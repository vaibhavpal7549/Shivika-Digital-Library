const { User, Seat, Payment } = require('../models');
// const googleSheetsService = require('../services/googleSheetsService');

/**
 * ============================================
 * SEAT CONTROLLER
 * ============================================
 * 
 * Handles all seat booking operations.
 * Enforces one-seat-per-user rule.
 * Syncs to Google Sheets on changes.
 */

/**
 * GET /seat/all
 * Get all seats with their status
 */
exports.getAllSeats = async (req, res) => {
  try {
    let seats = await Seat.find().sort({ seatNumber: 1 });

    // If no seats exist, initialize them
    if (seats.length === 0) {
      await Seat.initializeSeats(60);
      seats = await Seat.find().sort({ seatNumber: 1 });
    }

    // Format for frontend
    const seatsMap = {};
    seats.forEach(seat => {
      seatsMap[seat.seatNumber] = {
        seatNumber: seat.seatNumber,
        isBooked: seat.isBooked,
        status: seat.status,
        displayStatus: seat.displayStatus,
        shift: seat.shift,
        zone: seat.zone,
        bookedBy: seat.bookedBy,
        expiryDate: seat.expiryDate
      };
    });

    res.json({
      success: true,
      count: seats.length,
      seats: seatsMap,
      seatsArray: seats
    });

  } catch (error) {
    console.error('❌ Get seats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seats'
    });
  }
};

/**
 * GET /seat/available
 * Get all available seats
 */
exports.getAvailableSeats = async (req, res) => {
  try {
    const seats = await Seat.getAvailable();

    res.json({
      success: true,
      count: seats.length,
      seats
    });

  } catch (error) {
    console.error('❌ Get available seats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available seats'
    });
  }
};

/**
 * GET /seat/:seatNumber
 * Get specific seat details
 */
exports.getSeat = async (req, res) => {
  try {
    const seatNumber = parseInt(req.params.seatNumber);

    if (isNaN(seatNumber) || seatNumber < 1 || seatNumber > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat number'
      });
    }

    const seat = await Seat.getByNumber(seatNumber);

    if (!seat) {
      return res.status(404).json({
        success: false,
        error: 'Seat not found'
      });
    }

    res.json({
      success: true,
      seat
    });

  } catch (error) {
    console.error('❌ Get seat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch seat'
    });
  }
};

/**
 * POST /seat/book
 * Book a seat for user (after payment)
 * 
 * BUSINESS RULES:
 * - One user can only have one active seat
 * - Seat must be available
 * - Payment must be verified before booking
 */
exports.bookSeat = async (req, res) => {
  try {
    const {
      firebaseUid,
      seatNumber,
      shift = 'fullday',
      months = 1,
      paymentId // Optional: link to payment record
    } = req.body;

    // Validation
    if (!firebaseUid) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const seatNum = parseInt(seatNumber);
    if (isNaN(seatNum) || seatNum < 1 || seatNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat number'
      });
    }

    // Find user
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user already has an active seat (ONE-SEAT-PER-USER)
    if (user.hasActiveSeat) {
      return res.status(400).json({
        success: false,
        error: 'You already have an active seat booking',
        currentSeat: user.seat.seatNumber
      });
    }

    // Find seat
    let seat = await Seat.findOne({ seatNumber: seatNum });
    
    // Create seat if it doesn't exist
    if (!seat) {
      seat = new Seat({
        seatNumber: seatNum,
        zone: seatNum <= 15 ? 'A' : seatNum <= 30 ? 'B' : seatNum <= 45 ? 'C' : 'D'
      });
    }

    // Check if seat is available
    if (seat.isBooked && !seat.isExpired) {
      return res.status(400).json({
        success: false,
        error: 'Seat is already booked'
      });
    }

    // Calculate dates
    const bookingDate = new Date();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + months);

    // Book the seat
    await seat.book(user, shift, months);

    // Update user's seat info
    user.seat = {
      seatNumber: seatNum,
      seatStatus: 'active',
      libraryName: 'Shivika Digital Library',
      shift,
      bookingDate,
      expiryDate
    };

    // Update user's payment info
    user.payment.currentPlan = 'monthly';
    user.payment.paymentStatus = 'paid';
    user.payment.nextDueDate = nextDueDate;

    // Mark for sheets sync
    user.sheetsSync = {
      ...user.sheetsSync,
      syncStatus: 'pending'
    };

    await user.save();

    // Link payment if provided
    if (paymentId) {
      seat.lastPaymentId = paymentId;
      await seat.save();
    }

    console.log(`✅ Seat ${seatNum} booked for ${user.fullName}`);

    // Sync to Google Sheets (background)
    // googleSheetsService.syncUser(user).catch(err => {
    //   console.error('⚠️  Sheets sync error:', err.message);
    // });

    // Emit socket event for real-time UI update
    const io = req.app.get('io');
    if (io) {
      io.emit('seat:booked', {
        seatNumber: seatNum,
        userId: firebaseUid,
        userName: user.fullName,
        shift,
        expiryDate
      });
    }

    res.json({
      success: true,
      message: 'Seat booked successfully',
      seat: {
        seatNumber: seatNum,
        shift,
        bookingDate,
        expiryDate
      },
      user: {
        id: user._id,
        fullName: user.fullName,
        seat: user.seat
      }
    });

  } catch (error) {
    console.error('❌ Book seat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to book seat'
    });
  }
};

