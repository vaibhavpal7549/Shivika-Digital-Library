const Razorpay = require('razorpay');
const crypto = require('crypto');
const { User, Seat, Payment } = require('../models');
const { syncSeatToFirebase } = require('../services/firebaseSyncService');


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
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Log validation errors in detail
    if (error.name === 'ValidationError') {
      console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
      const validationMessages = Object.keys(error.errors).map(key => {
        return `${key}: ${error.errors[key].message}`;
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid data format',
        details: validationMessages.join(', ')
      });
    }
    
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
    // 1. Mandatory Debug Log
    console.log("VERIFY API HIT", JSON.stringify(req.body, null, 2));

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      firebaseUid,
      seatNumber,
      amount,
      shift = 'fullday',
      months = 1
    } = req.body;

    // 2. Strict Input Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.error('❌ Missing required payment details');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: payment_id, order_id, or signature'
      });
    }

    // Validate seatNumber if provided
    if (seatNumber && !Number.isInteger(parseInt(seatNumber))) {
      console.error('❌ Invalid seat number:', seatNumber);
      return res.status(400).json({ 
        success: false, 
        error: 'seatNumber must be a valid integer' 
      });
    }

    // Validate amount if provided
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      console.error('❌ Invalid amount:', amount);
      return res.status(400).json({ 
        success: false, 
        error: 'amount must be a positive number' 
      });
    }

    // Validate months
    if (months !== undefined && (!Number.isInteger(months) || months < 1 || months > 12)) {
      console.error('❌ Invalid months:', months);
      return res.status(400).json({ 
        success: false, 
        error: 'months must be an integer between 1 and 12' 
      });
    }

    // Validate firebaseUid
    if (!firebaseUid && !userId) {
      console.error('❌ Missing user identifier');
      return res.status(400).json({ 
        success: false, 
        error: 'firebaseUid or userId is required' 
      });
    }

    // 3. Env Variable Check
    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('❌ FATAL: RAZORPAY_KEY_SECRET is missing');
      return res.status(500).json({
        success: false,
        error: 'Server configuration error: Payment secret missing'
      });
    }

    // 4. Signature Verification
    try {
      const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(payload)
        .digest('hex');

      console.log(`🔐 Sig Check: Expected=${expectedSignature.slice(0,5)}... Received=${razorpay_signature.slice(0,5)}...`);

      const signatureValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(razorpay_signature)
      );

      if (!signatureValid) {
        console.error('❌ Signature Verification Failed');
        return res.status(400).json({
          success: false,
          error: 'Invalid payment signature'
        });
      }
    } catch (sigError) {
      console.error('❌ Signature calculation error:', sigError);
      return res.status(500).json({
        success: false,
        error: 'Internal error during signature verification'
      });
    }

    // 5. Database Operations (Clean, Atomic Order)
    try {
      console.log('💾 Starting database operations...');
      
      // ===== STEP 1: FIND RECORDS =====
      const payment = await Payment.findOne({ orderId: razorpay_order_id });
      if (!payment) {
        console.error('❌ Payment record not found for order:', razorpay_order_id);
        return res.status(404).json({ success: false, error: 'Payment record not found' });
      }

      const userUid = firebaseUid || userId || payment.firebaseUid;
      const user = await User.findOne({ firebaseUid: userUid });
      if (!user) {
        console.error('❌ User not found:', userUid);
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      console.log(`✅ Found payment and user for ${user.fullName}`);

      // ===== STEP 2: VALIDATE DATA =====
      const paymentMonths = payment.monthsPaidFor || months;
      const targetSeatNumber = seatNumber || payment.seatNumber;
      
      if (targetSeatNumber && !Number.isInteger(parseInt(targetSeatNumber))) {
        console.error('❌ Invalid seat number:', targetSeatNumber);
        return res.status(400).json({ success: false, error: 'Invalid seat number' });
      }

      // ===== STEP 3: UPDATE PAYMENT (NO SAVE YET) =====
      payment.markVerified(razorpay_payment_id, razorpay_signature);
      payment.receiptNumber = `RCP-${Date.now()}-${payment._id.toString().slice(-6)}`;
      console.log('✅ Payment marked as verified');

      // ===== STEP 4: UPDATE USER PAYMENT HISTORY (NO SAVE YET) =====
      try {
        user.addPayment({
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          amount: payment.amount,
          date: new Date(),
          paymentMode: 'online',
          status: 'success',
          type: payment.type,
          monthsPaid: paymentMonths,
          receiptNumber: payment.receiptNumber
        });
        console.log('✅ Payment added to user history');
      } catch (addPaymentError) {
        console.error('❌ Error adding payment to user history:', addPaymentError.message);
        return res.status(400).json({ 
          success: false, 
          error: `Invalid payment data: ${addPaymentError.message}` 
        });
      }

      // ===== STEP 5: UPDATE USER STATS =====
      user.payment.paymentStatus = 'paid';
      user.payment.totalAmountPaid = (user.payment.totalAmountPaid || 0) + payment.amount;
      
      const nextDueDate = new Date();
      nextDueDate.setMonth(nextDueDate.getMonth() + paymentMonths);
      user.payment.nextDueDate = nextDueDate;

      // ===== STEP 6: ATOMIC SEAT BOOKING =====
      let seatBooked = false;
      let seatInfo = null;
      let bookedSeat = null;

      if (targetSeatNumber) {
        console.log(`💺 Attempting to book Seat ${targetSeatNumber}...`);
        console.log(`Seat booking params:`, {
          seatNumber: targetSeatNumber,
          userId: user._id,
          firebaseUid: user.firebaseUid,
          shift,
          months: paymentMonths
        });
        
        const bookingDate = new Date();
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + paymentMonths);

        try {
          // Check if user is extending their own seat
          const isExtension = user.seat && user.seat.seatNumber === parseInt(targetSeatNumber);
          
          if (isExtension) {
            // ATOMIC EXTENSION: Update only if seat is booked by this user
            console.log(`🔄 Extending existing seat ${targetSeatNumber} for user ${user.firebaseUid}`);
            
            bookedSeat = await Seat.findOneAndUpdate(
              {
                seatNumber: parseInt(targetSeatNumber),
                bookedByFirebaseUid: user.firebaseUid
              },
              {
                $set: {
                  expiryDate: new Date(user.seat.expiryDate.getTime() + (paymentMonths * 30 * 24 * 60 * 60 * 1000)),
                  status: 'booked',
                  displayStatus: 'red'
                }
              },
              { new: true }
            );

            if (!bookedSeat) {
              console.error(`❌ Seat ${targetSeatNumber} extension failed - seat not found or not owned by user`);
              return res.status(409).json({
                success: false,
                error: 'Seat extension failed - seat not found or not owned by you'
              });
            }

            // Update user.seat expiry
            user.seat.expiryDate = bookedSeat.expiryDate;
            seatBooked = true;
            seatInfo = user.seat;
            
            console.log(`✅ Extended seat ${targetSeatNumber} until ${bookedSeat.expiryDate}`);
            
          } else {
            // ATOMIC NEW BOOKING: Update only if seat is available
            console.log(`📝 Creating new booking for seat ${targetSeatNumber}`);
            console.log(`🔍 Checking seat availability with query:`, {
              seatNumber: parseInt(targetSeatNumber),
              condition: '$or: [isBooked: false] OR [isBooked: true AND expired]'
            });
            
            bookedSeat = await Seat.findOneAndUpdate(
              {
                seatNumber: parseInt(targetSeatNumber),
                $or: [
                  { isBooked: false },
                  { isBooked: true, expiryDate: { $lt: new Date() } } // Expired seats
                ]
              },
              {
                $set: {
                  isBooked: true,
                  bookedBy: user._id,
                  bookedByFirebaseUid: user.firebaseUid,
                  bookingDate,
                  expiryDate,
                  shift,
                  status: 'booked',
                  displayStatus: 'red'
                },
                $push: {
                  bookingHistory: {
                    userId: user._id,
                    firebaseUid: user.firebaseUid,
                    bookedAt: bookingDate
                  }
                }
              },
              { new: true }
            );

            console.log(`📊 Seat booking query result:`, bookedSeat ? 'SUCCESS' : 'FAILED (null)');

            if (!bookedSeat) {
              console.error(`❌ Seat ${targetSeatNumber} booking failed - seat already booked or not found`);
              
              // Check if seat exists at all
              const existingSeat = await Seat.findOne({ seatNumber: parseInt(targetSeatNumber) });
              
              if (!existingSeat) {
                console.error(`❌ Seat ${targetSeatNumber} does not exist in database`);
                return res.status(404).json({
                  success: false,
                  error: `Seat ${targetSeatNumber} not found`
                });
              }
              
              // Seat exists but is booked
              console.error(`❌ Seat ${targetSeatNumber} is already booked:`, {
                isBooked: existingSeat.isBooked,
                bookedBy: existingSeat.bookedByFirebaseUid,
                expiryDate: existingSeat.expiryDate,
                status: existingSeat.status
              });
              
              return res.status(409).json({
                success: false,
                error: `Seat ${targetSeatNumber} is already booked by another user`
              });
            }

            // Update user.seat
            user.seat = {
              seatNumber: parseInt(targetSeatNumber),
              seatStatus: 'active',
              libraryName: 'Shivika Digital Library',
              shift,
              bookingDate,
              expiryDate
            };
            
            seatBooked = true;
            seatInfo = user.seat;
            
            console.log(`✅ Successfully booked seat ${targetSeatNumber} for ${user.fullName}`);
            console.log(`Seat details:`, {
              seatNumber: bookedSeat.seatNumber,
              bookedBy: bookedSeat.bookedByFirebaseUid,
              expiryDate: bookedSeat.expiryDate
            });
          }

          // Update payment record
          payment.seatNumber = parseInt(targetSeatNumber);
          payment.seatBookedSuccessfully = true;
          
          // Socket notification
          const io = req.app.get('io');
          if (io) {
            io.emit('seat:booked', { 
              seatNumber: parseInt(targetSeatNumber),
              bookedBy: user.firebaseUid,
              userName: user.fullName
            });
          }
          
        } catch (seatError) {
          console.error('❌ SEAT BOOKING ERROR:', seatError);
          console.error('Error name:', seatError.name);
          console.error('Error message:', seatError.message);
          console.error('Error stack:', seatError.stack);
          
          return res.status(500).json({
            success: false,
            error: 'Failed to book seat due to server error',
            details: process.env.NODE_ENV === 'development' ? seatError.message : undefined
          });
        }
      }

      // ===== STEP 7: SAVE USER (ONCE) =====
      console.log('💾 Saving user record...');
      console.log('User data:', {
        firebaseUid: user.firebaseUid,
        paymentHistoryLength: user.paymentHistory.length,
        seat: user.seat
      });
      
      await user.save();
      console.log('✅ User saved');
      
      // ===== STEP 8: SAVE PAYMENT (ONCE) =====
      console.log('💾 Saving payment record...');
      console.log('Payment data:', {
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        status: payment.status,
        seatNumber: payment.seatNumber
      });
      
      await payment.save();
      console.log('✅ Payment saved');

      // ===== STEP 9: FIREBASE SYNC (AFTER ALL DB COMMITS) =====
      if (bookedSeat && seatBooked) {
        try {
          console.log('🔄 Syncing seat to Firebase...');
          await syncSeatToFirebase(bookedSeat);
          console.log('✅ Firebase sync complete');
        } catch (firebaseError) {
          // Firebase sync failure is non-critical
          console.error('⚠️ Firebase sync failed (non-critical):', firebaseError.message);
        }
      }

      // ===== STEP 10: SUCCESS RESPONSE =====
      return res.status(200).json({
        success: true,
        message: 'Payment verified and seat booked',
        bookingConfirmed: seatBooked,
        payment: {
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          receipt: payment.receiptNumber
        },
        seat: seatInfo
      });

    } catch (dbError) {
      console.error('❌ Database Write Error:', dbError);
      console.error('Error name:', dbError.name);
      console.error('Error message:', dbError.message);
      console.error('Error stack:', dbError.stack);
      
      if (dbError.errors) {
        console.error('Validation errors:', JSON.stringify(dbError.errors, null, 2));
      }
      
      // Handle specific MongoDB errors
      if (dbError.code === 11000) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate record detected',
          details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
        });
      }
      
      if (dbError.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Invalid data format',
          details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
        });
      }
      
      // Generic database error
      return res.status(500).json({
        success: false,
        error: 'Database error while saving payment/booking',
        details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

  } catch (criticalError) {
    console.error('❌ CRITICAL UNHANDLED ERROR in verifyPayment:', criticalError);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during verification'
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
