const { User, Seat, Payment } = require('../models');
// const googleSheetsService = require('../services/googleSheetsService');

/**
 * ============================================
 * AUTH CONTROLLER
 * ============================================
 * 
 * Handles user authentication and registration.
 * Firebase handles actual auth, this manages MongoDB user records.
 */

/**
 * POST /auth/signup
 * Register new user after Firebase authentication
 */
exports.signup = async (req, res) => {
  try {
    const {
      firebaseUid,
      fullName,
      email,
      phone,
      photoURL,
      provider = 'email',
      profile = {}
    } = req.body;

    // Validation
    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'Firebase UID is required'
      });
    }

    if (!fullName || fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Full name is required (minimum 2 characters)'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Valid 10-digit Indian phone number is required'
      });
    }

    // Check if user already exists
    let user = await User.findOne({ firebaseUid });
    if (user) {
      // Update last login and return existing user
      user.lastLogin = new Date();
      await user.save();

      return res.json({
        success: true,
        message: 'User already registered',
        user,
        isNew: false
      });
    }

    // Check for duplicate email or phone
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already registered'
      });
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number already registered'
      });
    }

    // Create new user
    user = new User({
      firebaseUid,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      photoURL,
      provider,
      profile: {
        gender: profile.gender || null,
        dateOfBirth: profile.dateOfBirth || null,
        fatherName: profile.fatherName || null,
        address: profile.address || {},
        studentId: profile.studentId || null,
        collegeName: profile.collegeName || null,
        emergencyContact: profile.emergencyContact || {}
      },
      lastLogin: new Date()
    });

    await user.save();
    console.log(`✅ New user registered: ${email}`);

    // Sync to Google Sheets (background, don't block response)
    // googleSheetsService.syncUser(user).catch(err => {
    //   console.error('⚠️  Sheets sync error:', err.message);
    // });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      isNew: true
    });

  } catch (error) {
    console.error('❌ Signup error:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
};

/**
 * POST /auth/login
 * Update last login and return user data
 */
exports.login = async (req, res) => {
  try {
    const { firebaseUid, email, fullName, photoURL } = req.body;

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

    // Update user details from login payload (Sync Google Data)
    let updates = { lastLogin: new Date() };
    
    // Only update fields if they are provided and different
    if (email && user.email !== email) updates.email = email;
    if (fullName && user.fullName !== fullName) updates.fullName = fullName;
    if (photoURL && user.photoURL !== photoURL) updates.photoURL = photoURL;

    // Apply updates
    Object.assign(user, updates);
    await user.save();

    res.json({
      success: true,
      message: 'Login successful',
      user
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
};

/**
 * GET /user/:id
 * Get user by Firebase UID or MongoDB ID
 */
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;

    let user;
    
    // Check if it's a MongoDB ObjectId or Firebase UID
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(id);
    } else {
      user = await User.findOne({ firebaseUid: id });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
};

/**
 * PUT /user/:id
 * Update user profile
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fields that can be updated
    const allowedUpdates = [
      'fullName', 'phone', 'photoURL', 'profile'
    ];

    // Filter updates
    const filteredUpdates = {};
    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }

    let user;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      user = await User.findById(id);
    } else {
      user = await User.findOne({ firebaseUid: id });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Apply updates
    Object.assign(user, filteredUpdates);

    // Handle nested profile updates
    if (updates.profile) {
      user.profile = { ...user.profile.toObject(), ...updates.profile };
    }

    await user.save();

    // Sync to Google Sheets
    // googleSheetsService.syncUser(user).catch(err => {
    //   console.error('⚠️  Sheets sync error:', err.message);
    // });

    res.json({
      success: true,
      message: 'Profile updated',
      user
    });

  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
};
