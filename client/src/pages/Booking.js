import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { useUser } from '../contexts/UserContext';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { calculateMonthlyFee, calculateHourlyBasedFee, MONTHLY_FEE } from '../utils/feeUtils';

// ============================================
// CONFIGURATION
// ============================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Booking Component - REFACTORED
 * 
 * ALL validations and seat operations go through backend APIs.
 * MongoDB is the single source of truth.
 * Frontend NEVER writes directly to Firebase.
 * 
 * FLOW:
 * 1. Check seat availability via backend API
 * 2. Check user's existing seat via backend API
 * 3. Create Razorpay order via backend
 * 4. Process payment via Razorpay
 * 5. Verify payment via backend
 * 6. Book seat via backend API (which updates MongoDB + syncs to Firebase)
 */
export default function Booking() {
  const { seatNumber } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isProfileComplete } = useProfile();
  const { userData, refreshUserData } = useUser();
  const { lastSeatUpdate } = useSocket();
  
  const [feeCalculationMode, setFeeCalculationMode] = useState('hourly');
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [dailyHours, setDailyHours] = useState(8);
  const [totalFee, setTotalFee] = useState(MONTHLY_FEE);
  
  // Seat status from backend
  const [seatStatus, setSeatStatus] = useState('loading');
  const [seatOwner, setSeatOwner] = useState(null);
  
  // User's existing seat from backend
  const [userExistingSeat, setUserExistingSeat] = useState(null);
  
  // Change seat flow
  const [showChangeSeatConfirm, setShowChangeSeatConfirm] = useState(false);
  const [changeSeatInProgress, setChangeSeatInProgress] = useState(false);
  
  // Loading & status states
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [lastError, setLastError] = useState(null);
  
  // Success state
  const [bookingCompleted, setBookingCompleted] = useState(false);
  const [bookedSeatInfo, setBookedSeatInfo] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // Refs
  const razorpayScriptLoaded = useRef(false);
  const razorpayKeyRef = useRef(null);
  const isProcessingPayment = useRef(false);

  // Calculate total fee
  useEffect(() => {
    if (feeCalculationMode === 'hourly') {
      setTotalFee(calculateHourlyBasedFee(dailyHours, selectedMonths));
    } else {
      setTotalFee(calculateMonthlyFee(selectedMonths));
    }
  }, [selectedMonths, dailyHours, feeCalculationMode]);

  /**
   * Fetch seat availability from backend (MongoDB source of truth)
   */
  const checkSeatAvailability = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/seats/${seatNumber}`);
      if (response.data.success) {
        setSeatStatus(response.data.seat.isBooked ? 'booked' : 'vacant');
        return !response.data.seat.isBooked;
      }
      return false;
    } catch (error) {
      console.error('Error checking seat availability:', error);
      setSeatStatus('error');
      return false;
    }
  }, [seatNumber]);

  /**
   * Check if user already has a seat (from backend/MongoDB)
   */
  const checkUserSeat = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/seats/user/${currentUser.uid}`);
      if (response.data.success && response.data.hasSeat) {
        setUserExistingSeat(response.data.seat);
        
        // If user is viewing their own booked seat
        if (response.data.seatNumber === parseInt(seatNumber)) {
          setSeatStatus('owned');
          setBookedSeatInfo({
            seatNumber: response.data.seatNumber,
            ...response.data.seat,
            isOwnBooking: true
          });
        }
      } else {
        setUserExistingSeat(null);
      }
    } catch (error) {
      console.error('Error checking user seat:', error);
    }
  }, [currentUser?.uid, seatNumber]);

  // Initial data fetch from backend
  useEffect(() => {
    const fetchInitialData = async () => {
      setInitialLoading(true);
      await Promise.all([
        checkSeatAvailability(),
        checkUserSeat()
      ]);
      setInitialLoading(false);
    };

    if (currentUser) {
      fetchInitialData();
    }
  }, [currentUser, checkSeatAvailability, checkUserSeat]);

  // Refresh data when socket updates come in
  useEffect(() => {
    if (lastSeatUpdate && !bookingCompleted) {
      checkSeatAvailability();
      checkUserSeat();
    }
  }, [lastSeatUpdate, bookingCompleted, checkSeatAvailability, checkUserSeat]);

  /**
   * Load Razorpay checkout script
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
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  /**
   * Fetch Razorpay key from server
   */
  const fetchRazorpayKey = async () => {
    if (razorpayKeyRef.current) return razorpayKeyRef.current;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/razorpay-key`);
      if (response.data.success && response.data.key_id) {
        razorpayKeyRef.current = response.data.key_id;
        return response.data.key_id;
      }
    } catch (error) {
      console.warn('Could not fetch key from server');
    }

    const envKey = process.env.REACT_APP_RAZORPAY_KEY_ID;
    if (envKey && envKey !== 'your_razorpay_key_id_here') {
      razorpayKeyRef.current = envKey;
      return envKey;
    }
    return null;
  };

  /**
   * Main payment handler - ALL operations go through backend
   */
  const handlePayment = async () => {
    if (isProcessingPayment.current) {
      console.log('⚠️ Payment already in progress');
      return;
    }

    // Profile check
    if (!isProfileComplete) {
      toast.error('Please complete your profile before booking');
      navigate('/profile');
      return;
    }

    // Check existing seat via backend (NOT cached data)
    try {
      const userSeatResponse = await axios.get(`${API_BASE_URL}/api/seats/user/${currentUser.uid}`);
      
      if (userSeatResponse.data.success && userSeatResponse.data.hasSeat) {
        if (!changeSeatInProgress) {
          toast.error(`You already have Seat ${userSeatResponse.data.seatNumber} booked. Only one seat per user is allowed.`);
          return;
        }
      }
    } catch (error) {
      console.error('Backend user seat check failed:', error);
      toast.error('Unable to verify your booking status. Please try again.');
      return;
    }

    // Check seat availability via backend
    try {
      const availabilityResponse = await axios.get(`${API_BASE_URL}/api/seats/${seatNumber}`);
      
      if (availabilityResponse.data.seat.isBooked) {
        toast.error('This seat is already booked! Please select another seat.');
        navigate('/seats');
        return;
      }
    } catch (error) {
      console.error('Backend seat availability check failed:', error);
      toast.error('Unable to verify seat availability. Please try again.');
      return;
    }

    // Mark as processing
    isProcessingPayment.current = true;
    setLoading(true);
    setPaymentStatus('processing');
    setLastError(null);
    setBookingCompleted(false);
    
    const loadingToast = toast.loading('Initializing payment...');
    
    try {
      // Get Razorpay key
      const razorpayKey = await fetchRazorpayKey();
      if (!razorpayKey) {
        throw new Error('Payment gateway not configured');
      }

      // Load Razorpay script
      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) {
        throw new Error('Failed to load payment gateway');
      }

      // Create order on backend
      toast.loading('Creating order...', { id: loadingToast });
      const orderResponse = await axios.post(`${API_BASE_URL}/api/create-order`, {
        amount: totalFee,
        seatNumber,
        months: selectedMonths,
        dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null,
        feeCalculationMode,
        firebaseUid: currentUser.uid,
        type: 'seat_booking',
        notes: {
          customUserId: userData?.profile?.userId || 'N/A'
        }
      });

      if (!orderResponse.data.success) {
        throw new Error(orderResponse.data.error || 'Failed to create order');
      }

      const { orderId, amount, currency } = orderResponse.data;
      toast.dismiss(loadingToast);
      toast.success('Order created! Complete payment...', { duration: 2000 });

      // Configure Razorpay
      const options = {
        key: razorpayKey,
        amount: amount,
        currency: currency,
        name: 'Shivika Digital Library',
        description: `Seat ${seatNumber} - ${selectedMonths} month(s)`,
        order_id: orderId,
        
        handler: async function (response) {
          setPaymentStatus('verifying');
          const verifyToast = toast.loading('Verifying payment...');
          
          try {
            console.log('🔵 Payment successful, verifying with backend...', {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id
            });

            // STEP 1: Verify payment on backend (backend handles booking atomically)
            const verifyPayload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              firebaseUid: currentUser.uid,
              seatNumber: parseInt(seatNumber),
              amount: totalFee, // Ensure amount is sent
              shift: feeCalculationMode === 'hourly' ? 'custom' : 'fullday',
              months: selectedMonths,
              dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null
            };

            console.log('🔵 Sending verification payload:', verifyPayload);

            const verifyResponse = await axios.post(
              `${API_BASE_URL}/api/verify-payment`, 
              verifyPayload,
              { timeout: 15000 } // 15s timeout safety
            );

            console.log('✅ Backend verification response:', verifyResponse.data);

            if (!verifyResponse.data.success) {
              throw new Error(verifyResponse.data.error || 'Payment verification failed');
            }

            // Check if booking was confirmed
            if (!verifyResponse.data.bookingConfirmed) {
              console.warn('⚠️ Payment verified but seat was not booked');
              throw new Error('Payment successful but seat booking failed. Please contact support.');
            }

            toast.dismiss(verifyToast);
            setBookingCompleted(true);

            // Success! Backend has already booked the seat
            setBookedSeatInfo({
              seatNumber: parseInt(seatNumber),
              bookedAt: new Date().toISOString(),
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              amount: totalFee,
              months: selectedMonths,
              dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null,
            });

            setPaymentStatus('success');
            setShowSuccessModal(true);
            isProcessingPayment.current = false;
            
            // Refresh user data
            refreshUserData();

            toast.success(
              changeSeatInProgress 
                ? `🎉 Seat changed to ${seatNumber} successfully!`
                : `🎉 Payment Successful! Seat ${seatNumber} booked successfully!`,
              { 
                duration: 5000,
                style: {
                  background: '#10B981',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  padding: '16px',
                }
              }
            );

            setTimeout(() => {
              setShowSuccessModal(false);
              navigate('/dashboard');
            }, 3000);

          } catch (error) {
            toast.dismiss(verifyToast);
            console.error('❌ Payment verification error:', error);
            
            let errorMessage = error.response?.data?.error || error.message || 'Payment verification failed.';
            
            // Handle Timeout specifically
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
              errorMessage = 'Verification taking too long. Please check Dashboard or Contact Support.';
            }

            console.error('Error details:', {
              message: error.message,
              response: error.response?.data,
              status: error.response?.status,
              code: error.code
            });
            
            setPaymentStatus('failed');
            setLastError(errorMessage);
            setBookingCompleted(false);
            isProcessingPayment.current = false;
            
            toast.error(errorMessage, { duration: 7000 });
          }
        },
        
        prefill: {
          name: userData?.name || currentUser.displayName || '',
          email: userData?.email || currentUser.email || '',
          contact: userData?.phone || currentUser.phoneNumber || '',
        },
        
        theme: { color: '#667eea' },
        
        modal: {
          ondismiss: function () {
            setLoading(false);
            setPaymentStatus('idle');
            isProcessingPayment.current = false;
            toast.error('Payment cancelled');
          },
          escape: true,
          animation: true,
        },
        
        notes: {
          seatNumber: seatNumber,
          months: selectedMonths.toString(),
          purpose: 'Seat Booking',
        },
      };

      const razorpayInstance = new window.Razorpay(options);
      
      razorpayInstance.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);
        setPaymentStatus('failed');
        setLastError(response.error.description || 'Payment failed');
        isProcessingPayment.current = false;
        toast.error(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });

      razorpayInstance.open();
      setLoading(false);
      
    } catch (error) {
      console.error('❌ Payment error:', error);
      console.error('Error Stack:', error.stack);
      toast.dismiss(loadingToast);
      
      let errorMessage = 'Failed to initiate payment';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      if (errorMessage === 'next is not a function') {
        errorMessage += ' (Check console for stack trace)';
      }
      
      setPaymentStatus('failed');
      setLastError(errorMessage);
      isProcessingPayment.current = false;
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  /**
   * Handle change seat button click
   */
  const handleChangeSeat = () => {
    setChangeSeatInProgress(true);
    setShowChangeSeatConfirm(false);
    handlePayment();
  };

  /**
   * Retry payment
   */
  const handleRetry = () => {
    setPaymentStatus('idle');
    setLastError(null);
    isProcessingPayment.current = false;
    handlePayment();
  };

  /**
   * Close success modal
   */
  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    navigate('/dashboard');
  };

  /**
   * Get button text based on status
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

  // Success Modal Component
  const SuccessModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎉 Booking Successful!
        </h2>
        <p className="text-gray-600 mb-6">
          Your seat has been successfully booked.
        </p>
        
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
        
        <button
          onClick={handleSuccessModalClose}
          className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );

  // Loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading seat details...</p>
        </div>
      </div>
    );
  }

  // Seat already booked by another user
  if (seatStatus === 'booked' && !bookingCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🚫</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Seat Not Available</h2>
          <p className="text-gray-600 mb-6">
            Seat {seatNumber} has been booked by another user.
          </p>
          <Link
            to="/seats"
            className="inline-block w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all"
          >
            View Available Seats
          </Link>
        </div>
      </div>
    );
  }

  // User already owns this seat
  if (seatStatus === 'owned' && bookedSeatInfo?.isOwnBooking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Your Booked Seat</h2>
          <p className="text-gray-600 mb-6">
            You have already booked Seat {seatNumber}.
          </p>
          <Link
            to="/dashboard"
            className="inline-block w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Main booking UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4 md:p-8">
      {showSuccessModal && <SuccessModal />}
      
      {/* Change Seat Confirmation Modal */}
      {showChangeSeatConfirm && userExistingSeat && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Change Seat?</h3>
            <p className="text-gray-600 mb-4">
              You currently have <strong>Seat {userExistingSeat.seatNumber}</strong> booked.
              Booking Seat {seatNumber} will release your current seat.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowChangeSeatConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleChangeSeat}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/seats" className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4">
            ← Back to Seats
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 text-center">Book Seat {seatNumber}</h1>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {/* Seat Preview - Centered */}
          <div className="flex flex-col items-center justify-center mb-8 py-6 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-100">
            <div className="w-28 h-28 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 transform hover:scale-105 transition-all duration-300 mb-4">
              <span className="text-5xl font-bold text-white drop-shadow-lg">{seatNumber}</span>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold shadow-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Available
            </span>
          </div>

          {/* User has existing seat warning */}
          {userExistingSeat && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-amber-800 text-sm">
                ⚠️ You already have <strong>Seat {userExistingSeat.seatNumber}</strong> booked.
                Proceeding will change your seat.
              </p>
            </div>
          )}

          {/* Fee Calculation Mode */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fee Calculation Mode</label>
            <div className="flex gap-3">
              <button
                onClick={() => setFeeCalculationMode('hourly')}
                className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                  feeCalculationMode === 'hourly'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                Hourly Based
              </button>
              <button
                onClick={() => setFeeCalculationMode('fixed')}
                className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                  feeCalculationMode === 'fixed'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                }`}
              >
                Fixed Monthly
              </button>
            </div>
          </div>

          {/* Duration Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Months)</label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 6, 12].map((month) => (
                <button
                  key={month}
                  onClick={() => setSelectedMonths(month)}
                  className={`px-4 py-2 rounded-lg border transition-all ${
                    selectedMonths === month
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'
                  }`}
                >
                  {month} {month === 1 ? 'Month' : 'Months'}
                </button>
              ))}
            </div>
          </div>

          {/* Daily Hours (for hourly mode) */}
          {feeCalculationMode === 'hourly' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Daily Hours: <span className="font-bold text-blue-600">{dailyHours} hours</span>
              </label>
              <input
                type="range"
                min="4"
                max="12"
                step="2"
                value={dailyHours}
                onChange={(e) => setDailyHours(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>4 hrs</span>
                <span>12 hrs</span>
              </div>
            </div>
          )}

          {/* Fee Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Fee</span>
              <span className="text-3xl font-bold text-gray-800">₹{totalFee}</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {feeCalculationMode === 'hourly' 
                ? `${dailyHours} hours/day × ${selectedMonths} month(s)`
                : `Fixed rate × ${selectedMonths} month(s)`}
            </p>
          </div>

          {/* Error Display */}
          {paymentStatus === 'failed' && lastError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-700 text-sm mb-2">{lastError}</p>
              <button
                onClick={handleRetry}
                className="text-red-600 font-medium text-sm hover:underline"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={userExistingSeat && !changeSeatInProgress 
              ? () => setShowChangeSeatConfirm(true)
              : handlePayment}
            disabled={loading || paymentStatus === 'processing' || paymentStatus === 'verifying' || paymentStatus === 'success'}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              paymentStatus === 'success'
                ? 'bg-green-600 text-white'
                : loading || paymentStatus === 'processing' || paymentStatus === 'verifying'
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl'
            }`}
          >
            {loading || paymentStatus === 'processing' || paymentStatus === 'verifying' ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {getButtonText()}
              </span>
            ) : (
              userExistingSeat && !changeSeatInProgress
                ? `Change to Seat ${seatNumber} - ₹${totalFee}`
                : getButtonText()
            )}
          </button>

          {/* Security Note */}
          <p className="text-center text-xs text-gray-500 mt-4">
            🔒 Secure payment powered by Razorpay
          </p>
        </div>
      </div>
    </div>
  );
}

