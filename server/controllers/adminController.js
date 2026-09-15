const { User, Seat, Payment } = require("../models");
const { syncSeatToFirebase, deleteUserFromFirebase } = require("../services/firebaseSyncService");

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
      search,
    } = req.query;

    const query = { role: { $ne: "admin" } }; // Exclude admins

    // Filters
    if (status) query.status = status;
    if (seatStatus) query["seat.seatStatus"] = seatStatus;
    if (paymentStatus) query["payment.paymentStatus"] = paymentStatus;

    // Search
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .select("-password"),
      User.countDocuments(query),
    ]);

    // Calculate stats
    const stats = {
      total,
      active: users.filter((u) => u.hasActiveSeat).length,
      inactive: users.filter((u) => !u.hasActiveSeat).length,
      paid: users.filter((u) => u.payment.paymentStatus === "paid").length,
      overdue: users.filter((u) => u.payment.paymentStatus === "overdue")
        .length,
    };

    res.json({
      success: true,
      users: users.map((u) => ({
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
        createdAt: u.createdAt,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
      stats,
    });
  } catch (error) {
    console.error("❌ Get all users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch users",
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

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
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
        isPaymentOverdue: user.isPaymentOverdue,
      },
      payments,
    });
  } catch (error) {
    console.error("❌ Get user details error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch user details",
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
      { $set: updates },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
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
      adminId,
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
        error: "User not found",
      });
    }

    const previousStatus = user.payment.paymentStatus;

    // Update payment status
    user.payment.paymentStatus = paymentStatus;

    if (paymentStatus === "paid" && amount) {
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
        paymentMode: "cash",
        status: "success",
        type: "fee_payment",
        monthsPaid: months,
        receiptNumber,
        collectedBy: adminId,
        notes,
      });

      user.payment.lastPaymentDate = new Date();
      user.payment.lastPaymentAmount = amount;
      user.payment.nextDueDate = nextDueDate;
      user.payment.totalAmountPaid =
        (user.payment.totalAmountPaid || 0) + amount;

      // Create Payment record
      const payment = new Payment({
        userId: user._id,
        firebaseUid: user.firebaseUid,
        type: "fee_payment",
        orderId,
        amount,
        paymentMode: "cash",
        status: "success",
        verificationStatus: "verified_manual",
        monthsPaidFor: months,
        receiptNumber,
        seatNumber: user.seat?.seatNumber,
        periodStart: new Date(),
        periodEnd: nextDueDate,
        verifiedAt: new Date(),
        adminAction: {
          actionType: "admin_payment_update",
          actionBy: adminId,
          actionDate: new Date(),
          previousStatus,
          newStatus: paymentStatus,
          notes,
        },
      });

      await payment.save();

      // Extend seat if active
      if (user.hasActiveSeat && user.seat?.seatNumber) {
        const seat = await Seat.findOne({ seatNumber: user.seat.seatNumber });
        if (seat) {
          await seat.extendBooking(months);
          // Sync extended seat to Firebase
          await syncSeatToFirebase(seat);
        }

        user.seat.expiryDate = new Date(user.seat.expiryDate);
        user.seat.expiryDate.setMonth(user.seat.expiryDate.getMonth() + months);
      }
    }

    await user.save();

    console.log(
      `✅ Admin updated payment for ${user.fullName}: ${previousStatus} → ${paymentStatus}`,
    );

    res.json({
      success: true,
      message: "Payment status updated",
      user: {
        id: user._id,
        fullName: user.fullName,
        payment: user.payment,
        seat: user.seat,
      },
    });
  } catch (error) {
    console.error("❌ Update payment status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update payment status",
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
      users: users.map((u) => ({
        id: u._id,
        firebaseUid: u.firebaseUid,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        seat: u.seat,
        payment: u.payment,
        daysPastDue: u.payment.nextDueDate
          ? Math.floor(
              (new Date() - u.payment.nextDueDate) / (1000 * 60 * 60 * 24),
            )
          : 0,
      })),
    });
  } catch (error) {
    console.error("❌ Get overdue users error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch overdue users",
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
      users: users.map((u) => ({
        id: u._id,
        firebaseUid: u.firebaseUid,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        seat: u.seat,
        payment: u.payment,
        daysUntilExpiry: u.daysUntilExpiry,
      })),
    });
  } catch (error) {
    console.error("❌ Get expiring seats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch expiring seats",
    });
  }
};

