const express = require("express");
const router = express.Router();
const { paymentController } = require("../controllers");
const {
  requireFirebaseAuth,
  requireUidMatch,
  requireAdmin,
} = require("../middleware/authMiddleware");

/**
 * ============================================
 * PAYMENT ROUTES
 * ============================================
 *
 * POST /payment/create-order  - Create Razorpay order
 * POST /payment/verify        - Verify payment
 * POST /payment/manual        - Record manual payment (admin)
 * POST /payment/webhook       - Razorpay webhook
 * GET  /payment/user/:uid     - Get user's payments
 * GET  /payment/:orderId      - Get payment by order ID
 * GET  /payment/fees          - Get fee structure
 */

// Create Razorpay order
router.post(
  "/create-order",
  requireFirebaseAuth,
  requireUidMatch({ bodyField: "firebaseUid" }),
  paymentController.createOrder,
);

// Verify payment
router.post(
  "/verify",
  requireFirebaseAuth,
  requireUidMatch({ bodyField: "firebaseUid" }),
  paymentController.verifyPayment,
);

// Record manual payment (admin)
router.post(
  "/manual",
  requireFirebaseAuth,
  requireAdmin,
  paymentController.recordManualPayment,
);

// Razorpay webhook
router.post("/webhook", paymentController.webhook);

// Get fee structure
router.get("/fees", paymentController.getFeeStructure);

// Get user's payment statistics
router.get(
  "/stats/:firebaseUid",
  requireFirebaseAuth,
  requireUidMatch({ paramField: "firebaseUid" }),
  paymentController.getUserStats,
);

// Get user's payments
router.get(
  "/user/:firebaseUid",
  requireFirebaseAuth,
  requireUidMatch({ paramField: "firebaseUid" }),
  paymentController.getUserPayments,
);

// Get payment by order ID
router.get("/:orderId", paymentController.getPayment);

module.exports = router;
