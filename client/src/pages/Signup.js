import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';
import { useProfile } from '../contexts/ProfileContext';
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
  User,
  Phone,
  BookOpen
} from 'lucide-react';

// Get API URL from environment or default
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Signup Component
 * 
 * Complete signup flow with:
 * 1. Google Sign-in option
 * 2. Email/Password registration
 * 3. Profile completion (name, phone)
 * 4. MongoDB user creation via backend API
 */
export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signup, login, signInWithGoogle, currentUser } = useAuth();
  const { registerUser, refreshUserData } = useUser();
  const { refreshProfile } = useProfile();

  // Form state
  const [step, setStep] = useState(1); // 1: Auth method, 2: Profile completion
  const [authMethod, setAuthMethod] = useState(null); // 'google' or 'email'
  
  // User data state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [errors, setErrors] = useState({});

  // Google auth data (from Firebase)
  const [googleUserData, setGoogleUserData] = useState(null);

  // If user came from Google auth and needs to complete profile
  useEffect(() => {
    if (location.state?.needsProfileCompletion && location.state?.firebaseUser) {
      const fbUser = location.state.firebaseUser;
      setGoogleUserData(fbUser);
      setName(fbUser.displayName || '');
      setEmail(fbUser.email || '');
      setAuthMethod('google');
      setStep(2);
    }
  }, [location.state]);

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^\S+@\S+\.\S+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const validateName = (name) => {
    return name.trim().length >= 2;
  };

  // Real-time validation
  useEffect(() => {
    const newErrors = {};
    
    if (name && !validateName(name)) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (email && !validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (phone && !validatePhone(phone)) {
      newErrors.phone = 'Please enter a valid 10-digit mobile number';
    }
    
    if (password && !validatePassword(password)) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
  }, [name, email, phone, password, confirmPassword]);


  /**
   * Handle Google Sign-In
   */
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      console.log('🔵 Signup.js: Initiating Google Sign-In...');
      const result = await signInWithGoogle();
      
      if (result && result.user) {
        console.log('✅ Signup.js: Google Auth successful, checking MongoDB...');
        const firebaseUser = result.user;
        
        // Check if user already exists in MongoDB via Login endpoint (syncs photo)
        try {
          console.log('🔵 Signup.js: Calling /api/auth/login endpoint...');
          await axios.post(`${API_URL}/api/auth/login`, {
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email,
            fullName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL
          });
          
          console.log('✅ Signup.js: Backend login successful (User already exists)');
          // User exists and is updated
          toast.success('Welcome back!');
          navigate('/dashboard');
          return;
          
        } catch (error) {
          console.error('❌ Signup.js: Backend login error:', error);
          if (error.response?.status === 404 && error.response?.data?.needsRegistration) {
            console.log('ℹ️ Signup.js: User needs registration, proceeding to step 2...');
            // User needs to complete registration
            setGoogleUserData({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL
            });
            setName(firebaseUser.displayName || '');
            setEmail(firebaseUser.email || '');
            setAuthMethod('google');
            setStep(2);
            setIsLoading(false);
            return;
          }
          // Handle other errors (like server error)
          console.error('Google login check error:', error);
          toast.error(`Verification failed: ${error.response?.data?.error || error.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Signup.js: Google sign-in error:', error);
      // Toast is handled in AuthContext
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Email/Password Signup
   */
  const handleEmailSignup = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    if (!validateName(name)) {
      toast.error('Please enter a valid name');
      return;
    }
    if (!validateEmail(email)) {
      toast.error('Please enter a valid email');
      return;
    }
    if (!validatePhone(phone)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!validatePassword(password)) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      // First, create Firebase account
      console.log('Creating Firebase account...');
      const result = await signup(email, password);
      console.log('Firebase account created:', result?.user?.uid);
      
      if (result && result.user) {
        // Then register in MongoDB
        console.log('Registering user in MongoDB...');
        // Use context function to ensure state is updated
        await registerUser({
          name,
          email,
          phone,
          profilePicture: null
        }, result.user);
        console.log('User registered in MongoDB successfully');

        // Refresh user data to ensure context is up to date
        await refreshUserData();
        await refreshProfile(result.user.uid); // Sync profile context with explicit UID

        toast.success('Account created successfully!');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        // Attempt recovery: Try to login and complete registration
        try {
          console.log('Email in use, attempting recovery login...');
          const loginResult = await login(email, password);
          
          if (loginResult && loginResult.user) {
            console.log('Recovery login successful, retrying MongoDB registration...');
            await registerUser({
              name,
              email,
              phone,
              profilePicture: null
            }, loginResult.user);
            
            await refreshUserData();
            await refreshProfile(loginResult.user.uid);

            toast.success('Account recovered and created successfully!');
            navigate('/dashboard');
            return;
          }
        } catch (recoveryError) {
          console.error('Recovery failed:', recoveryError);
          // If recovery fails (e.g. wrong password), show original error
          toast.error('This email is already registered. Please login.');
        }
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Please use a stronger password.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address.');
      } else if (error.response?.data?.error) {
        // MongoDB registration error
        toast.error(error.response.data.error);
      } else {
        toast.error(error.message || 'Signup failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Profile Completion (for Google sign-in users)
   */
  const handleProfileCompletion = async (e) => {
    e.preventDefault();
    
    if (!validateName(name)) {
      toast.error('Please enter a valid name');
      return;
    }
    if (!validatePhone(phone)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsLoading(true);
    try {
      // Register in MongoDB with Firebase UID
      // Use context function to ensure state is updated
      await registerUser({
        name,
        email: googleUserData.email || email,
        phone,
        profilePicture: googleUserData.photoURL || null
      }, { uid: googleUserData.uid || currentUser?.uid });

      await refreshUserData();
      await refreshProfile(googleUserData.uid || currentUser?.uid); // Sync profile context with explicit UID

      toast.success('Profile completed successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Profile completion error:', error);
      
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error(error.message || 'Failed to complete profile');
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 md:w-96 h-72 md:h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-72 md:w-96 h-72 md:h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-5"></div>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md relative z-10 animate-fadeIn">
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          
          {/* Gradient Top Border */}
          <div className="h-1.5 bg-gradient-to-r from-green-500 via-blue-500 to-green-500"></div>

          <div className="p-6 sm:p-8 md:p-10">
            
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-2xl shadow-lg mb-4 transform hover:scale-105 transition-transform">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
                {step === 2 ? 'Complete Your Profile' : 'Create Account'}
              </h1>
              <p className="text-gray-500">
                {step === 2 
                  ? 'Just a few more details to get started'
                  : 'Join Shivika Digital Library today'
                }
              </p>
            </div>

            {/* Step 1: Choose Auth Method */}
            {step === 1 && (
              <>
                {/* Google Sign-In Button */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed mb-6"
                >
                  {isLoading && authMethod === 'google' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="font-medium text-gray-700">Continue with Google</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-gray-200"></div>
                  <span className="text-sm text-gray-400 font-medium">or sign up with email</span>
                  <div className="flex-1 h-px bg-gray-200"></div>
                </div>

                {/* Email Signup Form */}
                <form onSubmit={handleEmailSignup} className="space-y-4">
                  <InputField
                    icon={User}
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    error={errors.name}
                    autoComplete="name"
                    focusedField={focusedField}
                    setFocusedField={setFocusedField}
                  />

                  <InputField
                    icon={Mail}
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    autoComplete="email"
                    focusedField={focusedField}
                    setFocusedField={setFocusedField}
                  />

                  <InputField
                    icon={Phone}
                    type="tel"
                    placeholder="Mobile Number (10 digits)"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 10) {
                        setPhone(val);
                      }
                    }}
                    error={errors.phone}
                    autoComplete="tel"
                    maxLength={10}
                    focusedField={focusedField}
                    setFocusedField={setFocusedField}
                  />

                  <InputField
                    icon={Lock}
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={errors.password}
                    showToggle
                    onToggle={() => setShowPassword(!showPassword)}
                    isVisible={showPassword}
                    autoComplete="new-password"
                    focusedField={focusedField}
                    setFocusedField={setFocusedField}
                  />

                  <InputField
                    icon={Lock}
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={errors.confirmPassword}
                    showToggle
                    onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                    isVisible={showConfirmPassword}
                    autoComplete="new-password"
                    focusedField={focusedField}
                    setFocusedField={setFocusedField}
                  />

                  <button
                    type="submit"
                    disabled={isLoading || Object.keys(errors).length > 0}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Create Account
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            {/* Step 2: Profile Completion (for Google users) */}
            {step === 2 && (
              <form onSubmit={handleProfileCompletion} className="space-y-4">
                {googleUserData?.photoURL && (
                  <div className="flex justify-center mb-4">
                    <img 
                      src={googleUserData.photoURL} 
                      alt="Profile" 
                      className="w-20 h-20 rounded-full border-4 border-green-500"
                    />
                  </div>
                )}

                <InputField
                  icon={User}
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  error={errors.name}
                  autoComplete="name"
                  focusedField={focusedField}
                  setFocusedField={setFocusedField}
                />

                <InputField
                  icon={Mail}
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  autoComplete="email"
                  readOnly={true}
                  focusedField={focusedField}
                  setFocusedField={setFocusedField}
                />

                <InputField
                  icon={Phone}
                  type="tel"
                  placeholder="Mobile Number (10 digits)"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 10) {
                      setPhone(val);
                    }
                  }}
                  error={errors.phone}
                  autoComplete="tel"
                  maxLength={10}
                  focusedField={focusedField}
                  setFocusedField={setFocusedField}
                />

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-800 font-medium">Why we need your phone number</p>
                      <p className="text-xs text-blue-600 mt-1">
                        Your phone number helps us send important updates about your seat bookings and payments.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !validateName(name) || !validatePhone(phone)}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-blue-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Completing Profile...
                    </>
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      Complete Signup
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setGoogleUserData(null);
                    setAuthMethod(null);
                  }}
                  className="w-full py-3 text-gray-600 hover:text-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to signup options
                </button>
              </form>
            )}

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors"
                >
                  Sign In
                </Link>
              </p>
            </div>

            {/* Trust Signals */}
            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                <span>Fast</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>Trusted</span>
              </div>
            </div>
          </div>
        </div>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Input field component moved outside
const InputField = ({ 
  icon: Icon, 
  type, 
  placeholder, 
  value, 
  onChange, 
  error,
  showToggle,
  onToggle,
  isVisible,
  autoComplete,
  maxLength,
  disabled = false,
  readOnly = false,
  focusedField,
  setFocusedField
}) => (
  <div className="relative group">
    <div className={`
      flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all duration-300 ease-in-out
      ${focusedField === placeholder 
        ? 'border-blue-500 bg-white shadow-lg shadow-blue-500/20' 
        : error 
          ? 'border-red-300 bg-red-50/50' 
          : 'border-gray-100 bg-gray-50/50 hover:border-blue-200 hover:bg-white hover:shadow-md'
      }
    `}>
      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${
        focusedField === placeholder ? 'text-blue-500' : error ? 'text-red-400' : 'text-gray-400 group-hover:text-blue-400'
      }`} />
      <input
        type={showToggle ? (isVisible ? 'text' : 'password') : type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocusedField(placeholder)}
        onBlur={() => setFocusedField(null)}
        autoComplete={autoComplete}
        maxLength={maxLength}
        disabled={disabled}
        readOnly={readOnly}
        className="flex-1 bg-transparent outline-none focus:outline-none text-gray-800 placeholder-gray-400 text-base disabled:opacity-50 disabled:cursor-not-allowed w-full font-medium"
      />
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-blue-500"
        >
          {isVisible ? (
            <EyeOff className="w-5 h-5" />
          ) : (
            <Eye className="w-5 h-5" />
          )}
        </button>
      )}
      {!showToggle && value && !error && (
        <Check className="w-5 h-5 text-green-500 animate-scaleIn" />
      )}
    </div>
    {error && (
      <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1 animate-slideInDown">
        <AlertCircle className="w-4 h-4" />
        {error}
      </p>
    )}
  </div>
);