/**
 * POST /admin/seat/release
 * Admin force release a seat
 */
exports.forceReleaseSeat = async (req, res) => {
  try {
    const { seatNumber, adminId, reason = "admin_action" } = req.body;

    const seatNum = parseInt(seatNumber);
    if (isNaN(seatNum)) {
      return res.status(400).json({
        success: false,
        error: "Invalid seat number",
      });
    }

    const seat = await Seat.findOne({ seatNumber: seatNum });
    if (!seat) {
      return res.status(404).json({
        success: false,
        error: "Seat not found",
      });
    }

    if (!seat.isBooked) {
      return res.status(400).json({
        success: false,
        error: "Seat is not booked",
      });
    }

    // Find user
    const user = await User.findOne({ firebaseUid: seat.bookedByFirebaseUid });

    // Release seat
    await seat.release(`${reason}_by_admin`);

    // Update user if found
    if (user) {
      await user.releaseSeat();

      await user.save();
    }

    console.log(`✅ Admin released seat ${seatNum} (${reason})`);

    // Sync to Firebase (seat is now available)
    await syncSeatToFirebase(seat);

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("seat:released", {
        seatNumber: seatNum,
        reason: "admin_action",
        adminId,
      });
    }

    res.json({
      success: true,
      message: "Seat released successfully",
      seatNumber: seatNum,
    });
  } catch (error) {
    console.error("❌ Force release seat error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to release seat",
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
      shift = "fullday",
      months = 1,
      adminId,
    } = req.body;

    // Find user
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const seatNum = parseInt(seatNumber);
    if (isNaN(seatNum) || seatNum < 1 || seatNum > 100) {
      return res.status(400).json({
        success: false,
        error: "Invalid seat number",
      });
    }

    // Check if user already has a seat
    if (user.hasActiveSeat) {
      return res.status(400).json({
        success: false,
        error: "User already has an active seat",
        currentSeat: user.seat.seatNumber,
      });
    }

    // Find or create seat
    let seat = await Seat.findOne({ seatNumber: seatNum });
    if (!seat) {
      seat = new Seat({
        seatNumber: seatNum,
        zone:
          seatNum <= 15 ? "A" : seatNum <= 30 ? "B" : seatNum <= 45 ? "C" : "D",
      });
    }

    // Check availability
    if (seat.isBooked && !seat.isExpired) {
      return res.status(400).json({
        success: false,
        error: "Seat is already booked",
      });
    }

    // Book the seat
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    await seat.book(user, shift, months);

    // Update user
    user.seat = {
      seatNumber: seatNum,
      seatStatus: "active",
      libraryName: "Shivika Digital Library",
      shift,
      bookingDate: new Date(),
      expiryDate,
    };

    user.payment.nextDueDate = expiryDate;

    await user.save();

    console.log(`✅ Admin assigned seat ${seatNum} to ${user.fullName}`);

    // Sync to Firebase (seat is now booked)
    await syncSeatToFirebase(seat);

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("seat:booked", {
        seatNumber: seatNum,
        userId: firebaseUid,
        userName: user.fullName,
        adminAssigned: true,
      });
    }

    res.json({
      success: true,
      message: "Seat assigned successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        seat: user.seat,
      },
    });
  } catch (error) {
    console.error("❌ Assign seat error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assign seat",
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
      monthRevenue,
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: "admin" } }),
      Seat.countDocuments({ isBooked: true }),
      Seat.countDocuments({ isBooked: false }),
      User.countDocuments({ "payment.paymentStatus": "paid" }),
      User.countDocuments({ "payment.paymentStatus": "overdue" }),
      User.countDocuments({
        "seat.expiryDate": {
          $gt: new Date(),
          $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      Payment.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        status: "success",
      }),
      Payment.getTotalRevenue(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        new Date(),
      ),
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          paid: paidUsers,
          overdue: overdueUsers,
        },
        seats: {
          active: activeSeats,
          available: availableSeats,
          total: activeSeats + availableSeats,
          expiringIn7Days,
        },
        payments: {
          todayCount: todayPayments,
          monthRevenue,
        },
      },
    });
  } catch (error) {
    console.error("❌ Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch statistics",
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
        error: "User not found",
      });
    }

    // 1. Release seat if booked and sync to Firebase
    if (user.seat?.seatNumber) {
      const seat = await Seat.findOne({ seatNumber: user.seat.seatNumber });
      if (seat) {
        await seat.release("user_deleted");
        await syncSeatToFirebase(seat);
      }
    }

    // 2. Delete user from Firebase Auth Console & RTDB
    if (user.firebaseUid) {
      await deleteUserFromFirebase(user.firebaseUid);
    }

    // 3. Delete user document from MongoDB
    await User.findByIdAndDelete(id);

    console.log(`✅ User completely deleted from MongoDB & Firebase: ${user.fullName} (${user.email})`);

    res.json({
      success: true,
      message: "User deleted successfully from MongoDB and Firebase",
    });
  } catch (error) {
    console.error("❌ Delete user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete user",
    });
  }
};

