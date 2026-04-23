import { db, supabase } from '../config/supabase.js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

// Get messages for a document
export const getMessages = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  // Check access to document
  const { data: document } = await db.documents.findById(documentId);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  const isOwner = document.owner_id === req.user.id;
  const collaborator = document.collaborators?.find(c => c.user_id === req.user.id);

  if (!isOwner && !collaborator) {
    throw new ApiError(403, 'Access denied');
  }

  const { data: messages, error } = await db.messages.findByDocument(documentId);

  if (error) {
    throw new ApiError(500, 'Failed to fetch messages');
  }

  res.status(200).json({
    success: true,
    data: { messages: messages || [] }
  });
});

// Send message (HTTP endpoint - also used by Socket.IO)
export const sendMessage = asyncHandler(async (req, res) => {
  const { documentId, content } = req.body;

  // Check access to document
  const { data: document } = await db.documents.findById(documentId);
  
  if (!document) {
    throw new ApiError(404, 'Document not found');
  }

  const isOwner = document.owner_id === req.user.id;
  const collaborator = document.collaborators?.find(c => c.user_id === req.user.id);

  if (!isOwner && !collaborator) {
    throw new ApiError(403, 'Access denied');
  }

  const { data: message, error } = await db.messages.create({
    document_id: documentId,
    sender_id: req.user.id,
    content: content.trim()
  });

  if (error) {
    throw new ApiError(500, 'Failed to send message');
  }

  // Broadcast to all users in the document room
  const io = req.app.locals.io;
  io.to(`doc:${documentId}`).emit('new-message', {
    message: {
      id: message.id,
      content: message.content,
      sender: message.sender,
      created_at: message.created_at
    }
  });

  res.status(201).json({
    success: true,
    message: 'Message sent',
    data: { message }
  });
});

// Delete a message (only sender or owner can delete)
export const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  // Get the message
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select('*, document:document_id(owner_id)')
    .eq('id', messageId)
    .single();

  if (msgError || !message) {
    throw new ApiError(404, 'Message not found');
  }

  // Only sender or document owner can delete
  if (message.sender_id !== req.user.id && message.document.owner_id !== req.user.id) {
    throw new ApiError(403, 'You can only delete your own messages');
  }

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    throw new ApiError(500, 'Failed to delete message');
  }

  // Notify users in the document room
  const io = req.app.locals.io;
  io.to(`doc:${message.document_id}`).emit('message-deleted', { messageId });

  res.status(200).json({
    success: true,
    message: 'Message deleted'
  });
});

// Mark messages as read (optional feature)
export const markAsRead = asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  // This could be used to track unread messages
  // For now, just acknowledge
  res.status(200).json({
    success: true,
    message: 'Messages marked as read'
  });
});
