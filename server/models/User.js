const mongoose = require('mongoose');

/**
 * ============================================
 * USER SCHEMA - Complete User Data Model
 * ============================================
 * 
 * Single source of truth for all user data including:
 * - Authentication details
 * - Profile information
 * - Current seat booking
 * - Payment summary
 * - Payment history
 * 
 * Google Sheets sync fields marked with [SYNC]
 */

// Sub-schema for payment history entries
const PaymentHistorySchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  paymentMode: {
    type: String,
    enum: ['UPI', 'Cash', 'Card', 'Online', 'Razorpay'],
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  monthsPaidFor: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['success', 'pending', 'failed', 'refunded'],
    default: 'success'
  },
  receiptUrl: String,
  notes: String
}, { _id: true, timestamps: true });

// Sub-schema for seat details (embedded in user)
const SeatDetailsSchema = new mongoose.Schema({
  seatNumber: {
    type: Number,
    default: null
  },
  seatStatus: {
    type: String,
    enum: ['active', 'released', 'expired', null],
    default: null
  },
  libraryName: {
    type: String,
    default: 'Shivika Digital Library'
  },
  shift: {
    type: String,
    enum: ['morning', 'evening', 'fullday', 'custom', null],
    default: null
  },
  bookingDate: {
    type: Date,
    default: null
  },
  expiryDate: {
    type: Date,
    default: null
  }
}, { _id: false });

// Sub-schema for payment summary
const PaymentSummarySchema = new mongoose.Schema({
  currentPlan: {
    type: String,
    enum: ['hourly', 'monthly', 'quarterly', 'yearly', null],
    default: null
  },
  hoursPerDay: {
    type: Number,
    default: null
  },
  monthlyFee: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'overdue', 'exempt'],
    default: 'pending'
  },
  nextDueDate: {
    type: Date,
    default: null
  },
  lastPaymentDate: {
    type: Date,
    default: null
  }
}, { _id: false });

// Sub-schema for profile details
const ProfileDetailsSchema = new mongoose.Schema({
  gender: {
    type: String,
    enum: ['male', 'female', 'other', null],
    default: null
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  fatherName: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    full: String // Full address string
  },
  studentId: {
    type: String,
    trim: true
  },
  collegeName: {
    type: String,
    trim: true
  },
  emergencyContact: {
    name: String,
    phone: String,
    relation: String
  },
  userId: {
    type: String,
    trim: true,
    index: true
  }
}, { _id: false });

