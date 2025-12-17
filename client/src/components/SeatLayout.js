import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import toast from 'react-hot-toast';

export default function SeatLayout({ seats }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isProfileComplete, hasPendingDues } = useProfile();
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
    return seat.status || 'vacant';
  };

  const handleSeatClick = (seatNumber) => {
    const status = getSeatStatus(seatNumber);
    if (status === 'vacant') {
      if (!isProfileComplete) {
        toast.error('Please complete your profile before booking a seat');
        navigate('/profile');
        return;
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
            ? 'bg-yellow-500 hover:bg-yellow-600 animate-blink'
            : isBooked 
            ? 'bg-green-500 hover:bg-green-600' 
            : isVacant 
            ? 'bg-red-500 hover:bg-red-600 animate-blink' 
            : 'bg-gray-300'
          }
          rounded p-1.5 sm:p-2 md:p-3 flex flex-col items-center justify-center
          shadow-lg hover:shadow-xl
          min-h-[32px] min-w-[32px] sm:min-h-[44px] sm:min-w-[44px] md:min-h-[60px] md:min-w-[60px] lg:min-h-[80px] lg:min-w-[80px]
          aspect-square
        `}
        title={
          showPendingDues 
            ? `Seat ${seatNumber} - Pending Dues` 
            : `Seat ${seatNumber} - ${isBooked ? 'Booked' : 'Vacant'}`
        }
        disabled={!isVacant}
      >
        <div className="text-white font-bold text-xs sm:text-sm md:text-base mb-0.5">
          {seatNumber}
        </div>
        <div className="text-white text-xs sm:text-sm md:text-base">
          {showPendingDues ? '⚠️' : isBooked ? '📚' : '🪑'}
        </div>
        {isBooked && !showPendingDues && (
          <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 md:w-2.5 md:h-2.5 bg-white rounded-full"></div>
        )}
        {showPendingDues && (
          <div className="absolute top-0.5 right-0.5 w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-red-600 rounded-full animate-pulse"></div>
        )}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-xl p-3 sm:p-4 md:p-6 lg:p-8 border border-gray-100 w-full overflow-x-auto">
      {/* Header - Responsive */}
      <div className="text-center mb-4 sm:mb-6 md:mb-8 px-2">
        <div className="inline-block bg-gradient-to-br from-blue-600 to-blue-700 p-2 sm:p-3 md:p-4 rounded-lg sm:rounded-xl shadow-lg mb-2 sm:mb-3 md:mb-4">
          <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl block">🪑</span>
        </div>
        <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
          Library Seat Layout
        </h2>
        <p className="text-xs sm:text-sm md:text-base text-gray-600 mt-1 sm:mt-2">Select your preferred study seat</p>
      </div>
      
      {/* Legend - Responsive and wrappable */}
      <div className="flex justify-center gap-2 sm:gap-3 md:gap-4 lg:gap-6 mb-4 sm:mb-6 md:mb-8 flex-wrap px-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-500 rounded flex-shrink-0"></div>
          <span className="text-xs sm:text-sm text-gray-700">Booked</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 rounded animate-blink flex-shrink-0"></div>
          <span className="text-xs sm:text-sm text-gray-700">Vacant</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-500 rounded animate-blink flex-shrink-0"></div>
          <span className="text-xs sm:text-sm text-gray-700">Pending</span>
        </div>
      </div>

      {/* Seat Grid - Fully responsive */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          {/* Grid with responsive columns */}
          {/* 320px-375px: 4 cols | 376-767px: 5-6 cols | 768px+: 10 cols */}
          <div className="grid gap-1 sm:gap-1.5 md:gap-2 lg:gap-3" style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(44px, 1fr))',
          }}>
            {Array.from({ length: totalSeats }, (_, i) => i + 1).map((seatNumber) =>
              renderSeat(seatNumber)
            )}
          </div>
        </div>
      </div>

      {/* Instructions - Responsive text */}
      <p className="text-center text-xs sm:text-sm md:text-base text-gray-600 mt-4 sm:mt-6 md:mt-8 px-2">
        💡 Click on a vacant (red) seat to book it
      </p>
    </div>
  );
}

