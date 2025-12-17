import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, push } from 'firebase/database';
import axios from 'axios';
import toast from 'react-hot-toast';
import { calculateMonthlyFee, MONTHLY_FEE } from '../utils/feeUtils';

// ============================================
// CONFIGURATION
// ============================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * FeePayment Component
 * 
 * Handles library fee payment using Razorpay payment gateway.
 * 
 * Payment Flow:
 * 1. User selects number of months
 * 2. Frontend requests order creation from backend
 * 3. Backend creates Razorpay order and returns order_id
 * 4. Frontend opens Razorpay checkout with order details
 * 5. User completes payment on Razorpay
 * 6. Razorpay returns payment details to handler
 * 7. Frontend sends details to backend for verification
 * 8. Backend verifies signature using HMAC SHA256
 * 9. On success, update Firebase and show confirmation
 */
export default function FeePayment() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { updateFeePayment } = useProfile();
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [totalFee, setTotalFee] = useState(MONTHLY_FEE);
  
  // ============================================
  // ENHANCED LOADING & STATUS STATES
  // ============================================
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // 'idle' | 'processing' | 'verifying' | 'success' | 'failed'
  const [lastError, setLastError] = useState(null); // Store last error for retry
  const [lastOrderId, setLastOrderId] = useState(null); // Store order ID for retry
  
  // Ref to track if Razorpay script is loaded (prevents duplicate loads)
  const razorpayScriptLoaded = useRef(false);
  // Ref to store Razorpay key (fetched from server)
  const razorpayKeyRef = useRef(null);

  // Calculate total fee when months change
  useEffect(() => {
    setTotalFee(calculateMonthlyFee(selectedMonths));
  }, [selectedMonths]);

  /**
   * Load Razorpay checkout script
   * Only loads once per session to prevent duplicate script tags
   */
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      // Check if already loaded
      if (razorpayScriptLoaded.current || window.Razorpay) {
        resolve(true);
        return;
      }

      // Check if script tag already exists
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
   * Fetch Razorpay key from server
   * This is safer than exposing keys in frontend env
   */
  const fetchRazorpayKey = async () => {
    // Return cached key if available
    if (razorpayKeyRef.current) {
      return razorpayKeyRef.current;
    }

    // Try to get key from server first (more secure)
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

    // Fallback to environment variable
    const envKey = process.env.REACT_APP_RAZORPAY_KEY_ID;
    if (envKey && envKey !== 'your_razorpay_key_id_here') {
      razorpayKeyRef.current = envKey;
      return envKey;
    }

    return null;
  };

  /**
   * Main payment handler
   * Orchestrates the complete payment flow with enhanced status tracking
   */
  const handlePayment = async () => {
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
      console.log('📦 Creating order for ₹' + totalFee);
      const orderResponse = await axios.post(`${API_BASE_URL}/api/create-order`, {
        amount: totalFee,
        months: selectedMonths,
        userId: currentUser.uid,
        type: 'fee_payment',
      });

      if (!orderResponse.data.success) {
        throw new Error(orderResponse.data.error || 'Failed to create order');
      }

      const { order, mode } = orderResponse.data;

      if (!order || !order.id) {
        throw new Error('Invalid order response from server');
      }

      // Store order ID for potential retry
      setLastOrderId(order.id);
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
        description: `Library Fee - ${selectedMonths} month(s)`,
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
              months: selectedMonths,
              userId: currentUser.uid,
              type: 'fee_payment',
            });

            if (verifyResponse.data.success) {
              console.log('✅ Payment verified:', response.razorpay_payment_id);
              toast.dismiss(verifyToast);
              
              // Step 7: Update user profile and save payment record
              const paymentDate = new Date().toISOString();
              
              // Update fee payment status in profile
              await updateFeePayment(paymentDate, selectedMonths);

              // Save payment history to Firebase with complete status
              const paymentsRef = ref(database, 'payments');
              await push(paymentsRef, {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                months: selectedMonths,
                amount: totalFee,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                paidAt: paymentDate,
                feePaymentDate: paymentDate,
                status: 'paid',
                verificationStatus: 'verified',
                type: 'fee_payment',
                createdAt: paymentDate,
                updatedAt: paymentDate,
              });

              // Update payment status
              setPaymentStatus('success');
              toast.success('🎉 Fee payment successful!', { duration: 4000 });
              
              // Navigate after short delay to show success message
              setTimeout(() => navigate('/profile'), 1500);
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
              months: selectedMonths,
              amount: totalFee,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              status: 'verification_failed',
              verificationStatus: 'failed',
              errorMessage: error.message,
              type: 'fee_payment',
              createdAt: new Date().toISOString(),
            });
            
            toast.error('Payment verification failed. Please contact support with your payment ID: ' + response.razorpay_payment_id);
          }
        },
        
        // Prefill user details
        prefill: {
          name: currentUser.displayName || '',
          email: currentUser.email || '',
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
          // Prevent closing during payment
          escape: true,
          animation: true,
        },
        
        // Additional options
        notes: {
          purpose: 'Library Fee Payment',
          months: selectedMonths.toString(),
        },
      };

      // Step 8: Open Razorpay checkout
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
        return '✓ Payment Successful!';
      default:
        return `Pay ₹${totalFee}`;
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-600 to-green-700 p-4 rounded-xl shadow-lg">
              <span className="text-3xl">💳</span>
            </div>
            <div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                Pay Fee
              </h2>
              <p className="text-gray-600 mt-1">Complete your payment securely</p>
            </div>
          </div>

          {/* Payment Status Banner */}
          {paymentStatus === 'success' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold text-green-800">Payment Successful!</p>
                <p className="text-sm text-green-600">Redirecting to profile...</p>
              </div>
            </div>
          )}

          {paymentStatus === 'failed' && lastError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">❌</span>
                <p className="font-semibold text-red-800">Payment Failed</p>
              </div>
              <p className="text-sm text-red-600 mb-3">{lastError}</p>
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                🔄 Retry Payment
              </button>
            </div>
          )}

          <div className="space-y-6">
            {/* Months Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Number of Months
              </label>
              <select
                value={selectedMonths}
                onChange={(e) => setSelectedMonths(Number(e.target.value))}
                disabled={loading || paymentStatus === 'success'}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <option key={month} value={month}>
                    {month} {month === 1 ? 'Month' : 'Months'}
                  </option>
                ))}
              </select>
            </div>

            {/* Fee Breakdown */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Monthly Fee:</span>
                <span className="font-semibold">₹{MONTHLY_FEE}/month</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Months:</span>
                <span className="font-semibold">{selectedMonths}</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-lg font-semibold text-gray-800">Total Amount:</span>
                <span className="text-2xl font-bold text-purple-600">₹{totalFee}</span>
              </div>
            </div>

            {/* Payment Button */}
            <button
              onClick={handlePayment}
              disabled={loading || paymentStatus === 'success'}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
                paymentStatus === 'success'
                  ? 'bg-green-500 text-white'
                  : 'bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800'
              }`}
            >
              {loading && (
                <span className="inline-block animate-spin mr-2">⏳</span>
              )}
              {getButtonText()}
            </button>

            <button
              onClick={() => navigate('/profile')}
              disabled={loading}
              className="w-full text-center text-gray-600 hover:text-purple-600 disabled:opacity-50 py-2"
            >
              ← Back to Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

