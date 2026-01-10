import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

/**
 * SocketContext
 * 
 * Provides real-time Socket.IO connectivity for:
 * - Seat updates (live seat layout updates)
 * - Payment notifications
 * - Profile sync
 * - Admin panel updates
 */

const SocketContext = createContext();

// Get Socket URL from environment or default
const SOCKET_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const { currentUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastSeatUpdate, setLastSeatUpdate] = useState(null);
  const [lastPaymentUpdate, setLastPaymentUpdate] = useState(null);
  const [lastProfileUpdate, setLastProfileUpdate] = useState(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('🔌 Socket connected:', newSocket.id);
      setConnected(true);
      
      // Auto-join seats room for all users
      newSocket.emit('join:seats');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.warn('🔌 Socket connection error:', error.message);
      setConnected(false);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔌 Socket reconnected after', attemptNumber, 'attempts');
      setConnected(true);
      
      // Re-join rooms after reconnect
      newSocket.emit('join:seats');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Join user-specific room when authenticated
  useEffect(() => {
    if (socket && connected && currentUser?.uid) {
      socket.emit('join:user', currentUser.uid);
      console.log('👤 Joined user room:', currentUser.uid.substring(0, 8) + '...');
    }
  }, [socket, connected, currentUser?.uid]);

  // Set up seat update listeners
  useEffect(() => {
    if (!socket) return;

    const handleSeatUpdate = (data) => {
      console.log('🪑 Seat update received:', data);
      setLastSeatUpdate(data);

      // Show toast notification for relevant updates
      if (data.type === 'SEAT_BOOKED') {
        // Only notify if it's not the current user
        if (data.userId !== currentUser?.uid) {
          toast(`Seat ${data.seatNumber} was just booked`, {
            icon: '🪑',
            duration: 3000
          });
        }
      } else if (data.type === 'SEAT_RELEASED') {
        if (data.userId !== currentUser?.uid) {
          toast(`Seat ${data.seatNumber} is now available`, {
            icon: '✨',
            duration: 3000
          });
        }
      }
    };

    socket.on('seat:update', handleSeatUpdate);

    return () => {
      socket.off('seat:update', handleSeatUpdate);
    };
  }, [socket, currentUser?.uid]);

  // Set up user-specific listeners
  useEffect(() => {
    if (!socket) return;

    const handleUserSeatUpdate = (data) => {
      console.log('👤 User seat update:', data);
      setLastSeatUpdate(data);
    };

    const handleUserPaymentUpdate = (data) => {
      console.log('💳 User payment update:', data);
      setLastPaymentUpdate(data);

      if (data.type === 'PAYMENT_COMPLETED') {
        toast.success(`Payment of ₹${data.amount} confirmed!`, {
          duration: 4000
        });
      }
    };

    const handleUserProfileUpdate = (data) => {
      console.log('👤 User profile update:', data);
      setLastProfileUpdate(data);
    };

    socket.on('user:seat:update', handleUserSeatUpdate);
    socket.on('user:payment:update', handleUserPaymentUpdate);
    socket.on('user:profile:update', handleUserProfileUpdate);

    return () => {
      socket.off('user:seat:update', handleUserSeatUpdate);
      socket.off('user:payment:update', handleUserPaymentUpdate);
      socket.off('user:profile:update', handleUserProfileUpdate);
    };
  }, [socket]);

  // Join admin room (for admin users)
  const joinAdminRoom = useCallback(() => {
    if (socket && connected) {
      socket.emit('join:admin');
      console.log('🛡️ Joined admin room');
    }
  }, [socket, connected]);

  // Leave admin room
  const leaveAdminRoom = useCallback(() => {
    if (socket && connected) {
      socket.emit('leave:admin');
    }
  }, [socket, connected]);

  // Subscribe to admin events
  const subscribeToAdminEvents = useCallback((callbacks) => {
    if (!socket) return () => {};

    const {
      onSeatUpdate,
      onPaymentUpdate,
      onProfileUpdate,
      onNewUser,
      onStatsUpdate
    } = callbacks;

    if (onSeatUpdate) socket.on('admin:seat:update', onSeatUpdate);
    if (onPaymentUpdate) socket.on('admin:payment:update', onPaymentUpdate);
    if (onProfileUpdate) socket.on('admin:profile:update', onProfileUpdate);
    if (onNewUser) socket.on('admin:user:new', onNewUser);
    if (onStatsUpdate) socket.on('admin:stats:update', onStatsUpdate);

    return () => {
      if (onSeatUpdate) socket.off('admin:seat:update', onSeatUpdate);
      if (onPaymentUpdate) socket.off('admin:payment:update', onPaymentUpdate);
      if (onProfileUpdate) socket.off('admin:profile:update', onProfileUpdate);
      if (onNewUser) socket.off('admin:user:new', onNewUser);
      if (onStatsUpdate) socket.off('admin:stats:update', onStatsUpdate);
    };
  }, [socket]);

  // Generic event subscription
  const on = useCallback((event, callback) => {
    if (socket) {
      socket.on(event, callback);
    }
  }, [socket]);

  const off = useCallback((event, callback) => {
    if (socket) {
      socket.off(event, callback);
    }
  }, [socket]);

  const value = {
    socket,
    connected,
    
    // Latest updates (for triggering re-renders)
    lastSeatUpdate,
    lastPaymentUpdate,
    lastProfileUpdate,
    
    // Admin functions
    joinAdminRoom,
    leaveAdminRoom,
    subscribeToAdminEvents,
    
    // Generic event handling
    on,
    off
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}
