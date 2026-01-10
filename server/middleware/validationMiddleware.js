/**
 * Validation Middleware
 * 
 * Centralized middleware for data consistency and validation.
 * Ensures MongoDB is the single source of truth for all operations.
 */

const User = require('../models/User');

/**
 * Verify user exists in MongoDB
 * Attaches user document to req.mongoUser
 */
const verifyUserExists = async (req, res, next) => {
  try {
    const firebaseUid = req.body.firebaseUid || req.params.firebaseUid || req.query.firebaseUid;
    
    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Firebase UID is required',
        code: 'MISSING_UID'
      });
    }

    const user = await User.findOne({ firebaseUid });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found in database. Please complete registration first.',
        code: 'USER_NOT_FOUND'
      });
    }

    req.mongoUser = user;
    next();
  } catch (error) {
    console.error('❌ User verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify user',
      code: 'VERIFICATION_ERROR'
    });
  }
};

/**
 * Validate profile is complete before allowing seat booking
 * Requires: name, email, phone at minimum
 */
const validateProfileComplete = async (req, res, next) => {
  try {
    const user = req.mongoUser;
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User verification required first',
        code: 'NO_USER_CONTEXT'
      });
    }

    const missingFields = [];
    
    if (!user.name || user.name.trim() === '') missingFields.push('name');
    if (!user.email || user.email.trim() === '') missingFields.push('email');
    if (!user.phone || user.phone.trim() === '') missingFields.push('phone');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Profile incomplete. Missing: ${missingFields.join(', ')}`,
        code: 'PROFILE_INCOMPLETE',
        missingFields
      });
    }

    next();
  } catch (error) {
    console.error('❌ Profile validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate profile',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Enforce one-seat-per-user rule
 * Checks MongoDB for existing seat booking
 */
const enforceOneSeatPerUser = async (req, res, next) => {
  try {
    const user = req.mongoUser;
    const { seatNumber, changeSeat } = req.body;
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'User verification required first',
        code: 'NO_USER_CONTEXT'
      });
    }

    // Check if user already has a seat
    if (user.seat?.seatNumber && user.seat?.status === 'active') {
      // If changing seat, allow the operation
      if (changeSeat && user.seat.seatNumber !== parseInt(seatNumber)) {
        req.isChangingSeat = true;
        req.oldSeatNumber = user.seat.seatNumber;
        return next();
      }
      
      // If booking same seat (renewal), allow
      if (user.seat.seatNumber === parseInt(seatNumber)) {
        req.isRenewal = true;
        return next();
      }

      // User trying to book different seat without changeSeat flag
      return res.status(400).json({
        success: false,
        error: `You already have Seat ${user.seat.seatNumber} booked. Only one seat per user is allowed.`,
        code: 'ONE_SEAT_LIMIT',
        currentSeat: user.seat.seatNumber
      });
    }

    next();
  } catch (error) {
    console.error('❌ One-seat validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate seat limit',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Validate seat availability from MongoDB
 * Checks if seat is already booked by another user
 */
const validateSeatAvailability = async (req, res, next) => {
  try {
    const { seatNumber } = req.body;
    const user = req.mongoUser;
    
    if (!seatNumber) {
      return res.status(400).json({
        success: false,
        error: 'Seat number is required',
        code: 'MISSING_SEAT_NUMBER'
      });
    }

    const seatNum = parseInt(seatNumber);
    
    // Validate seat number range
    if (seatNum < 1 || seatNum > 60) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat number. Must be between 1 and 60.',
        code: 'INVALID_SEAT_NUMBER'
      });
    }

    // Check if seat is booked by another user in MongoDB
    const existingBooking = await User.findOne({
      'seat.seatNumber': seatNum,
      'seat.status': 'active',
      firebaseUid: { $ne: user.firebaseUid }
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        error: `Seat ${seatNum} is already booked by another user`,
        code: 'SEAT_TAKEN'
      });
    }

    req.validatedSeatNumber = seatNum;
    next();
  } catch (error) {
    console.error('❌ Seat availability validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate seat availability',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Validate payment data
 */
const validatePaymentData = (req, res, next) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({
      success: false,
      error: 'Missing payment verification data',
      code: 'INVALID_PAYMENT_DATA',
      missing: {
        razorpay_order_id: !razorpay_order_id,
        razorpay_payment_id: !razorpay_payment_id,
        razorpay_signature: !razorpay_signature
      }
    });
  }

  next();
};

/**
 * Validate shift type
 */
const validateShift = (req, res, next) => {
  const { shift } = req.body;
  const validShifts = ['morning', 'evening', 'fullday'];
  
  if (shift && !validShifts.includes(shift)) {
    return res.status(400).json({
      success: false,
      error: `Invalid shift. Must be one of: ${validShifts.join(', ')}`,
      code: 'INVALID_SHIFT'
    });
  }

  req.validatedShift = shift || 'fullday';
  next();
};

/**
 * Rate limiting for sensitive operations
 * Simple in-memory rate limiter
 */
const rateLimitMap = new Map();

const rateLimit = (maxRequests = 10, windowMs = 60000) => {
  return (req, res, next) => {
    const key = req.body.firebaseUid || req.ip;
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, windowStart: now });
      return next();
    }
    
    const record = rateLimitMap.get(key);
    
    // Reset window if expired
    if (now - record.windowStart > windowMs) {
      rateLimitMap.set(key, { count: 1, windowStart: now });
      return next();
    }
    
    // Check limit
    if (record.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((record.windowStart + windowMs - now) / 1000)
      });
    }
    
    record.count++;
    next();
  };
};

/**
 * Log operation for audit trail
 */
const auditLog = (operationType) => {
  return (req, res, next) => {
    const startTime = Date.now();
    const userId = req.body.firebaseUid || req.params.firebaseUid || 'unknown';
    
    // Log after response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logData = {
        timestamp: new Date().toISOString(),
        operation: operationType,
        userId: userId.substring(0, 8) + '...',
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      };
      
      if (res.statusCode >= 400) {
        console.warn(`⚠️ ${operationType} failed:`, logData);
      } else {
        console.log(`✅ ${operationType}:`, logData);
      }
    });
    
    next();
  };
};

module.exports = {
  verifyUserExists,
  validateProfileComplete,
  enforceOneSeatPerUser,
  validateSeatAvailability,
  validatePaymentData,
  validateShift,
  rateLimit,
  auditLog
};
