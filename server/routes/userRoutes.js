const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { emitProfileUpdated, emitUserRegistered, emitPaymentStatusUpdate } = require('../socket/socketManager');

/**
 * User Routes
 * 
 * These routes handle user CRUD operations.
 * Firebase handles authentication, these routes handle user data in MongoDB.
 * Socket.IO events are emitted for real-time updates.
 */

/**
 * POST /api/users/register
 * 
 * Register a new user after Firebase authentication.
 * Creates a MongoDB document with user details.
 * 
 * This endpoint is idempotent - calling it multiple times
 * with the same firebaseUid will return the existing user.
 * 
 * Request body:
 * - firebaseUid: string (required) - From Firebase Auth
 * - name: string (required) - User's full name
 * - email: string (required) - User's email
 * - phone: string (required) - User's phone number
 * - profilePicture: string (optional) - From Google profile
 */
router.post('/register', async (req, res) => {
  try {
    const { firebaseUid, name, email, phone, profilePicture } = req.body;

    // Validate required fields
    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Firebase UID is required'
      });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Name is required (minimum 2 characters)'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Validate phone format (Indian mobile number)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid 10-digit Indian mobile number'
      });
    }

    // Check if user already exists by firebaseUid
    let user = await User.findOne({ firebaseUid });

    if (user) {
      // User already exists - return existing user
      console.log(`ℹ️  User already registered: ${email}`);
      return res.json({
        success: true,
        message: 'User already registered',
        user: user,
        isNew: false
      });
    }

    // Check if email is already used by another user
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'This email is already registered with another account'
      });
    }

    // Check if phone is already used by another user
    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        error: 'This phone number is already registered with another account'
      });
    }

    // Create new user with photoURL field (matches User model)
    user = new User({
      firebaseUid,
      fullName: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      role: 'student',
      photoURL: profilePicture || null, // Map profilePicture from request to photoURL in DB
      seat: {
        seatNumber: null,
        shift: null,
        bookedAt: null,
        validUntil: null,
        status: null
      },
      payment: {
        paymentStatus: 'pending'
      }
    });

    await user.save();

    console.log(`✅ New user registered: ${email}`);

    // Emit Socket.IO event for real-time admin updates
    emitUserRegistered({
      userId: firebaseUid,
      name: user.fullName,
      email: user.email
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: user,
      isNew: true
    });

  } catch (error) {
    console.error('❌ Error registering user:', error);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `This ${field} is already registered`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to register user'
    });
  }
});

/**
 * GET /api/users/:firebaseUid
 * 
 * Get user by Firebase UID.
 * Returns user data from MongoDB.
 */
router.get('/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Firebase UID is required'
      });
    }

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        needsRegistration: true
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

/**
 * PUT /api/users/:firebaseUid
 * 
 * Update user profile.
 * Only allows updating certain fields.
 */
router.put('/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { 
      fullName, 
      name, 
      phone, 
      fatherName,
      dateOfBirth,
      fullAddress,
      phoneNumber,
      profilePhoto,
      profilePicture,
      gender,
      userId
    } = req.body;

    console.log('📝 Update Profile Request:', { firebaseUid, body: req.body });

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Update allowed fields (support both old and new field names)
    if (fullName !== undefined || name !== undefined) {
      user.fullName = (fullName || name).trim();
    }
    
    if (phone !== undefined || phoneNumber !== undefined) {
      const phoneValue = phone || phoneNumber;
      // Validate phone format
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phoneRegex.test(phoneValue)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid 10-digit Indian mobile number'
        });
      }
      user.phone = phoneValue.trim();
    }
    
    // Update profile details
    if (fatherName !== undefined) {
      user.profile.fatherName = fatherName.trim();
    }
    
    if (dateOfBirth !== undefined) {
      user.profile.dateOfBirth = dateOfBirth;
    }
    
    if (fullAddress !== undefined) {
      user.profile.address = user.profile.address || {};
      user.profile.address.full = fullAddress.trim();
    }
    
    // Handle profile photo - support both profilePhoto and profilePicture
    if (profilePhoto !== undefined || profilePicture !== undefined) {
      user.photoURL = profilePhoto || profilePicture;
    }

    if (gender !== undefined) {
      user.profile.gender = gender || null;
    }

    if (userId !== undefined) {
      user.profile.userId = userId;
    }

    await user.save();

    console.log(`✅ User updated: ${user.email}`);

    // Emit Socket.IO event for real-time updates
    emitProfileUpdated({
      userId: firebaseUid,
      name: user.name,
      email: user.email,
      phone: user.phone
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: user
    });

  } catch (error) {
    console.error('❌ Error updating user:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      console.error('❌ Validation Error Details:', messages);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

/**
 * PUT /api/users/:firebaseUid/seat
 * 
 * Update user's seat booking.
 * Called after successful payment verification.
 */
router.put('/:firebaseUid/seat', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { seatNumber, shift, validUntil } = req.body;

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.seat = {
      seatNumber,
      shift,
      bookedAt: new Date(),
      validUntil: new Date(validUntil),
      status: 'active'
    };

    await user.save();

    console.log(`✅ Seat ${seatNumber} assigned to user: ${user.email}`);

    res.json({
      success: true,
      message: 'Seat assigned successfully',
      user: user
    });

  } catch (error) {
    console.error('❌ Error updating seat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update seat'
    });
  }
});

/**
 * DELETE /api/users/:firebaseUid/seat
 * 
 * Clear user's seat booking.
 * Called when seat is released or expired.
 */
router.delete('/:firebaseUid/seat', async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await user.clearSeat();

    console.log(`✅ Seat cleared for user: ${user.email}`);

    res.json({
      success: true,
      message: 'Seat cleared successfully',
      user: user
    });

  } catch (error) {
    console.error('❌ Error clearing seat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear seat'
    });
  }
});

/**
 * PUT /api/users/:firebaseUid/payment-status
 * 
 * Update user's payment status.
 */
router.put('/:firebaseUid/payment-status', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    const { paymentStatus } = req.body;

    const validStatuses = ['PENDING', 'PAID', 'OVERDUE', 'EXEMPT'];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment status'
      });
    }

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.paymentStatus = paymentStatus;
    await user.save();

    console.log(`✅ Payment status updated for user: ${user.email} - ${paymentStatus}`);

    // Emit Socket.IO event for real-time updates
    emitPaymentStatusUpdate({
      userId: firebaseUid,
      paymentStatus
    });

    res.json({
      success: true,
      message: 'Payment status updated',
      user: user
    });

  } catch (error) {
    console.error('❌ Error updating payment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status'
    });
  }
});

/**
 * GET /api/users/check/email/:email
 * 
 * Check if email is already registered.
 */
router.get('/check/email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email: email.toLowerCase() });

    res.json({
      success: true,
      exists: !!user
    });
  } catch (error) {
    console.error('❌ Error checking email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email'
    });
  }
});

/**
 * GET /api/users/check/phone/:phone
 * 
 * Check if phone is already registered.
 */
router.get('/check/phone/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const user = await User.findOne({ phone });

    res.json({
      success: true,
      exists: !!user
    });
  } catch (error) {
    console.error('❌ Error checking phone:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check phone'
    });
  }
});

module.exports = router;
