const Razorpay = require('razorpay');
const crypto = require('crypto');
const { User, Seat, Payment } = require('../models');


/**
 * ============================================
 * PAYMENT CONTROLLER
 * ============================================
 * 
 * Handles Razorpay payment flow:
 * 1. Create order → 2. Client pays → 3. Verify payment → 4. Update records → 5. Book seat
 * 
 * Also syncs to Google Sheets for admin dashboard.
 */

// Initialize Razorpay (lazy initialization)
let razorpay = null;

const getRazorpay = () => {
  if (!razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpay;
};

// Fee configuration
const FEE_CONFIG = {
  monthly: 600,
  quarterly: 1700,
  halfYearly: 3200,
  yearly: 6000
};

/**
 * POST /payment/create-order
 * Create Razorpay order for payment
 */
exports.createOrder = async (req, res) => {
  try {
    console.log('🔵 Create Order Request:', JSON.stringify(req.body, null, 2));
    
    const razorpayInstance = getRazorpay();
    if (!razorpayInstance) {
      console.error('❌ Razorpay instance is null. Check env vars.');
      console.error('KEY_ID:', process.env.RAZORPAY_KEY_ID ? 'Set' : 'Missing');
      console.error('KEY_SECRET:', process.env.RAZORPAY_KEY_SECRET ? 'Set' : 'Missing');
      return res.status(500).json({
        success: false,
        error: 'Razorpay not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'
      });
    }

    const {
      firebaseUid,
      amount,
      type = 'fee_payment',
      months = 1,
      seatNumber,
      notes = {}
    } = req.body;

    // Validation
    if (!firebaseUid || !amount) {
      console.error('❌ Missing required fields:', { firebaseUid, amount });
      return res.status(400).json({
        success: false,
        error: 'User ID and amount are required'
      });
    }

    // Find user
    const user = await User.findOne({ firebaseUid });
    if (!user) {
      console.error('❌ User not found for uid:', firebaseUid);
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Amount in paise
      currency: 'INR',
      receipt: `order_${Date.now()}_${firebaseUid.slice(-6)}`,
      notes: {
        firebaseUid,
        userId: user._id.toString(),
        type,
        months,
        seatNumber: seatNumber || user.seat?.seatNumber || '',
        userName: user.fullName,
        ...notes
      }
    };

    console.log('🔵 Creating Razorpay order with options:', options);
    let razorpayOrder;
    try {
      razorpayOrder = await razorpayInstance.orders.create(options);
      console.log('✅ Razorpay order created:', razorpayOrder.id);
    } catch (rzpError) {
      console.error('❌ Razorpay order creation failed:', rzpError);
      throw rzpError;
    }

    // Create payment record in MongoDB
    console.log('🔵 Creating Payment record...');
    const payment = new Payment({
      userId: user._id,
      firebaseUid,
      userEmail: user.email,
      type,
      orderId: razorpayOrder.id,
      amount,
      status: 'pending',
      paymentMode: 'Online',
      monthsPaidFor: months,
      seatNumber: seatNumber || user.seat?.seatNumber,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000),
      metadata: {
        razorpayOrderId: razorpayOrder.id,
        receipt: options.receipt
      }
    });

    console.log('🔵 Saving Payment record...');
    try {
      await payment.save();
      console.log('✅ Payment record saved');
    } catch (saveError) {
      console.error('❌ Payment save failed:', saveError);
      throw saveError;
    }

    console.log(`✅ Payment order created: ${razorpayOrder.id} for ${user.fullName}`);

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
      paymentId: payment._id,
      prefill: {
        name: user.fullName,
        email: user.email,
        contact: user.phone
      }
    });

  } catch (error) {
    console.error('❌ Create order error:', error);
    // Send specific error message if available
    res.status(500).json({
      success: false,
      error: error.error?.description || error.message || 'Failed to create payment order'
    });
  }
};

