import React, { useState } from "react";
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
} from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Get auth and context hooks
  const { login, enterDemoMode, sessionBlocked, blockReason } = useAuth();
  const { fetchUserData } = useUser();
  const { refreshProfile } = useProfile();
  const navigate = useNavigate();

  const handleDemoClick = () => {
    enterDemoMode();
    navigate("/dashboard");
  };

  /**
   * Check if user is registered in MongoDB
   */
  const checkUserRegistration = async (firebaseUid) => {
    try {
      const response = await apiClient.get(`/api/users/${firebaseUid}`);
      return response.data.success && response.data.user;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  };

  /**
   * Handle Email/Password Authentication
   */
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(normalizedEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Logging in with email...");
      const result = await login(normalizedEmail, password);
      console.log("Login successful:", result?.user?.uid);

      if (result && result.user) {
        console.log("Checking MongoDB registration...");
        const isRegistered = await checkUserRegistration(result.user.uid);
        console.log("User registered in MongoDB:", isRegistered);

        if (!isRegistered) {
          // Redirect to signup to complete profile
          console.log(
            "User not registered in MongoDB, redirecting to profile completion",
          );
          navigate("/signup", {
            state: {
              needsProfileCompletion: true,
              firebaseUser: {
                uid: result.user.uid,
                email: result.user.email,
                displayName: result.user.displayName,
                photoURL: result.user.photoURL,
              },
            },
          });
          return;
        }

        // Sync MongoDB user & profile state before navigating
        await fetchUserData(result.user.uid);
        await refreshProfile(result.user.uid);
      }

      toast.success("Logged in successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
    }
  };



  // ============================================
  // VALIDATION HELPERS
  // ============================================
  const isEmailValid = /^\S+@\S+\.\S+$/.test(email.trim());
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
        <div
          className="absolute bottom-20 right-10 w-72 md:w-96 h-72 md:h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
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
                <h3 className="font-semibold text-amber-800 mb-1">
                  Session Ended
                </h3>
                <p className="text-sm text-amber-700">{blockReason}</p>
                <p className="text-xs text-amber-600 mt-2">
                  Please sign in again to continue.
                </p>
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
                EMAIL/PASSWORD FORM
                Enhanced with floating labels & validation
                ======================================== */}
              <form
                onSubmit={handleEmailSubmit}
                className="space-y-5 animate-fadeIn"
              >
                {/* Email Input with Floating Label Effect */}
                <div className="relative">
                  <div
                    className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none ${
                      focusedField === "email" || email
                        ? "-translate-y-9 text-xs text-blue-600 bg-white px-1"
                        : "text-gray-500"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </span>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    required
                    className={`w-full px-4 py-4 pl-4 border-2 rounded-xl text-gray-900 placeholder-transparent focus:outline-none transition-all duration-300 pointer-events-auto bg-gray-50/50 hover:bg-white ${
                      focusedField === "email"
                        ? "border-blue-500 bg-white shadow-lg shadow-blue-500/20"
                        : email && isEmailValid
                          ? "border-green-400 bg-green-50/30"
                          : "border-gray-200 hover:border-blue-200 hover:shadow-md"
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
                  <div
                    className={`absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200 pointer-events-none ${
                      focusedField === "password" || password
                        ? "-translate-y-9 text-xs text-blue-600 bg-white px-1"
                        : "text-gray-500"
                    }`}
                  >
                    <span className="flex items-center gap-1">
                      <Lock className="w-4 h-4" />
                      Password
                    </span>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    required
                    minLength={6}
                    className={`w-full px-4 py-4 pr-12 border-2 rounded-xl text-gray-900 placeholder-transparent focus:outline-none transition-all duration-300 pointer-events-auto bg-gray-50/50 hover:bg-white ${
                      focusedField === "password"
                        ? "border-blue-500 bg-white shadow-lg shadow-blue-500/20"
                        : password && isPasswordValid
                          ? "border-green-400 bg-green-50/30"
                          : "border-gray-200 hover:border-blue-200 hover:shadow-md"
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
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
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
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 active:scale-[0.98]"
                      : "bg-gray-300 cursor-not-allowed"
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
                  Don't have an account?{" "}
                  <span className="text-blue-600 font-semibold">Sign Up</span>
                </Link>

                {/* Explore Demo Account CTA */}
                <div className="pt-4 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-500 font-medium mb-3">
                    Want to explore the library features first?
                  </p>
                  <button
                    type="button"
                    onClick={handleDemoClick}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4 text-amber-100 animate-pulse" />
                    <span>Explore Demo Account</span>
                  </button>
                </div>
              </form>

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
