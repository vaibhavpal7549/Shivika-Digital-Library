import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, database } from '../firebase/config';
import { GoogleAuthProvider } from 'firebase/auth';
import { ref, set, get, onValue, remove, serverTimestamp, runTransaction } from 'firebase/database';
import toast from 'react-hot-toast';

const AuthContext = createContext();

// ============================================
// CONFIGURATION
// ============================================
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity timeout
const SESSION_CHECK_INTERVAL_MS = 60 * 1000; // Check session validity every 60 seconds
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // Send heartbeat every 30 seconds

/**
 * Generate a unique session ID
 * Combines timestamp, random string, and browser fingerprint
 */
const generateSessionId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const browserPart = navigator.userAgent.length.toString(36);
  return `${timestamp}-${randomPart}-${browserPart}`;
};

/**
 * Get device/browser information for session tracking
 */
const getDeviceInfo = () => {
  const userAgent = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';
  
  // Detect browser
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg')) {
    browser = 'Edge';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }
  
  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac')) {
    os = 'MacOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
  }
  
  return {
    browser,
    os,
    platform: navigator.platform || 'Unknown',
    language: navigator.language || 'en',
    userAgent: userAgent.substring(0, 200), // Truncate for storage
  };
};

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [sessionValid, setSessionValid] = useState(true);
  const [activeSessionInfo, setActiveSessionInfo] = useState(null);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState(null);
  
  // Refs for intervals and cleanup
  const heartbeatIntervalRef = useRef(null);
  const sessionCheckIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const currentSessionIdRef = useRef(null);

  // ============================================
  // SESSION MANAGEMENT FUNCTIONS
  // ============================================

  /**
   * Create a new session for the user in Firebase
   * Invalidates any existing sessions (single-session enforcement)
   */
  const createSession = useCallback(async (userId) => {
    const newSessionId = generateSessionId();
    const deviceInfo = getDeviceInfo();
    const sessionData = {
      sessionId: newSessionId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      deviceInfo,
      isActive: true,
    };
    
    try {
      // Use transaction to ensure atomic session creation
      const sessionRef = ref(database, `sessions/${userId}`);
      
      await runTransaction(sessionRef, (currentSession) => {
        // Always replace with new session (single-session enforcement)
        return sessionData;
      });
      
      setSessionId(newSessionId);
      currentSessionIdRef.current = newSessionId;
      setActiveSessionInfo(sessionData);
      setSessionValid(true);
      setSessionBlocked(false);
      setBlockReason(null);
      
      console.log('✅ Session created:', newSessionId.slice(-8));
      return newSessionId;
    } catch (error) {
      console.error('❌ Failed to create session:', error);
      throw error;
    }
  }, []);

  /**
   * Validate current session against the stored session
   * Returns true if session is valid, false if invalidated
   */
  const validateSession = useCallback(async (userId, currentSessionId) => {
    if (!userId || !currentSessionId) return false;
    
    try {
      const sessionRef = ref(database, `sessions/${userId}`);
      const snapshot = await get(sessionRef);
      const storedSession = snapshot.val();
      
      if (!storedSession) {
        console.warn('⚠️ No session found in database');
        return false;
      }
      
      if (storedSession.sessionId !== currentSessionId) {
        console.warn('⚠️ Session invalidated - new login detected');
        return false;
      }
      
      // Check for session timeout (inactivity)
      const lastActivity = new Date(storedSession.lastActivity).getTime();
      const timeSinceActivity = Date.now() - lastActivity;
      
      if (timeSinceActivity > SESSION_TIMEOUT_MS) {
        console.warn('⚠️ Session expired due to inactivity');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Session validation error:', error);
      return false;
    }
  }, []);

  /**
   * Update session heartbeat (last activity timestamp)
   * Keeps session alive while user is active
   */
  const updateHeartbeat = useCallback(async (userId, currentSessionId) => {
    if (!userId || !currentSessionId) return;
    
    try {
      const sessionRef = ref(database, `sessions/${userId}`);
      const snapshot = await get(sessionRef);
      const storedSession = snapshot.val();
      
      // Only update if this is still the active session
      if (storedSession && storedSession.sessionId === currentSessionId) {
        await set(sessionRef, {
          ...storedSession,
          lastActivity: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('❌ Heartbeat update failed:', error);
    }
  }, []);

  /**
   * Clear session from database on logout
   */
  const clearSession = useCallback(async (userId) => {
    if (!userId) return;
    
    try {
      const sessionRef = ref(database, `sessions/${userId}`);
      await remove(sessionRef);
      console.log('✅ Session cleared');
    } catch (error) {
      console.error('❌ Failed to clear session:', error);
    }
  }, []);

  /**
   * Force logout other devices (keep current session)
   * Called when user wants to logout other sessions
   */
  const forceLogoutOtherDevices = useCallback(async () => {
    if (!currentUser || !sessionId) {
      toast.error('No active session to manage');
      return false;
    }
    
    try {
      // Re-create session (this invalidates any other sessions with different IDs)
      await createSession(currentUser.uid);
      toast.success('All other devices have been logged out');
      return true;
    } catch (error) {
      console.error('❌ Failed to force logout other devices:', error);
      toast.error('Failed to logout other devices');
      return false;
    }
  }, [currentUser, sessionId, createSession]);

  /**
   * Handle session invalidation (logged out by another device)
   */
  const handleSessionInvalidation = useCallback(async (reason = 'Session invalidated') => {
    // Prevent duplicate calls
    if (sessionCheckIntervalRef.current === 'invalidating') {
      return;
    }
    
    // Mark as invalidating
    sessionCheckIntervalRef.current = 'invalidating';
    
    setSessionValid(false);
    setSessionBlocked(true);
    setBlockReason(reason);
    
    // Stop heartbeat and session check
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // Show notification (only once due to guard above)
    toast.error(`🔒 ${reason}`, { duration: 5000 });
    
    // Sign out the user
    try {
      await signOut(auth);
    } catch (error) {
      console.error('❌ Error signing out after session invalidation:', error);
    }
  }, []);

  // ============================================
  // ACTIVITY TRACKING
  // Reset inactivity timer on user activity
  // ============================================
  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };
    
    // Track user activity events
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, []);

  // ============================================
  // SESSION MONITORING
  // Listen for session changes and validate periodically
  // ============================================
  useEffect(() => {
    if (!currentUser || !sessionId) return;
    
    // Listen for real-time session changes
    const sessionRef = ref(database, `sessions/${currentUser.uid}`);
    const unsubscribeSession = onValue(sessionRef, (snapshot) => {
      const storedSession = snapshot.val();
      
      if (!storedSession) {
        // Session was deleted (logged out from another location)
        handleSessionInvalidation('Your session was ended');
        return;
      }
      
      if (storedSession.sessionId !== currentSessionIdRef.current) {
        // Session ID changed (new login from another device)
        handleSessionInvalidation('You have been logged out because your account was accessed from another device');
        return;
      }
      
      // Update active session info for display
      setActiveSessionInfo(storedSession);
    });
    
    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(() => {
      updateHeartbeat(currentUser.uid, currentSessionIdRef.current);
    }, HEARTBEAT_INTERVAL_MS);
    
    // Start session validation interval
    sessionCheckIntervalRef.current = setInterval(async () => {
      const isValid = await validateSession(currentUser.uid, currentSessionIdRef.current);
      if (!isValid && sessionValid) {
        handleSessionInvalidation('Session expired or invalidated');
      }
    }, SESSION_CHECK_INTERVAL_MS);
    
    return () => {
      unsubscribeSession();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [currentUser, sessionId, validateSession, updateHeartbeat, handleSessionInvalidation, sessionValid]);

  // ============================================
  // AUTH STATE OBSERVER
  // ============================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Don't create session here - it's created during login
        // This handles page refresh - validate existing session
        if (currentSessionIdRef.current) {
          const isValid = await validateSession(user.uid, currentSessionIdRef.current);
          if (!isValid) {
            // Session invalid on page refresh - need to re-login
            setSessionValid(false);
          }
        }
      } else {
        setCurrentUser(null);
        setSessionId(null);
        currentSessionIdRef.current = null;
        setActiveSessionInfo(null);
        setSessionValid(true);
        setSessionBlocked(false);
        setBlockReason(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [validateSession]);

  // ============================================
  // AUTHENTICATION FUNCTIONS
  // ============================================

  /**
   * Email/Password Sign Up
   * Creates account and establishes session
   * Returns the userCredential for further processing
   */
  async function signup(email, password) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create session for new user
      await createSession(userCredential.user.uid);
      
      // Return userCredential for MongoDB registration
      return userCredential;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  }

  /**
   * Email/Password Login
   * Authenticates user and creates new session (invalidating previous sessions)
   * Returns the userCredential for further processing
   */
  async function login(email, password) {
    try {
      // Clear any blocked state from previous attempts
      setSessionBlocked(false);
      setBlockReason(null);
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Create new session (this invalidates any existing session - single session enforcement)
      await createSession(userCredential.user.uid);
      
      // Return userCredential for MongoDB registration check
      return userCredential;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  }

  /**
   * Google Sign In
   * Authenticates with Google and creates new session
   * Returns the userCredential for further processing
   */
  async function signInWithGoogle() {
    try {
      console.log('🔵 Starting Google Sign-In...');
      // Clear any blocked state from previous attempts
      setSessionBlocked(false);
      setBlockReason(null);
      
      const provider = new GoogleAuthProvider();
      // Add custom parameters if needed
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      console.log('🔵 Opening popup...');
      const userCredential = await signInWithPopup(auth, provider);
      console.log('✅ Google Auth successful:', userCredential.user.uid);
      
      // Create new session (this invalidates any existing session - single session enforcement)
      try {
        console.log('🔵 Creating session...');
        await createSession(userCredential.user.uid);
        console.log('✅ Session created successfully');
      } catch (sessionError) {
        console.error('❌ Session creation failed:', sessionError);
        // We still allow login even if session creation fails, but log it
        // Or should we fail? The app relies on session.
        // Let's throw for now to maintain security, but log specific error
        throw new Error(`Session creation failed: ${sessionError.message}`);
      }
      
      // Return userCredential for MongoDB registration check
      return userCredential;
    } catch (error) {
      console.error('❌ Google Sign-In Error:', error);
      console.error('Error Code:', error.code);
      console.error('Error Message:', error.message);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Popup blocked. Please allow popups for this site.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error(`Google Sign-In failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Logout
   * Signs out user and clears session from database
   */
  async function logout() {
    try {
      // Clear session before signing out
      if (currentUser) {
        await clearSession(currentUser.uid);
      }
      
      // Stop intervals
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
      
      await signOut(auth);
      
      // Reset all session state
      setSessionId(null);
      currentSessionIdRef.current = null;
      setActiveSessionInfo(null);
      setSessionValid(true);
      setSessionBlocked(false);
      setBlockReason(null);
      
      toast.success('Logged out successfully!');
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  }

  // ============================================
  // CONTEXT VALUE
  // ============================================
  const value = {
    // User state
    currentUser,
    loading,
    
    // Auth functions
    signup,
    login,
    signInWithGoogle,
    logout,
    
    // Session management
    sessionId,
    sessionValid,
    sessionBlocked,
    blockReason,
    activeSessionInfo,
    forceLogoutOtherDevices,
    
    // Session info helpers
    getSessionDuration: () => {
      if (!activeSessionInfo?.createdAt) return null;
      const created = new Date(activeSessionInfo.createdAt).getTime();
      return Date.now() - created;
    },
    getLastActivity: () => {
      if (!activeSessionInfo?.lastActivity) return null;
      return new Date(activeSessionInfo.lastActivity);
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