/**
 * GET /admin/current-students
 * Get all current students with active or pending bookings
 */
exports.getCurrentStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = "",
      paymentStatus = "All",
      seatStatus = "All",
      monthsPaid = "All",
      paymentDeadline = "All",
      sortBy = "seatNumber",
      sortOrder = "asc",
    } = req.query;

    const query = {
      role: { $ne: "admin" },
      "seat.seatNumber": { $ne: null, $exists: true },
      $or: [
        { "seat.seatStatus": "active" },
        { "seat.bookingStatus": "pending_payment" },
        { membershipStatus: "active" },
      ],
    };

    if (paymentStatus !== "All") {
      if (paymentStatus === "Paid") {
        query["payment.paymentStatus"] = "paid";
      } else if (paymentStatus === "Pending") {
        query["payment.paymentStatus"] = "pending";
      }
    }

    if (seatStatus !== "All") {
      if (seatStatus === "Active") {
        query["seat.seatStatus"] = "active";
      } else if (seatStatus === "Pending") {
        query["seat.bookingStatus"] = "pending_payment";
      }
    }

    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      const numSearch = parseInt(search);
      const searchOr = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { "profile.studentId": searchRegex },
      ];
      if (!isNaN(numSearch)) {
        searchOr.push({ "seat.seatNumber": numSearch });
      }
      query.$and = (query.$and || []).concat([{ $or: searchOr }]);
    }

    const allCurrentUsers = await User.find(query).select("-password");

    let filteredUsers = allCurrentUsers.filter((u) => {
      if (monthsPaid !== "All") {
        const count = u.monthsPaid || 0;
        if (monthsPaid === "0" && count !== 0) return false;
        if (monthsPaid === "1+" && count < 1) return false;
        if (monthsPaid === "3+" && count < 3) return false;
        if (monthsPaid === "6+" && count < 6) return false;
        if (monthsPaid === "12+" && count < 12) return false;
      }

      if (paymentDeadline !== "All") {
        const deadline = u.seat?.paymentDeadline;
        if (paymentDeadline === "Due Soon") {
          if (!deadline) return false;
          const diffDays =
            (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24);
          if (diffDays < 0 || diffDays > 2) return false;
        } else if (paymentDeadline === "Expired/Pending") {
          if (
            u.seat?.bookingStatus === "pending_payment" &&
            deadline &&
            new Date(deadline) < new Date()
          ) {
            return true;
          }
          if (u.payment?.paymentStatus === "pending") return true;
          return false;
        }
      }

      return true;
    });

    filteredUsers.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case "fullName":
          valA = a.fullName || "";
          valB = b.fullName || "";
          break;
        case "bookingDate":
          valA = a.seat?.bookingDate
            ? new Date(a.seat.bookingDate).getTime()
            : 0;
          valB = b.seat?.bookingDate
            ? new Date(b.seat.bookingDate).getTime()
            : 0;
          break;
        case "paymentDeadline":
          valA = a.seat?.paymentDeadline
            ? new Date(a.seat.paymentDeadline).getTime()
            : 0;
          valB = b.seat?.paymentDeadline
            ? new Date(b.seat.paymentDeadline).getTime()
            : 0;
          break;
        case "monthsPaid":
          valA = a.monthsPaid || 0;
          valB = b.monthsPaid || 0;
          break;
        case "nextDueDate":
          valA = a.payment?.nextDueDate
            ? new Date(a.payment.nextDueDate).getTime()
            : 0;
          valB = b.payment?.nextDueDate
            ? new Date(b.payment.nextDueDate).getTime()
            : 0;
          break;
        case "seatNumber":
        default:
          valA = a.seat?.seatNumber || 0;
          valB = b.seat?.seatNumber || 0;
          break;
      }

      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    const total = filteredUsers.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const paginatedUsers = filteredUsers.slice(skip, skip + limitNum);

    res.json({
      success: true,
      students: paginatedUsers.map((u) => {
        const obj = u.toObject({ virtuals: true });
        const now = new Date();
        let daysRemainingForPayment = null;
        if (u.seat?.paymentDeadline) {
          const diffMs = new Date(u.seat.paymentDeadline) - now;
          daysRemainingForPayment = Math.max(
            0,
            Math.ceil(diffMs / (1000 * 60 * 60 * 24)),
          );
        }
        return {
          ...obj,
          id: u._id,
          monthsPaid: u.monthsPaid,
          paidThroughDate: u.paidThroughDate,
          daysRemainingForPayment,
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("❌ Get current students error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch current students" });
  }
};

/**
 * GET /admin/past-students
 * Get all past students with historical records
 */
exports.getPastStudents = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search = "",
      exitStatus = "All",
      membershipDuration = "All",
      sortBy = "fullName",
      sortOrder = "asc",
    } = req.query;

    const query = {
      role: { $ne: "admin" },
      $or: [
        { "seat.seatNumber": null },
        { "seat.seatStatus": { $in: ["released", "expired"] } },
        { membershipStatus: { $in: ["inactive", "expired"] } },
      ],
    };

    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      const numSearch = parseInt(search);
      const searchOr = [
        { fullName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { "profile.studentId": searchRegex },
      ];
      if (!isNaN(numSearch)) {
        searchOr.push({ "seat.seatNumber": numSearch });
      }
      query.$and = (query.$and || []).concat([{ $or: searchOr }]);
    }

    const allPastUsers = await User.find(query).select("-password");

    let filteredUsers = allPastUsers.filter((u) => {
      if (exitStatus !== "All") {
        if (
          exitStatus === "Expired" &&
          u.seat?.bookingStatus !== "expired" &&
          u.membershipStatus !== "expired"
        )
          return false;
        if (exitStatus === "Deactivated" && u.membershipStatus !== "inactive")
          return false;
        if (exitStatus === "Left" && u.seat?.seatStatus !== "released")
          return false;
      }

      if (membershipDuration !== "All") {
        const months = u.monthsPaid || 0;
        if (membershipDuration === "< 1 month" && months >= 1) return false;
        if (membershipDuration === "1-3 months" && (months < 1 || months > 3))
          return false;
        if (membershipDuration === "3-6 months" && (months < 3 || months > 6))
          return false;
        if (membershipDuration === "6+ months" && months < 6) return false;
      }

      return true;
    });

    filteredUsers.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case "seatNumber":
          valA = a.seat?.seatNumber || 0;
          valB = b.seat?.seatNumber || 0;
          break;
        case "bookingDate":
          valA = a.seat?.bookingDate
            ? new Date(a.seat.bookingDate).getTime()
            : 0;
          valB = b.seat?.bookingDate
            ? new Date(b.seat.bookingDate).getTime()
            : 0;
          break;
        case "monthsPaid":
          valA = a.monthsPaid || 0;
          valB = b.monthsPaid || 0;
          break;
        case "fullName":
        default:
          valA = a.fullName || "";
          valB = b.fullName || "";
          break;
      }
      if (typeof valA === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sortOrder === "asc" ? valA - valB : valB - valA;
    });

    const total = filteredUsers.length;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const paginatedUsers = filteredUsers.slice(skip, skip + limitNum);

    res.json({
      success: true,
      students: paginatedUsers.map((u) => {
        const obj = u.toObject({ virtuals: true });
        const hasSeat = Boolean(u.seat?.seatNumber);
        return {
          ...obj,
          id: u._id,
          membershipStatus: hasSeat ? (u.membershipStatus || "active") : "inactive",
          seat: {
            ...(u.seat || {}),
            bookingStatus: hasSeat && u.seat?.bookingStatus === "confirmed" ? "confirmed" : "not_confirmed",
            seatStatus: hasSeat ? u.seat?.seatStatus : "released"
          },
          monthsPaid: u.monthsPaid,
          paidThroughDate: u.paidThroughDate,
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("❌ Get past students error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch past students" });
  }
};

/**
 * GET /admin/enhanced-stats
 * Get comprehensive 8 summary cards stats
 */
exports.getEnhancedStats = async (req, res) => {
  try {
    const now = new Date();
    const fiveDaysFromNow = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalSeats,
      occupiedSeats,
      availableSeats,
      pendingPayments,
      activeStudents,
      pastStudents,
      feesDueSoon,
      monthlyRevenue,
    ] = await Promise.all([
      Seat.countDocuments({}),
      Seat.countDocuments({ isBooked: true, status: "booked" }),
      Seat.countDocuments({ status: "available" }),
      User.countDocuments({
        role: { $ne: "admin" },
        $or: [
          { "seat.bookingStatus": "pending_payment" },
          { "payment.paymentStatus": "pending" },
        ],
      }),
      User.countDocuments({
        role: { $ne: "admin" },
        "seat.seatNumber": { $ne: null, $exists: true },
        $or: [
          { "seat.seatStatus": "active" },
          { "seat.bookingStatus": "pending_payment" },
          { membershipStatus: "active" },
        ],
      }),
      User.countDocuments({
        role: { $ne: "admin" },
        $or: [
          { "seat.seatNumber": null },
          { "seat.seatStatus": { $in: ["released", "expired"] } },
          { membershipStatus: { $in: ["inactive", "expired"] } },
        ],
      }),
      User.countDocuments({
        role: { $ne: "admin" },
        "payment.nextDueDate": { $gte: now, $lte: fiveDaysFromNow },
      }),
      Payment.getTotalRevenue(startOfMonth, now),
    ]);

    res.json({
      success: true,
      stats: {
        totalSeats: totalSeats || 60,
        occupiedSeats,
        availableSeats:
          availableSeats || Math.max(0, (totalSeats || 60) - occupiedSeats),
        pendingPayments,
        activeStudents,
        pastStudents,
        feesDueSoon,
        monthlyRevenue: monthlyRevenue || 0,
      },
    });
  } catch (error) {
    console.error("❌ Get enhanced stats error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch enhanced stats" });
  }
};

