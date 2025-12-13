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

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Create order endpoint
app.post('/api/create-order', async (req, res) => {
  try {
    // Check if Razorpay is configured
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay keys not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Payment gateway not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env file' 
      });
    }

    const { amount, currency = 'INR', seatNumber, months, userId, type } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }

    const receiptId = type === 'fee_payment' 
      ? `fee_${userId}_${Date.now()}`
      : `seat_${seatNumber}_${Date.now()}`;

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency,
      receipt: receiptId,
      notes: {
        seatNumber: seatNumber || null,
        months: months || null,
        userId,
        type: type || 'seat_booking',
      },
    };

    console.log('Creating Razorpay order with options:', { ...options, amount: options.amount / 100 });

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error creating order:', error);
    const errorMessage = error.error?.description || error.message || 'Failed to create payment order';
    res.status(500).json({ success: false, error: errorMessage });
  }
});

// Verify payment webhook
app.post('/api/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, seatNumber, months, userId, type } = req.body;

    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (generated_signature === razorpay_signature) {
      // Payment verified successfully
      // This will be handled by Firebase Realtime Database update from frontend
      res.json({ 
        success: true, 
        message: 'Payment verified',
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id
      });
    } else {
      res.status(400).json({ success: false, error: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

