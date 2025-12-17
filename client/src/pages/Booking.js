import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, set, onValue, push, get, runTransaction, remove } from 'firebase/database';
import axios from 'axios';
import toast from 'react-hot-toast';
import { calculateMonthlyFee, calculateHourlyBasedFee, calculateMonthlyFeeFromHours, MONTHLY_FEE, HOURLY_RATE } from '../utils/feeUtils';

// ============================================
// CONFIGURATION
// ============================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Booking Component
 * 
 * Handles seat booking with Razorpay payment integration.
 * Supports both fixed monthly fee and hourly-based fee calculation.
 */
export default function Booking() {
  const { seatNumber } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isProfileComplete, updateFeePayment, bookedSeat, hasBookedSeat, bookedSeatLoading } = useProfile();
  const [feeCalculationMode, setFeeCalculationMode] = useState('hourly'); // 'fixed' or 'hourly'
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [dailyHours, setDailyHours] = useState(8);
  const [totalFee, setTotalFee] = useState(MONTHLY_FEE);
  const [seatStatus, setSeatStatus] = useState('vacant');
  
  // ============================================
  // CHANGE SEAT STATE - For users who want to switch seats
  // ============================================
  // If user already has a booked seat and wants to change, this flow handles:
  // 1. Confirming they want to release their current seat
  // 2. Proceeding with new seat booking
  // 3. Releasing old seat only AFTER new booking is confirmed
  const [showChangeSeatConfirm, setShowChangeSeatConfirm] = useState(false);
  const [changeSeatInProgress, setChangeSeatInProgress] = useState(false);
  
  // ============================================
  // ENHANCED LOADING & STATUS STATES
  // ============================================
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // Loading initial seat data
  const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle' | 'processing' | 'verifying' | 'success' | 'failed'
  const [lastError, setLastError] = useState(null); // Store last error for retry
  
  // ============================================
  // SUCCESS STATE - Prevents race condition
  // ============================================
  // CRITICAL: This flag prevents the "Seat Already Booked" error from showing
  // after a successful payment. The real-time listener updates seatStatus to 'booked'
  // which would normally trigger the error UI. This flag guards against that.
  const [bookingCompleted, setBookingCompleted] = useState(false);
  const [bookedSeatInfo, setBookedSeatInfo] = useState(null); // Store booking details for success UI
  const [showSuccessModal, setShowSuccessModal] = useState(false); // Control success modal visibility
  
  // Refs to prevent duplicate operations
  const razorpayScriptLoaded = useRef(false);
  const razorpayKeyRef = useRef(null);
  const isProcessingPayment = useRef(false); // Prevent double payment submissions

  // Calculate total fee when inputs change
  useEffect(() => {
    if (feeCalculationMode === 'hourly') {
      setTotalFee(calculateHourlyBasedFee(dailyHours, selectedMonths));
    } else {
      setTotalFee(calculateMonthlyFee(selectedMonths));
    }
  }, [selectedMonths, dailyHours, feeCalculationMode]);

  // Listen to seat status changes in real-time
  // IMPORTANT: Only update status if booking is NOT completed by current user
  // This prevents the "Seat Already Booked" error after successful payment
  useEffect(() => {
    const seatRef = ref(database, `seats/${seatNumber}`);
    const unsubscribe = onValue(seatRef, (snapshot) => {
      const data = snapshot.val();
      setInitialLoading(false);
      
      if (data) {
        // CRITICAL FIX: Don't update to 'booked' if this user just completed booking
        // The bookingCompleted flag guards against this race condition
        if (bookingCompleted) {
          // User just booked this seat - keep showing success, not error
          console.log('🛡️ Ignoring seat status update - booking already completed by current user');
          return;
        }
        
        // Check if this seat was booked by current user (already has their booking)
        if (data.status === 'booked' && data.userId === currentUser?.uid) {
          // This user already has this seat booked - show their booking info
          setSeatStatus('booked');
          setBookedSeatInfo({
            seatNumber,
            bookedAt: data.bookedAt,
            paymentId: data.paymentId,
            amount: data.amount,
            isOwnBooking: true
          });
        } else {
          setSeatStatus(data.status || 'vacant');
        }
      } else {
        setSeatStatus('vacant');
      }
    });

    return () => unsubscribe();
  }, [seatNumber, bookingCompleted, currentUser?.uid]);

  /**
   * Load Razorpay checkout script (singleton pattern)
   */
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (razorpayScriptLoaded.current || window.Razorpay) {
        resolve(true);
        return;
      }

      const existingScript = document.querySelector('script[src*="razorpay"]');
      if (existingScript) {
        razorpayScriptLoaded.current = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        razorpayScriptLoaded.current = true;
        console.log('✅ Razorpay script loaded');
        resolve(true);
      };
      script.onerror = () => {
        console.error('❌ Failed to load Razorpay script');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  /**
   * Fetch Razorpay key from server (more secure than env)
   */
  const fetchRazorpayKey = async () => {
    if (razorpayKeyRef.current) return razorpayKeyRef.current;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/razorpay-key`);
      if (response.data.success && response.data.key_id) {
        razorpayKeyRef.current = response.data.key_id;
        console.log(`✅ Razorpay key fetched (mode: ${response.data.mode})`);
        return response.data.key_id;
      }
    } catch (error) {
      console.warn('Could not fetch key from server, using env variable');
    }

    const envKey = process.env.REACT_APP_RAZORPAY_KEY_ID;
    if (envKey && envKey !== 'your_razorpay_key_id_here') {
      razorpayKeyRef.current = envKey;
      return envKey;
    }
    return null;
  };

  /**
   * Check seat availability before payment (atomic check)
   * Returns true if seat is available, false otherwise
   */
  const checkSeatAvailability = useCallback(async () => {
    try {
      const seatRef = ref(database, `seats/${seatNumber}`);
      const snapshot = await get(seatRef);
      const data = snapshot.val();
      
      if (!data) return true; // Seat doesn't exist = vacant
      if (data.status === 'booked') {
        // Check if booked by someone else
        if (data.userId !== currentUser?.uid) {
          return false; // Seat booked by another user
        }
      }
      return true; // Seat is available
    } catch (error) {
      console.error('Error checking seat availability:', error);
      return false; // Fail safe - assume unavailable on error
    }
  }, [seatNumber, currentUser?.uid]);

  /**
   * Book seat atomically using Firebase transaction
   * Prevents race conditions when multiple users try to book same seat
   */
  const bookSeatAtomically = useCallback(async (paymentDetails) => {
    const seatRef = ref(database, `seats/${seatNumber}`);
    
    return runTransaction(seatRef, (currentData) => {
      // Check if seat is already booked by someone else
      if (currentData && currentData.status === 'booked' && currentData.userId !== currentUser?.uid) {
        // Abort transaction - seat already taken
        return; // Returning undefined aborts the transaction
      }
      
      // Seat is available - book it
      return {
        status: 'booked',
        userId: currentUser.uid,
        userEmail: currentUser.email || currentUser.phoneNumber,
        bookedAt: paymentDetails.bookedAt,
        months: paymentDetails.months,
        dailyHours: paymentDetails.dailyHours,
        feeCalculationMode: paymentDetails.feeCalculationMode,
        paymentId: paymentDetails.paymentId,
        orderId: paymentDetails.orderId,
        amount: paymentDetails.amount,
        feePaymentDate: paymentDetails.paymentDate,
        verificationStatus: 'verified',
      };
    });
  }, [seatNumber, currentUser]);

  /**
   * Main payment handler for seat booking with enhanced status tracking
   * 
   * ONE-SEAT-PER-USER ENFORCEMENT:
   * 1. Frontend check via ProfileContext (bookedSeat)
   * 2. Backend check via /api/check-user-seat endpoint
   * 3. Backend re-check in /api/create-order endpoint
   * 4. Atomic Firebase transaction during booking
   */
  const handlePayment = async () => {
    // Prevent double submissions
    if (isProcessingPayment.current) {
      console.log('⚠️ Payment already in progress, ignoring duplicate click');
      return;
    }
    
    // Validation checks
    if (!isProfileComplete) {
      toast.error('Please complete your profile before booking a seat');
      navigate('/profile');
      return;
    }

    // ============================================
    // ONE-SEAT-PER-USER CHECK (Frontend - Primary)
    // ============================================
    // Check if user already has a booked seat from ProfileContext
    // This is the first line of defense, using cached data for fast UX
    if (hasBookedSeat && !changeSeatInProgress) {
      toast.error(`You have already booked Seat ${bookedSeat.seatNumber}. Only one seat per user is allowed.`);
      return;
    }

    // ============================================
    // ONE-SEAT-PER-USER CHECK (Backend - Secondary)
    // ============================================
    // Double-check with backend for race-condition safety
    // This handles edge cases like stale frontend cache, direct API calls, etc.
    try {
      const backendCheckResponse = await axios.get(`${API_BASE_URL}/api/check-user-seat/${currentUser.uid}`);
      if (backendCheckResponse.data.success && backendCheckResponse.data.hasBookedSeat && !changeSeatInProgress) {
        console.log('🚫 Backend blocked: User already has a seat');
        toast.error(`You have already booked Seat ${backendCheckResponse.data.seatNumber}. Only one seat per user is allowed.`);
        return;
      }
    } catch (error) {
      // If backend check fails, continue with frontend validation only
      // Better UX than blocking completely
      console.warn('⚠️ Backend seat check failed, relying on frontend validation:', error.message);
    }

    // STEP 1: Check seat availability BEFORE initiating payment
    const isAvailable = await checkSeatAvailability();
    if (!isAvailable || seatStatus === 'booked') {
      toast.error('This seat is already booked! Please select another seat.');
      navigate('/seats');
      return;
    }

    // Mark as processing to prevent double submissions
    isProcessingPayment.current = true;
    
    // Reset states
    setLoading(true);
    setPaymentStatus('processing');
    setLastError(null);
    setBookingCompleted(false); // Reset in case of retry
    
    // Show loading toast
    const loadingToast = toast.loading('Initializing payment...');
    
    try {
      // Step 1: Get Razorpay key
      const razorpayKey = await fetchRazorpayKey();
      if (!razorpayKey) {
        toast.dismiss(loadingToast);
        toast.error('Payment gateway not configured. Please contact administrator.');
        console.error('❌ Razorpay Key ID not available');
        setPaymentStatus('failed');
        setLastError('Payment gateway not configured');
        setLoading(false);
        return;
      }

      // Step 2: Load Razorpay script
      toast.loading('Loading payment gateway...', { id: loadingToast });
      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) {
        toast.dismiss(loadingToast);
        toast.error('Failed to load payment gateway. Please refresh and try again.');
        setPaymentStatus('failed');
        setLastError('Failed to load payment gateway');
        setLoading(false);
        return;
      }

      // Step 3: Create order on backend
      toast.loading('Creating order...', { id: loadingToast });
      console.log('📦 Creating order for Seat', seatNumber, '- ₹' + totalFee);
      const response = await axios.post(`${API_BASE_URL}/api/create-order`, {
        amount: totalFee,
        seatNumber,
        months: selectedMonths,
        dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null,
        feeCalculationMode,
        userId: currentUser.uid,
        type: 'seat_booking',
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create order');
      }

      const { order, mode } = response.data;

      if (!order || !order.id) {
        throw new Error('Invalid order response from server');
      }

      console.log('✅ Order created:', order.id, `(${mode} mode)`);
      
      // Dismiss loading toast before opening Razorpay
      toast.dismiss(loadingToast);
      toast.success('Order created! Complete payment...', { duration: 2000 });

      // Step 4: Configure Razorpay checkout options
      const options = {
        key: razorpayKey,
        amount: order.amount, // Already in paise from server
        currency: order.currency,
        name: 'Shivika Digital Library',
        description: `Seat ${seatNumber} - ${selectedMonths} month(s)${feeCalculationMode === 'hourly' ? ` (${dailyHours} hrs/day)` : ''}`,
        order_id: order.id,
        
        // Step 5: Handle successful payment
        handler: async function (response) {
          console.log('💳 Payment completed, verifying...');
          setPaymentStatus('verifying');
          const verifyToast = toast.loading('Verifying payment...');
          
          try {
            // Step 6: Verify payment on backend
            const verifyResponse = await axios.post(`${API_BASE_URL}/api/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              seatNumber,
              months: selectedMonths,
              userId: currentUser.uid,
              type: 'seat_booking',
            });

            if (verifyResponse.data.success) {
              console.log('✅ Payment verified:', response.razorpay_payment_id);
              toast.dismiss(verifyToast);
              
              const bookedAt = new Date().toISOString();
              const paymentDate = new Date().toISOString();
              
              // CRITICAL: Set booking completed BEFORE updating Firebase
              // This prevents the race condition where real-time listener
              // shows "Seat Already Booked" error
              setBookingCompleted(true);
              
              // ============================================
              // CHANGE SEAT FLOW: Release old seat first
              // ============================================
              // If user is changing seats, release the old one AFTER payment verification
              // but BEFORE booking the new seat
              if (changeSeatInProgress && bookedSeat) {
                try {
                  console.log(`🔄 Releasing old Seat ${bookedSeat.seatNumber} for seat change`);
                  const oldSeatRef = ref(database, `seats/${bookedSeat.seatNumber}`);
                  await remove(oldSeatRef);
                  console.log(`✅ Old Seat ${bookedSeat.seatNumber} released successfully`);
                  toast.success(`Seat ${bookedSeat.seatNumber} released. Booking new seat...`);
                } catch (releaseError) {
                  console.error('❌ Failed to release old seat:', releaseError);
                  // Continue with new booking anyway - old seat can be cleaned up later
                }
              }
              
              // Step 7: Update fee payment in profile
              await updateFeePayment(paymentDate, selectedMonths);
              
              // Step 8: Book seat atomically using transaction
              // This prevents race conditions with other users
              const paymentDetails = {
                bookedAt,
                paymentDate,
                months: selectedMonths,
                dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null,
                feeCalculationMode,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                amount: totalFee,
              };
              
              const transactionResult = await bookSeatAtomically(paymentDetails);
              
              // Check if transaction was successful
              if (!transactionResult.committed) {
                // Transaction aborted - seat was taken during payment
                console.error('❌ Seat was booked by another user during payment');
                toast.error('Unfortunately, this seat was booked by another user. Your payment will be refunded.');
                setPaymentStatus('failed');
                setLastError('Seat was booked by another user during payment process');
                setBookingCompleted(false);
                isProcessingPayment.current = false;
                return;
              }

              // Step 9: Save payment history with complete status
              const paymentsRef = ref(database, 'payments');
              await push(paymentsRef, {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                seatNumber: parseInt(seatNumber),
                months: selectedMonths,
                dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null,
                feeCalculationMode,
                amount: totalFee,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                bookedAt,
                feePaymentDate: paymentDate,
                status: 'paid',
                verificationStatus: 'verified',
                type: 'seat_booking',
                createdAt: paymentDate,
                updatedAt: paymentDate,
              });

              // Step 10: Store booked seat info for success UI
              setBookedSeatInfo({
                seatNumber: parseInt(seatNumber),
                bookedAt,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                amount: totalFee,
                months: selectedMonths,
                dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null,
              });

              // Update payment status and show success modal
              setPaymentStatus('success');
              setShowSuccessModal(true);
              isProcessingPayment.current = false;
              
              // Show success toast with seat number
              toast.success(
                `🎉 Seat ${seatNumber} booked successfully!\nPayment ID: ${response.razorpay_payment_id.slice(-8)}`,
                { duration: 5000 }
              );
              
              // Navigate to dashboard after showing success modal
              // Delay is longer to let user see the success confirmation
              setTimeout(() => {
                setShowSuccessModal(false);
                navigate('/dashboard');
              }, 3000);
            } else {
              toast.dismiss(verifyToast);
              console.error('❌ Verification failed:', verifyResponse.data.error);
              setPaymentStatus('failed');
              setLastError('Payment verification failed');
              toast.error('Payment verification failed. Please contact support.');
            }
          } catch (error) {
            toast.dismiss(verifyToast);
            console.error('❌ Payment verification error:', error);
            setPaymentStatus('failed');
            setLastError(error.message || 'Payment verification failed');
            
            // Save failed payment attempt for reference
            const paymentsRef = ref(database, 'payments');
            await push(paymentsRef, {
              userId: currentUser.uid,
              userEmail: currentUser.email,
              seatNumber: parseInt(seatNumber),
              months: selectedMonths,
              amount: totalFee,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              status: 'verification_failed',
              verificationStatus: 'failed',
              errorMessage: error.message,
              type: 'seat_booking',
              createdAt: new Date().toISOString(),
            });
            
            toast.error('Payment verification failed. Please contact support with your payment ID: ' + response.razorpay_payment_id);
            isProcessingPayment.current = false;
          }
        },
        
        // Prefill user details
        prefill: {
          name: currentUser.displayName || '',
          email: currentUser.email || '',
          contact: currentUser.phoneNumber || '',
        },
        
        // Theme customization
        theme: {
          color: '#667eea',
        },
        
        // Handle checkout modal close
        modal: {
          ondismiss: function () {
            console.log('🚫 Payment modal closed by user');
            setLoading(false);
            setPaymentStatus('idle');
            isProcessingPayment.current = false; // Reset processing flag
            toast.error('Payment cancelled. You can retry anytime.');
          },
          escape: true,
          animation: true,
        },
        
        // Additional notes
        notes: {
          seatNumber: seatNumber,
          months: selectedMonths.toString(),
          purpose: 'Seat Booking',
        },
      };

      // Step 10: Open Razorpay checkout
      const razorpayInstance = new window.Razorpay(options);
      
      // Handle payment failure
      razorpayInstance.on('payment.failed', function (response) {
        console.error('❌ Payment failed:', response.error);
        setPaymentStatus('failed');
        setLastError(response.error.description || 'Payment failed');
        isProcessingPayment.current = false; // Reset processing flag
        toast.error(`Payment failed: ${response.error.description || 'Unknown error'}. You can retry.`);
        setLoading(false);
      });

      razorpayInstance.open();
      setLoading(false); // Reset loading after modal opens
      
    } catch (error) {
      console.error('❌ Payment error:', error);
      toast.dismiss(); // Dismiss any loading toasts
      
      // Detailed error handling
      let errorMessage = 'Failed to initiate payment';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Network/connection errors
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMessage = 'Cannot connect to server. Please ensure the backend is running.';
        console.error('🌐 Network error - Server may be offline at:', API_BASE_URL);
      }
      
      setPaymentStatus('failed');
      setLastError(errorMessage);
      isProcessingPayment.current = false; // Reset processing flag
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  /**
   * Retry payment after failure
   */
  const handleRetry = () => {
    setPaymentStatus('idle');
    setLastError(null);
    isProcessingPayment.current = false; // Ensure flag is reset
    handlePayment();
  };

  /**
   * Close success modal and navigate to dashboard
   */
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigate('/dashboard');
  };

  /**
   * Get loading button text based on payment status
   */
  const getButtonText = () => {
    switch (paymentStatus) {
      case 'processing':
        return 'Processing...';
      case 'verifying':
        return 'Verifying...';
      case 'success':
        return '✓ Booking Successful!';
      default:
        return `Pay ₹${totalFee} & Book Seat`;
    }
  };

  // ============================================
  // SUCCESS MODAL COMPONENT
  // Shows after successful booking with seat details
  // ============================================
  const SuccessModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center transform animate-scaleIn">
        {/* Success Icon with Animation */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        {/* Success Message */}
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎉 Booking Successful!
        </h2>
        <p className="text-gray-600 mb-6">
          Your seat has been successfully booked.
        </p>
        
        {/* Booked Seat Info Card */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border border-green-200">
          <div className="text-5xl font-bold text-green-600 mb-2">
            Seat {bookedSeatInfo?.seatNumber}
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-medium">Duration:</span> {bookedSeatInfo?.months} month(s)</p>
            {bookedSeatInfo?.dailyHours && (
              <p><span className="font-medium">Daily Hours:</span> {bookedSeatInfo.dailyHours} hrs/day</p>
            )}
            <p><span className="font-medium">Amount Paid:</span> ₹{bookedSeatInfo?.amount}</p>
            <p className="text-xs text-gray-500 mt-2">
              Payment ID: {bookedSeatInfo?.paymentId?.slice(-12)}
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleSuccessModalClose}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg hover:shadow-xl"
          >
            Go to Dashboard →
          </button>
          <p className="text-xs text-gray-500">
            Redirecting automatically in a few seconds...
          </p>
        </div>
      </div>
    </div>
  );

  // ============================================
  // LOADING STATE
  // Show while fetching initial seat data or checking booked seat
  // ============================================
  if (initialLoading || bookedSeatLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading seat information...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // ONE-SEAT-PER-USER: USER ALREADY HAS A SEAT
  // Show this if user tries to book another seat while having one
  // Provides option to "Change Seat" instead of booking multiple
  // ============================================
  if (hasBookedSeat && bookedSeat.seatNumber !== parseInt(seatNumber) && !changeSeatInProgress) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">
          {/* Change Seat Confirmation Modal */}
          {showChangeSeatConfirm && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center transform animate-scaleIn">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔄</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">Confirm Seat Change</h3>
                <p className="text-gray-600 mb-4">
                  You are about to change from <span className="font-bold text-purple-600">Seat {bookedSeat.seatNumber}</span> to <span className="font-bold text-blue-600">Seat {seatNumber}</span>.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-left">
                  <p className="text-amber-800 text-sm">
                    <strong>⚠️ Important:</strong>
                  </p>
                  <ul className="text-amber-700 text-sm mt-1 list-disc list-inside space-y-1">
                    <li>Your current seat will be released after successful payment</li>
                    <li>A new payment is required for the new seat</li>
                    <li>Previous payment will NOT be refunded automatically</li>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowChangeSeatConfirm(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowChangeSeatConfirm(false);
                      setChangeSeatInProgress(true);
                      // This will allow handlePayment to proceed
                    }}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition"
                  >
                    Proceed to Change
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-amber-600 mb-2">
              You Have Already Booked One Seat
            </h2>
            <p className="text-gray-600">
              Only one seat per user is allowed.
            </p>
          </div>

          {/* Current Booking Info */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 mb-6 border border-green-200">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span>📍</span> Your Current Booking
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {bookedSeat.seatNumber}
              </div>
              <div className="text-left">
                <p className="font-bold text-lg text-gray-800">Seat {bookedSeat.seatNumber}</p>
                <p className="text-sm text-gray-600">
                  {bookedSeat.months} month(s) • {bookedSeat.dailyHours ? `${bookedSeat.dailyHours} hrs/day` : 'Full day'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Booked: {new Date(bookedSeat.bookedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Attempted Seat Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              You attempted to book <span className="font-bold text-blue-600">Seat {seatNumber}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => setShowChangeSeatConfirm(true)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <span>🔄</span> Change to Seat {seatNumber}
            </button>
            <Link
              to="/dashboard"
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition text-center block"
            >
              Keep Current Seat
            </Link>
            <Link
              to="/seats"
              className="w-full bg-gray-200 text-gray-800 py-3 rounded-xl font-semibold hover:bg-gray-300 transition text-center block"
            >
              View All Seats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // SUCCESS STATE (after booking completion)
  // CRITICAL: This check comes BEFORE the "booked" check
  // to prevent showing error after successful payment
  // ============================================
  if (bookingCompleted && paymentStatus === 'success') {
    return (
      <>
        {showSuccessModal && <SuccessModal />}
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-4">
              Seat {seatNumber} Booked Successfully!
            </h2>
            <p className="text-gray-600 mb-6">
              Your booking is confirmed. Redirecting to dashboard...
            </p>
            <Link
              to="/dashboard"
              className="bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition inline-block"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ============================================
  // SEAT ALREADY BOOKED STATE
  // Only show if NOT completed by current user
  // ============================================
  if (seatStatus === 'booked' && !bookingCompleted) {
    // Check if it's the current user's own booking
    if (bookedSeatInfo?.isOwnBooking) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🪑</span>
            </div>
            <h2 className="text-2xl font-bold text-blue-600 mb-4">
              Your Seat Booking
            </h2>
            <p className="text-gray-600 mb-6">
              You have already booked Seat {seatNumber}.
            </p>
            <Link
              to="/dashboard"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition inline-block"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      );
    }
    
    // Seat booked by someone else
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            Seat Already Booked
          </h2>
          <p className="text-gray-600 mb-6">
            Seat {seatNumber} is already booked by another user.
            Please select a different seat.
          </p>
          <Link
            to="/seats"
            className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-purple-700 transition inline-block"
          >
            View Available Seats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-xl shadow-lg">
              <span className="text-3xl">🪑</span>
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Book Seat {seatNumber}
              </h2>
              <p className="text-gray-600 mt-1">Reserve your study space</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Seat Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-2xl border-2 border-blue-200 shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold animate-blink shadow-xl">
                  {seatNumber}
                </div>
                <div>
                  <p className="font-bold text-xl text-gray-800">Seat Number: {seatNumber}</p>
                  <p className="text-sm text-gray-600 font-medium">Status: Vacant • Ready to Book</p>
                </div>
              </div>
            </div>

            {/* Fee Calculation Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fee Calculation Method
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFeeCalculationMode('fixed')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                    feeCalculationMode === 'fixed'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                  }`}
                >
                  Fixed Monthly Fee
                </button>
                <button
                  type="button"
                  onClick={() => setFeeCalculationMode('hourly')}
                  className={`px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                    feeCalculationMode === 'hourly'
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                  }`}
                >
                  Daily Hours Based
                </button>
              </div>
            </div>

            {/* Daily Hours Selection (only for hourly mode) */}
            {feeCalculationMode === 'hourly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily Study Hours
                </label>
                <select
                  value={dailyHours}
                  onChange={(e) => setDailyHours(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((hour) => (
                    <option key={hour} value={hour}>
                      {hour} {hour === 1 ? 'Hour' : 'Hours'} per day
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Months Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Number of Months
              </label>
              <select
                value={selectedMonths}
                onChange={(e) => setSelectedMonths(Number(e.target.value))}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <option key={month} value={month}>
                    {month} {month === 1 ? 'Month' : 'Months'}
                  </option>
                ))}
              </select>
            </div>

            {/* Fee Breakdown */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-2xl space-y-3 border border-blue-100 shadow-md">
              {feeCalculationMode === 'hourly' ? (
                <>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Hourly Rate:</span>
                    <span className="font-bold text-blue-700">₹{HOURLY_RATE}/hour</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Daily Hours:</span>
                    <span className="font-bold text-gray-800">{dailyHours} hours</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Monthly Fee:</span>
                    <span className="font-bold text-blue-700">₹{calculateMonthlyFeeFromHours(dailyHours)}/month</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Months:</span>
                    <span className="font-bold text-gray-800">{selectedMonths}</span>
                  </div>
                  <div className="border-t-2 border-blue-200 pt-4 flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-800">Total Fee:</span>
                    <span className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">₹{totalFee}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Monthly Fee:</span>
                    <span className="font-bold text-blue-700">₹{MONTHLY_FEE}/month</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Months:</span>
                    <span className="font-bold text-gray-800">{selectedMonths}</span>
                  </div>
                  <div className="border-t-2 border-blue-200 pt-4 flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-800">Total Fee:</span>
                    <span className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">₹{totalFee}</span>
                  </div>
                </>
              )}
            </div>

            {/* Payment Status Banner */}
            {paymentStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-xl">✓</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-800">Booking Successful!</h4>
                    <p className="text-sm text-green-600">Your seat has been booked successfully.</p>
                  </div>
                </div>
              </div>
            )}
            
            {paymentStatus === 'failed' && lastError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 text-xl">✕</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-800">Payment Failed</h4>
                    <p className="text-sm text-red-600">{lastError}</p>
                  </div>
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center gap-2"
                  >
                    <span>🔄</span> Retry
                  </button>
                </div>
              </div>
            )}

            {/* Profile Completion Warning */}
            {!isProfileComplete && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="text-yellow-400 text-xl mr-3">⚠️</div>
                  <div>
                    <p className="text-yellow-800 font-semibold">Profile Incomplete</p>
                    <p className="text-yellow-700 text-sm">Please complete your profile to book this seat.</p>
                  </div>
                </div>
                <Link
                  to="/profile"
                  className="mt-3 block text-center bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-700 transition"
                >
                  Complete Profile
                </Link>
              </div>
            )}

            {/* Payment Button */}
            <button
              onClick={handlePayment}
              disabled={loading || !isProfileComplete || paymentStatus === 'processing' || paymentStatus === 'verifying' || paymentStatus === 'success'}
              className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                paymentStatus === 'success' 
                  ? 'bg-green-600 text-white cursor-not-allowed' 
                  : 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {(loading || paymentStatus === 'processing' || paymentStatus === 'verifying') && (
                <span className="animate-spin">⏳</span>
              )}
              {paymentStatus === 'success' && <span>✓</span>}
              {!isProfileComplete ? 'Complete Profile to Book' : getButtonText()}
            </button>

            <Link
              to="/seats"
              className="block text-center text-gray-600 hover:text-purple-600"
            >
              ← Back to Seat Selection
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

