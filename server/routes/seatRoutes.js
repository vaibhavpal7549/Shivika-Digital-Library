const express = require('express');
const router = express.Router();
const { seatController } = require('../controllers');

/**
 * ============================================
 * SEAT ROUTES
 * ============================================
 * 
 * GET  /seat/all              - Get all seats
 * GET  /seat/available        - Get available seats
 * GET  /seat/:seatNumber      - Get seat details
 * GET  /seat/user/:firebaseUid - Get user's seat
 * GET  /seat/expiring         - Get expiring seats
 * POST /seat/book             - Book a seat
 * POST /seat/release          - Release a seat
 * POST /seat/change           - Change seat
 */

// Get all seats
router.get('/all', seatController.getAllSeats);

// Get available seats
router.get('/available', seatController.getAvailableSeats);

// Get expiring seats
router.get('/expiring', seatController.getExpiringSeats);

// Get user's seat
router.get('/user/:firebaseUid', seatController.getUserSeat);

// Get specific seat
router.get('/:seatNumber', seatController.getSeat);

// Book a seat
router.post('/book', seatController.bookSeat);

// Release a seat
router.post('/release', seatController.releaseSeat);

// Change seat
router.post('/change', seatController.changeSeat);

module.exports = router;
