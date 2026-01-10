/**
 * ============================================
 * SHIVIKA DIGITAL LIBRARY - SERVER
 * ============================================
 * 
 * Main entry point for the backend server.
 * 
 * ARCHITECTURE:
 * - MongoDB: Single source of truth for all data
 * - Firebase Auth: Authentication only
 * - Google Sheets: Real-time sync for admin dashboard
 * - Socket.IO: Real-time updates for seat status
 * - Razorpay: Payment processing
 * 
 * DATA FLOW:
 * 1. User authenticates via Firebase Auth
 * 2. All data stored in MongoDB
 * 3. Changes sync to Google Sheets for admin
 * 4. Real-time updates via Socket.IO
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const admin = require('firebase-admin');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Import routes
const {
  authRoutes,
  seatRoutes,
  paymentRoutes,
  adminRoutes,
  userRoutes
} = require('./routes');

// Import services
const googleSheetsService = require('./services/googleSheetsService');
const { initializeJobs } = require('./jobs/scheduledJobs');
const { initializeSocket } = require('./socket/socketManager');

// ============================================
// DATABASE CONNECTION
// ============================================
connectDB();

// ============================================
// FIREBASE ADMIN INITIALIZATION
// ============================================

let firebaseInitialized = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized with service account');
  } else if (process.env.FIREBASE_DATABASE_URL) {
    admin.initializeApp({
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized with database URL only');
  } else {
    console.warn('⚠️  Firebase Admin not configured');
  }
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error.message);
}

// ============================================
// EXPRESS APP SETUP
// ============================================

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Trust proxy for production (Render, etc.)
app.set('trust proxy', 1);

// ============================================
// MIDDLEWARE
// ============================================

// CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// SOCKET.IO INITIALIZATION
// ============================================

const io = initializeSocket(server);
app.set('io', io);

// ============================================
// GOOGLE SHEETS INITIALIZATION
// ============================================

(async () => {
  try {
    await googleSheetsService.initialize();
    console.log('✅ Google Sheets service initialized');
  } catch (error) {
    console.warn('⚠️  Google Sheets not configured:', error.message);
  }
})();

// ============================================
// SCHEDULED JOBS INITIALIZATION
// ============================================

initializeJobs(io);

// ============================================
// API ROUTES
// ============================================

// Root route - welcome message
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏛️ Shivika Digital Library API Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      users: '/api/users/*',
      seats: '/api/seat/*',
      payments: '/api/payment/*',
      admin: '/api/admin/*'
    },
    documentation: 'See API_DOCUMENTATION.md for full API reference'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: 'connected',
      firebase: firebaseInitialized ? 'connected' : 'not configured',
      razorpay: process.env.RAZORPAY_KEY_ID ? 'configured' : 'not configured'
    }
  });
});

// Razorpay key (public)
app.get('/api/razorpay-key', (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID) {
    return res.status(500).json({
      success: false,
      error: 'Razorpay not configured'
    });
  }
  
  res.json({
    success: true,
    key_id: process.env.RAZORPAY_KEY_ID,
    mode: process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') ? 'test' : 'live'
  });
});

// Auth routes: /api/auth/*
app.use('/api/auth', authRoutes);

// User routes: /api/users/*
app.use('/api/users', userRoutes);

// Seat routes: /api/seat/*
app.use('/api/seat', seatRoutes);

// Also support /api/seats/* for backward compatibility
app.use('/api/seats', seatRoutes);

// Payment routes: /api/payment/*
app.use('/api/payment', paymentRoutes);

// Also support /api/payments/* for backward compatibility
app.use('/api/payments', paymentRoutes);

// Admin routes: /api/admin/*
app.use('/api/admin', adminRoutes);

// ============================================
// LEGACY ENDPOINTS (for backward compatibility)
// ============================================

// Legacy: Check user seat
app.get('/api/check-user-seat/:userId', async (req, res) => {
  const { User } = require('./models');
  try {
    const user = await User.findOne({ firebaseUid: req.params.userId });
    
    if (!user) {
      return res.json({
        success: true,
        hasBookedSeat: false,
        seatNumber: null
      });
    }

    res.json({
      success: true,
      hasBookedSeat: user.hasActiveSeat,
      seatNumber: user.seat?.seatNumber || null,
      message: user.hasActiveSeat
        ? `You have already booked Seat ${user.seat.seatNumber}. Only one seat per user is allowed.`
        : 'No seat booked. You can proceed with booking.'
    });
  } catch (error) {
    console.error('❌ Check user seat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check seat status'
    });
  }
});

// Legacy: Create order (redirects to new payment route)
app.post('/api/create-order', async (req, res) => {
  const { paymentController } = require('./controllers');
  return paymentController.createOrder(req, res);
});

// Legacy: Verify payment (redirects to new payment route)
app.post('/api/verify-payment', async (req, res) => {
  const { paymentController } = require('./controllers');
  return paymentController.verifyPayment(req, res);
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// ============================================
// START SERVER
// ============================================

server.listen(PORT, () => {
  console.log('');
  console.log('============================================');
  console.log('  SHIVIKA DIGITAL LIBRARY SERVER');
  console.log('============================================');
  console.log(`  🚀 Server running on port ${PORT}`);
  console.log(`  📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  🔥 Firebase: ${firebaseInitialized ? 'Connected' : 'Not configured'}`);
  console.log(`  💳 Razorpay: ${process.env.RAZORPAY_KEY_ID ? 'Configured' : 'Not configured'}`);
  console.log('============================================');
  console.log('');
  console.log('API Endpoints:');
  console.log('  POST /api/auth/signup         - Register user');
  console.log('  POST /api/auth/login          - Login user');
  console.log('  GET  /api/seat/all            - Get all seats');
  console.log('  POST /api/seat/book           - Book a seat');
  console.log('  POST /api/payment/create-order - Create payment');
  console.log('  POST /api/payment/verify      - Verify payment');
  console.log('  GET  /api/admin/users         - Admin: Get users');
  console.log('  GET  /api/admin/stats         - Admin: Dashboard');
  console.log('');
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forcing shutdown...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, io };

