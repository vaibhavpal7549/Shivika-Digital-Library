const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Razorpay = require('razorpay');
const crypto = require('crypto');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
// API ENDPOINTS
// ============================================

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
 * Request body:
 * - razorpay_order_id: string (from Razorpay response)
 * - razorpay_payment_id: string (from Razorpay response)
 * - razorpay_signature: string (from Razorpay response)
 * 
 * Verification formula:
 * generated_signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 * valid = (generated_signature === razorpay_signature)
 */
app.post('/api/verify-payment', (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      seatNumber,
      months,
      userId,
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

    if (isValid) {
      console.log('✅ Payment verified successfully:', razorpay_payment_id);
      
      res.json({ 
        success: true, 
        message: 'Payment verified successfully',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        verified: true
      });
    } else {
      console.error('❌ Signature mismatch - possible tampering!');
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
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

