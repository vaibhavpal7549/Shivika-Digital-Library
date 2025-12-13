import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, set, onValue, push } from 'firebase/database';
import axios from 'axios';
import toast from 'react-hot-toast';
import { calculateMonthlyFee, calculateHourlyBasedFee, calculateMonthlyFeeFromHours, MONTHLY_FEE, HOURLY_RATE } from '../utils/feeUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (feeCalculationMode === 'hourly') {
      setTotalFee(calculateHourlyBasedFee(dailyHours, selectedMonths));
    } else {
      setTotalFee(calculateMonthlyFee(selectedMonths));
    }
  }, [selectedMonths, dailyHours, feeCalculationMode]);

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

    // Check if Razorpay key is configured
    const razorpayKey = process.env.REACT_APP_RAZORPAY_KEY_ID;
    if (!razorpayKey || razorpayKey === 'your_razorpay_key_id') {
      toast.error('Payment gateway not configured. Please contact administrator.');
      console.error('Razorpay Key ID not configured. Please set REACT_APP_RAZORPAY_KEY_ID in .env file');
      return;
    }

    setLoading(true);
    try {
      // Load Razorpay script
      const razorpayLoaded = await loadRazorpayScript();
      if (!razorpayLoaded) {
        toast.error('Failed to load payment gateway');
        setLoading(false);
        return;
      }

      // Create order
      const response = await axios.post(`${API_BASE_URL}/api/create-order`, {
        amount: totalFee,
        seatNumber,
        months: selectedMonths,
        dailyHours: feeCalculationMode === 'hourly' ? dailyHours : null,
        feeCalculationMode,
        userId: currentUser.uid,
      });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to create order');
      }

      const { order } = response.data;

      if (!order || !order.id) {
        throw new Error('Invalid order response from server');
      }

      // Razorpay options
      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Library Seat Booking',
        description: `Seat ${seatNumber} - Fee for ${selectedMonths} month(s)${feeCalculationMode === 'hourly' ? ` (${dailyHours} hrs/day)` : ''}`,
        order_id: order.id,
        handler: async function (response) {
          try {
            // Verify payment
            const verifyResponse = await axios.post(`${API_BASE_URL}/api/verify-payment`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              seatNumber,
              months: selectedMonths,
              userId: currentUser.uid,
            });

            if (verifyResponse.data.success) {
              const bookedAt = new Date().toISOString();
              const paymentDate = new Date().toISOString();
              
              // Update fee payment in profile
              await updateFeePayment(paymentDate, selectedMonths);
              
              // Update seat status in Firebase
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
              });

              // Save payment history
              const paymentsRef = ref(database, 'payments');
              await push(paymentsRef, {
                userId: currentUser.uid,
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
              });

              toast.success('Payment successful! Seat booked and fee paid.');
              navigate('/dashboard');
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
          contact: currentUser.phoneNumber || '',
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
              disabled={loading || !isProfileComplete}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : !isProfileComplete ? 'Complete Profile to Book' : `Pay ₹${totalFee} & Book Seat`}
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

