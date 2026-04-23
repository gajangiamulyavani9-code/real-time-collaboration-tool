import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { 
  documentIdValidation,
  addCollaboratorValidation
} from '../middleware/validation.js';
import { 
  getCollaborators,
  addCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
  joinViaShareLink
} from '../controllers/collaborator.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/documents/:id/collaborators
 * @desc    Get all collaborators for a document
 * @access  Private
 */
router.get('/:id/collaborators', documentIdValidation, getCollaborators);

/**
 * @route   POST /api/documents/:id/collaborators
 * @desc    Add a collaborator to document
 * @access  Private (Owner only)
 */
router.post('/:id/collaborators', addCollaboratorValidation, addCollaborator);

/**
 * @route   PUT /api/documents/:id/collaborators/:userId
 * @desc    Update collaborator role
 * @access  Private (Owner only)
 */
router.put('/:id/collaborators/:userId', documentIdValidation, updateCollaboratorRole);

/**
 * @route   DELETE /api/documents/:id/collaborators/:userId
 * @desc    Remove collaborator from document
 * @access  Private (Owner only)
 */
router.delete('/:id/collaborators/:userId', documentIdValidation, removeCollaborator);

/**
 * @route   POST /api/documents/join/:shareId
 * @desc    Join document via share link
 * @access  Private
 */
router.post('/join/:shareId', joinViaShareLink);

export { router as collaboratorRouter };
