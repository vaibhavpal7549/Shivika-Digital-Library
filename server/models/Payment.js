const mongoose = require('mongoose');

/**
 * ============================================
 * PAYMENT SCHEMA - Transaction Records
 * ============================================
 * 
 * Stores all payment transactions with full audit trail.
 * Linked to User and Seat for complete traceability.
 * 
 * Triggers:
 * - On successful payment → Update User.payment + User.seat.expiryDate
 * - On successful payment → Sync to Google Sheets
 * - On admin update → Sync to Google Sheets
 */

const PaymentSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  firebaseUid: {
    type: String,
    required: true,
    index: true
  },

  userEmail: {
    type: String,
    required: true
  },

  userName: {
    type: String
  },

  userPhone: {
    type: String
  },

  // Seat reference (optional for fee-only payments)
  seatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seat',
    default: null
  },

  seatNumber: {
    type: Number,
    default: null
  },

  // Payment type
  type: {
    type: String,
    enum: ['seat_booking', 'fee_payment', 'renewal', 'fine', 'deposit', 'refund'],
    required: true
  },

  // Razorpay payment details
  orderId: {
    type: String,
    required: true,
    unique: true
  },

  paymentId: {
    type: String,
    sparse: true,
    unique: true
  },

  signature: {
    type: String
  },

  // Amount details
  amount: {
    type: Number,
    required: true
  },

  currency: {
    type: String,
    default: 'INR'
  },

  // Payment method
  paymentMode: {
    type: String,
    enum: ['UPI', 'Cash', 'Card', 'Online', 'Razorpay', 'NetBanking', 'Wallet'],
    required: true
  },

  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },

  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'failed'],
    default: 'pending'
  },

  // Subscription details
  monthsPaidFor: {
    type: Number,
    default: 1,
    min: 1,
    max: 12
  },

  shift: {
    type: String,
    enum: ['morning', 'evening', 'fullday', 'custom', null],
    default: null
  },

  // Dates
  paidAt: {
    type: Date
  },

  // For fee payments
  feePaymentDate: {
    type: Date
  },

  // Validity period
  validFrom: {
    type: Date
  },

  validUntil: {
    type: Date
  },

  // Error tracking
  errorMessage: {
    type: String
  },

  errorCode: {
    type: String
  },

  // Admin actions
  adminAction: {
    actionType: {
      type: String,
      enum: ['approved', 'rejected', 'refunded', 'modified', null]
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    actionAt: Date,
    notes: String
  },

  // Receipt/Invoice
  receiptNumber: {
    type: String,
    unique: true,
    sparse: true
  },

  invoiceUrl: {
    type: String
  },



  syncError: {
    type: String
  },

  // Additional metadata
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  notes: {
    type: String
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// INDEXES
// ============================================
// Note: userId and firebaseUid have index: true in schema, so skip duplicates
PaymentSchema.index({ firebaseUid: 1, type: 1 }); // Compound index
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ createdAt: -1 });
// Skip paymentId and orderId - they have unique: true which auto-creates index
PaymentSchema.index({ seatNumber: 1 });
PaymentSchema.index({ paidAt: -1 });

// ============================================
// VIRTUALS
// ============================================

PaymentSchema.virtual('displayStatus').get(function() {
  if (this.verificationStatus === 'verified' && this.status === 'paid') {
    return 'Completed';
  }
  if (this.status === 'pending') return 'Pending';
  if (this.status === 'failed' || this.verificationStatus === 'failed') return 'Failed';
  if (this.status === 'refunded') return 'Refunded';
  return this.status;
});

PaymentSchema.virtual('isSuccessful').get(function() {
  return this.status === 'paid' && this.verificationStatus === 'verified';
});

// ============================================
// INSTANCE METHODS
// ============================================

// Mark payment as verified/successful
PaymentSchema.methods.markVerified = function(paymentId, signature) {
  this.paymentId = paymentId;
  this.signature = signature;
  this.status = 'paid';
  this.verificationStatus = 'verified';
  this.paidAt = new Date();
  
  // Note: Receipt number is set in controller before save
  // Do NOT call save() here - controller handles it
  return this; // Return this for chaining
};

// Mark payment as failed
PaymentSchema.methods.markFailed = async function(errorMessage, errorCode) {
  this.status = 'failed';
  this.verificationStatus = 'failed';
  this.errorMessage = errorMessage;
  this.errorCode = errorCode;
  
  return this.save();
};

// Get data for Google Sheets sync
PaymentSchema.methods.getSheetsSyncData = function() {
  return {
    paymentId: this.paymentId || this.orderId,
    userName: this.userName,
    userPhone: this.userPhone,
    userEmail: this.userEmail,
    seatNumber: this.seatNumber || 'N/A',
    amount: this.amount,
    paymentMode: this.paymentMode,
    status: this.displayStatus,
    monthsPaid: this.monthsPaidFor,
    paidAt: this.paidAt 
      ? new Date(this.paidAt).toLocaleDateString('en-IN')
      : 'N/A',
    validUntil: this.validUntil
      ? new Date(this.validUntil).toLocaleDateString('en-IN')
      : 'N/A',
    receiptNumber: this.receiptNumber || 'N/A'
  };
};

// Instance method to convert to Firebase format
PaymentSchema.methods.toFirebaseFormat = function() {
  return {
    oderId: String(this._id),
    oderId: String(this.orderId),
    paymentId: this.paymentId,
    firebaseUid: this.firebaseUid,
    userEmail: this.userEmail,
    type: this.type,
    amount: this.amount,
    currency: this.currency,
    status: this.status,
    verificationStatus: this.verificationStatus,
    seatNumber: this.seatNumber,
    shift: this.shift,
    months: this.monthsPaidFor,
    feePaymentDate: this.feePaymentDate?.toISOString(),
    paidAt: this.paidAt?.toISOString(),
    createdAt: this.createdAt?.toISOString(),
    updatedAt: this.updatedAt?.toISOString()
  };
};

// ============================================
// STATIC METHODS
// ============================================

// Get user's payment history
PaymentSchema.statics.getUserPayments = async function(firebaseUid, type = null) {
  const query = { firebaseUid };
  if (type) query.type = type;
  return this.find(query).sort({ createdAt: -1 });
};

// Get payment by order ID
PaymentSchema.statics.getByOrderId = async function(orderId) {
  return this.findOne({ orderId });
};

// Get payment by payment ID
PaymentSchema.statics.getByPaymentId = async function(paymentId) {
  return this.findOne({ paymentId });
};

// Get pending payments
PaymentSchema.statics.getPending = function() {
  return this.find({ status: 'pending' }).sort({ createdAt: -1 });
};

// Get successful payments for date range
PaymentSchema.statics.getSuccessfulInRange = function(startDate, endDate) {
  return this.find({
    status: 'paid',
    verificationStatus: 'verified',
    paidAt: { $gte: startDate, $lte: endDate }
  }).sort({ paidAt: -1 });
};

// Get total revenue
PaymentSchema.statics.getTotalRevenue = async function(startDate, endDate) {
  const match = {
    status: 'paid',
    verificationStatus: 'verified'
  };
  
  if (startDate && endDate) {
    match.paidAt = { $gte: startDate, $lte: endDate };
  }

  const result = await this.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  return result[0]?.total || 0;
};



// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================
// PaymentSchema.pre('save', function(next) {
//   // Auto-generate receipt number for verified payments
//   if (this.isModified('verificationStatus') && 
//       this.verificationStatus === 'verified' && 
//       !this.receiptNumber) {
//     this.receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
//   }
//   next();
// });

module.exports = mongoose.model('Payment', PaymentSchema);

