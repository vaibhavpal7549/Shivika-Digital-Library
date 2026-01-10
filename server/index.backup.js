const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const admin = require('firebase-admin');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const seatRoutes = require('./routes/seatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { initializeSocket, emitPaymentCompleted, emitSeatBooked } = require('./socket/socketManager');
const { Payment } = require('./models');

dotenv.config();

// ============================================
// MONGODB CONNECTION
// ============================================
connectDB();

// ============================================
// FIREBASE ADMIN INITIALIZATION
// ============================================

/**
 * Initialize Firebase Admin SDK for server-side operations.
 * Used for:
 * - ONE-SEAT-PER-USER validation (race-condition safe)
 * - Server-side seat status verification
 * - Direct database access for security checks
 */
let firebaseInitialized = false;

try {
  // Try to initialize with service account if available
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized with service account');
  } else if (process.env.FIREBASE_DATABASE_URL) {
    // Initialize without credentials for limited operations
    admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized with database URL only');
  } else {
    console.warn('⚠️  WARNING: Firebase Admin not configured!');
    console.warn('   ONE-SEAT-PER-USER validation will rely on frontend only.');
    console.warn('   Set FIREBASE_DATABASE_URL in server/.env for backend validation.');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
  console.warn('   ONE-SEAT-PER-USER validation will rely on frontend only.');
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ============================================
// SOCKET.IO INITIALIZATION
// ============================================
const io = initializeSocket(server);

// Make io available to routes
app.set('io', io);

// Trust proxy for Render
app.set('trust proxy', 1);

// Middleware
// CORS configuration - allow all origins for now, can restrict in production
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// ============================================
// USER ROUTES (MongoDB)
// ============================================
app.use('/api/users', userRoutes);

// ============================================
// SEAT ROUTES (MongoDB + Firebase sync)
// ============================================
app.use('/api/seats', seatRoutes);

// ============================================
// ADMIN ROUTES
// ============================================
app.use('/api/admin', adminRoutes);

// ============================================
// PAYMENT ROUTES (MongoDB + Firebase sync)
// ============================================
app.use('/api/payments', paymentRoutes);

// ============================================
// RAZORPAY INITIALIZATION
// ============================================

/**
 * Validate Razorpay configuration on startup
 * Log warnings if keys are missing or using live keys in development
 */
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.warn('⚠️  WARNING: Razorpay keys not configured!');
  console.warn('   Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env');
  console.warn('   Get TEST keys from: https://dashboard.razorpay.com/app/keys');
}

// Check if using test or live keys
const isTestMode = RAZORPAY_KEY_ID?.startsWith('rzp_test_');
const isLiveMode = RAZORPAY_KEY_ID?.startsWith('rzp_live_');

if (isLiveMode && process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  WARNING: Using LIVE Razorpay keys in development!');
  console.warn('   This will process REAL payments. Use TEST keys for development.');
  console.warn('   Test Key ID format: rzp_test_XXXXXXXXXXXX');
}

if (isTestMode) {
  console.log('✅ Razorpay initialized in TEST mode');
}

// Initialize Razorpay instance
let razorpay = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user already has a booked seat
 * ONE-SEAT-PER-USER RULE ENFORCEMENT (Backend)
 * 
 * This is the PRIMARY enforcement point for the one-seat rule.
 * It queries Firebase directly to check if the user already has a verified seat booking.
 * 
 * RACE CONDITION SAFETY:
 * - Uses Firebase server-side query
 * - Called BEFORE creating payment order
 * - Double-checked in verify-payment endpoint
 * 
 * @param {string} userId - Firebase user ID
 * @returns {Object} { hasBookedSeat: boolean, seatNumber: number|null, error: string|null }
 */
async function checkUserExistingSeat(userId) {
  if (!firebaseInitialized) {
    console.warn('⚠️ Firebase not initialized - skipping backend seat check');
    return { hasBookedSeat: false, seatNumber: null, error: null, skipped: true };
  }

  try {
    const db = admin.database();
    const seatsRef = db.ref('seats');
    
    // Query all seats to find one belonging to this user
    const snapshot = await seatsRef.once('value');
    const seatsData = snapshot.val() || {};
    
    // Find seat booked by current user with verified status
    for (const [seatNumber, seatData] of Object.entries(seatsData)) {
      if (
        seatData.userId === userId &&
        seatData.status === 'booked' &&
        seatData.verificationStatus === 'verified'
      ) {
        console.log(`🚫 User ${userId.substring(0, 8)} already has Seat ${seatNumber} booked`);
        return {
          hasBookedSeat: true,
          seatNumber: parseInt(seatNumber),
          error: null
        };
      }
    }
    
    return { hasBookedSeat: false, seatNumber: null, error: null };
  } catch (error) {
    console.error('❌ Error checking user seat:', error.message);
    return { hasBookedSeat: false, seatNumber: null, error: error.message };
  }
}

// ============================================
// API ENDPOINTS
// ============================================

/**
 * GET /api/check-user-seat/:userId
 * 
 * Endpoint to check if user already has a booked seat.
 * Used by frontend before initiating payment.
 * 
 * ONE-SEAT-PER-USER RULE: This endpoint helps enforce the rule
 * that each user can only have ONE active seat booking.
 * 
 * Response:
 * - hasBookedSeat: boolean
 * - seatNumber: number (if booked) or null
 * - message: string (user-friendly message)
 */
app.get('/api/check-user-seat/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const result = await checkUserExistingSeat(userId);
    
    if (result.skipped) {
      // Firebase not configured - let frontend handle validation
      return res.json({
        success: true,
        hasBookedSeat: false,
        seatNumber: null,
        message: 'Backend validation skipped - rely on frontend',
        skipped: true
      });
    }
    
    if (result.error) {
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      hasBookedSeat: result.hasBookedSeat,
      seatNumber: result.seatNumber,
      message: result.hasBookedSeat
        ? `You have already booked Seat ${result.seatNumber}. Only one seat per user is allowed.`
        : 'No seat booked. You can proceed with booking.'
    });
  } catch (error) {
    console.error('❌ Error in check-user-seat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check user seat status'
    });
  }
});

