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
      <div
        key={seatNumber}
        onClick={() => handleSeatClick(seatNumber)}
        className={`
          relative cursor-pointer transition-all duration-300 transform hover:scale-110
          ${showPendingDues
            ? 'bg-yellow-500 hover:bg-yellow-600 animate-blink'
            : isBooked 
            ? 'bg-green-500 hover:bg-green-600' 
            : isVacant 
            ? 'bg-red-500 hover:bg-red-600 animate-blink' 
            : 'bg-gray-300'
          }
          rounded-lg p-4 flex flex-col items-center justify-center
          shadow-lg hover:shadow-xl
          min-h-[80px] min-w-[80px]
        `}
        title={
          showPendingDues 
            ? `Seat ${seatNumber} - Pending Dues` 
            : `Seat ${seatNumber} - ${isBooked ? 'Booked' : 'Vacant'}`
        }
      >
        <div className="text-white font-bold text-sm mb-1">
          {seatNumber}
        </div>
        <div className="text-white text-xs">
          {showPendingDues ? '⚠️' : isBooked ? '📚' : '🪑'}
        </div>
        {isBooked && !showPendingDues && (
          <div className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full"></div>
        )}
        {showPendingDues && (
          <div className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="text-center mb-8">
        <div className="inline-block bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-xl shadow-lg mb-4">
          <span className="text-4xl">🪑</span>
        </div>
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
          Library Seat Layout
        </h2>
        <p className="text-gray-600 mt-2">Select your preferred study seat</p>
      </div>
      
      {/* Legend */}
      <div className="flex justify-center gap-6 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-700">Booked</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded animate-blink"></div>
          <span className="text-sm text-gray-700">Vacant</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-500 rounded animate-blink"></div>
          <span className="text-sm text-gray-700">Pending Dues</span>
        </div>
      </div>

      {/* Seat Grid */}
      <div className="grid grid-cols-10 gap-3 justify-center">
        {Array.from({ length: totalSeats }, (_, i) => i + 1).map((seatNumber) =>
          renderSeat(seatNumber)
        )}
      </div>

      <p className="text-center text-gray-600 mt-6 text-sm">
        Click on a vacant (red) seat to book it
      </p>
    </div>
  );
}

