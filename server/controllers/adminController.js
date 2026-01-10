const { User, Seat, Payment } = require('../models');
const googleSheetsService = require('../services/googleSheetsService');

/**
 * ============================================
 * ADMIN CONTROLLER
 * ============================================
 * 
 * Admin operations for managing users, seats, and payments.
 * All changes sync to Google Sheets for admin dashboard.
 */

/**
 * GET /admin/users
 * Get all users with seat and payment info
 */
exports.getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      seatStatus,
      paymentStatus,
      search
    } = req.query;

    const query = { role: { $ne: 'admin' } }; // Exclude admins

    // Filters
    if (status) query.status = status;
    if (seatStatus) query['seat.seatStatus'] = seatStatus;
    if (paymentStatus) query['payment.paymentStatus'] = paymentStatus;

    // Search
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select('-password'),
      User.countDocuments(query)
    ]);

    // Calculate stats
    const stats = {
      total,
      active: users.filter(u => u.hasActiveSeat).length,
      inactive: users.filter(u => !u.hasActiveSeat).length,
      paid: users.filter(u => u.payment.paymentStatus === 'paid').length,
      overdue: users.filter(u => u.payment.paymentStatus === 'overdue').length
    };

    res.json({
      success: true,
      users: users.map(u => ({
        id: u._id,
        firebaseUid: u.firebaseUid,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        seat: u.seat,
        payment: u.payment,
        hasActiveSeat: u.hasActiveSeat,
        daysUntilExpiry: u.daysUntilExpiry,
        isPaymentOverdue: u.isPaymentOverdue,
        status: u.status,
        createdAt: u.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats
    });

  } catch (error) {
    console.error('❌ Get all users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
};

/**
 * GET /admin/user/:id
 * Get single user details
 */
exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get payment history from Payment collection
    const payments = await Payment.getUserPayments(user.firebaseUid);

    res.json({
      success: true,
      user: {
        ...user.toObject(),
        hasActiveSeat: user.hasActiveSeat,
        daysUntilExpiry: user.daysUntilExpiry,
        isPaymentOverdue: user.isPaymentOverdue
      },
      payments
    });

  } catch (error) {
    console.error('❌ Get user details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details'
    });
  }
};

/**
 * PUT /admin/user/:id
 * Update user details
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be directly updated
    delete updates._id;
    delete updates.firebaseUid;
    delete updates.password;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates, 'sheetsSync.syncStatus': 'pending' },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Sync to Google Sheets
    googleSheetsService.syncUser(user).catch(err => {
      console.error('⚠️  Sheets sync error:', err.message);
    });

    res.json({
      success: true,
      message: 'User updated successfully',
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

/**
 * PUT /admin/payment/update
 * Admin update payment status (mark paid, overdue, etc.)
 */