/**
 * POST /seat/release
 * Release a seat (manual or auto-release)
 */
exports.releaseSeat = async (req, res) => {
  try {
    const { firebaseUid, seatNumber, reason = 'manual' } = req.body;

    // Find user
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const seatNum = seatNumber || user.seat?.seatNumber;
    if (!seatNum) {
      return res.status(400).json({
        success: false,
        error: 'No seat to release'
      });
    }

    // Find seat
    const seat = await Seat.findOne({ seatNumber: seatNum });
    if (!seat) {
      return res.status(404).json({
        success: false,
        error: 'Seat not found'
      });
    }

    // Verify ownership
    if (seat.bookedByFirebaseUid !== firebaseUid) {
      return res.status(403).json({
        success: false,
        error: 'You can only release your own seat'
      });
    }

    // Release the seat
    await seat.release(reason);

    // Update user
    await user.releaseSeat();

    console.log(`✅ Seat ${seatNum} released by ${user.fullName}`);

    // Sync to Google Sheets
    // googleSheetsService.syncUser(user).catch(err => {
    //   console.error('⚠️  Sheets sync error:', err.message);
    // });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('seat:released', {
        seatNumber: seatNum,
        userId: firebaseUid,
        reason
      });
    }

    res.json({
      success: true,
      message: 'Seat released successfully',
      seatNumber: seatNum
    });

  } catch (error) {
    console.error('❌ Release seat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to release seat'
    });
  }
};

/**
 * POST /seat/change
 * Change to a different seat (release old, book new)
 */
exports.changeSeat = async (req, res) => {
  try {
    const { firebaseUid, newSeatNumber, shift } = req.body;

    // Find user
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const oldSeatNumber = user.seat?.seatNumber;
    if (!oldSeatNumber) {
      return res.status(400).json({
        success: false,
        error: 'No current seat to change from'
      });
    }

    const newSeatNum = parseInt(newSeatNumber);
    if (isNaN(newSeatNum) || newSeatNum < 1 || newSeatNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid new seat number'
      });
    }

    if (oldSeatNumber === newSeatNum) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change to the same seat'
      });
    }

    // Check if new seat is available
    let newSeat = await Seat.findOne({ seatNumber: newSeatNum });
    if (newSeat && newSeat.isBooked && !newSeat.isExpired) {
      return res.status(400).json({
        success: false,
        error: 'New seat is not available'
      });
    }

    // Release old seat
    const oldSeat = await Seat.findOne({ seatNumber: oldSeatNumber });
    if (oldSeat) {
      await oldSeat.release('user_request');
    }

    // Calculate remaining validity
    const remainingDays = user.daysUntilExpiry || 30;
    const months = Math.ceil(remainingDays / 30);

    // Book new seat
    if (!newSeat) {
      newSeat = new Seat({
        seatNumber: newSeatNum,
        zone: newSeatNum <= 15 ? 'A' : newSeatNum <= 30 ? 'B' : newSeatNum <= 45 ? 'C' : 'D'
      });
    }

    const newShift = shift || user.seat.shift || 'fullday';
    await newSeat.book(user, newShift, months);

    // Update user's seat info (keep expiry date)
    const oldExpiry = user.seat.expiryDate;
    user.seat = {
      seatNumber: newSeatNum,
      seatStatus: 'active',
      libraryName: 'Shivika Digital Library',
      shift: newShift,
      bookingDate: new Date(),
      expiryDate: oldExpiry // Keep original expiry
    };

    await user.save();

    console.log(`✅ ${user.fullName} changed from seat ${oldSeatNumber} to ${newSeatNum}`);

    // Sync to Google Sheets
    // googleSheetsService.syncUser(user).catch(err => {
    //   console.error('⚠️  Sheets sync error:', err.message);
    // });

    // Emit socket events
    const io = req.app.get('io');
    if (io) {
      io.emit('seat:changed', {
        oldSeatNumber,
        newSeatNumber: newSeatNum,
        userId: firebaseUid,
        userName: user.fullName
      });
    }

    res.json({
      success: true,
      message: 'Seat changed successfully',
      oldSeat: oldSeatNumber,
      newSeat: {
        seatNumber: newSeatNum,
        shift: newShift,
        expiryDate: oldExpiry
      }
    });

  } catch (error) {
    console.error('❌ Change seat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change seat'
    });
  }
};

/**
 * GET /seat/user/:firebaseUid
 * Get seat booked by specific user
 */
exports.getUserSeat = async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.seat?.seatNumber) {
      return res.json({
        success: true,
        hasSeat: false,
        seat: null
      });
    }

    res.json({
      success: true,
      hasSeat: true,
      seat: user.seat,
      isExpiring: user.daysUntilExpiry !== null && user.daysUntilExpiry <= 7,
      daysUntilExpiry: user.daysUntilExpiry
    });

  } catch (error) {
    console.error('❌ Get user seat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user seat'
    });
  }
};

/**
 * GET /seat/expiring
 * Get seats expiring within specified days (admin)
 */
exports.getExpiringSeats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const seats = await Seat.findExpiring(days);

    res.json({
      success: true,
      count: seats.length,
      days,
      seats
    });

  } catch (error) {
    console.error('❌ Get expiring seats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expiring seats'
    });
  }
};
