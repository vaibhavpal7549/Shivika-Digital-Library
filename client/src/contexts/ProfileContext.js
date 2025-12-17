import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { database } from '../firebase/config';
import { ref, set, onValue, query, orderByChild, equalTo, get } from 'firebase/database';
import { useAuth } from './AuthContext';
import { getFeeStatus, isFeeValid } from '../utils/feeUtils';

const ProfileContext = createContext();

export function useProfile() {
  return useContext(ProfileContext);
}

export function ProfileProvider({ children }) {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // ============================================
  // BOOKED SEAT STATE - Single source of truth
  // ============================================
  // This tracks the user's currently booked seat from Firebase 'seats' collection
  // It's fetched in real-time to ensure accuracy and prevent stale data
  const [bookedSeat, setBookedSeat] = useState(null);
  const [bookedSeatLoading, setBookedSeatLoading] = useState(true);

  // ============================================
  // PROFILE DATA LISTENER
  // ============================================
  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const profileRef = ref(database, `profiles/${currentUser.uid}`);
    const unsubscribe = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      setProfile(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ============================================
  // BOOKED SEAT LISTENER - Real-time updates
  // ============================================
  // Listens to all seats and finds the one booked by current user
  // This ensures we always have the latest booking status
  useEffect(() => {
    if (!currentUser) {
      setBookedSeat(null);
      setBookedSeatLoading(false);
      return;
    }

    setBookedSeatLoading(true);
    const seatsRef = ref(database, 'seats');
    
    const unsubscribe = onValue(seatsRef, (snapshot) => {
      const seatsData = snapshot.val() || {};
      
      // Find seat booked by current user with verified payment
      // Only consider seats that are:
      // 1. Status is 'booked'
      // 2. userId matches current user
      // 3. Has a valid payment verification status
      let userSeat = null;
      
      for (const [seatNumber, seatData] of Object.entries(seatsData)) {
        if (
          seatData.status === 'booked' &&
          seatData.userId === currentUser.uid &&
          seatData.verificationStatus === 'verified'
        ) {
          userSeat = {
            seatNumber: parseInt(seatNumber),
            bookedAt: seatData.bookedAt,
            months: seatData.months,
            dailyHours: seatData.dailyHours,
            amount: seatData.amount,
            paymentId: seatData.paymentId,
            orderId: seatData.orderId,
            feePaymentDate: seatData.feePaymentDate,
            verificationStatus: seatData.verificationStatus,
          };
          break; // User can only have one booked seat
        }
      }
      
      setBookedSeat(userSeat);
      setBookedSeatLoading(false);
      
      if (userSeat) {
        console.log('✅ Found booked seat for user:', userSeat.seatNumber);
      } else {
        console.log('ℹ️ No booked seat found for current user');
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const isProfileComplete = () => {
    if (!profile) return false;
    return !!(
      profile.profilePhoto &&
      profile.fullName &&
      profile.fatherName &&
      profile.dateOfBirth &&
      profile.email &&
      profile.phoneNumber &&
      profile.fullAddress
    );
  };

  const updateProfile = async (profileData) => {
    if (!currentUser) throw new Error('User not authenticated');
    
    try {
      const profileRef = ref(database, `profiles/${currentUser.uid}`);
      await set(profileRef, {
        ...profile,
        ...profileData,
        userId: currentUser.uid,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  // Check fee status
  const feeStatus = profile?.feePaymentDate ? getFeeStatus(profile.feePaymentDate) : 'PENDING';
  const hasPendingDues = feeStatus === 'PENDING';

  // Update fee status periodically
  useEffect(() => {
    if (!currentUser || !profile?.feePaymentDate) return;

    const checkFeeStatus = () => {
      const currentStatus = getFeeStatus(profile.feePaymentDate);
      if (currentStatus === 'PENDING' && profile.feeStatus !== 'PENDING') {
        // Update fee status in database
        const profileRef = ref(database, `profiles/${currentUser.uid}`);
        set(profileRef, {
          ...profile,
          feeStatus: 'PENDING',
        });
      }
    };

    // Check immediately
    checkFeeStatus();

    // Check every hour
    const interval = setInterval(checkFeeStatus, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentUser, profile]);

  const updateFeePayment = async (paymentDate, months) => {
    if (!currentUser) throw new Error('User not authenticated');
    
    try {
      const profileRef = ref(database, `profiles/${currentUser.uid}`);
      const updatedProfile = {
        ...profile,
        feePaymentDate: paymentDate,
        feeStatus: 'PAID',
        feeMonths: months,
        feeUpdatedAt: new Date().toISOString(),
      };
      await set(profileRef, updatedProfile);
      return true;
    } catch (error) {
      console.error('Error updating fee payment:', error);
      throw error;
    }
  };

  // ============================================
  // CONTEXT VALUE - All profile and seat data
  // ============================================
  const value = {
    // Profile data
    profile,
    loading,
    isProfileComplete: isProfileComplete(),
    updateProfile,
    
    // Fee status
    feeStatus,
    hasPendingDues,
    updateFeePayment,
    
    // Booked seat data - single source of truth
    // Use this to display booked seat in Profile and other components
    bookedSeat,
    bookedSeatLoading,
    hasBookedSeat: !!bookedSeat, // Convenience boolean for conditional rendering
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