/**
 * PUT /admin/student/:id/deactivate
 * Deactivate a student and release seat while keeping history
 */
exports.deactivateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "admin_deactivation" } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.seat?.seatNumber) {
      const seat = await Seat.findOne({ seatNumber: user.seat.seatNumber });
      if (seat) {
        await seat.release(`deactivated_${reason}`);
        // Sync released seat to Firebase
        await syncSeatToFirebase(seat);
      }
      user.seat.seatStatus = "released";
      user.seat.bookingStatus = "released";
      user.seat.seatNumber = null;
    }

    user.membershipStatus = "inactive";
    user.deactivatedAt = new Date();
    user.deactivationReason = reason;

    await user.save();

    res.json({
      success: true,
      message:
        "Student deactivated successfully. Historical records preserved.",
      user,
    });
  } catch (error) {
    console.error("❌ Deactivate student error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to deactivate student" });
  }
};

/**
 * Expire pending bookings helper method
 */
exports.expirePendingBookings = async () => {
  try {
    const now = new Date();
    const expiredUsers = await User.find({
      "seat.bookingStatus": "pending_payment",
      "seat.paymentDeadline": { $lt: now },
      "payment.paymentStatus": { $ne: "paid" },
    });

    for (const user of expiredUsers) {
      const seatNum = user.seat?.seatNumber;
      if (seatNum) {
        const seat = await Seat.findOne({ seatNumber: seatNum });
        if (seat) {
          await seat.release("5day_payment_deadline_expired");
          // Sync released seat to Firebase
          await syncSeatToFirebase(seat);
        }
      }
      user.seat.seatStatus = "expired";
      user.seat.bookingStatus = "expired";
      user.seat.seatNumber = null;
      user.membershipStatus = "expired";
      await user.save();
      console.log(
        `⏰ Automatically expired booking for ${user.fullName} on Seat ${seatNum}`,
      );
    }
  } catch (err) {
    console.error("❌ Error running expirePendingBookings:", err);
  }
};

