const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');

/**
 * ============================================
 * AUTH ROUTES
 * ============================================
 * 
 * POST /auth/signup     - Register new user
 * POST /auth/login      - Login user
 * GET  /auth/user/:id   - Get user by Firebase UID
 * PUT  /auth/user/:id   - Update user profile
 */

// Register new user
router.post('/signup', authController.signup);

// Login user
router.post('/login', authController.login);

// Get user by Firebase UID
router.get('/user/:firebaseUid', authController.getUser);

// Update user profile
router.put('/user/:firebaseUid', authController.updateUser);

module.exports = router;
