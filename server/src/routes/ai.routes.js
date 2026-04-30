import { Router } from 'express';
import { body } from 'express-validator';
import { assistWithDocument } from '../controllers/ai.controller.js';
import { handleValidationErrors } from '../middleware/validation.js';

const router = Router();

router.post(
  '/assist',
  [
    body('documentId').isUUID().withMessage('Invalid document ID'),
    body('prompt').optional().isString().isLength({ max: 2000 }).withMessage('Prompt must be under 2000 characters'),
    body('mode').optional().isIn(['ask', 'summarize', 'improve', 'actions']).withMessage('Invalid AI mode'),
    body('messages').optional().isArray({ max: 20 }).withMessage('Messages must be a short array'),
    handleValidationErrors,
  ],
  assistWithDocument
);

export { router as aiRouter };
