import React, { createContext, useContext, useState, useEffect } from 'react';
import { database } from '../firebase/config';
import { ref, set, onValue } from 'firebase/database';
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

  const value = {
    profile,
    loading,
    isProfileComplete: isProfileComplete(),
    updateProfile,
    feeStatus,
    hasPendingDues,
    updateFeePayment,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

