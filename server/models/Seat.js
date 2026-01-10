const mongoose = require('mongoose');

/**
 * ============================================
 * SEAT SCHEMA - Library Seat Management
 * ============================================
 * 
 * Tracks individual seat status and bookings.
 * One-to-one relationship with User when booked.
 * 
 * Business Rules:
 * - One user can only book one seat
 * - Seat auto-releases after expiryDate
 * - Seat status changes trigger Google Sheets sync
 */

const SeatSchema = new mongoose.Schema({
  // Seat identification
  seatNumber: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 100
  },

  // Seat zone/section for organization
  zone: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'Premium'],
    default: 'A'
  },

  // Booking status
  isBooked: {
    type: Boolean,
    default: false,
    index: true
  },

  // Reference to user who booked
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Firebase UID of the user (for quick lookups)
  bookedByFirebaseUid: {
    type: String,
    default: null,
    index: true
  },

  // Booking details
  bookingDate: {
    type: Date,
    default: null
  },

  expiryDate: {
    type: Date,
    default: null,
    index: true
  },

  shift: {
    type: String,
    enum: ['morning', 'evening', 'fullday', 'custom', null],
    default: null
  },

  // Payment association
  lastPaymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  },

  // Seat metadata
  amenities: [{
    type: String,
    enum: ['power_outlet', 'lamp', 'locker', 'window_view', 'ac']
  }],

  // Seat status tracking
  status: {
    type: String,
    enum: ['available', 'booked', 'reserved', 'maintenance', 'expired'],
    default: 'available'
  },

  // For UI display (blinking yellow when payment pending)
  displayStatus: {
    type: String,
    enum: ['green', 'red', 'yellow', 'gray'],
    default: 'green'
  },

  // Booking history for audit
  bookingHistory: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    firebaseUid: String,
    bookedAt: Date,
    releasedAt: Date,
    releaseReason: {
      type: String,
      enum: ['expired', 'manual', 'admin', 'payment_failed', 'user_request']
    }
  }],

  // Notes for admin
  adminNotes: String

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================
// INDEXES
// ============================================
// Note: seatNumber has unique: true which auto-creates index
// Also: bookedByFirebaseUid and expiryDate have index: true in schema
SeatSchema.index({ isBooked: 1, status: 1 }); // Compound index for queries

// ============================================
// VIRTUALS
// ============================================

// Check if seat is expired
SeatSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return new Date(this.expiryDate) < new Date();
});

// Days until expiry
SeatSchema.virtual('daysUntilExpiry').get(function() {
  if (!this.expiryDate) return null;
  const diff = new Date(this.expiryDate) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ============================================
// INSTANCE METHODS
// ============================================

// Book seat for a user
SeatSchema.methods.book = async function(user, shift, months = 1) {
  const bookingDate = new Date();
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + months);

  this.isBooked = true;
  this.bookedBy = user._id;
  this.bookedByFirebaseUid = user.firebaseUid;
  this.bookingDate = bookingDate;
  this.expiryDate = expiryDate;
  this.shift = shift;
  this.status = 'booked';
  this.displayStatus = 'red';

  // Add to booking history
  this.bookingHistory.push({
    userId: user._id,
    firebaseUid: user.firebaseUid,
    bookedAt: bookingDate
  });

  return this.save();
};

// Release seat
SeatSchema.methods.release = async function(reason = 'manual') {
  // Update last booking history entry
  if (this.bookingHistory.length > 0) {
    const lastBooking = this.bookingHistory[this.bookingHistory.length - 1];
    if (!lastBooking.releasedAt) {
      lastBooking.releasedAt = new Date();
      lastBooking.releaseReason = reason;
    }
  }

  this.isBooked = false;
  this.bookedBy = null;
  this.bookedByFirebaseUid = null;
  this.bookingDate = null;
  this.expiryDate = null;
  this.shift = null;
  this.status = 'available';
  this.displayStatus = 'green';
  this.lastPaymentId = null;

  return this.save();
};

// Extend booking
SeatSchema.methods.extendBooking = async function(months) {
  if (!this.expiryDate) {
    throw new Error('Seat has no active booking to extend');
  }

  const newExpiry = new Date(this.expiryDate);
  newExpiry.setMonth(newExpiry.getMonth() + months);
  this.expiryDate = newExpiry;
  this.status = 'booked';
  this.displayStatus = 'red';

  return this.save();
};

// Mark as payment pending (yellow blink)
SeatSchema.methods.markPaymentPending = async function() {
  this.displayStatus = 'yellow';
  return this.save();
};

// ============================================
// STATIC METHODS
// ============================================

// Get all available seats
SeatSchema.statics.getAvailable = function() {
  return this.find({ 
    isBooked: false, 
    status: 'available' 
  }).sort({ seatNumber: 1 });
};

// Get all booked seats
SeatSchema.statics.getBooked = function() {
  return this.find({ 
    isBooked: true 
  }).populate('bookedBy', 'fullName email phone');
};

// Find seats expiring within days
SeatSchema.statics.findExpiring = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    isBooked: true,
    expiryDate: { $lte: futureDate, $gte: new Date() }
  }).populate('bookedBy', 'fullName email phone');
};

// Find expired seats that need release
SeatSchema.statics.findExpired = function() {
  return this.find({
    isBooked: true,
    expiryDate: { $lt: new Date() }
  }).populate('bookedBy', 'fullName email phone');
};

// Get seat by number
SeatSchema.statics.getByNumber = function(seatNumber) {
  return this.findOne({ seatNumber }).populate('bookedBy', 'fullName email phone');
};

// Initialize seats (run once to create all seats)
SeatSchema.statics.initializeSeats = async function(totalSeats = 60) {
  const existing = await this.countDocuments();
  if (existing > 0) {
    console.log(`Seats already initialized: ${existing} seats exist`);
    return;
  }

  const seats = [];
  for (let i = 1; i <= totalSeats; i++) {
    const zone = i <= 15 ? 'A' : i <= 30 ? 'B' : i <= 45 ? 'C' : 'D';
    seats.push({
      seatNumber: i,
      zone,
      isBooked: false,
      status: 'available',
      displayStatus: 'green',
      amenities: i % 5 === 0 ? ['power_outlet', 'lamp'] : ['power_outlet']
    });
  }

  await this.insertMany(seats);
  console.log(`✅ Initialized ${totalSeats} seats`);
};

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================
SeatSchema.pre('save', function(next) {
  // Auto-update display status based on booking and expiry
  if (!this.isBooked) {
    this.displayStatus = 'green';
  } else if (this.isExpired) {
    this.displayStatus = 'yellow'; // Expired but not yet released
  } else {
    this.displayStatus = 'red';
  }
  next();
});

module.exports = mongoose.model('Seat', SeatSchema);
