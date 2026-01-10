import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { database } from '../firebase/config';
import { ref, set, onValue } from 'firebase/database';
import { useAuth } from './AuthContext';
import { getFeeStatus } from '../utils/feeUtils';
import axios from 'axios';

const ProfileContext = createContext();

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function useProfile() {
  return useContext(ProfileContext);
}

export function ProfileProvider({ children }) {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // ============================================
  // BOOKED SEAT STATE - From MongoDB (source of truth)
  // ============================================
  const [bookedSeat, setBookedSeat] = useState(null);
  const [bookedSeatLoading, setBookedSeatLoading] = useState(true);

  // ============================================
  // PROFILE DATA - Fetch from MongoDB (source of truth)
  // Also listen to Firebase for real-time updates
  // ============================================
  const fetchProfileFromMongoDB = useCallback(async (explicitUid = null) => {
    const uidToFetch = explicitUid || currentUser?.uid;
    
    if (!uidToFetch) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/users/${uidToFetch}`);
      
      if (response.data.success && response.data.user) {
        // Map MongoDB user data to profile structure
        const userData = response.data.user;
        setProfile({
          fullName: userData.fullName,
          email: userData.email,
          phoneNumber: userData.phone,
          photoURL: userData.photoURL, // Google profile photo
          profilePhoto: userData.photoURL, // Alias for compatibility
          fatherName: userData.profile?.fatherName,
          dateOfBirth: userData.profile?.dateOfBirth,
          fullAddress: userData.profile?.address?.full,
          profile: userData.profile,
          // Include other fields if needed
          role: userData.role,
          isActive: userData.isActive,
        });
        console.log('✅ Fetched profile from MongoDB');
      } else {
        setProfile(null);
        console.log('ℹ️ No profile found for current user');
      }
    } catch (error) {
      console.error('Error fetching profile from MongoDB:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  // Fetch profile on mount and when user changes
  useEffect(() => {
    fetchProfileFromMongoDB();
  }, [fetchProfileFromMongoDB]);

  // Also listen to Firebase for real-time updates (for backward compatibility)
  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const profileRef = ref(database, `profiles/${currentUser.uid}`);
    const unsubscribe = onValue(profileRef, (snapshot) => {
      const firebaseData = snapshot.val();
      // If Firebase has data, merge it but MongoDB photoURL takes precedence
      if (firebaseData) {
        setProfile(prev => ({
          ...prev,
          ...firebaseData,
          photoURL: prev?.photoURL || firebaseData.photoURL, // Preserve MongoDB photoURL
          profilePhoto: prev?.photoURL || firebaseData.photoURL,
        }));
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ============================================
  // BOOKED SEAT - Fetch from MongoDB via API
  // ============================================
  const fetchBookedSeat = useCallback(async () => {
    if (!currentUser?.uid) {
      setBookedSeat(null);
      setBookedSeatLoading(false);
      return;
    }

    try {
      setBookedSeatLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/seats/user/${currentUser.uid}`);
      
      if (response.data.success && response.data.hasSeat && response.data.seat) {
        setBookedSeat({
          seatNumber: response.data.seat.seatNumber,
          shift: response.data.seat.shift,
          bookedAt: response.data.seat.bookedAt,
          validUntil: response.data.seat.validUntil,
          status: response.data.seat.status
        });
        console.log('✅ Fetched booked seat from MongoDB:', response.data.seat.seatNumber);
      } else {
        setBookedSeat(null);
        console.log('ℹ️ No booked seat found for current user');
      }
    } catch (error) {
      console.error('Error fetching booked seat:', error);
      setBookedSeat(null);
    } finally {
      setBookedSeatLoading(false);
    }
  }, [currentUser?.uid]);

  // Fetch booked seat on mount and when user changes
  useEffect(() => {
    fetchBookedSeat();
  }, [fetchBookedSeat]);

  // Listen for Firebase seat changes (for real-time UI updates)
  // This is READ-ONLY - no writes to Firebase from frontend
  useEffect(() => {
    if (!currentUser) return;

    const seatsRef = ref(database, 'seats');
    const unsubscribe = onValue(seatsRef, () => {
      // When Firebase updates, re-fetch from MongoDB to ensure consistency
      fetchBookedSeat();
    });

    return () => unsubscribe();
  }, [currentUser, fetchBookedSeat]);

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
      // Update profile via backend (MongoDB is source of truth)
      const response = await axios.put(`${API_BASE_URL}/api/users/${currentUser.uid}`, profileData);
      
      if (response.data?.success && response.data.user) {
        // Update local cache for immediate UI feedback
        setProfile({
          ...profile,
          ...profileData,
          userId: currentUser.uid,
          updatedAt: new Date().toISOString(),
        });
        return true;
      }
      throw new Error(response.data?.error || 'Failed to update profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  // Check fee status
  const feeStatus = profile?.feePaymentDate ? getFeeStatus(profile.feePaymentDate) : 'PENDING';
  const hasPendingDues = feeStatus === 'PENDING';

  // Client-side fee status check (read-only, no writes)
  useEffect(() => {
    if (!currentUser || !profile?.feePaymentDate) return;

    // Optionally: trigger UI notifications when dues become pending
    // Do not write to backend from client here
  }, [currentUser, profile]);

  const updateFeePayment = async (paymentDate, months) => {
    if (!currentUser) throw new Error('User not authenticated');
    
    try {
      // Update payment status via backend (MongoDB is source of truth)
      const response = await axios.put(`${API_BASE_URL}/api/users/${currentUser.uid}/payment-status`, {
        paymentStatus: 'PAID',
      });

      if (response.data?.success) {
        // Update local cache for immediate UI feedback
        setProfile({
          ...profile,
          feePaymentDate: paymentDate,
          feeStatus: 'PAID',
          feeMonths: months,
          feeUpdatedAt: new Date().toISOString(),
        });
        return true;
      }

      throw new Error(response.data?.error || 'Failed to update payment status');
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
    
    // Booked seat data - fetched from MongoDB (source of truth)
    // Firebase is used only for real-time notifications
    bookedSeat,
    bookedSeatLoading,
    hasBookedSeat: !!bookedSeat, // Convenience boolean for conditional rendering
    refreshBookedSeat: fetchBookedSeat, // Function to manually refresh seat data
    refreshProfile: fetchProfileFromMongoDB, // Function to manually refresh profile data
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

