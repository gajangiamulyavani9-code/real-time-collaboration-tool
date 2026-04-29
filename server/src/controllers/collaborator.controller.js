import { db, supabase } from '../config/supabase.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

// Get all collaborators for a document
export const getCollaborators = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;

  // Check if user has access to document
  const { data: document } = await db.documents.findById(documentId);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  const isOwner = document.owner_id === req.user.id;
  const collaborator = document.collaborators?.find(c => c.user_id === req.user.id);

  if (!isOwner && !collaborator) {
    throw new ApiError(403, 'Access denied');
  }

  const { data: collaborators, error } = await db.collaborators.findByDocument(documentId);

  if (error) {
    throw new ApiError(500, 'Failed to fetch collaborators');
  }

  // Format collaborators with user info
  const formattedCollaborators = collaborators?.map(c => ({
    user_id: c.user_id,
    role: c.role,
    user: c.user
  })) || [];

  // Add owner info
  const result = [
    {
      user_id: document.owner_id,
      role: 'owner',
      user: document.owner
    },
    ...formattedCollaborators
  ];

  res.status(200).json({
    success: true,
    data: { collaborators: result }
  });
});

// Add collaborator to document
export const addCollaborator = asyncHandler(async (req, res) => {
  const { id: documentId } = req.params;
  const { email, role } = req.body;

  // Only owner can add collaborators
  const { data: document } = await db.documents.findById(documentId);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  if (document.owner_id !== req.user.id) {
    throw new ApiError(403, 'Only the owner can add collaborators');
  }

  // Find user by email
  const { data: userToAdd, error: userError } = await db.users.findByEmail(email);
  
  if (userError || !userToAdd) {
    throw new ApiError(404, 'User not found with this email');
  }

  // Can't add owner as collaborator
  if (userToAdd.id === req.user.id) {
    throw new ApiError(400, 'You are already the owner of this document');
  }

  // Check if already a collaborator
  const { data: existingCollab } = await db.collaborators.findByUserAndDocument(
    userToAdd.id,
    documentId
  );

  if (existingCollab) {
    throw new ApiError(409, 'User is already a collaborator');
  }

  // Add collaborator
  const { data: collaborator, error } = await db.collaborators.add(
    documentId,
    userToAdd.id,
    role
  );

  if (error) {
    console.error('Error adding collaborator:', error);
    throw new ApiError(500, 'Failed to add collaborator');
  }

  // Notify the new collaborator via Socket.IO if they're online
  const io = req.app.locals.io;
  io.to(`user:${userToAdd.id}`).emit('added-to-document', {
    document: {
      id: document.id,
      title: document.title,
      share_id: document.share_id,
      owner: document.owner
    },
    role
  });

  res.status(201).json({
    success: true,
    message: 'Collaborator added successfully',
    data: {
      collaborator: {
        user_id: userToAdd.id,
        role,
        user: {
          id: userToAdd.id,
          name: userToAdd.name,
          email: userToAdd.email,
          avatar_url: userToAdd.avatar_url
        }
      }
    }
  });
});

// Update collaborator role
export const updateCollaboratorRole = asyncHandler(async (req, res) => {
  const { id: documentId, userId } = req.params;
  const { role } = req.body;

  // Only owner can update roles
  const { data: document } = await db.documents.findById(documentId);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  if (document.owner_id !== req.user.id) {
    throw new ApiError(403, 'Only the owner can update roles');
  }

  // Can't change owner's role
  if (userId === document.owner_id) {
    throw new ApiError(400, 'Cannot change owner role');
  }

  const { data: updatedCollab, error } = await db.collaborators.updateRole(
    documentId,
    userId,
    role
  );

  if (error) {
    throw new ApiError(500, 'Failed to update role');
  }

  // Notify the user about role change
  const io = req.app.locals.io;
  io.to(`user:${userId}`).emit('role-updated', {
    documentId,
    role
  });

  res.status(200).json({
    success: true,
    message: 'Role updated successfully',
    data: { collaborator: updatedCollab }
  });
});

// Remove collaborator from document
export const removeCollaborator = asyncHandler(async (req, res) => {
  const { id: documentId, userId } = req.params;

  // Only owner can remove collaborators
  const { data: document } = await db.documents.findById(documentId);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  if (document.owner_id !== req.user.id) {
    throw new ApiError(403, 'Only the owner can remove collaborators');
  }

  // Can't remove owner
  if (userId === document.owner_id) {
    throw new ApiError(400, 'Cannot remove owner');
  }

  const { error } = await db.collaborators.remove(documentId, userId);

  if (error) {
    throw new ApiError(500, 'Failed to remove collaborator');
  }

  // Notify the removed user
  const io = req.app.locals.io;
  io.to(`user:${userId}`).emit('removed-from-document', { documentId });

  // Also notify anyone in the document room
  io.to(`doc:${documentId}`).emit('collaborator-removed', { userId });

  res.status(200).json({
    success: true,
    message: 'Collaborator removed successfully'
  });
});

// Join document via share link
export const joinViaShareLink = asyncHandler(async (req, res) => {
  const { shareId } = req.params;

  // Find document by share ID
  const { data: document, error: docError } = await db.documents.searchByShareId(shareId);

  if (docError || !document) {
    throw new ApiError(404, 'Invalid share link');
  }

  // Check if already has access
  if (document.owner_id === req.user.id) {
    return res.status(200).json({
      success: true,
      message: 'You are the owner of this document',
      data: { 
        document: { id: document.id },
        role: 'owner'
      }
    });
  }

  const { data: existingCollab } = await db.collaborators.findByUserAndDocument(
    req.user.id,
    document.id
  );

  if (existingCollab) {
    if (existingCollab.role !== 'editor') {
      await db.collaborators.updateRole(document.id, req.user.id, 'editor');
    }

    return res.status(200).json({
      success: true,
      message: 'You already have edit access to this document',
      data: { 
        document: { id: document.id },
        role: 'editor'
      }
    });
  }

  // Share links grant edit access so both sender and recipient can write.
  const { data: collaborator, error } = await db.collaborators.add(
    document.id,
    req.user.id,
    'editor'
  );

  if (error) {
    throw new ApiError(500, 'Failed to join document');
  }

  res.status(200).json({
    success: true,
    message: 'Successfully joined document',
    data: { 
      document: { id: document.id },
      role: 'editor'
    }
  });
});
