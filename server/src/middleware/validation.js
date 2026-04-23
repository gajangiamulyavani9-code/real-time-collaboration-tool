import { body, param, validationResult } from 'express-validator';
import { ApiError } from './errorHandler.js';

// Handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg
    }));
    
    const error = new ApiError(400, 'Validation failed');
    error.errors = formattedErrors;
    return next(error);
  }
  next();
};

// Auth validations
export const registerValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  handleValidationErrors
];

export const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Document validations
export const createDocumentValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string'),
  handleValidationErrors
];

export const updateDocumentValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid document ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('content')
    .optional()
    .isString()
    .withMessage('Content must be a string'),
  handleValidationErrors
];

export const documentIdValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid document ID'),
  handleValidationErrors
];

// Collaborator validations
export const addCollaboratorValidation = [
  param('id')
    .isUUID()
    .withMessage('Invalid document ID'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('role')
    .isIn(['viewer', 'editor'])
    .withMessage('Role must be either viewer or editor'),
  handleValidationErrors
];

// Message validations
export const sendMessageValidation = [
  body('documentId')
    .isUUID()
    .withMessage('Invalid document ID'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),
  handleValidationErrors
];

// Utility to validate share ID
export const shareIdValidation = [
  param('shareId')
    .isLength({ min: 8, max: 12 })
    .isAlphanumeric()
    .withMessage('Invalid share ID'),
  handleValidationErrors
];
