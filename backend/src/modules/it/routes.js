const express = require('express');
const { body, param } = require('express-validator');
const { authenticateToken } = require('../../middlewares/auth');
const { requireRole } = require('../../middlewares/rbac');
const { asyncHandler } = require('../../middlewares/error');
const itController = require('./controller');

const router = express.Router();

// All IT routes require authentication and IT role
router.use(authenticateToken);
router.use(requireRole('it'));

// Get all IT tickets
router.get('/tickets', asyncHandler(itController.getITTickets));

// Ban user IP and close ticket
router.post(
  '/tickets/:ticketId/ban',
  [
    param('ticketId').isString().notEmpty().withMessage('Ticket ID is required'),
    body('ipAddress').optional().isString().withMessage('IP address must be a string'),
    body('itNotes').optional().isString().withMessage('IT notes must be a string')
  ],
  asyncHandler(itController.banUserIP)
);

// Dismiss IT ticket without action
router.post(
  '/tickets/:ticketId/dismiss',
  [
    param('ticketId').isString().notEmpty().withMessage('Ticket ID is required'),
    body('itNotes').optional().isString().withMessage('IT notes must be a string')
  ],
  asyncHandler(itController.dismissTicket)
);

// Get IT dashboard statistics
router.get('/stats', asyncHandler(itController.getITStats));

module.exports = router;
