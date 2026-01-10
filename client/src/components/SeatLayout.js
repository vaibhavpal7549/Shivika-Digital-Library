import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import toast from 'react-hot-toast';

/**
 * SeatLayout Component
 * 
 * Displays the library seat grid with real-time availability.
 * 
 * ONE-SEAT-PER-USER RULE:
 * - If user already has a booked seat, clicking other seats navigates to booking
 *   page which handles the "Change Seat" flow
 * - User's current seat is highlighted in a distinct blue color
 * - Provides visual feedback for booking restrictions
 */
export default function SeatLayout({ seats }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isProfileComplete, hasPendingDues, bookedSeat, hasBookedSeat } = useProfile();
  const [userSeatNumber, setUserSeatNumber] = useState(null);
  const totalSeats = 60;

  // Find user's seat
  useEffect(() => {
    if (!currentUser) return;

    const seatsRef = ref(database, 'seats');
    const unsubscribe = onValue(seatsRef, (snapshot) => {
      const seatsData = snapshot.val() || {};
      for (const [seatNum, seatData] of Object.entries(seatsData)) {
        if (seatData.userId === currentUser.uid && seatData.status === 'booked') {
          setUserSeatNumber(parseInt(seatNum));
          return;
        }
      }
      setUserSeatNumber(null);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const getSeatStatus = (seatNumber) => {
    const seat = seats[seatNumber];
    if (!seat) return 'vacant';
    // Backend uses 'available', frontend uses 'vacant'
    return seat.status === 'available' ? 'vacant' : seat.status || 'vacant';
  };

  const handleSeatClick = (seatNumber) => {
    const status = getSeatStatus(seatNumber);
    
    // Profile incomplete check
    if (!isProfileComplete) {
      toast.error('Please complete your profile before booking a seat');
      navigate('/profile');
      return;
    }
    
    // User's own seat - show info
    if (userSeatNumber === seatNumber) {
      toast('This is your currently booked seat!', { icon: '🪑' });
      return;
    }
    
    // Seat is vacant
    if (status === 'vacant') {
      // ONE-SEAT-PER-USER: If user has a seat, navigate to booking which handles change flow
      if (hasBookedSeat) {
        // We don't block, just let them go to booking page to handle the switch
      }
      navigate(`/booking/${seatNumber}`);
    } else {
      toast.error(`Seat ${seatNumber} is already booked!`);
    }
  };

  const renderSeat = (seatNumber) => {
    const status = getSeatStatus(seatNumber);
    const isBooked = status === 'booked';
    const isVacant = status === 'vacant';
    const isUserSeat = userSeatNumber === seatNumber;
    const showPendingDues = isUserSeat && hasPendingDues;

    return (
      <button
        key={seatNumber}
        onClick={() => handleSeatClick(seatNumber)}
        className={`
          relative transition-all duration-300 transform hover:scale-105 touch-target
          ${showPendingDues
            ? 'bg-yellow-100 border-2 border-yellow-500 text-yellow-700 animate-pulse'
            : isUserSeat
            ? 'bg-blue-700 border-2 border-blue-700 text-white shadow-blue-200'
            : isBooked 
            ? 'bg-red-100 border-2 border-red-400 text-red-600 cursor-not-allowed' 
            : isVacant 
            ? 'bg-green-100 border-2 border-green-600 text-green-800 animate-pulse hover:bg-green-200 hover:shadow-green-100' 
            : 'bg-gray-100'
          }
          rounded-xl p-1.5 sm:p-2 md:p-3 flex flex-col items-center justify-center
          shadow-sm hover:shadow-md
          min-h-[44px] min-w-[44px] sm:min-h-[50px] sm:min-w-[50px] md:min-h-[60px] md:min-w-[60px]
          aspect-square
        `}
        title={
          showPendingDues 
            ? `Seat ${seatNumber} - Pending Dues` 
            : isUserSeat
            ? `Seat ${seatNumber} - Your Seat`
            : `Seat ${seatNumber} - ${isBooked ? 'Booked' : 'Available'}`
        }
        disabled={!isVacant && !isUserSeat}
      >
        <div className={`font-bold text-xs sm:text-sm md:text-base mb-0.5 ${isUserSeat ? 'text-white' : ''}`}>
          {seatNumber}
        </div>
        <div className="text-xs sm:text-sm md:text-base">
          {showPendingDues ? '⚠️' : isUserSeat ? '👤' : isBooked ? '🔒' : '✨'}
        </div>
        {isUserSeat && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 border border-gray-100 w-full">
      {/* Header - Responsive */}
      <div className="text-center mb-6 sm:mb-8 px-2">
        <div className="inline-block bg-gradient-to-br from-blue-600 to-blue-700 p-3 sm:p-4 rounded-2xl shadow-lg mb-3 sm:mb-4">
          <span className="text-3xl sm:text-4xl text-white">🪑</span>
        </div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">
          Select Your Seat
        </h2>
        <p className="text-sm sm:text-base text-gray-500 mt-2">
          Green seats are available for booking
        </p>
      </div>
      
      {/* Legend - Responsive and wrappable */}
      <div className="flex justify-center gap-4 sm:gap-6 mb-6 sm:mb-8 flex-wrap px-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-green-100 border-2 border-green-600 rounded-lg flex-shrink-0 animate-pulse"></div>
          <span className="text-sm font-medium text-gray-700">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-red-100 border-2 border-red-400 rounded-lg flex-shrink-0"></div>
          <span className="text-sm font-medium text-gray-500">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-blue-700 border-2 border-blue-700 rounded-lg flex-shrink-0"></div>
          <span className="text-sm font-medium text-gray-700">Your Seat</span>
        </div>
      </div>

      {/* Seat Grid - Fully responsive */}
      <div className="flex justify-center">
        <div className="inline-block">
          {/* Grid with fixed columns for stability */}
          <div className="grid gap-2 sm:gap-3" style={{
            gridTemplateColumns: 'repeat(5, 1fr)', // Mobile default
            '@media (min-width: 640px)': {
              gridTemplateColumns: 'repeat(8, 1fr)', // Tablet
            },
            '@media (min-width: 1024px)': {
              gridTemplateColumns: 'repeat(10, 1fr)', // Desktop
            }
          }}>
            {/* We use a responsive class approach for grid columns instead of inline styles for media queries */}
            <div className="hidden sm:hidden md:hidden lg:hidden"></div> {/* Hack to keep tailwind classes if needed, but we'll use className for grid */}
          </div>
          
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3 md:gap-4">
            {Array.from({ length: totalSeats }, (_, i) => i + 1).map((seatNumber) =>
              renderSeat(seatNumber)
            )}
          </div>
        </div>
      </div>

      {/* Instructions - Responsive text */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500 bg-blue-50 inline-block px-4 py-2 rounded-full border border-blue-100">
          💡 Click on any <span className="font-bold text-green-600">Available</span> seat to proceed with booking
        </p>
      </div>
    </div>
  );
}

