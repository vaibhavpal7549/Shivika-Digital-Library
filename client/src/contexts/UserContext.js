import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

/**
 * UserContext
 * 
 * This context manages user data from MongoDB.
 * It serves as the SINGLE SOURCE OF TRUTH for user information.
 * 
 * Firebase Auth handles authentication (login/logout).
 * MongoDB (via this context) handles user data storage.
 */

const UserContext = createContext();

// Get API URL from environment or default
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const { currentUser, loading: authLoading } = useAuth();
  
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  /**
   * Fetch user data from MongoDB
   */
  const fetchUserData = useCallback(async (firebaseUid) => {
    if (!firebaseUid) {
      setUserData(null);
      setLoading(false);
      return null;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_URL}/api/users/${firebaseUid}`);
      
      if (response.data.success) {
        setUserData(response.data.user);
        setNeedsRegistration(false);
        return response.data.user;
      }
    } catch (err) {
      console.error('Error fetching user data:', err);
      
      if (err.response?.status === 404 && err.response?.data?.needsRegistration) {
        setNeedsRegistration(true);
        setUserData(null);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
    
    return null;
  }, []);

  /**
   * Register user in MongoDB
   */
  /**
   * Register user in MongoDB
   */
  const registerUser = useCallback(async (registrationData, explicitUser = null) => {
    const userToRegister = explicitUser || currentUser;
    
    if (!userToRegister) {
      throw new Error('No authenticated user');
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${API_URL}/api/users/register`, {
        firebaseUid: userToRegister.uid,
        ...registrationData
      });

      if (response.data.success) {
        setUserData(response.data.user);
        setNeedsRegistration(false);
        return response.data;
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Error registering user:', err);
      setError(err.response?.data?.error || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  /**
   * Update user profile in MongoDB
   */
  const updateProfile = useCallback(async (updateData) => {
    if (!currentUser || !userData) {
      throw new Error('No user to update');
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.put(
        `${API_URL}/api/users/${currentUser.uid}`,
        updateData
      );

      if (response.data.success) {
        setUserData(response.data.user);
        toast.success('Profile updated successfully!');
        return response.data.user;
      } else {
        throw new Error(response.data.error || 'Update failed');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error(err.response?.data?.error || 'Failed to update profile');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentUser, userData]);

  /**
   * Update user's seat in MongoDB
   */
  const updateSeat = useCallback(async (seatData) => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      const response = await axios.put(
        `${API_URL}/api/users/${currentUser.uid}/seat`,
        seatData
      );

      if (response.data.success) {
        setUserData(response.data.user);
        return response.data.user;
      } else {
        throw new Error(response.data.error || 'Failed to update seat');
      }
    } catch (err) {
      console.error('Error updating seat:', err);
      throw err;
    }
  }, [currentUser]);

  /**
   * Clear user's seat in MongoDB
   */
  const clearSeat = useCallback(async () => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      // Try using the new seat release API first
      const response = await axios.post(`${API_URL}/api/seats/release`, {
        firebaseUid: currentUser.uid
      });

      if (response.data.success) {
        setUserData(response.data.user);
        return response.data.user;
      }
    } catch (err) {
      console.warn('Seat release API failed, trying fallback:', err);
      
      // Fallback to user route
      try {
        const fallbackResponse = await axios.delete(
          `${API_URL}/api/users/${currentUser.uid}/seat`
        );

        if (fallbackResponse.data.success) {
          setUserData(fallbackResponse.data.user);
          return fallbackResponse.data.user;
        }
      } catch (fallbackErr) {
        console.error('Error clearing seat:', fallbackErr);
        throw fallbackErr;
      }
    }
    
    throw new Error('Failed to clear seat');
  }, [currentUser]);

  /**
   * Sync seat data between Firebase and MongoDB
   * Ensures data consistency across both databases
   */
  const syncSeatData = useCallback(async () => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      const response = await axios.post(`${API_URL}/api/seats/sync`, {
        firebaseUid: currentUser.uid
      });

      if (response.data.success) {
        // Refresh user data to get latest seat info
        const updatedUser = await fetchUserData(currentUser.uid);
        return {
          success: true,
          message: response.data.message,
          seat: response.data.seat,
          source: response.data.source,
          user: updatedUser
        };
      }
    } catch (err) {
      console.error('Error syncing seat data:', err);
      throw err;
    }
  }, [currentUser, fetchUserData]);

  /**
   * Check if user has a booked seat (via backend)
   */
  const checkUserSeat = useCallback(async () => {
    if (!currentUser) {
      return { hasBookedSeat: false, seatNumber: null };
    }

    try {
      const response = await axios.get(
        `${API_URL}/api/seats/check-user/${currentUser.uid}`
      );

      return {
        hasBookedSeat: response.data.hasBookedSeat,
        seatNumber: response.data.seatNumber,
        message: response.data.message
      };
    } catch (err) {
      console.error('Error checking user seat:', err);
      return { hasBookedSeat: false, seatNumber: null };
    }
  }, [currentUser]);

  /**
   * Update payment status in MongoDB
   */
  const updatePaymentStatus = useCallback(async (paymentStatus) => {
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    try {
      const response = await axios.put(
        `${API_URL}/api/users/${currentUser.uid}/payment-status`,
        { paymentStatus }
      );

      if (response.data.success) {
        setUserData(response.data.user);
        return response.data.user;
      } else {
        throw new Error(response.data.error || 'Failed to update payment status');
      }
    } catch (err) {
      console.error('Error updating payment status:', err);
      throw err;
    }
  }, [currentUser]);

  /**
   * Refresh user data from MongoDB
   */
  const refreshUserData = useCallback(async () => {
    if (currentUser) {
      return fetchUserData(currentUser.uid);
    }
    return null;
  }, [currentUser, fetchUserData]);

  // Fetch user data when Firebase auth state changes
  useEffect(() => {
    if (!authLoading) {
      if (currentUser) {
        fetchUserData(currentUser.uid);
      } else {
        setUserData(null);
        setNeedsRegistration(false);
        setLoading(false);
      }
    }
  }, [currentUser, authLoading, fetchUserData]);

  const value = {
    // User data
    userData,
    loading: loading || authLoading,
    error,
    needsRegistration,
    
    // User info helpers (from MongoDB)
    userName: userData?.name || currentUser?.displayName || 'User',
    userEmail: userData?.email || currentUser?.email || '',
    userPhone: userData?.phone || '',
    userRole: userData?.role || 'student',
    userSeat: userData?.seat || null,
    paymentStatus: userData?.paymentStatus || 'PENDING',
    hasActiveSeat: userData?.hasActiveSeat || false,
    
    // Actions
    registerUser,
    updateProfile,
    updateSeat,
    clearSeat,
    updatePaymentStatus,
    refreshUserData,
    fetchUserData,
    syncSeatData,
    checkUserSeat,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}
