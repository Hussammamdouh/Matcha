const { getFirestore } = require('../../../lib/firebase');
const { createRequestLogger } = require('../../lib/logger');

/**
 * Get all IT tickets for user banning
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getITTickets(req, res) {
  const logger = createRequestLogger(req.id);
  
  try {
    const db = getFirestore();
    
    const ticketsSnapshot = await db
      .collection('it_tickets')
      .where('status', '==', 'open')
      .orderBy('createdAt', 'desc')
      .get();
    
    const tickets = [];
    for (const doc of ticketsSnapshot.docs) {
      const ticket = { id: doc.id, ...doc.data() };
      
      // Get user details
      const userDoc = await db.collection('users').doc(ticket.userId).get();
      if (userDoc.exists) {
        ticket.userDetails = userDoc.data();
      }
      
      tickets.push(ticket);
    }
    
    logger.info('Retrieved IT tickets', { count: tickets.length });
    
    return res.status(200).json({
      ok: true,
      data: { tickets },
      count: tickets.length
    });
  } catch (error) {
    logger.error('Failed to get IT tickets', { error: error.message });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'IT_TICKETS_FETCH_FAILED',
        message: 'Failed to fetch IT tickets'
      }
    });
  }
}

/**
 * Ban user IP and close IT ticket
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function banUserIP(req, res) {
  const logger = createRequestLogger(req.id);
  const { ticketId } = req.params;
  const { ipAddress, itNotes } = req.body;
  
  try {
    const db = getFirestore();
    
    // Get the ticket document
    const ticketDoc = await db.collection('it_tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'IT ticket not found'
        }
      });
    }
    
    const ticket = ticketDoc.data();
    if (ticket.status !== 'open') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'TICKET_ALREADY_PROCESSED',
          message: 'Ticket has already been processed'
        }
      });
    }
    
    const userId = ticket.userId;
    
    // Get user's IP address if not provided
    let finalIPAddress = ipAddress;
    if (!finalIPAddress && ticket.userDetails) {
      // In a real implementation, you would get this from user login logs
      finalIPAddress = ticket.userDetails.lastLoginIP || 'unknown';
    }
    
    // Create IP ban record
    await db.collection('banned_ips').add({
      ipAddress: finalIPAddress,
      userId,
      reason: ticket.reason,
      ticketId,
      bannedAt: new Date(),
      bannedBy: req.user?.uid || 'system',
      itNotes: itNotes || 'Banned by IT team'
    });
    
    // Update user status
    await db.collection('users').doc(userId).update({
      status: 'banned',
      banReason: ticket.reason,
      bannedAt: new Date(),
      bannedIP: finalIPAddress,
      updatedAt: new Date()
    });
    
    // Close the ticket
    await db.collection('it_tickets').doc(ticketId).update({
      status: 'closed',
      closedAt: new Date(),
      itNotes: itNotes || 'IP banned by IT team',
      closedBy: req.user?.uid || 'system'
    });
    
    logger.warn('User IP banned by IT team', { 
      userId, 
      ticketId, 
      ipAddress: finalIPAddress, 
      reason: ticket.reason 
    });
    
    return res.status(200).json({
      ok: true,
      data: {
        message: 'User IP banned successfully',
        userId,
        ticketId,
        ipAddress: finalIPAddress
      }
    });
  } catch (error) {
    logger.error('Failed to ban user IP', { error: error.message, ticketId });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'IP_BAN_FAILED',
        message: 'Failed to ban user IP'
      }
    });
  }
}

/**
 * Dismiss IT ticket without action
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function dismissTicket(req, res) {
  const logger = createRequestLogger(req.id);
  const { ticketId } = req.params;
  const { itNotes } = req.body;
  
  try {
    const db = getFirestore();
    
    // Get the ticket document
    const ticketDoc = await db.collection('it_tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'TICKET_NOT_FOUND',
          message: 'IT ticket not found'
        }
      });
    }
    
    const ticket = ticketDoc.data();
    if (ticket.status !== 'open') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'TICKET_ALREADY_PROCESSED',
          message: 'Ticket has already been processed'
        }
      });
    }
    
    // Close the ticket without action
    await db.collection('it_tickets').doc(ticketId).update({
      status: 'dismissed',
      closedAt: new Date(),
      itNotes: itNotes || 'Ticket dismissed by IT team',
      closedBy: req.user?.uid || 'system'
    });
    
    logger.info('IT ticket dismissed', { ticketId, reason: ticket.reason });
    
    return res.status(200).json({
      ok: true,
      data: {
        message: 'Ticket dismissed successfully',
        ticketId
      }
    });
  } catch (error) {
    logger.error('Failed to dismiss ticket', { error: error.message, ticketId });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'TICKET_DISMISSAL_FAILED',
        message: 'Failed to dismiss ticket'
      }
    });
  }
}

/**
 * Get IT dashboard statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getITStats(req, res) {
  const logger = createRequestLogger(req.id);
  
  try {
    const db = getFirestore();
    
    // Get counts for different ticket statuses
    const [openSnapshot, closedSnapshot, dismissedSnapshot] = await Promise.all([
      db.collection('it_tickets').where('status', '==', 'open').get(),
      db.collection('it_tickets').where('status', '==', 'closed').get(),
      db.collection('it_tickets').where('status', '==', 'dismissed').get()
    ]);
    
    // Get banned IPs count
    const bannedIPsSnapshot = await db.collection('banned_ips').get();
    
    const stats = {
      openTickets: openSnapshot.size,
      closedTickets: closedSnapshot.size,
      dismissedTickets: dismissedSnapshot.size,
      totalTickets: openSnapshot.size + closedSnapshot.size + dismissedSnapshot.size,
      bannedIPs: bannedIPsSnapshot.size
    };
    
    logger.info('Retrieved IT statistics', stats);
    
    return res.status(200).json({
      ok: true,
      data: { stats }
    });
  } catch (error) {
    logger.error('Failed to get IT stats', { error: error.message });
    return res.status(500).json({
      ok: false,
      error: {
        code: 'IT_STATS_FETCH_FAILED',
        message: 'Failed to fetch IT statistics'
      }
    });
  }
}

module.exports = {
  getITTickets,
  banUserIP,
  dismissTicket,
  getITStats
};


