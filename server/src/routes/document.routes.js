import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { 
  createDocumentValidation,
  updateDocumentValidation,
  documentIdValidation,
  shareIdValidation
} from '../middleware/validation.js';
import { 
  getDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  getDocumentByShareId,
  regenerateShareId,
  getDocumentVersions
} from '../controllers/document.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/documents
 * @desc    Get all documents for current user
 * @access  Private
 */
router.get('/', getDocuments);

/**
 * @route   POST /api/documents
 * @desc    Create a new document
 * @access  Private
 */
router.post('/', createDocumentValidation, createDocument);

/**
 * @route   GET /api/documents/share/:shareId
 * @desc    Get document by share ID
 * @access  Private
 */
router.get('/share/:shareId', shareIdValidation, getDocumentByShareId);

/**
 * @route   GET /api/documents/:id
 * @desc    Get single document by ID
 * @access  Private
 */
router.get('/:id', documentIdValidation, getDocument);

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document (title/content)
 * @access  Private
 */
router.put('/:id', updateDocumentValidation, updateDocument);

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete document
 * @access  Private (Owner only)
 */
router.delete('/:id', documentIdValidation, deleteDocument);

/**
 * @route   POST /api/documents/:id/regenerate-share
 * @desc    Regenerate share ID for document
 * @access  Private (Owner only)
 */
router.post('/:id/regenerate-share', documentIdValidation, regenerateShareId);

/**
 * @route   GET /api/documents/:id/versions
 * @desc    Get document version history
 * @access  Private
 */
router.get('/:id/versions', documentIdValidation, getDocumentVersions);

export { router as documentRouter };
