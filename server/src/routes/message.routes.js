import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendMessageValidation } from '../middleware/validation.js';
import { 
  getMessages,
  sendMessage,
  deleteMessage,
  markAsRead
} from '../controllers/message.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/messages/:documentId
 * @desc    Get all messages for a document
 * @access  Private
 */
router.get('/:documentId', getMessages);

/**
 * @route   POST /api/messages
 * @desc    Send a message to document chat
 * @access  Private
 */
router.post('/', sendMessageValidation, sendMessage);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete a message
 * @access  Private (Sender or Owner)
 */
router.delete('/:messageId', deleteMessage);

/**
 * @route   POST /api/messages/:documentId/read
 * @desc    Mark messages as read
 * @access  Private
 */
router.post('/:documentId/read', markAsRead);

export { router as messageRouter };
