import jwt from 'jsonwebtoken';
import { ApiError, asyncHandler } from './errorHandler.js';
import { db, supabase } from '../config/supabase.js';

// Verify JWT token and attach user to request
export const authenticate = asyncHandler(async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Access token is required');
  }

  const token = authHeader.substring(7);

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist
    const { data: user, error } = await db.users.findById(decoded.userId);
    
    if (error || !user) {
      throw new ApiError(401, 'User not found or token is invalid');
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token expired');
    }
    throw error;
  }
});

// Optional authentication - doesn't throw error if no token
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await db.users.findById(decoded.userId);
    
    if (!error && user) {
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name
      };
    }
  } catch (error) {
    // Silently fail for optional auth
    req.user = null;
  }

  next();
});

// Check if user is document owner or has specific role
export const checkDocumentAccess = (allowedRoles = ['owner', 'editor', 'viewer']) => {
  return asyncHandler(async (req, res, next) => {
    const { id: documentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(401, 'Authentication required');
    }

    // Get document
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error || !document) {
      throw new ApiError(404, 'Document not found');
    }

    // Check if user is owner
    if (document.owner_id === userId) {
      req.document = document;
      req.userRole = 'owner';
      return next();
    }

    // Check collaborator access
    const { data: collaborator } = await db.collaborators.findByUserAndDocument(
      userId,
      documentId
    );

    if (collaborator && allowedRoles.includes(collaborator.role)) {
      req.document = document;
      req.userRole = collaborator.role;
      return next();
    }

    throw new ApiError(403, 'Access denied');
  });
};

// Socket.IO authentication middleware
export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user, error } = await db.users.findById(decoded.userId);

    if (error || !user) {
      return next(new Error('User not found'));
    }

    // Attach user to socket
    socket.user = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    return next(new Error('Invalid token'));
  }
};