exports.updatePaymentStatus = async (req, res) => {
  try {
    const {
      firebaseUid,
      userId,
      paymentStatus,
      amount,
      months = 1,
      notes,
      adminId
    } = req.body;

    // Find user
    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (firebaseUid) {
      user = await User.findOne({ firebaseUid });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const previousStatus = user.payment.paymentStatus;

    // Update payment status
    user.payment.paymentStatus = paymentStatus;

    if (paymentStatus === 'paid' && amount) {
      // Add payment record
      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + months);

      const orderId = `ADMIN_${Date.now()}_${user.firebaseUid.slice(-6)}`;
      const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).slice(-6)}`;

      await user.addPayment({
        paymentId: orderId,
        orderId,
        amount,
        date: new Date(),
        paymentMode: 'cash',
        status: 'success',
        type: 'fee_payment',
        monthsPaid: months,
        receiptNumber,
        collectedBy: adminId,
        notes
      });

      user.payment.lastPaymentDate = new Date();
      user.payment.lastPaymentAmount = amount;
      user.payment.nextDueDate = nextDueDate;
      user.payment.totalAmountPaid = (user.payment.totalAmountPaid || 0) + amount;

      // Create Payment record
      const payment = new Payment({
        userId: user._id,
        firebaseUid: user.firebaseUid,
        type: 'fee_payment',
        orderId,
        amount,
        paymentMode: 'cash',
        status: 'success',
        verificationStatus: 'verified_manual',
        monthsPaidFor: months,
        receiptNumber,
        seatNumber: user.seat?.seatNumber,
        periodStart: new Date(),
        periodEnd: nextDueDate,
        verifiedAt: new Date(),
        adminAction: {
          actionType: 'admin_payment_update',
          actionBy: adminId,
          actionDate: new Date(),
          previousStatus,
          newStatus: paymentStatus,
          notes
        }
      });

      await payment.save();

      // Extend seat if active
      if (user.hasActiveSeat && user.seat?.seatNumber) {
        const seat = await Seat.findOne({ seatNumber: user.seat.seatNumber });
        if (seat) {
          await seat.extendBooking(months);
        }

        user.seat.expiryDate = new Date(user.seat.expiryDate);
        user.seat.expiryDate.setMonth(user.seat.expiryDate.getMonth() + months);
      }

      // Sync payment to sheets
      googleSheetsService.syncPayment(payment, user).catch(err => {
        console.error('⚠️  Sheets sync error:', err.message);
      });
    }

    user.sheetsSync.syncStatus = 'pending';
    await user.save();

    console.log(`✅ Admin updated payment for ${user.fullName}: ${previousStatus} → ${paymentStatus}`);

    // Sync user to Google Sheets
    googleSheetsService.syncUser(user).catch(err => {
      console.error('⚠️  Sheets sync error:', err.message);
    });

    res.json({
      success: true,
      message: 'Payment status updated',
      user: {
        id: user._id,
        fullName: user.fullName,
        payment: user.payment,
        seat: user.seat
      }
    });

  } catch (error) {
    console.error('❌ Update payment status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update payment status'
    });
  }
};

/**
 * GET /admin/overdue
 * Get users with overdue payments
 */
exports.getOverdueUsers = async (req, res) => {
  try {
    const users = await User.findOverduePayments();

    res.json({
      success: true,
      count: users.length,
      users: users.map(u => ({
        id: u._id,
        firebaseUid: u.firebaseUid,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        seat: u.seat,
        payment: u.payment,
        daysPastDue: u.payment.nextDueDate 
          ? Math.floor((new Date() - u.payment.nextDueDate) / (1000 * 60 * 60 * 24))
          : 0
      }))
    });

  } catch (error) {
    console.error('❌ Get overdue users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overdue users'
    });
  }
};

/**
 * GET /admin/expiring
 * Get users with expiring seats
 */
exports.getExpiringSeats = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const users = await User.findExpiringSeats(days);

    res.json({
      success: true,
      count: users.length,
      days,
      users: users.map(u => ({
        id: u._id,
        firebaseUid: u.firebaseUid,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        seat: u.seat,
        payment: u.payment,
        daysUntilExpiry: u.daysUntilExpiry
      }))
    });

  } catch (error) {
    console.error('❌ Get expiring seats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch expiring seats'
    });
  }
};

/**
 * POST /admin/seat/release
 * Admin force release a seat
 */
exports.forceReleaseSeat = async (req, res) => {
  try {
    const { seatNumber, adminId, reason = 'admin_action' } = req.body;

    const seatNum = parseInt(seatNumber);
    if (isNaN(seatNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat number'
      });
    }

    const seat = await Seat.findOne({ seatNumber: seatNum });
    if (!seat) {
      return res.status(404).json({
        success: false,
        error: 'Seat not found'
      });
    }

    if (!seat.isBooked) {
      return res.status(400).json({
        success: false,
        error: 'Seat is not booked'
      });
    }

    // Find user
    const user = await User.findOne({ firebaseUid: seat.bookedByFirebaseUid });
    
    // Release seat
    await seat.release(`${reason}_by_admin`);

    // Update user if found
    if (user) {
      await user.releaseSeat();
      user.sheetsSync.syncStatus = 'pending';
      await user.save();

      // Sync to Google Sheets
      googleSheetsService.syncUser(user).catch(err => {
        console.error('⚠️  Sheets sync error:', err.message);
      });
    }

    console.log(`✅ Admin released seat ${seatNum} (${reason})`);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('seat:released', {
        seatNumber: seatNum,
        reason: 'admin_action',
        adminId
      });
    }

    res.json({
      success: true,
      message: 'Seat released successfully',
      seatNumber: seatNum
    });

  } catch (error) {
    console.error('❌ Force release seat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to release seat'
    });
  }
};

/**
 * POST /admin/seat/assign
 * Admin assign a seat to user
 */
exports.assignSeat = async (req, res) => {
  try {
    const {
      firebaseUid,
      seatNumber,
      shift = 'fullday',
      months = 1,
      adminId
    } = req.body;

    // Find user
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const seatNum = parseInt(seatNumber);
    if (isNaN(seatNum) || seatNum < 1 || seatNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid seat number'
      });
    }

    // Check if user already has a seat
    if (user.hasActiveSeat) {
      return res.status(400).json({
        success: false,
        error: 'User already has an active seat',
        currentSeat: user.seat.seatNumber
      });
    }

    // Find or create seat
    let seat = await Seat.findOne({ seatNumber: seatNum });
    if (!seat) {
      seat = new Seat({
        seatNumber: seatNum,
        zone: seatNum <= 15 ? 'A' : seatNum <= 30 ? 'B' : seatNum <= 45 ? 'C' : 'D'
      });
    }

    // Check availability
    if (seat.isBooked && !seat.isExpired) {
      return res.status(400).json({
        success: false,
        error: 'Seat is already booked'
      });
    }

    // Book the seat
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    await seat.book(user, shift, months);

    // Update user
    user.seat = {
      seatNumber: seatNum,
      seatStatus: 'active',
      libraryName: 'Shivika Digital Library',
      shift,
      bookingDate: new Date(),
      expiryDate
    };

    user.payment.nextDueDate = expiryDate;
    user.sheetsSync.syncStatus = 'pending';
    await user.save();

    console.log(`✅ Admin assigned seat ${seatNum} to ${user.fullName}`);

    // Sync to Google Sheets
    googleSheetsService.syncUser(user).catch(err => {
      console.error('⚠️  Sheets sync error:', err.message);
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('seat:booked', {
        seatNumber: seatNum,
        userId: firebaseUid,
        userName: user.fullName,
        adminAssigned: true
      });
    }

    res.json({
      success: true,
      message: 'Seat assigned successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        seat: user.seat
      }
    });

  } catch (error) {
    console.error('❌ Assign seat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign seat'
    });
  }
};

/**
 * GET /admin/stats
 * Get dashboard statistics
 */
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeSeats,
      availableSeats,
      paidUsers,
      overdueUsers,
      expiringIn7Days,
      todayPayments,
      monthRevenue
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }),
      Seat.countDocuments({ isBooked: true }),
      Seat.countDocuments({ isBooked: false }),
      User.countDocuments({ 'payment.paymentStatus': 'paid' }),
      User.countDocuments({ 'payment.paymentStatus': 'overdue' }),
      User.countDocuments({
        'seat.expiryDate': {
          $gt: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      }),
      Payment.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        status: 'success'
      }),
      Payment.getTotalRevenue(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        new Date()
      )
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          paid: paidUsers,
          overdue: overdueUsers
        },
        seats: {
          active: activeSeats,
          available: availableSeats,
          total: activeSeats + availableSeats,
          expiringIn7Days
        },
        payments: {
          todayCount: todayPayments,
          monthRevenue
        }
      }
    });

  } catch (error) {
    console.error('❌ Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
};

/**
 * POST /admin/sync-sheets
 * Force sync all data to Google Sheets
 */
exports.syncToSheets = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } });
    
    await googleSheetsService.batchSyncUsers(users);

    res.json({
      success: true,
      message: `Synced ${users.length} users to Google Sheets`
    });

  } catch (error) {
    console.error('❌ Sync to sheets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync to Google Sheets'
    });
  }
};

/**
 * DELETE /admin/user/:id
 * Delete user (soft delete)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Release seat if booked
    if (user.seat?.seatNumber) {
      const seat = await Seat.findOne({ seatNumber: user.seat.seatNumber });
      if (seat) {
        await seat.release('user_deleted');
      }
    }

    // Soft delete
    user.status = 'deleted';
    user.deletedAt = new Date();
    await user.save();

    // Remove from Google Sheets
    googleSheetsService.deleteUserRow(user.firebaseUid).catch(err => {
      console.error('⚠️  Sheets delete error:', err.message);
    });

    console.log(`✅ User deleted: ${user.fullName}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
};
