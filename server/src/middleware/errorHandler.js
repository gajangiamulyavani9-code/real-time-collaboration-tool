// Custom error class for API errors
export class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Global error handling middleware
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  
  // Supabase errors
  if (err.code === 'PGRST116') {
    error = new ApiError(404, 'Resource not found');
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Token expired');
  }

  // Validation errors (Express Validator)
  if (err.statusCode === 400 && err.errors) {
    return res.status(400).json({
      success: false,
      status: 'fail',
      errors: err.errors
    });
  }

  // Default to 500 server error if status code not set
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  // Send response
  res.status(statusCode).json({
    success: false,
    status: error.status || 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler for specific resources
export const notFound = (resourceName = 'Resource') => {
  return (req, res, next) => {
    const error = new ApiError(404, `${resourceName} not found`);
    next(error);
  };
};
