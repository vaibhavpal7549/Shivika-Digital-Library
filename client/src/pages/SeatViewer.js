import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { useSocket } from '../contexts/SocketContext';
import { database } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import SeatLayout from '../components/SeatLayout';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * SeatViewer Component
 * 
 * Displays the library seat layout with real-time availability.
 * Uses Socket.IO for instant updates without page refresh.
 * 
 * ONE-SEAT-PER-USER FEATURES:
 * - Shows "Your Booked Seat" card if user has a seat
 * - Displays seat number prominently
 * - Provides "Change Seat" information
 * - Profile completion check before allowing booking
 */
export default function SeatViewer() {
  const { isProfileComplete, bookedSeat, hasBookedSeat, bookedSeatLoading } = useProfile();
  const { connected, lastSeatUpdate } = useSocket();
  const [seats, setSeats] = useState({});
  const [loading, setLoading] = useState(true);

  // Initial load from MongoDB (source of truth)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/seats/all`);
        if (isMounted && response.data?.success) {
          setSeats(response.data.seats || {});
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching seats from API:', error);
        // Fallback to Firebase listener will still populate
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Firebase real-time listener (cache/updates)
  // DISABLED: Backend does not sync to Firebase, so this was overwriting valid API data with empty data.
  /*
  useEffect(() => {
    const seatsRef = ref(database, 'seats');
    const unsubscribe = onValue(seatsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setSeats(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  */

  // Socket.IO updates (secondary, for instant cross-user updates)
  useEffect(() => {
    if (lastSeatUpdate) {
      // Update seats based on socket event
      setSeats(prevSeats => {
        const newSeats = { ...prevSeats };
        
        if (lastSeatUpdate.type === 'SEAT_BOOKED') {
          newSeats[lastSeatUpdate.seatNumber] = {
            status: 'booked',
            userId: lastSeatUpdate.userId,
            userEmail: lastSeatUpdate.userEmail,
            bookedAt: lastSeatUpdate.bookedAt
          };
        } else if (lastSeatUpdate.type === 'SEAT_RELEASED') {
          delete newSeats[lastSeatUpdate.seatNumber];
        } else if (lastSeatUpdate.type === 'SEAT_CHANGED') {
          // Remove old seat
          if (lastSeatUpdate.oldSeatNumber) {
            delete newSeats[lastSeatUpdate.oldSeatNumber];
          }
          // Add new seat
          newSeats[lastSeatUpdate.newSeatNumber] = {
            status: 'booked',
            userId: lastSeatUpdate.userId,
            userEmail: lastSeatUpdate.userEmail
          };
        }
        
        return newSeats;
      });
    }
  }, [lastSeatUpdate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-lg md:text-xl text-gray-700">Loading seats...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6 lg:p-8 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header - Responsive */}
        <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 mb-4 sm:mb-6 md:mb-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            {/* Title Section */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 sm:p-3 rounded-lg sm:rounded-xl shadow-lg flex-shrink-0">
                <span className="text-xl sm:text-2xl md:text-3xl block">🪑</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent truncate">
                    Seat Viewer
                  </h1>
                  {/* Real-time connection indicator */}
                  <span 
                    className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
                    title={connected ? 'Live updates active' : 'Reconnecting...'}
                  />
                </div>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-0.5 sm:mt-1">
                  {connected ? 'Live updates active' : 'Real-time availability'}
                </p>
              </div>
            </div>

            {/* Buttons - Responsive */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              <Link
                to="/dashboard"
                className="bg-purple-600 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded text-xs sm:text-sm md:text-base font-semibold hover:bg-purple-700 transition touch-target text-center"
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className="bg-blue-600 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 rounded text-xs sm:text-sm md:text-base font-semibold hover:bg-blue-700 transition touch-target text-center"
              >
                Profile
              </Link>
            </div>
          </div>
        </div>

        {/* Profile Completion Alert - Responsive */}
        {!isProfileComplete && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2 sm:gap-3 flex-1">
                <div className="text-lg sm:text-xl flex-shrink-0">⚠️</div>
                <div className="min-w-0">
                  <p className="text-yellow-800 font-semibold text-sm sm:text-base">Profile Incomplete</p>
                  <p className="text-yellow-700 text-xs sm:text-sm">Please complete your profile to book seats.</p>
                </div>
              </div>
              <Link
                to="/profile"
                className="bg-yellow-600 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold hover:bg-yellow-700 transition touch-target whitespace-nowrap text-sm sm:text-base"
              >
                Complete
              </Link>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* YOUR BOOKED SEAT CARD - ONE-SEAT-PER-USER */}
        {/* Shows prominently if user already has a seat */}
        {/* ============================================ */}
        {hasBookedSeat && bookedSeat && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 p-4 sm:p-6 mb-4 sm:mb-6 rounded-xl shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg">
                  {bookedSeat.seatNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg sm:text-xl">✅</span>
                    <h3 className="text-lg sm:text-xl font-bold text-green-800">Your Booked Seat</h3>
                  </div>
                  <p className="text-green-700 text-sm sm:text-base mt-1">
                    <span className="font-semibold">Seat {bookedSeat.seatNumber}</span> • {
                      (() => {
                        const duration = parseInt(bookedSeat.months || bookedSeat.monthsPaidFor || 1);
                        return duration === 1 ? '1 Month' : `${duration} Months`;
                      })()
                    }
                    {bookedSeat.dailyHours && ` • ${bookedSeat.dailyHours} hrs/day`}
                  </p>
                  <p className="text-green-600 text-xs sm:text-sm mt-1">
                    Booked on: {
                      (() => {
                        const dateValue = bookedSeat.bookingDate || bookedSeat.bookedAt || bookedSeat.createdAt;
                        if (!dateValue) return 'N/A';
                        // Extract YYYY-MM-DD from ISO string
                        return new Date(dateValue).toISOString().split('T')[0];
                      })()
                    }
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <Link
                  to="/dashboard"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition text-center text-sm sm:text-base"
                >
                  View Dashboard
                </Link>
              </div>
            </div>
            {/* One-seat-per-user notice */}
            <div className="mt-4 bg-white/50 rounded-lg p-3 border border-green-200">
              <p className="text-green-700 text-xs sm:text-sm flex items-start gap-2">
                <span className="flex-shrink-0">ℹ️</span>
                <span>
                  <strong>One seat per user:</strong> You can only have one seat booked at a time. 
                  To change seats, click on a vacant (green) seat and follow the "Change Seat" flow.
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Loading booked seat */}
        {bookedSeatLoading && (
          <div className="bg-gray-50 border border-gray-200 p-4 mb-4 sm:mb-6 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
              <p className="text-gray-600 text-sm">Checking your booking status...</p>
            </div>
          </div>
        )}

        {/* Seat Layout - Responsive Container */}
        <div className="w-full">
          <SeatLayout seats={seats} />
        </div>
      </div>
    </div>
  );
}

