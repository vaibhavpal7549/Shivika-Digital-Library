import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useUser } from "../contexts/UserContext";
import { useProfile } from "../contexts/ProfileContext";
import toast from "react-hot-toast";
import apiClient from "../utils/apiClient";
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
  BookOpen,
} from "lucide-react";

/**
 * Signup Component
 *
 * Complete signup flow with Email/Password registration
 */
export default function Signup() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { registerUser, refreshUserData } = useUser();
  const { refreshProfile } = useProfile();

  // User data state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [errors, setErrors] = useState({});

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
      newErrors.name = "Name must be at least 2 characters";
    }

    if (email && !validateEmail(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (phone && !validatePhone(phone)) {
      newErrors.phone = "Please enter a valid 10-digit mobile number";
    }

    if (password && !validatePassword(password)) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (confirmPassword && password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
  }, [name, email, phone, password, confirmPassword]);

  /**
   * Handle Email/Password Signup
   * Pre-validates phone and email uniqueness BEFORE creating Firebase account
   */
  const handleEmailSignup = async (e) => {
    e.preventDefault();
    
    // Prevent double-click: set loading immediately
    if (isLoading) return;
    setIsLoading(true);

    try {
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

      // Normalize inputs
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedPhone = phone.trim();

      // ====================================================
      // PRE-CHECK: Verify phone and email uniqueness BEFORE
      // creating Firebase account (prevents orphaned accounts)
      // ====================================================
      console.log('Pre-checking phone and email uniqueness...');
      
      const [phoneCheck, emailCheck] = await Promise.all([
        apiClient.get(`/api/users/check/phone/${normalizedPhone}`).catch(() => ({ data: { exists: false } })),
        apiClient.get(`/api/users/check/email/${normalizedEmail}`).catch(() => ({ data: { exists: false } }))
      ]);

      const duplicateErrors = [];
      if (phoneCheck.data.exists) {
        duplicateErrors.push('This phone number is already registered with another user.');
      }
      if (emailCheck.data.exists) {
        duplicateErrors.push('This email address is already registered with another user.');
      }

      if (duplicateErrors.length === 2) {
        toast.error('Both phone number and email address are already registered.');
        return;
      } else if (duplicateErrors.length === 1) {
        toast.error(duplicateErrors[0]);
        return;
      }

      // ====================================================
      // All checks passed — now create Firebase account
      // ====================================================
      console.log('Creating Firebase account...');
      const result = await signup(normalizedEmail, password);
      console.log('Firebase account created:', result?.user?.uid);
      
      if (result && result.user) {
        // Register in MongoDB
        console.log('Registering user in MongoDB...');
        await registerUser({
          name,
          email: normalizedEmail,
          phone: normalizedPhone,
          profilePicture: null
        }, result.user);
        console.log('User registered in MongoDB successfully');

        // Refresh user data to ensure context is up to date
        await refreshUserData();
        await refreshProfile(result.user.uid);

        toast.success('Account created successfully!');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please login instead.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Please use a stronger password.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address.');
      } else if (error.response?.data?.error) {
        // MongoDB registration error (specific message from backend)
        toast.error(error.response.data.error);
      } else {
        toast.error(error.message || 'Signup failed. Please try again.');
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
        <div
          className="absolute bottom-20 right-10 w-72 md:w-96 h-72 md:h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
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
                Create Account
              </h1>
              <p className="text-gray-500">
                Join Shivika Digital Library today
              </p>
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
                  const val = e.target.value.replace(/\D/g, "");
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
                onToggle={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
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

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                Already have an account?{" "}
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
  setFocusedField,
}) => (
  <div className="relative group">
    <div
      className={`
      flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all duration-300 ease-in-out
      ${
        focusedField === placeholder
          ? "border-blue-500 bg-white shadow-lg shadow-blue-500/20"
          : error
            ? "border-red-300 bg-red-50/50"
            : "border-gray-100 bg-gray-50/50 hover:border-blue-200 hover:bg-white hover:shadow-md"
      }
    `}
    >
      <Icon
        className={`w-5 h-5 flex-shrink-0 transition-colors duration-300 ${
          focusedField === placeholder
            ? "text-blue-500"
            : error
              ? "text-red-400"
              : "text-gray-400 group-hover:text-blue-400"
        }`}
      />
      <input
        type={showToggle ? (isVisible ? "text" : "password") : type}
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
