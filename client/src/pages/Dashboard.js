import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const { isProfileComplete, profile } = useProfile();
  const navigate = useNavigate();
  const [seats, setSeats] = useState({});
  const [selectedHours, setSelectedHours] = useState(1);
  const [hourlyRate] = useState(50); // ₹50 per hour
  const [totalFee, setTotalFee] = useState(hourlyRate);

  useEffect(() => {
    setTotalFee(selectedHours * hourlyRate);
  }, [selectedHours, hourlyRate]);

  useEffect(() => {
    const seatsRef = ref(database, 'seats');
    const unsubscribe = onValue(seatsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setSeats(data);
    });

    return () => unsubscribe();
  }, []);

  const bookedCount = Object.values(seats).filter(seat => seat.status === 'booked').length;
  const vacantCount = 60 - bookedCount;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      // Error handled in context
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-3 rounded-xl shadow-lg">
                  <span className="text-2xl">📚</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    Shivika Digital Library
                  </h1>
                  <p className="text-gray-600 mt-1 font-medium">
                    Welcome back, {currentUser?.email || currentUser?.phoneNumber || 'User'} 👋
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link
                to="/profile"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Profile
              </Link>
              <Link
                to="/payment-history"
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
              >
                Payment History
              </Link>
              <Link
                to="/seats"
                className={`px-6 py-2 rounded-lg font-semibold transition ${
                  isProfileComplete
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-400 text-white cursor-not-allowed'
                }`}
                onClick={(e) => {
                  if (!isProfileComplete) {
                    e.preventDefault();
                    toast.error('Please complete your profile before booking a seat');
                    navigate('/profile');
                  }
                }}
              >
                View Seats
              </Link>
              <button
                onClick={handleLogout}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Profile Completion Alert */}
        {!isProfileComplete && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="text-yellow-400 text-xl mr-3">⚠️</div>
                <div>
                  <p className="text-yellow-800 font-semibold">Profile Incomplete</p>
                  <p className="text-yellow-700 text-sm">Please complete your profile to book seats.</p>
                </div>
              </div>
              <Link
                to="/profile"
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-yellow-700 transition"
              >
                Complete Profile
              </Link>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Seat Status */}
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-6 border border-blue-100">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-4">
              Seat Status
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                  <span className="font-semibold text-gray-800">Booked Seats</span>
                </div>
                <span className="text-2xl font-bold text-green-600">{bookedCount}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-blink"></div>
                  <span className="font-semibold text-gray-800">Vacant Seats</span>
                </div>
                <span className="text-2xl font-bold text-red-600">{vacantCount}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                  <span className="font-semibold text-gray-800">Total Seats</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">60</span>
              </div>
            </div>
          </div>

          {/* Fee Calculator */}
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-2xl shadow-xl p-6 border border-purple-100">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent mb-4">
              Fee Calculator
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Hours
                </label>
                <select
                  value={selectedHours}
                  onChange={(e) => setSelectedHours(Number(e.target.value))}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((hour) => (
                    <option key={hour} value={hour}>
                      {hour} {hour === 1 ? 'Hour' : 'Hours'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-700">Hourly Rate:</span>
                  <span className="font-semibold">₹{hourlyRate}/hr</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-800">Total Fee:</span>
                  <span className="text-2xl font-bold text-purple-600">₹{totalFee}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Library Location */}
          <div className="bg-gradient-to-br from-white to-green-50 rounded-2xl shadow-xl p-6 md:col-span-2 border border-green-100">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent mb-4">
              Library Location
            </h2>
            <div className="w-full h-64 rounded-lg overflow-hidden">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.1234567890!2d72.8776559!3d19.0759837!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDA0JzMzLjUiTiA3MsKwNTInMzkuNiJF!5e0!3m2!1sen!2sin!4v1234567890123!5m2!1sen!2sin"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Library Location"
              ></iframe>
            </div>
            <p className="mt-4 text-gray-600 text-center">
              📍 Library Address: 123 Education Street, Learning City, 400001
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

