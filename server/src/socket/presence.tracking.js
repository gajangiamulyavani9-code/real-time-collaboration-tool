// Presence tracking for Socket.IO
// Tracks which users are online and what documents they're viewing

const onlineUsers = new Map(); // userId -> { socketId, status, lastSeen }
const userDocuments = new Map(); // userId -> Set of documentIds

export const setupPresenceTracking = (io) => {
  
  // Periodic cleanup of stale connections (every 5 minutes)
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    onlineUsers.forEach((data, userId) => {
      if (now - data.lastSeen > staleThreshold) {
        onlineUsers.delete(userId);
        userDocuments.delete(userId);
      }
    });
  }, 5 * 60 * 1000);

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    
    // Update user presence
    onlineUsers.set(userId, {
      socketId: socket.id,
      status: 'online',
      lastSeen: Date.now()
    });

    // Initialize user's document set if not exists
    if (!userDocuments.has(userId)) {
      userDocuments.set(userId, new Set());
    }

    // Handle status updates
    socket.on('update-status', ({ status }) => {
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).status = status;
        onlineUsers.get(userId).lastSeen = Date.now();
        
        // Broadcast status change to relevant document rooms
        const docs = userDocuments.get(userId);
        if (docs) {
          docs.forEach(docId => {
            socket.to(`doc:${docId}`).emit('user-status-changed', {
              userId,
              status
            });
          });
        }
      }
    });

    // Track which documents user joins
    socket.on('join-document', ({ documentId }) => {
      const docs = userDocuments.get(userId);
      if (docs) {
        docs.add(documentId);
      }
      
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = Date.now();
      }
    });

    // Track when user leaves documents
    socket.on('leave-document', ({ documentId }) => {
      const docs = userDocuments.get(userId);
      if (docs) {
        docs.delete(documentId);
      }
    });

    // Update last seen on any activity
    socket.onAny(() => {
      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).lastSeen = Date.now();
      }
    });

    // Clean up on disconnect
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      userDocuments.delete(userId);
    });
  });
};

// Helper function to get online status of users
export const getUsersOnlineStatus = (userIds) => {
  return userIds.map(userId => ({
    userId,
    isOnline: onlineUsers.has(userId),
    status: onlineUsers.get(userId)?.status || 'offline'
  }));
};

// Helper function to check if user is online
export const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

// Get online users for a specific document
export const getDocumentOnlineUsers = (documentId) => {
  const onlineInDoc = [];
  
  userDocuments.forEach((docs, userId) => {
    if (docs.has(documentId) && onlineUsers.has(userId)) {
      onlineInDoc.push({
        userId,
        status: onlineUsers.get(userId).status
      });
    }
  });
  
  return onlineInDoc;
};