/**
 * POST /payment/verify
 * Verify Razorpay payment signature and update records
 */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      firebaseUid,
      seatNumber,
      shift = 'fullday'
    } = req.body;

    // Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Payment details are incomplete'
      });
    }

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    // Find payment record
    const payment = await Payment.findOne({ orderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment record not found'
      });
    }

    // Find user
    const user = await User.findOne({ firebaseUid: payment.firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!isValid) {
      // Payment verification failed
      await payment.markFailed('verification_failed');
      
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }

    // Payment verified! Update records
    await payment.markVerified(razorpay_payment_id, razorpay_signature);

    // Generate receipt number
    payment.receiptNumber = `RCP-${Date.now()}-${payment._id.toString().slice(-6)}`;
    await payment.save();

    // Update user's payment info
    const months = payment.monthsPaidFor || 1;
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + months);

    // Add to user's payment history
    await user.addPayment({
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      amount: payment.amount,
      date: new Date(),
      paymentMode: 'online',
      status: 'success',
      type: payment.type,
      monthsPaid: months,
      receiptNumber: payment.receiptNumber
    });

    // Update payment summary
    user.payment.paymentStatus = 'paid';
    user.payment.lastPaymentDate = new Date();
    user.payment.lastPaymentAmount = payment.amount;
    user.payment.nextDueDate = nextDueDate;
    user.payment.totalAmountPaid = (user.payment.totalAmountPaid || 0) + payment.amount;

    // Book seat if specified
    const seatNum = seatNumber || payment.seatNumber;
    if (seatNum && !user.hasActiveSeat) {
      let seat = await Seat.findOne({ seatNumber: parseInt(seatNum) });
      
      if (!seat) {
        seat = new Seat({
          seatNumber: parseInt(seatNum),
          zone: seatNum <= 15 ? 'A' : seatNum <= 30 ? 'B' : seatNum <= 45 ? 'C' : 'D'
        });
      }

      // Check if seat is available
      if (!seat.isBooked || seat.isExpired) {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + months);

        await seat.book(user, shift, months);

        user.seat = {
          seatNumber: parseInt(seatNum),
          seatStatus: 'active',
          libraryName: 'Shivika Digital Library',
          shift,
          bookingDate: new Date(),
          expiryDate
        };

        payment.seatNumber = parseInt(seatNum);
        payment.seatBookedSuccessfully = true;
        await payment.save();

        // Emit socket event
        const io = req.app.get('io');
        if (io) {
          io.emit('seat:booked', {
            seatNumber: parseInt(seatNum),
            userId: firebaseUid,
            userName: user.fullName
          });
        }
      }
    } else if (seatNum && user.hasActiveSeat) {
      // Extend existing seat booking
      const seat = await Seat.findOne({ seatNumber: user.seat.seatNumber });
      if (seat) {
        await seat.extendBooking(months);
      }

      user.seat.expiryDate = new Date(user.seat.expiryDate);
      user.seat.expiryDate.setMonth(user.seat.expiryDate.getMonth() + months);
    }

    await user.save();

    console.log(`✅ Payment verified: ${razorpay_payment_id} for ${user.fullName}`);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: payment.amount,
        receiptNumber: payment.receiptNumber,
        status: 'success'
      },
      seat: user.seat,
      user: {
        id: user._id,
        fullName: user.fullName,
        nextDueDate
      }
    });

  } catch (error) {
    console.error('❌ Verify payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment'
    });
  }
};

/**
 * GET /payment/user/:firebaseUid
 * Get payment history for user
 */
exports.getUserPayments = async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get from Payment collection
    const payments = await Payment.getUserPayments(firebaseUid);

    // Also include embedded payment history
    const embeddedHistory = user.paymentHistory || [];

    res.json({
      success: true,
      payments,
      paymentHistory: embeddedHistory,
      summary: {
        totalPaid: user.payment.totalAmountPaid || 0,
        lastPaymentDate: user.payment.lastPaymentDate,
        lastPaymentAmount: user.payment.lastPaymentAmount,
        nextDueDate: user.payment.nextDueDate,
        paymentStatus: user.payment.paymentStatus
      }
    });

  } catch (error) {
    console.error('❌ Get user payments error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment history'
    });
  }
};

/**
 * GET /payment/stats/:firebaseUid
 * Get payment statistics for user
 */
exports.getUserStats = async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    const user = await User.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get all successful payments for this user
    const payments = await Payment.find({ 
      firebaseUid,
      status: { $in: ['paid', 'success'] }
    });

    const stats = {
      totalPaymentsCount: payments.length,
      totalAmountPaid: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
      seatPaymentsCount: payments.filter(p => p.seatNumber && p.seatNumber > 0).length,
      feePaymentsCount: payments.filter(p => p.type === 'fee_payment').length
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment statistics'
    });
  }
};

/**
 * GET /payment/:orderId
 * Get specific payment by order ID
 */
exports.getPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.getByOrderId(orderId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    console.error('❌ Get payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment'
    });
  }
};

/**
 * POST /payment/manual (Admin only)
 * Record manual/cash payment
 */
