import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, database } from '../firebase/config';
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
  const [isDemo, setIsDemo] = useState(() => {
    try {
      return sessionStorage.getItem('is_demo_mode') === 'true';
    } catch {
      return false;
    }
  });
  // Initialize sessionId from sessionStorage if present
  const [sessionId, setSessionId] = useState(() => {
    try {
      return sessionStorage.getItem('auth_session_id') || null;
    } catch {
      return null;
    }
  });
  const [sessionValid, setSessionValid] = useState(true);
  const [activeSessionInfo, setActiveSessionInfo] = useState(null);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [blockReason, setBlockReason] = useState(null);
  
  // Refs for intervals and cleanup
  const heartbeatIntervalRef = useRef(null);
  const sessionCheckIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const currentSessionIdRef = useRef(sessionId);
  const isCreatingSessionRef = useRef(false);
  const isInvalidatingRef = useRef(false);

  // Keep currentSessionIdRef in sync with state
  useEffect(() => {
    currentSessionIdRef.current = sessionId;
  }, [sessionId]);

  // ============================================
  // SESSION MANAGEMENT FUNCTIONS
  // ============================================

  /**
   * Create a new session for the user in Firebase
   * Invalidates any existing sessions (single-session enforcement)
   */
  const createSession = useCallback(async (userId) => {
    isCreatingSessionRef.current = true;
    const newSessionId = generateSessionId();
    const deviceInfo = getDeviceInfo();
    const sessionData = {
      sessionId: newSessionId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      deviceInfo,
      isActive: true,
    };

    currentSessionIdRef.current = newSessionId;

    try {
      sessionStorage.setItem('auth_session_id', newSessionId);
    } catch (e) {
      console.warn('Could not save session to sessionStorage:', e);
    }
    
    try {
      // Use set to record session in RTDB before updating state
      const sessionRef = ref(database, `sessions/${userId}`);
      await set(sessionRef, sessionData);
      console.log('✅ Session created in RTDB:', newSessionId.slice(-8));
    } catch (error) {
      console.warn('⚠️ RTDB session sync failed (non-fatal):', error.message);
    }

    setSessionId(newSessionId);
    setActiveSessionInfo(sessionData);
    setSessionValid(true);
    setSessionBlocked(false);
    setBlockReason(null);

    // Release creation lock after 1.5s to allow RTDB writes to settle
    setTimeout(() => {
      isCreatingSessionRef.current = false;
    }, 1500);

    return newSessionId;
  }, []);

  /**
   * Validate current session against the stored session
   * Returns true if session is valid, false if invalidated
   */
  const validateSession = useCallback(async (userId, currentSessionId) => {
    if (!userId || !currentSessionId) return true;
    
    try {
      const sessionRef = ref(database, `sessions/${userId}`);
      const snapshot = await get(sessionRef);
      const storedSession = snapshot.val();
      
      if (!storedSession) {
        console.warn('⚠️ No session found in database during validation - maintaining session');
        return true;
      }
      
      if (storedSession.sessionId !== currentSessionId) {
        console.warn('⚠️ Session invalidated - new login detected on another device');
        return false;
      }
      
      // Check for session timeout (inactivity)
      const lastActivity = storedSession.lastActivity ? new Date(storedSession.lastActivity).getTime() : Date.now();
      const timeSinceActivity = Date.now() - lastActivity;
      
      if (timeSinceActivity > SESSION_TIMEOUT_MS) {
        console.warn('⚠️ Session expired due to inactivity');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Session validation error (allowing session):', error);
      return true;
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
    const isDemoUser =
      isDemo ||
      currentUser?.isDemo ||
      sessionStorage.getItem("is_demo_mode") === "true" ||
      sessionStorage.getItem("demo_mode") === "true" ||
      currentUser?.uid?.startsWith("demo-");

    if (isDemoUser) {
      toast("You are in demo mode click exit demo button to go out", {
        icon: "⚠️",
        duration: 5000,
        style: {
          borderRadius: "12px",
          background: "#1e293b",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "14px",
        },
      });
      return false;
    }

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
  }, [currentUser, sessionId, createSession, isDemo]);

  /**
   * Handle session invalidation (logged out by another device)
   */
  const handleSessionInvalidation = useCallback(async (reason = 'Session invalidated') => {
    // Prevent duplicate calls
    if (isInvalidatingRef.current) {
      return;
    }
    isInvalidatingRef.current = true;
    
    setSessionValid(false);
    setSessionBlocked(true);
    setBlockReason(reason);
    
    // Stop heartbeat and session check
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (sessionCheckIntervalRef.current) {
      clearInterval(sessionCheckIntervalRef.current);
      sessionCheckIntervalRef.current = null;
    }
    
    // Show single notification using toast ID guard
    toast.error(`🔒 ${reason}`, { id: 'session-invalidated-toast', duration: 5000 });
    
    // Sign out the user
    try {
      await signOut(auth);
    } catch (error) {
      console.error('❌ Error signing out after session invalidation:', error);
    } finally {
      setTimeout(() => {
        isInvalidatingRef.current = false;
      }, 3000);
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
      if (isCreatingSessionRef.current) return;

      const storedSession = snapshot.val();
      
      if (!storedSession) {
        if (currentSessionIdRef.current) {
          const sessionData = {
            sessionId: currentSessionIdRef.current,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            deviceInfo: getDeviceInfo(),
            isActive: true,
          };
          set(ref(database, `sessions/${currentUser.uid}`), sessionData).catch(() => {});
        }
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
    if (isDemo) {
      setCurrentUser({
        uid: 'demo-user-uid',
        email: 'demo@shivikalibrary.com',
        displayName: 'Demo Explorer',
        photoURL: null,
        isDemo: true,
      });
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        if (!currentSessionIdRef.current) {
          try {
            await createSession(user.uid);
          } catch (e) {
            console.warn('Auto create session error:', e);
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
  }, [createSession]);

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
      setCurrentUser(userCredential.user);
      
      // Create session for new user
      try {
        await createSession(userCredential.user.uid);
      } catch (sessionError) {
        console.warn('⚠️ Non-fatal session error on signup:', sessionError);
      }
      
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
      setCurrentUser(userCredential.user);
      
      // Create new session (this invalidates any existing session - single session enforcement)
      try {
        await createSession(userCredential.user.uid);
      } catch (sessionError) {
        console.warn('⚠️ Non-fatal session error on login:', sessionError);
      }
      
      // Return userCredential for MongoDB registration check
      return userCredential;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  }



  /**
   * Logout
   * Signs out user and clears session from database
   */
  async function logout() {
    const isDemoUser =
      isDemo ||
      currentUser?.isDemo ||
      sessionStorage.getItem("is_demo_mode") === "true" ||
      sessionStorage.getItem("demo_mode") === "true" ||
      currentUser?.uid?.startsWith("demo-");

    if (isDemoUser) {
      toast("You are in demo mode click exit demo button to go out", {
        icon: "⚠️",
        duration: 5000,
        style: {
          borderRadius: "12px",
          background: "#1e293b",
          color: "#fff",
          fontWeight: "bold",
          fontSize: "14px",
        },
      });
      return false;
    }

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
      return true;
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  }

  /**
   * Enter Demo Mode (Student)
   */
  const enterDemoMode = useCallback(() => {
    setIsDemo(true);
    try {
      sessionStorage.setItem('is_demo_mode', 'true');
      sessionStorage.setItem('demo_role', 'student');
    } catch (e) {
      console.warn('Could not save demo state to sessionStorage:', e);
    }
    setCurrentUser({
      uid: 'demo-user-uid',
      email: 'demo@shivikalibrary.com',
      displayName: 'Demo Explorer',
      photoURL: null,
      isDemo: true,
    });
    toast.success('Welcome to Student Demo Mode!');
  }, []);

  /**
   * Enter Admin Demo Mode
   */
  const enterAdminDemoMode = useCallback(() => {
    setIsDemo(true);
    try {
      sessionStorage.setItem('is_demo_mode', 'true');
      sessionStorage.setItem('demo_role', 'admin');
    } catch (e) {
      console.warn('Could not save demo state to sessionStorage:', e);
    }
    setCurrentUser({
      uid: 'demo-admin-uid',
      email: 'admin@shivikalibrary.com',
      displayName: 'Admin Administrator',
      photoURL: null,
      isDemo: true,
      isAdminDemo: true,
    });
    toast.success('👑 Welcome to Admin Demo Mode!');
  }, []);

  /**
   * Exit Demo Mode
   */
  const exitDemoMode = useCallback(async () => {
    setIsDemo(false);
    try {
      sessionStorage.removeItem('is_demo_mode');
      sessionStorage.removeItem('demo_role');
    } catch (e) {
      console.warn('Could not remove demo state from sessionStorage:', e);
    }
    setCurrentUser(null);
    try {
      await signOut(auth);
    } catch (e) {
      // Ignored
    }
    toast.success('Exited Demo Mode');
  }, []);

  // ============================================
  // CONTEXT VALUE
  // ============================================
  const value = {
    // User state
    currentUser,
    loading,
    isDemo,
    
    // Auth functions
    signup,
    login,
    logout,
    enterDemoMode,
    enterAdminDemoMode,
    exitDemoMode,
    
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

