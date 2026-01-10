import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import axios from 'axios';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Shield, 
  Zap, 
  Loader2,
  Check,
  AlertCircle,
  User
} from 'lucide-react';

// Get API URL from environment or default
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Enhanced Login Component
 * 
 * UX Improvements Made:
 * 1. Clear visual hierarchy - Google Sign-in is now prominently displayed as the primary option
 * 2. Floating labels with smooth animations for better form UX
 * 3. Password visibility toggle for better usability
 * 4. Enhanced loading states with spinner animations
 * 5. Improved trust signals with icons
 * 6. Better mobile touch targets (minimum 44px)
 * 7. Consistent icon library (Lucide) for professional look
 * 8. Smooth micro-interactions on all interactive elements
 * 9. Form validation feedback with visual indicators
 * 10. Keyboard-friendly layout with proper tab order
 */
export default function Login() {
  // ============================================
  // STATE MANAGEMENT - No changes to auth logic
  // ============================================
  const [activeTab, setActiveTab] = useState('google'); // Changed default to Google for better UX
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Get session-related state from AuthContext
  const { login, signInWithGoogle, sessionBlocked, blockReason } = useAuth();
  const navigate = useNavigate();

  /**
   * Check if user is registered in MongoDB
   */
  const checkUserRegistration = async (firebaseUid) => {
    try {
      const response = await axios.get(`${API_URL}/api/users/${firebaseUid}`);
      return response.data.success && response.data.user;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  };

  // ============================================
  // EVENT HANDLERS - Original logic preserved
  // ============================================
  
  /**
   * Handle Email/Password Authentication
   * 
   * NOTE: Toast notifications are handled in AuthContext.js
   * to prevent duplicate notifications and maintain single
   * source of truth for auth feedback.
   */
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      console.log('Logging in with email...');
      const result = await login(email, password);
      console.log('Login successful:', result?.user?.uid);
      
      // Check if user is registered in MongoDB
      if (result && result.user) {
        console.log('Checking MongoDB registration...');
        const isRegistered = await checkUserRegistration(result.user.uid);
        console.log('User registered in MongoDB:', isRegistered);
        
        if (!isRegistered) {
          // Redirect to signup to complete profile
          console.log('User not registered in MongoDB, redirecting to profile completion');
          navigate('/signup', {
            state: {
              needsProfileCompletion: true,
              firebaseUser: {
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName,
                photoURL: result.user.photoURL
              }
            }
          });
          return;
        }
      }
      
      toast.success('Logged in successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      // Error toast is already shown by AuthContext login function
      setIsLoading(false);
    }
  };

  /**
   * Handle Google Sign-In
   * 
   * NOTE: Checks MongoDB registration and redirects to signup if needed.
   */
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      console.log('🔵 Login.js: Initiating Google Sign-In...');
      const result = await signInWithGoogle();
      
      // Check if user is registered in MongoDB and sync Google profile data
      if (result && result.user) {
        console.log('✅ Login.js: Google Auth successful, checking MongoDB...');
        try {
          console.log('🔵 Login.js: Calling /auth/login endpoint...');
          await axios.post(`${API_URL}/auth/login`, {
            firebaseUid: result.user.uid,
            email: result.user.email,
            fullName: result.user.displayName,
            photoURL: result.user.photoURL
          });
          
          console.log('✅ Login.js: Backend login successful');
          toast.success('Logged in with Google!');
          navigate('/dashboard');
        } catch (error) {
          console.error('❌ Login.js: Backend login error:', error);
          if (error.response?.status === 404) {
            console.log('ℹ️ Login.js: User needs registration, redirecting...');
            // User not found in MongoDB, redirect to signup to complete profile
            navigate('/signup', {
              state: {
                needsProfileCompletion: true,
                firebaseUser: {
                  uid: result.user.uid,
                  email: result.user.email,
                  displayName: result.user.displayName,
                  photoURL: result.user.photoURL
                }
              }
            });
          } else {
            console.error('Login check error:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Failed to verify account';
            toast.error(`Verification failed: ${errorMessage}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Login.js: Google Sign-In Error:', error);
      setIsLoading(false);
    }
  };

  // ============================================
  // VALIDATION HELPERS
  // ============================================
  const isEmailValid = email.length > 0 && email.includes('@');
  const isPasswordValid = password.length >= 6;
  const isFormValid = isEmailValid && isPasswordValid;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* ========================================
          ANIMATED BACKGROUND
          Creates depth and visual interest
          ======================================== */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 md:w-96 h-72 md:h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-72 md:w-96 h-72 md:h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-5"></div>
      </div>

      {/* ========================================
          MAIN LOGIN CARD
          Clean, modern SaaS-quality design
          ======================================== */}
      <div className="w-full max-w-md relative z-10 animate-fadeIn">
        {/* ========================================
            SESSION BLOCKED ALERT
            Shown when user was logged out from another device
            ======================================== */}
        {sessionBlocked && blockReason && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 mb-1">Session Ended</h3>
                <p className="text-sm text-amber-700">{blockReason}</p>
                <p className="text-xs text-amber-600 mt-2">Please sign in again to continue.</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          
          {/* Gradient Top Border - Brand identity */}
          <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"></div>

          <div className="p-6 sm:p-8 md:p-10">
            
            {/* ========================================
                HEADER SECTION
                Clear branding and context
                ======================================== */}
            <div className="text-center mb-8">
              {/* Logo with hover effect */}
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg mb-4 transform hover:scale-105 hover:rotate-3 transition-all duration-300 cursor-pointer">
                <span className="text-3xl sm:text-4xl">📚</span>
              </div>
              
              {/* App Name */}
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Shivika Digital Library
              </h1>
              
              {/* Dynamic Subtitle */}
              <p className="text-gray-600 text-sm sm:text-base flex items-center justify-center gap-2">
                <span>Welcome back! Sign in to continue</span>
              </p>
            </div>

            {/* ========================================
                TAB SELECTOR
                Clear distinction between auth methods
                ======================================== */}
            <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
              <button
                onClick={() => setActiveTab('google')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${
                  activeTab === 'google'
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                aria-label="Sign in with Google"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Google</span>
              </button>
              
              <button
                onClick={() => setActiveTab('email')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 ${
                  activeTab === 'email'
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                aria-label="Sign in with Email"
              >
                <Mail className="w-5 h-5" />
                <span>Email</span>
              </button>
            </div>

            {/* ========================================
                GOOGLE SIGN-IN SECTION
                Primary method - most prominent
                ======================================== */}
            {activeTab === 'google' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Google Sign-in Button - Large & Prominent */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="group w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 hover:border-blue-400 hover:shadow-lg hover:shadow-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
                  aria-label="Continue with Google"
                >
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  ) : (
                    <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  <span className="text-base">
                    {isLoading ? 'Connecting...' : 'Continue with Google'}
                  </span>
                </button>

                {/* Benefits of Google Sign-in */}
                <div className="flex flex-col gap-2 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    <Check className="w-4 h-4 text-blue-600" />
                    <span>One-click sign in, no password needed</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    <Check className="w-4 h-4 text-blue-600" />
                    <span>Secure authentication by Google</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="relative flex items-center gap-4">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-sm text-gray-500 font-medium">or use email</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                {/* Switch to Email */}
                <button
                  onClick={() => setActiveTab('email')}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 active:scale-[0.98]"
                >
                  <Mail className="w-5 h-5" />
                  <span>Sign in with Email</span>
                </button>
              </div>
            )}

            {/* ========================================
                EMAIL/PASSWORD FORM
                Enhanced with floating labels & validation
                ======================================== */}
            {activeTab === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-5 animate-fadeIn">
                
                {/* Email Input with Floating Label Effect */}
                <div className="relative">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none ${
                    focusedField === 'email' || email 
                      ? '-translate-y-9 text-xs text-blue-600 bg-white px-1' 
                      : 'text-gray-500'
                  }`}>
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    required
                    className={`w-full px-4 py-4 pl-4 border-2 rounded-xl text-gray-900 placeholder-transparent focus:outline-none transition-all duration-300 pointer-events-auto bg-gray-50/50 hover:bg-white ${
                      focusedField === 'email' 
                        ? 'border-blue-500 bg-white shadow-lg shadow-blue-500/20' 
                        : email && isEmailValid 
                          ? 'border-green-400 bg-green-50/30' 
                          : 'border-gray-200 hover:border-blue-200 hover:shadow-md'
                    }`}
                    placeholder="Email Address"
                    disabled={isLoading}
                    aria-label="Email Address"
                    autoComplete="email"
                  />
                  {/* Validation Icon */}
                  {email && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isEmailValid ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                  )}
                </div>

                {/* Password Input with Toggle */}
                <div className="relative">
                  <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none ${
                    focusedField === 'password' || password 
                      ? '-translate-y-9 text-xs text-blue-600 bg-white px-1' 
                      : 'text-gray-500'
                  }`}>
                    <span className="flex items-center gap-1">
                      <Lock className="w-4 h-4" />
                      Password
                    </span>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    required
                    minLength={6}
                    className={`w-full px-4 py-4 pr-12 border-2 rounded-xl text-gray-900 placeholder-transparent focus:outline-none transition-all duration-300 pointer-events-auto bg-gray-50/50 hover:bg-white ${
                      focusedField === 'password' 
                        ? 'border-blue-500 bg-white shadow-lg shadow-blue-500/20' 
                        : password && isPasswordValid 
                          ? 'border-green-400 bg-green-50/30' 
                          : 'border-gray-200 hover:border-blue-200 hover:shadow-md'
                    }`}
                    placeholder="Password"
                    disabled={isLoading}
                    autoComplete="current-password"
                    aria-label="Password"
                  />
                  
                  {/* Password Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Password Strength Hint */}
                {password && password.length < 6 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1 -mt-2">
                    <AlertCircle className="w-3 h-3" />
                    Password must be at least 6 characters
                  </p>
                )}

                {/* Submit Button - Primary CTA */}
                <button
                  type="submit"
                  disabled={isLoading || !isFormValid}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2 ${
                    isFormValid && !isLoading
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 active:scale-[0.98]'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                  aria-label="Sign In"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <span className="text-lg">→</span>
                    </>
                  )}
                </button>

                {/* Link to Sign Up Page */}
                <Link
                  to="/signup"
                  className="w-full py-3 text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium flex items-center justify-center gap-1"
                >
                  Don't have an account? <span className="text-blue-600 font-semibold">Sign Up</span>
                </Link>
              </form>
            )}

            {/* ========================================
                FOOTER SECTION
                Trust signals & navigation
                ======================================== */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              {/* Trust Indicators */}
              <div className="flex items-center justify-center gap-6 mb-4">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500">
                  <Shield className="w-4 h-4 text-green-600" />
                  <span>Secure</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500">
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span>Private</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Fast</span>
                </div>
              </div>

              {/* Back to Home Link */}
              <Link
                to="/"
                className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ========================================
            BOTTOM HELP TEXT
            Additional context below card
            ======================================== */}
        <p className="text-center text-xs text-gray-500 mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