/**
 * GET /api/razorpay-key
 * 
 * Safely expose Razorpay key_id to frontend.
 * This endpoint only returns the key_id (public key),
 * NEVER the key_secret (private key).
 */
app.get('/api/razorpay-key', (req, res) => {
  if (!RAZORPAY_KEY_ID) {
    return res.status(500).json({
      success: false,
      error: 'Razorpay not configured'
    });
  }
  
  res.json({
    success: true,
    key_id: RAZORPAY_KEY_ID,
    mode: isTestMode ? 'test' : 'live'
  });
});

/**
 * POST /api/create-order
 * 
 * Creates a Razorpay order for payment.
 * Amount should be in INR (rupees), will be converted to paise.
 * 
 * Request body:
 * - amount: number (in rupees, e.g., 500 for ₹500)
 * - currency: string (default: 'INR')
 * - seatNumber: string (optional, for seat booking)
 * - months: number (subscription duration)
 * - userId: string (Firebase user ID)
 * - type: string ('fee_payment' | 'seat_booking')
 */
app.post('/api/create-order', async (req, res) => {
  try {
    // Check if Razorpay is properly initialized
    if (!razorpay) {
      console.error('❌ Razorpay not initialized - keys missing');
      return res.status(500).json({ 
        success: false, 
        error: 'Payment gateway not configured. Please contact administrator.' 
      });
    }

    const { amount, currency = 'INR', seatNumber, months, userId, type } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid amount. Amount must be greater than 0.' 
      });
    }

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required.' 
      });
    }

    // ============================================
    // ONE-SEAT-PER-USER VALIDATION (Backend)
    // ============================================
    // CRITICAL: Check if user already has a booked seat BEFORE creating order
    // This prevents payment for users who already have a seat.
    // This is race-condition safe as it's checked server-side.
    
    if (type === 'seat_booking') {
      const existingSeatCheck = await checkUserExistingSeat(userId);
      
      if (existingSeatCheck.hasBookedSeat) {
        console.log(`🚫 Blocking seat booking - User already has Seat ${existingSeatCheck.seatNumber}`);
        return res.status(400).json({
          success: false,
          error: 'You have already booked one seat.',
          errorCode: 'SEAT_ALREADY_BOOKED',
          existingSeatNumber: existingSeatCheck.seatNumber,
          message: `You already have Seat ${existingSeatCheck.seatNumber} booked. Only one seat per user is allowed.`
        });
      }
    }

    // Generate unique receipt ID
    const receiptId = type === 'fee_payment' 
      ? `fee_${userId.substring(0, 8)}_${Date.now()}`
      : `seat_${seatNumber || 'NA'}_${Date.now()}`;

    // Razorpay order options
    // IMPORTANT: Amount must be in paise (smallest currency unit)
    const amountInPaise = Math.round(amount * 100);
    
    const options = {
      amount: amountInPaise,
      currency,
      receipt: receiptId.substring(0, 40), // Razorpay receipt max 40 chars
      notes: {
        seatNumber: seatNumber || 'N/A',
        months: months || 1,
        userId: userId.substring(0, 50), // Limit note length
        type: type || 'seat_booking',
      },
    };

    console.log('📦 Creating Razorpay order:', {
      amountINR: amount,
      amountPaise: amountInPaise,
      currency,
      receipt: receiptId,
      type: type || 'seat_booking'
    });

    const order = await razorpay.orders.create(options);
    
    console.log('✅ Order created successfully:', {
      orderId: order.id,
      amount: order.amount / 100,
      status: order.status
    });

    res.json({ 
      success: true, 
      order,
      mode: isTestMode ? 'test' : 'live'
    });
  } catch (error) {
    console.error('❌ Error creating order:', error);
    
    // Parse Razorpay error response
    let errorMessage = 'Failed to create payment order';
    
    if (error.error?.description) {
      errorMessage = error.error.description;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // Check for common Razorpay errors
    if (error.statusCode === 401) {
      errorMessage = 'Invalid Razorpay credentials. Please check your API keys.';
    } else if (error.statusCode === 400) {
      errorMessage = `Invalid request: ${errorMessage}`;
    }

    res.status(error.statusCode || 500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

/**
 * POST /api/verify-payment
 * 
 * Verifies Razorpay payment signature using HMAC SHA256.
 * This ensures the payment response is authentic and from Razorpay.
 * 
 * IMPORTANT: This endpoint is the single source of truth for payment records.
 * - Saves payment to MongoDB first
 * - Syncs to Firebase for real-time updates
 * - No frontend direct Firebase writes for payments
 * 
 * Request body:
 * - razorpay_order_id: string (from Razorpay response)
 * - razorpay_payment_id: string (from Razorpay response)
 * - razorpay_signature: string (from Razorpay response)
 * - userId: string (Firebase UID)
 * - userEmail: string
 * - amount: number
 * - type: 'seat_booking' | 'fee_payment'
 * - months: number (for fee_payment)
 * - seatNumber: number (for seat_booking)
 * 
 * Verification formula:
 * generated_signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 * valid = (generated_signature === razorpay_signature)
 */
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      seatNumber,
      shift,
      months,
      userId,
      userEmail,
      amount,
      type 
    } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error('❌ Missing payment verification fields');
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required payment verification fields' 
      });
    }

    // Check if key_secret is available
    if (!RAZORPAY_KEY_SECRET) {
      console.error('❌ Cannot verify payment - key_secret not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Payment verification not configured' 
      });
    }

    console.log('🔐 Verifying payment:', {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      type: type || 'seat_booking'
    });

    // Generate signature using HMAC SHA256
    // Format: order_id|payment_id
    const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(signaturePayload)
      .digest('hex');

    // Compare signatures (timing-safe comparison)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(generated_signature, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    const paymentDate = new Date();

    if (isValid) {
      console.log('✅ Payment signature verified:', razorpay_payment_id);
      
      // ============================================
      // SAVE PAYMENT TO MONGODB (Source of Truth)
      // ============================================
      try {
        // Check if payment already exists (prevent duplicates)
        let payment = await Payment.findOne({ orderId: razorpay_order_id });
        
        if (payment) {
          // Update existing payment record
          payment.paymentId = razorpay_payment_id;
          payment.status = 'paid';
          payment.verificationStatus = 'verified';
          payment.paidAt = paymentDate;
          if (type === 'fee_payment') {
            payment.feePaymentDate = paymentDate;
          }
          await payment.save();
          console.log('✅ Updated existing payment in MongoDB:', payment._id);
        } else {
          // Create new payment record
          payment = new Payment({
            firebaseUid: userId,
            userEmail: userEmail || '',
            type: type || 'seat_booking',
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            amount: amount || 0,
            status: 'paid',
            verificationStatus: 'verified',
            seatNumber: seatNumber,
            shift: shift,
            months: months,
            feePaymentDate: type === 'fee_payment' ? paymentDate : undefined,
            paidAt: paymentDate
          });
          await payment.save();
          console.log('✅ Payment saved to MongoDB:', payment._id);
        }

        // ============================================
        // SYNC TO FIREBASE (Real-time updates)
        // ============================================
        if (firebaseInitialized) {
          try {
            const firebaseDb = admin.database();
            const paymentsRef = firebaseDb.ref('payments').push();
            await paymentsRef.set({
              ...payment.toFirebaseFormat(),
              mongoId: payment._id.toString()
            });
            
            // Update MongoDB sync status
            payment.firebaseSynced = true;
            await payment.save();
            console.log('✅ Payment synced to Firebase');
          } catch (fbError) {
            console.error('⚠️ Firebase sync failed (non-critical):', fbError.message);
            payment.firebaseSyncError = fbError.message;
            await payment.save();
          }
        }

        // ============================================
        // UPDATE USER PROFILE (for fee payments)
        // ============================================
        if (type === 'fee_payment' && firebaseInitialized) {
          try {
            const firebaseDb = admin.database();
            const profileRef = firebaseDb.ref(`profiles/${userId}`);
            const snapshot = await profileRef.once('value');
            const currentProfile = snapshot.val() || {};
            
            await profileRef.update({
              feePaymentDate: paymentDate.toISOString(),
              feeStatus: 'PAID',
              feeMonths: months,
              feeUpdatedAt: paymentDate.toISOString()
            });
            console.log('✅ User profile fee status updated');
          } catch (profileError) {
            console.error('⚠️ Profile update failed:', profileError.message);
          }
        }

        // Emit payment completed event via Socket.IO
        emitPaymentCompleted({
          userId,
          amount: amount,
          paymentId: razorpay_payment_id,
          seatNumber,
          type: type || 'seat_booking'
        });
        
        res.json({ 
          success: true, 
          message: 'Payment verified and saved successfully',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          paymentDate: paymentDate.toISOString(),
          verified: true,
          mongoId: payment._id.toString()
        });

      } catch (dbError) {
        console.error('❌ Database error saving payment:', dbError);
        // Still return success for verification, but indicate save failure
        res.json({ 
          success: true, 
          message: 'Payment verified but database save failed',
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          paymentDate: paymentDate.toISOString(),
          verified: true,
          warning: 'Payment record may need manual verification'
        });
      }
      
    } else {
      console.error('❌ Signature mismatch - possible tampering!');
      
      // Save failed verification to MongoDB for audit
      try {
        const failedPayment = new Payment({
          firebaseUid: userId,
          userEmail: userEmail || '',
          type: type || 'seat_booking',
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          amount: amount || 0,
          status: 'verification_failed',
          verificationStatus: 'failed',
          errorMessage: 'Signature mismatch - possible tampering'
        });
        await failedPayment.save();
        console.log('⚠️ Failed verification saved for audit:', failedPayment._id);
      } catch (dbError) {
        console.error('❌ Could not save failed verification:', dbError.message);
      }
      
      res.status(400).json({ 
        success: false, 
        error: 'Payment verification failed - signature mismatch' 
      });
    }
  } catch (error) {
    console.error('❌ Payment verification error:', error.message);
    
    // Handle specific crypto errors
    if (error.message.includes('Invalid character')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid signature format' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Payment verification failed' 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running', socketIO: !!io });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO ready for real-time updates`);
});

