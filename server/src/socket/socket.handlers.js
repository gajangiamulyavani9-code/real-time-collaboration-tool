import { socketAuth } from '../middleware/auth.js';
import { db, supabase } from '../config/supabase.js';
import { debounce } from '../utils/debounce.js';

// Map to store document content for efficient broadcasting
const documentContentMap = new Map();

// Map to track active users and their cursor positions
const activeUsersMap = new Map();

// Debounced save function for auto-save
const debouncedSaveMap = new Map();

export const setupSocketHandlers = (io) => {
  // Apply authentication middleware
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.user.name} (${socket.user.id})`);

    // Store user's socket for direct messaging
    socket.join(`user:${socket.user.id}`);

    // ============================================================================
    // DOCUMENT ROOM MANAGEMENT
    // ============================================================================

    /**
     * Join a document room for real-time collaboration
     * Event: 'join-document'
     * Data: { documentId: string }
     */
    socket.on('join-document', async ({ documentId }) => {
      try {
        // Verify user has access to document
        const { data: document } = await db.documents.findById(documentId);
        
        if (!document) {
          socket.emit('error', { message: 'Document not found' });
          return;
        }

        const isOwner = document.owner_id === socket.user.id;
        const collaborator = document.collaborators?.find(c => c.user_id === socket.user.id);

        if (!isOwner && !collaborator) {
          socket.emit('error', { message: 'Access denied to this document' });
          return;
        }

        const userRole = isOwner ? 'owner' : collaborator.role;

        // Join the document room
        const roomName = `doc:${documentId}`;
        await socket.join(roomName);

        // Store user info for this document
        if (!activeUsersMap.has(documentId)) {
          activeUsersMap.set(documentId, new Map());
        }

        const docUsers = activeUsersMap.get(documentId);
        docUsers.set(socket.user.id, {
          socketId: socket.id,
          user: {
            id: socket.user.id,
            name: socket.user.name,
            email: socket.user.email
          },
          role: userRole,
          cursor: null,
          color: getUserColor(socket.user.id)
        });

        // Send current document content
        socket.emit('document-joined', {
          document: {
            id: document.id,
            title: document.title,
            content: document.content,
            share_id: document.share_id
          },
          role: userRole
        });

        // Notify all users in room about new user
        socket.to(roomName).emit('user-joined', {
          user: {
            id: socket.user.id,
            name: socket.user.name
          },
          role: userRole,
          color: getUserColor(socket.user.id)
        });

        // Send active users list to the joining user
        const activeUsers = Array.from(docUsers.values()).map(u => ({
          id: u.user.id,
          name: u.user.name,
          role: u.role,
          color: u.color,
          cursor: u.cursor
        }));

        socket.emit('active-users', { users: activeUsers });

        console.log(`👤 ${socket.user.name} joined document: ${documentId}`);

      } catch (error) {
        console.error('Error joining document:', error);
        socket.emit('error', { message: 'Failed to join document' });
      }
    });

    /**
     * Leave a document room
     * Event: 'leave-document'
     * Data: { documentId: string }
     */
    socket.on('leave-document', async ({ documentId }) => {
      await handleUserLeave(socket, documentId);
    });

    // ============================================================================
    // REAL-TIME DOCUMENT EDITING
    // ============================================================================

    /**
     * Handle document content changes
     * Event: 'document-change'
     * Data: { documentId: string, content: string, operation: object }
     */
    socket.on('document-change', async ({ documentId, content, operation }) => {
      try {
        const roomName = `doc:${documentId}`;
        
        // Check if user is in the room
        if (!socket.rooms.has(roomName)) {
          socket.emit('error', { message: 'Not joined to this document' });
          return;
        }

        // Check user role - viewers cannot edit
        const docUsers = activeUsersMap.get(documentId);
        const userData = docUsers?.get(socket.user.id);
        
        if (userData?.role === 'viewer') {
          socket.emit('error', { message: 'Viewers cannot edit documents' });
          return;
        }

        // Broadcast change to other users in room (excluding sender)
        socket.to(roomName).emit('content-changed', {
          content,
          operation,
          userId: socket.user.id,
          userName: socket.user.name,
          timestamp: Date.now()
        });

        // Debounced auto-save to database
        const debouncedSave = getDebouncedSave(documentId);
        debouncedSave(documentId, content, socket.user.id);

      } catch (error) {
        console.error('Error handling document change:', error);
        socket.emit('error', { message: 'Failed to process change' });
      }
    });

    /**
     * Handle explicit save request
     * Event: 'save-document'
     * Data: { documentId: string, content: string }
     */
    socket.on('save-document', async ({ documentId, content }) => {
      try {
        await saveDocumentContent(documentId, content, socket.user.id);
        
        // Confirm save to sender
        socket.emit('document-saved', { 
          documentId, 
          timestamp: new Date().toISOString() 
        });

        // Notify others that document was saved
        socket.to(`doc:${documentId}`).emit('document-saved-by-other', {
          userId: socket.user.id,
          userName: socket.user.name,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error saving document:', error);
        socket.emit('error', { message: 'Failed to save document' });
      }
    });

    // ============================================================================
    // CURSOR TRACKING
    // ============================================================================

    /**
     * Handle cursor position updates
     * Event: 'cursor-move'
     * Data: { documentId: string, cursor: { x: number, y: number, selection?: object } }
     */
    socket.on('cursor-move', ({ documentId, cursor }) => {
      const roomName = `doc:${documentId}`;
      
      if (!socket.rooms.has(roomName)) return;

      // Update cursor position in active users map
      const docUsers = activeUsersMap.get(documentId);
      if (docUsers && docUsers.has(socket.user.id)) {
        docUsers.get(socket.user.id).cursor = cursor;
      }

      // Broadcast cursor position to other users
      socket.to(roomName).emit('cursor-update', {
        userId: socket.user.id,
        userName: socket.user.name,
        cursor,
        color: getUserColor(socket.user.id)
      });
    });

    // ============================================================================
    // CHAT MESSAGES
    // ============================================================================

    /**
     * Handle chat messages
     * Event: 'send-message'
     * Data: { documentId: string, content: string }
     */
    socket.on('send-message', async ({ documentId, content }) => {
      try {
        const roomName = `doc:${documentId}`;
        
        if (!socket.rooms.has(roomName)) {
          socket.emit('error', { message: 'Not joined to this document' });
          return;
        }

        // Save message to database
        const { data: message, error } = await db.messages.create({
          document_id: documentId,
          sender_id: socket.user.id,
          content: content.trim()
        });

        if (error) {
          throw error;
        }

        // Broadcast to all users in room (including sender for consistency)
        const messageData = {
          id: message.id,
          content: message.content,
          sender: {
            id: socket.user.id,
            name: socket.user.name,
            email: socket.user.email
          },
          created_at: message.created_at
        };

        io.to(roomName).emit('new-message', { message: messageData });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ============================================================================
    // USER PRESENCE
    // ============================================================================

    /**
     * Handle user typing indicator
     * Event: 'typing'
     * Data: { documentId: string, isTyping: boolean }
     */
    socket.on('typing', ({ documentId, isTyping }) => {
      const roomName = `doc:${documentId}`;
      
      if (!socket.rooms.has(roomName)) return;

      socket.to(roomName).emit('user-typing', {
        userId: socket.user.id,
        userName: socket.user.name,
        isTyping
      });
    });

    // ============================================================================
    // DISCONNECT HANDLING
    // ============================================================================

    socket.on('disconnect', (reason) => {
      console.log(`❌ User disconnected: ${socket.user.name} (${reason})`);
      
      // Clean up from all document rooms
      activeUsersMap.forEach((docUsers, documentId) => {
        if (docUsers.has(socket.user.id)) {
          handleUserLeave(socket, documentId, false);
        }
      });
    });
  });
};

// Helper function to handle user leaving a document
async function handleUserLeave(socket, documentId, notifyOthers = true) {
  const roomName = `doc:${documentId}`;
  
  await socket.leave(roomName);

  // Remove from active users
  const docUsers = activeUsersMap.get(documentId);
  if (docUsers) {
    docUsers.delete(socket.user.id);
    
    // Clean up empty document entries
    if (docUsers.size === 0) {
      activeUsersMap.delete(documentId);
      // Clean up debounced save
      debouncedSaveMap.delete(documentId);
    }
  }

  if (notifyOthers) {
    socket.to(roomName).emit('user-left', {
      userId: socket.user.id,
      userName: socket.user.name
    });
  }

  console.log(`👋 ${socket.user.name} left document: ${documentId}`);
}

// Get or create debounced save function for a document
function getDebouncedSave(documentId) {
  if (!debouncedSaveMap.has(documentId)) {
    const debouncedFn = debounce(async (docId, content, userId) => {
      await saveDocumentContent(docId, content, userId);
    }, 2000); // Auto-save 2 seconds after last change
    
    debouncedSaveMap.set(documentId, debouncedFn);
  }
  
  return debouncedSaveMap.get(documentId);
}

// Save document content to database
async function saveDocumentContent(documentId, content, userId) {
  try {
    // Update document in database
    const { data, error } = await db.documents.update(documentId, { content });

    if (error) {
      console.error('Error auto-saving document:', error);
      return;
    }

    // Create version snapshot
    await db.versions.create({
      document_id: documentId,
      content: content,
      user_id: userId,
      change_summary: 'Auto-saved'
    });

    console.log(`💾 Auto-saved document: ${documentId}`);
    
  } catch (error) {
    console.error('Error in saveDocumentContent:', error);
  }
}

// Generate consistent color for user based on their ID
function getUserColor(userId) {
  const colors = [
    '#EF4444', // red-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#6366F1', // indigo-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#14B8A6', // teal-500
    '#F97316', // orange-500
    '#84CC16'  // lime-500
  ];
  
  // Generate hash from user ID
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return colors[Math.abs(hash) % colors.length];
}
