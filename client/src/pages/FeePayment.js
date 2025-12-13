import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, push } from 'firebase/database';
import axios from 'axios';
import toast from 'react-hot-toast';
import { calculateMonthlyFee, MONTHLY_FEE } from '../utils/feeUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function FeePayment() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { updateFeePayment } = useProfile();
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [totalFee, setTotalFee] = useState(MONTHLY_FEE);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setTotalFee(calculateMonthlyFee(selectedMonths));
  }, [selectedMonths]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    // Check if Razorpay key is configured
    const razorpayKey = process.env.REACT_APP_RAZORPAY_KEY_ID;
    if (!razorpayKey || razorpayKey === 'your_razorpay_key_id') {
      toast.error('Payment gateway not configured. Please contact administrator.');
      console.error('Razorpay Key ID not configured. Please set REACT_APP_RAZORPAY_KEY_ID in .env file');
      return;
    }

    setLoading(true);
    try {
      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) {
        toast.error('Failed to load payment gateway');
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API_BASE_URL}/api/create-order`, {
        amount: totalFee,
        months: selectedMonths,
        userId: currentUser.uid,
        type: 'fee_payment',
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create order');
      }

      const { order } = response.data;

      if (!order || !order.id) {
        throw new Error('Invalid order response from server');
      }

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Library Fee Payment',
        description: `Fee payment for ${selectedMonths} month(s)`,
        order_id: order.id,
        handler: async function (response) {
          try {
            const verifyResponse = await axios.post(`${API_BASE_URL}/api/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              months: selectedMonths,
              userId: currentUser.uid,
              type: 'fee_payment',
            });

            if (verifyResponse.data.success) {
              const paymentDate = new Date().toISOString();
              
              await updateFeePayment(paymentDate, selectedMonths);

              // Save payment history
              const paymentsRef = ref(database, 'payments');
              await push(paymentsRef, {
                userId: currentUser.uid,
                months: selectedMonths,
                amount: totalFee,
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                bookedAt: paymentDate,
                feePaymentDate: paymentDate,
                status: 'paid',
                type: 'fee_payment',
              });

              toast.success('Fee payment successful!');
              navigate('/profile');
            } else {
              toast.error('Payment verification failed');
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: currentUser.displayName || 'User',
          email: currentUser.email || '',
        },
        theme: {
          color: '#667eea',
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
            toast.error('Payment cancelled');
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      
      razorpay.on('payment.failed', function (response) {
        console.error('Payment failed:', response.error);
        toast.error(`Payment failed: ${response.error.description || 'Unknown error'}`);
        setLoading(false);
      });

      razorpay.open();
      setLoading(false);
    } catch (error) {
      console.error('Payment error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to initiate payment';
      toast.error(errorMessage);
      
      // More detailed error logging
      if (error.response?.status === 500) {
        console.error('Server error - Check if backend is running and Razorpay keys are configured');
      } else if (error.response?.status === 0) {
        console.error('Network error - Check if backend server is running at', API_BASE_URL);
        toast.error('Cannot connect to server. Please ensure the backend is running.');
      }
      
      setLoading(false);
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

          <div className="space-y-6">
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
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Processing...' : `Pay ₹${totalFee}`}
            </button>

            <button
              onClick={() => navigate('/profile')}
              className="w-full text-center text-gray-600 hover:text-purple-600"
            >
              ← Back to Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

