import { v4 as uuidv4 } from 'uuid';
import { db, supabase } from '../config/supabase.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

// Generate a unique share ID (8 characters, alphanumeric)
const generateShareId = () => {
  return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
};

// Get all documents for current user (owned + collaborated)
export const getDocuments = asyncHandler(async (req, res) => {
  const { data: documents, error } = await db.documents.findAllByUser(req.user.id);

  if (error) {
    console.error('Error fetching documents:', error);
    throw new ApiError(500, 'Failed to fetch documents');
  }

  // Transform data to include user's role for each document
  const transformedDocs = documents?.map(doc => {
    const isOwner = doc.owner_id === req.user.id;
    const collaborator = doc.collaborators?.find(c => c.user_id === req.user.id);
    
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      share_id: doc.share_id,
      owner: doc.owner,
      role: isOwner ? 'owner' : collaborator?.role || 'viewer',
      is_owner: isOwner,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      collaborator_count: doc.collaborators?.length || 0
    };
  }) || [];

  res.status(200).json({
    success: true,
    data: { documents: transformedDocs }
  });
});

// Get single document by ID
export const getDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const { data: document, error } = await db.documents.findById(id);

  if (error || !document) {
    throw new ApiError(404, 'Document not found');
  }

  // Check access permissions
  const isOwner = document.owner_id === req.user.id;
  const collaborator = document.collaborators?.find(c => c.user_id === req.user.id);

  if (!isOwner && !collaborator) {
    throw new ApiError(403, 'Access denied');
  }

  const userRole = isOwner ? 'owner' : collaborator.role;

  res.status(200).json({
    success: true,
    data: {
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        share_id: document.share_id,
        owner: document.owner,
        collaborators: document.collaborators,
        role: userRole,
        is_owner: isOwner,
        created_at: document.created_at,
        updated_at: document.updated_at
      }
    }
  });
});

// Create new document
export const createDocument = asyncHandler(async (req, res) => {
  const { title, content = '' } = req.body;

  const shareId = generateShareId();

  const { data: document, error } = await db.documents.create({
    title: title.trim(),
    content,
    owner_id: req.user.id,
    share_id: shareId
  });

  if (error) {
    console.error('Error creating document:', error);
    throw new ApiError(500, 'Failed to create document');
  }

  res.status(201).json({
    success: true,
    message: 'Document created successfully',
    data: {
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        share_id: document.share_id,
        owner: document.owner,
        role: 'owner',
        is_owner: true,
        created_at: document.created_at,
        updated_at: document.updated_at
      }
    }
  });
});

// Update document
export const updateDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;

  // Get existing document to check permissions
  const { data: existingDoc } = await db.documents.findById(id);
  
  if (!existingDoc) {
    throw new ApiError(404, 'Document not found');
  }

  const isOwner = existingDoc.owner_id === req.user.id;
  const collaborator = existingDoc.collaborators?.find(c => c.user_id === req.user.id);

  // Only owners and editors can update content
  if (!isOwner && (!collaborator || collaborator.role === 'viewer')) {
    throw new ApiError(403, 'You do not have permission to edit this document');
  }

  const updates = {};
  if (title !== undefined) updates.title = title.trim();
  if (content !== undefined) updates.content = content;

  const { data: document, error } = await db.documents.update(id, updates);

  if (error) {
    console.error('Error updating document:', error);
    throw new ApiError(500, 'Failed to update document');
  }

  // Broadcast update to other connected users via Socket.IO
  const io = req.app.locals.io;
  io.to(`doc:${id}`).emit('document-updated', {
    document: {
      id: document.id,
      title: document.title,
      content: document.content,
      updated_at: document.updated_at
    },
    updatedBy: req.user.id
  });

  // Create version snapshot if content changed
  if (content !== undefined && content !== existingDoc.content) {
    await db.versions.create({
      document_id: id,
      content: content,
      user_id: req.user.id,
      change_summary: `Updated by ${req.user.name}`
    });
  }

  res.status(200).json({
    success: true,
    message: 'Document updated successfully',
    data: {
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        share_id: document.share_id,
        updated_at: document.updated_at
      }
    }
  });
});

// Delete document
export const deleteDocument = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get document to check ownership
  const { data: document } = await db.documents.findById(id);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  // Only owner can delete
  if (document.owner_id !== req.user.id) {
    throw new ApiError(403, 'Only the owner can delete this document');
  }

  const { error } = await db.documents.delete(id);

  if (error) {
    console.error('Error deleting document:', error);
    throw new ApiError(500, 'Failed to delete document');
  }

  // Notify connected users that document is deleted
  const io = req.app.locals.io;
  io.to(`doc:${id}`).emit('document-deleted', { documentId: id });

  res.status(200).json({
    success: true,
    message: 'Document deleted successfully'
  });
});

// Get document by share ID (for joining via share link)
export const getDocumentByShareId = asyncHandler(async (req, res) => {
  const { shareId } = req.params;

  const { data: document, error } = await db.documents.searchByShareId(shareId);

  if (error || !document) {
    throw new ApiError(404, 'Document not found');
  }

  // Check if current user has access
  const isOwner = document.owner_id === req.user?.id;
  const collaborator = document.collaborators?.find(c => c.user_id === req.user?.id);

  const userRole = isOwner ? 'owner' : collaborator?.role;

  res.status(200).json({
    success: true,
    data: {
      document: {
        id: document.id,
        title: document.title,
        share_id: document.share_id,
        owner: document.owner,
        role: userRole || null,
        is_owner: isOwner,
        has_access: !!userRole
      }
    }
  });
});

// Regenerate share ID
export const regenerateShareId = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: document } = await db.documents.findById(id);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  if (document.owner_id !== req.user.id) {
    throw new ApiError(403, 'Only the owner can regenerate share link');
  }

  const newShareId = generateShareId();

  const { data: updatedDoc, error } = await supabase
    .from('documents')
    .update({ share_id: newShareId })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new ApiError(500, 'Failed to regenerate share link');
  }

  res.status(200).json({
    success: true,
    message: 'Share link regenerated',
    data: { share_id: updatedDoc.share_id }
  });
});

// Get document version history
export const getDocumentVersions = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check access
  const { data: document } = await db.documents.findById(id);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  const isOwner = document.owner_id === req.user.id;
  const collaborator = document.collaborators?.find(c => c.user_id === req.user.id);

  if (!isOwner && !collaborator) {
    throw new ApiError(403, 'Access denied');
  }

  const { data: versions, error } = await db.versions.findByDocument(id);

  if (error) {
    throw new ApiError(500, 'Failed to fetch versions');
  }

  res.status(200).json({
    success: true,
    data: { versions: versions || [] }
  });
});
