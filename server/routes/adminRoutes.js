const express = require('express');
const router = express.Router();
const { adminController } = require('../controllers');

/**
 * ============================================
 * ADMIN ROUTES
 * ============================================
 * 
 * All routes require admin authentication.
 * 
 * GET  /admin/users              - Get all users
 * GET  /admin/user/:id           - Get user details
 * PUT  /admin/user/:id           - Update user
 * DELETE /admin/user/:id         - Delete user
 * PUT  /admin/payment/update     - Update payment status
 * GET  /admin/overdue            - Get overdue users
 * GET  /admin/expiring           - Get expiring seats
 * POST /admin/seat/release       - Force release seat
 * POST /admin/seat/assign        - Assign seat to user
 * GET  /admin/stats              - Get dashboard stats

 */

// Get all users
router.get('/users', adminController.getAllUsers);

// Get dashboard stats
router.get('/stats', adminController.getDashboardStats);

// Get users with overdue payments
router.get('/overdue', adminController.getOverdueUsers);

// Get users with expiring seats
router.get('/expiring', adminController.getExpiringSeats);

// Get single user details
router.get('/user/:id', adminController.getUserDetails);

// Update user
router.put('/user/:id', adminController.updateUser);

// Delete user
router.delete('/user/:id', adminController.deleteUser);

// Update payment status
router.put('/payment/update', adminController.updatePaymentStatus);

// Force release seat
router.post('/seat/release', adminController.forceReleaseSeat);

// Assign seat to user
router.post('/seat/assign', adminController.assignSeat);



module.exports = router;
