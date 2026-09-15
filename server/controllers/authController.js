const { User, Seat, Payment } = require("../models");
const { validateAndNormalizeIdentity } = require("../utils/identityUtils");
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

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address'
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Normalize phone: strip +91, leading 0, spaces, dashes
    let normalizedPhone = phone.replace(/[\s\-().]/g, '');
    if (normalizedPhone.startsWith('+91')) {
      normalizedPhone = normalizedPhone.substring(3);
    } else if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
      normalizedPhone = normalizedPhone.substring(2);
    } else if (normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
      normalizedPhone = normalizedPhone.substring(1);
    }
    normalizedPhone = normalizedPhone.trim();

    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Valid 10-digit Indian phone number is required'
      });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists by firebaseUid
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

    // Check BOTH email and phone uniqueness simultaneously
    const [existingEmail, existingPhone] = await Promise.all([
      User.findOne({ email: normalizedEmail }),
      User.findOne({ phone: normalizedPhone })
    ]);

    const errors = [];
    if (existingEmail) {
      errors.push('This email address is already registered with another user.');
    }
    if (existingPhone) {
      errors.push('This phone number is already registered with another user.');
    }

    if (errors.length === 2) {
      return res.status(400).json({
        success: false,
        error: 'Both phone number and email address are already registered.',
        details: errors
      });
    } else if (errors.length === 1) {
      return res.status(400).json({
        success: false,
        error: errors[0]
      });
    }

    // Create new user
    user = new User({
      firebaseUid,
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
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
    console.log(`✅ New user registered: ${normalizedEmail}`);

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

    // Handle duplicate key error (race condition safety net)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      let message = 'This credential is already registered.';
      if (field === 'phone') {
        message = 'This phone number is already registered with another user.';
      } else if (field === 'email') {
        message = 'This email address is already registered with another user.';
      } else if (field === 'firebaseUid') {
        message = 'This account is already registered.';
      }
      return res.status(400).json({
        success: false,
        error: message
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

    console.log("🔵 Login attempt:", {
      firebaseUid: firebaseUid
        ? `${firebaseUid.substring(0, 10)}...`
        : "missing",
      email,
      fullName,
    });

    if (!firebaseUid) {
      console.error("❌ Login failed: No Firebase UID provided");
      return res.status(400).json({
        success: false,
        error: "Firebase UID is required",
      });
    }

    const user = await User.findOne({ firebaseUid });

    if (!user) {
      console.log(
        `ℹ️ User not found in MongoDB for UID: ${firebaseUid.substring(0, 10)}...`,
      );
      console.log("ℹ️ This user needs to complete registration");

      return res.status(404).json({
        success: false,
        error: "User not found",
        needsRegistration: true,
      });
    }

    console.log(`✅ User found: ${user.fullName} (${user.email})`);
    console.log(`   - Has phone: ${user.phone ? "Yes" : "No"}`);
    console.log(`   - Profile complete: ${user.phone ? "Yes" : "No"}`);

    // Update user details from login payload
    let updates = { lastLogin: new Date() };

    // Only update fields if they are provided and different
    if (email && user.email !== email) {
      console.log(`   - Updating email: ${user.email} → ${email}`);
      updates.email = email;
    }
    if (fullName && user.fullName !== fullName) {
      console.log(`   - Updating name: ${user.fullName} → ${fullName}`);
      updates.fullName = fullName;
    }
    if (photoURL && user.photoURL !== photoURL) {
      console.log(`   - Updating photo URL`);
      updates.photoURL = photoURL;
    }

    // Apply updates
    Object.assign(user, updates);
    await user.save();

    console.log(`✅ Login successful for: ${user.fullName}`);

    res.json({
      success: true,
      message: "Login successful",
      user,
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
};

/**
 * GET /user/:id
 * Get user by Firebase UID or MongoDB ID
 */
exports.getUser = async (req, res) => {
  try {
    const id = req.params.firebaseUid || req.params.id;

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
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("❌ Get user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user",
    });
  }
};

/**
 * PUT /user/:id
 * Update user profile
 */
exports.updateUser = async (req, res) => {
  try {
    const id = req.params.firebaseUid || req.params.id;
    const updates = req.body;

    // Fields that can be updated
    const allowedUpdates = ["fullName", "phone", "photoURL", "profile"];

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
        error: "User not found",
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
      message: "Profile updated",
      user,
    });
  } catch (error) {
    console.error("❌ Update user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update user",
    });
  }
};
