import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import SeatLayout from '../components/SeatLayout';

export default function SeatViewer() {
  const { currentUser, logout } = useAuth();
  const { isProfileComplete } = useProfile();
  const [seats, setSeats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const seatsRef = ref(database, 'seats');
    const unsubscribe = onValue(seatsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setSeats(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading seats...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-3 rounded-xl shadow-lg">
                  <span className="text-2xl">🪑</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    Seat Viewer
                  </h1>
                  <p className="text-gray-600 mt-1 font-medium">Real-time seat availability</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
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

        {/* Seat Layout */}
        <SeatLayout seats={seats} />
      </div>
    </div>
  );
}