// Main User Schema
const UserSchema = new mongoose.Schema({
  // ============================================
  // AUTHENTICATION DETAILS
  // ============================================
  
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  fullName: { // [SYNC to Google Sheets]
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  
  phone: { // [SYNC to Google Sheets]
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number']
  },
  
  photoURL: {
    type: String,
    default: null
  },
  
  provider: {
    type: String,
    enum: ['google', 'email', 'phone'],
    default: 'email'
  },
  
  role: {
    type: String,
    enum: ['student', 'admin', 'staff'],
    default: 'student'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  lastLogin: {
    type: Date,
    default: Date.now
  },

  // ============================================
  // PROFILE DETAILS
  // ============================================
  profile: {
    type: ProfileDetailsSchema,
    default: () => ({})
  },

  // ============================================
  // SEAT DETAILS [SYNC to Google Sheets]
  // ============================================
  seat: {
    type: SeatDetailsSchema,
    default: () => ({})
  },

  // ============================================
  // PAYMENT SUMMARY [SYNC to Google Sheets]
  // ============================================
  payment: {
    type: PaymentSummarySchema,
    default: () => ({})
  },

  // ============================================
  // PAYMENT HISTORY
  // ============================================
  paymentHistory: {
    type: [PaymentHistorySchema],
    default: []
  },

  // ============================================
  // GOOGLE SHEETS SYNC TRACKING
  // ============================================
  sheetsSync: {
    lastSyncedAt: {
      type: Date,
      default: null
    },
    sheetRowId: {
      type: Number,
      default: null
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'failed', null],
      default: null
    }
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// INDEXES
// ============================================
// Note: email has unique:true which auto-creates index, so skip explicit index
UserSchema.index({ phone: 1 });
UserSchema.index({ 'seat.seatNumber': 1 });
UserSchema.index({ 'seat.seatStatus': 1 });
UserSchema.index({ 'payment.paymentStatus': 1 });
UserSchema.index({ 'payment.nextDueDate': 1 });
UserSchema.index({ createdAt: -1 });

// ============================================
// VIRTUALS
// ============================================

// Check if user has an active seat
UserSchema.virtual('hasActiveSeat').get(function() {
  return this.seat && 
         this.seat.seatNumber !== null && 
         this.seat.seatStatus === 'active' &&
         this.seat.expiryDate && 
         new Date(this.seat.expiryDate) > new Date();
});

// Check if payment is overdue
UserSchema.virtual('isPaymentOverdue').get(function() {
  if (!this.payment.nextDueDate) return false;
  return new Date(this.payment.nextDueDate) < new Date() && 
         this.payment.paymentStatus !== 'paid';
});

// Days until expiry
UserSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.seat.expiryDate) return null;
  const diff = new Date(this.seat.expiryDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ============================================
// INSTANCE METHODS
// ============================================

// Book a seat for user
UserSchema.methods.bookSeat = async function(seatNumber, shift, months = 1) {
  const bookingDate = new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + months);

  this.seat = {
    seatNumber,
    seatStatus: 'active',
    libraryName: 'Shivika Digital Library',
    shift,
    bookingDate,
    expiryDate
  };

  return this.save();
};

// Release seat
UserSchema.methods.releaseSeat = async function() {
  this.seat = {
    seatNumber: null,
    seatStatus: 'released',
    libraryName: 'Shivika Digital Library',
    shift: null,
    bookingDate: null,
    expiryDate: null
  };

  return this.save();
};

// Add payment to history
UserSchema.methods.addPayment = async function(paymentData) {
  this.paymentHistory.push(paymentData);
  
  // Update payment summary
  this.payment.totalPaid = (this.payment.totalPaid || 0) + paymentData.amount;
  this.payment.lastPaymentDate = paymentData.paymentDate || new Date();
  this.payment.paymentStatus = 'paid';
  
  // Extend due date
  const months = paymentData.monthsPaidFor || 1;
  const nextDue = new Date(this.payment.nextDueDate || new Date());
  nextDue.setMonth(nextDue.getMonth() + months);
  this.payment.nextDueDate = nextDue;

  // Extend seat expiry
  if (this.seat.expiryDate) {
    const newExpiry = new Date(this.seat.expiryDate);
    newExpiry.setMonth(newExpiry.getMonth() + months);
    this.seat.expiryDate = newExpiry;
  }

  return this.save();
};

// Get data for Google Sheets sync
UserSchema.methods.getSheetsSyncData = function() {
  return {
    oderId: String(this._id),
    fullName: this.fullName,
    phone: this.phone,
    email: this.email,
    seatNumber: this.seat?.seatNumber || 'N/A',
    shift: this.seat?.shift || 'N/A',
    paymentStatus: this.payment?.paymentStatus || 'pending',
    totalPaid: this.payment?.totalPaid || 0,
    lastPaymentDate: this.payment?.lastPaymentDate 
      ? new Date(this.payment.lastPaymentDate).toLocaleDateString('en-IN')
      : 'N/A',
    nextDueDate: this.payment?.nextDueDate
      ? new Date(this.payment.nextDueDate).toLocaleDateString('en-IN')
      : 'N/A',
    expiryDate: this.seat?.expiryDate
      ? new Date(this.seat.expiryDate).toLocaleDateString('en-IN')
      : 'N/A',
    seatStatus: this.seat?.seatStatus || 'N/A'
  };
};

// ============================================
// STATIC METHODS
// ============================================

// Find users with expiring seats (within days)
UserSchema.statics.findExpiringSeats = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    'seat.seatStatus': 'active',
    'seat.expiryDate': { $lte: futureDate, $gte: new Date() }
  });
};

// Find users with overdue payments
UserSchema.statics.findOverduePayments = function() {
  return this.find({
    'payment.paymentStatus': { $ne: 'paid' },
    'payment.nextDueDate': { $lt: new Date() }
  });
};

// Find users needing Google Sheets sync
UserSchema.statics.findPendingSync = function() {
  return this.find({
    'sheetsSync.syncStatus': 'pending'
  });
};

module.exports = mongoose.model('User', UserSchema);