exports.recordManualPayment = async (req, res) => {
  try {
    const {
      firebaseUid,
      amount,
      months = 1,
      paymentMode = 'cash',
      notes,
      adminId,
      seatNumber,
      shift = 'fullday'
    } = req.body;

    // Validation
    if (!firebaseUid || !amount || !adminId) {
      return res.status(400).json({
        success: false,
        error: 'User ID, amount, and admin ID are required'
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

    // Create payment record
    const orderId = `MANUAL_${Date.now()}_${firebaseUid.slice(-6)}`;
    const receiptNumber = `RCP-${Date.now()}-${Math.random().toString(36).slice(-6)}`;

    const payment = new Payment({
      userId: user._id,
      firebaseUid,
      type: 'fee_payment',
      orderId,
      amount,
      paymentMode,
      status: 'success',
      verificationStatus: 'verified_manual',
      monthsPaidFor: months,
      receiptNumber,
      seatNumber: seatNumber || user.seat?.seatNumber,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000),
      verifiedAt: new Date(),
      adminAction: {
        actionType: 'manual_payment',
        actionBy: adminId,
        actionDate: new Date(),
        notes
      }
    });

    await payment.save();

    // Update user
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + months);

    await user.addPayment({
      paymentId: orderId,
      orderId,
      amount,
      date: new Date(),
      paymentMode,
      status: 'success',
      type: 'fee_payment',
      monthsPaid: months,
      receiptNumber,
      collectedBy: adminId
    });

    user.payment.paymentStatus = 'paid';
    user.payment.lastPaymentDate = new Date();
    user.payment.lastPaymentAmount = amount;
    user.payment.nextDueDate = nextDueDate;
    user.payment.totalAmountPaid = (user.payment.totalAmountPaid || 0) + amount;

    // Book seat if specified
    const seatNum = seatNumber || user.seat?.seatNumber;
    if (seatNum && !user.hasActiveSeat) {
      let seat = await Seat.findOne({ seatNumber: parseInt(seatNum) });
      
      if (!seat) {
        seat = new Seat({
          seatNumber: parseInt(seatNum),
          zone: seatNum <= 15 ? 'A' : seatNum <= 30 ? 'B' : seatNum <= 45 ? 'C' : 'D'
        });
      }

      if (!seat.isBooked || seat.isExpired) {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + months);

        await seat.book(user, shift, months);

        user.seat = {
          seatNumber: parseInt(seatNum),
          seatStatus: 'active',
          libraryName: 'Shivika Digital Library',
          shift,
          bookingDate: new Date(),
          expiryDate
        };
      }
    } else if (user.hasActiveSeat) {
      // Extend booking
      const seat = await Seat.findOne({ seatNumber: user.seat.seatNumber });
      if (seat) {
        await seat.extendBooking(months);
      }

      user.seat.expiryDate = new Date(user.seat.expiryDate);
      user.seat.expiryDate.setMonth(user.seat.expiryDate.getMonth() + months);
    }

    await user.save();

    console.log(`✅ Manual payment recorded: ₹${amount} for ${user.fullName} by admin`);

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      payment: {
        orderId,
        amount,
        receiptNumber,
        months,
        paymentMode
      },
      user: {
        id: user._id,
        fullName: user.fullName,
        nextDueDate,
        seat: user.seat
      }
    });

  } catch (error) {
    console.error('❌ Record manual payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record payment'
    });
  }
};

/**
 * GET /payment/fees
 * Get fee structure
 */
exports.getFeeStructure = async (req, res) => {
  res.json({
    success: true,
    fees: FEE_CONFIG,
    currency: 'INR'
  });
};

/**
 * POST /payment/webhook
 * Razorpay webhook handler
 */
exports.webhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    
    // Verify webhook signature
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');

    if (digest !== req.headers['x-razorpay-signature']) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`📨 Webhook received: ${event}`);

    switch (event) {
      case 'payment.captured':
        // Payment successful
        const paymentData = payload.payment.entity;
        console.log(`✅ Webhook: Payment captured - ${paymentData.id}`);
        break;

      case 'payment.failed':
        // Payment failed
        const failedPayment = payload.payment.entity;
        const payment = await Payment.findOne({ orderId: failedPayment.order_id });
        if (payment) {
          await payment.markFailed('payment_failed');
        }
        console.log(`❌ Webhook: Payment failed - ${failedPayment.id}`);
        break;

      case 'refund.created':
        // Refund initiated
        console.log(`🔄 Webhook: Refund created`);
        break;
    }

    res.json({ status: 'ok' });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
