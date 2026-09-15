const express = require("express");
const router = express.Router();
const { authController } = require("../controllers");
const {
  requireFirebaseAuth,
  requireUidMatch,
} = require("../middleware/authMiddleware");

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
router.post(
  "/signup",
  requireFirebaseAuth,
  requireUidMatch({ bodyField: "firebaseUid" }),
  authController.signup,
);

// Login user
router.post(
  "/login",
  requireFirebaseAuth,
  requireUidMatch({ bodyField: "firebaseUid" }),
  authController.login,
);

// Get user by Firebase UID
router.get(
  "/user/:firebaseUid",
  requireFirebaseAuth,
  requireUidMatch({ paramField: "firebaseUid" }),
  authController.getUser,
);

// Update user profile
router.put(
  "/user/:firebaseUid",
  requireFirebaseAuth,
  requireUidMatch({ paramField: "firebaseUid" }),
  authController.updateUser,
);

module.exports = router;
