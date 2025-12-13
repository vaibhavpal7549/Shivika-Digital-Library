import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { database } from '../firebase/config';
import { ref, onValue } from 'firebase/database';

export default function PaymentHistory() {
  const { currentUser, logout } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const paymentsRef = ref(database, 'payments');
    const unsubscribe = onValue(paymentsRef, (snapshot) => {
      const data = snapshot.val() || {};
      // Filter payments for current user
      const userPayments = Object.entries(data)
        .filter(([_, payment]) => payment.userId === currentUser.uid)
        .map(([id, payment]) => ({
          id,
          ...payment,
        }))
        .sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));
      
      setPayments(userPayments);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading payment history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-green-600 to-green-700 p-3 rounded-xl shadow-lg">
                  <span className="text-2xl">💳</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
                    Payment History
                  </h1>
                  <p className="text-gray-600 mt-1 font-medium">View all your booking transactions</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                to="/dashboard"
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Profile
              </Link>
              <button
                onClick={logout}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Payment History Table */}
        {payments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No Payment History</h3>
            <p className="text-gray-600 mb-6">You haven't made any bookings yet.</p>
            <Link
              to="/seats"
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition inline-block"
            >
              Book a Seat
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Date</th>
                    <th className="px-6 py-4 text-left font-semibold">Seat Number</th>
                    <th className="px-6 py-4 text-left font-semibold">Hours</th>
                    <th className="px-6 py-4 text-left font-semibold">Amount</th>
                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                    <th className="px-6 py-4 text-left font-semibold">Payment ID</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-800">
                        {formatDate(payment.bookedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-semibold">
                          Seat {payment.seatNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-800">
                        {payment.hours} {payment.hours === 1 ? 'Hour' : 'Hours'}
                      </td>
                      <td className="px-6 py-4 text-gray-800 font-semibold">
                        ₹{payment.amount}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
                          ✓ Paid
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm font-mono">
                        {payment.paymentId?.substring(0, 20)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {payments.length > 0 && (
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-6 mt-6 border border-blue-100">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Summary</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Total Bookings</p>
                <p className="text-2xl font-bold text-purple-600">{payments.length}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Total Amount Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{payments.reduce((sum, p) => sum + (p.amount || 0), 0)}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-gray-600 text-sm">Total Hours Booked</p>
                <p className="text-2xl font-bold text-blue-600">
                  {payments.reduce((sum, p) => sum + (p.hours || 0), 0)} Hours
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

