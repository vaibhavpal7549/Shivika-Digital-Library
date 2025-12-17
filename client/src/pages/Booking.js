import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, set, onValue, push } from 'firebase/database';
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
  const { isProfileComplete, updateFeePayment } = useProfile();
  const [feeCalculationMode, setFeeCalculationMode] = useState('hourly'); // 'fixed' or 'hourly'
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [dailyHours, setDailyHours] = useState(8);
  const [totalFee, setTotalFee] = useState(MONTHLY_FEE);
  const [seatStatus, setSeatStatus] = useState('vacant');
  
  // ============================================
  // ENHANCED LOADING & STATUS STATES
  // ============================================
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle' | 'processing' | 'verifying' | 'success' | 'failed'
  const [lastError, setLastError] = useState(null); // Store last error for retry
  
  // Refs to prevent duplicate operations
  const razorpayScriptLoaded = useRef(false);
  const razorpayKeyRef = useRef(null);

  // Calculate total fee when inputs change
  useEffect(() => {
    if (feeCalculationMode === 'hourly') {
      setTotalFee(calculateHourlyBasedFee(dailyHours, selectedMonths));
    } else {
      setTotalFee(calculateMonthlyFee(selectedMonths));
    }
  }, [selectedMonths, dailyHours, feeCalculationMode]);

  // Listen to seat status changes in real-time
  useEffect(() => {
    const seatRef = ref(database, `seats/${seatNumber}`);
    const unsubscribe = onValue(seatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSeatStatus(data.status || 'vacant');
      }
    });

    return () => unsubscribe();
  }, [seatNumber]);

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
   * Main payment handler for seat booking with enhanced status tracking
   */
  const handlePayment = async () => {
    // Validation checks
    if (!isProfileComplete) {
      toast.error('Please complete your profile before booking a seat');
      navigate('/profile');
      return;
    }

    if (seatStatus === 'booked') {
      toast.error('This seat is already booked!');
      navigate('/seats');
      return;
    }

    // Reset states
    setLoading(true);
    setPaymentStatus('processing');
    setLastError(null);
    
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
              
              // Step 7: Update fee payment in profile
              await updateFeePayment(paymentDate, selectedMonths);
              
              // Step 8: Update seat status in Firebase
              const seatRef = ref(database, `seats/${seatNumber}`);
              await set(seatRef, {
                status: 'booked',
                userId: currentUser.uid,
                userEmail: currentUser.email || currentUser.phoneNumber,
                bookedAt,
                months: selectedMonths,
                dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null,
                feeCalculationMode,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                amount: totalFee,
                feePaymentDate: paymentDate,
                verificationStatus: 'verified',
              });

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

              // Update payment status
              setPaymentStatus('success');
              toast.success('🎉 Payment successful! Seat booked and fee paid.', { duration: 4000 });
              
              // Navigate after short delay to show success message
              setTimeout(() => navigate('/dashboard'), 1500);
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
    handlePayment();
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

  if (seatStatus === 'booked') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Seat Already Booked
          </h2>
          <p className="text-gray-600 mb-6">
            Seat {seatNumber} is already booked by another user.
          </p>
          <Link
            to="/seats"
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition inline-block"
          >
            View Other Seats
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

