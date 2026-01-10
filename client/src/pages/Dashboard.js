import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, onValue } from 'firebase/database';
import toast from 'react-hot-toast';
import { HOURLY_RATE } from '../utils/feeUtils';
import { 
  User, 
  History, 
  LogOut, 
  LayoutGrid, 
  Users, 
  DollarSign, 
  MapPin, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Shield,
  Smartphone,
  Monitor,
  Clock,
  Image
} from 'lucide-react';

export default function Dashboard() {
  // Get session management functions from AuthContext
  const { 
    currentUser, 
    logout, 
    activeSessionInfo, 
    forceLogoutOtherDevices,
    getSessionDuration,
    getLastActivity 
  } = useAuth();
  const { isProfileComplete, profile, bookedSeat, hasBookedSeat } = useProfile();
  const navigate = useNavigate();
  const [seats, setSeats] = useState({});
  const [selectedHours, setSelectedHours] = useState(4);
  const [totalFee, setTotalFee] = useState(HOURLY_RATE);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [showSessionInfo, setShowSessionInfo] = useState(false);
  const [isForceLoggingOut, setIsForceLoggingOut] = useState(false);

  useEffect(() => {
    setTotalFee(selectedHours * HOURLY_RATE);
  }, [selectedHours]);

  useEffect(() => {
    const seatsRef = ref(database, 'seats');
    const unsubscribe = onValue(seatsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setSeats(data);
    });

    return () => unsubscribe();
  }, []);

  const bookedCount = Object.values(seats).filter(seat => seat.status === 'booked').length;
  const vacantCount = 60 - bookedCount;
  const occupancyPercentage = Math.round((bookedCount / 60) * 100);

  /**
   * Handle Logout
   * 
   * NOTE: Toast notification is handled in AuthContext.logout()
   * to prevent duplicate "Logged out successfully" messages.
   */
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // Toast handled in AuthContext.logout()
      navigate('/');
    } catch (error) {
      setIsLoggingOut(false);
      // Error handled in context
    }
  };

  /**
   * Handle force logout of other devices
   */
  const handleForceLogoutOthers = async () => {
    setIsForceLoggingOut(true);
    try {
      await forceLogoutOtherDevices();
    } finally {
      setIsForceLoggingOut(false);
    }
  };

  /**
   * Format session duration for display
   */
  const formatDuration = (ms) => {
    if (!ms) return 'Unknown';
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  const handleBookingSeat = (e) => {
    if (!isProfileComplete) {
      e.preventDefault();
      toast.error('⚠️ Complete your profile first');
      navigate('/profile');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Main Content */}
      <div className="p-4 sm:p-6 md:p-8 pb-32 sm:pb-20 md:pb-8">
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 page-enter">

          {/* HEADER SECTION - Minimal & Clean */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-sm md:text-base text-gray-600 mt-2">
                Welcome back, <span className="font-semibold text-gray-800">{currentUser?.email?.split('@')[0] || 'User'}</span> 👋
              </p>
            </div>
            
            {/* Header Actions */}
            <div className="flex gap-2 sm:gap-3">
              {/* Session Info Toggle */}
              <button
                onClick={() => setShowSessionInfo(!showSessionInfo)}
                className={`group relative inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl border transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md ${
                  showSessionInfo 
                    ? 'bg-green-50 border-green-300' 
                    : 'bg-white border-gray-200 hover:border-green-300 hover:bg-green-50'
                }`}
                aria-label="Session Info"
                title="Session Info"
              >
                <Shield className={`w-5 h-5 transition-colors ${showSessionInfo ? 'text-green-600' : 'text-gray-600 group-hover:text-green-600'}`} strokeWidth={2} />
              </button>
              <Link
                to="/profile"
                className="group relative inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md"
                aria-label="View Profile"
                title="View Profile"
              >
                <User className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" strokeWidth={2} />
              </Link>
              <Link
                to="/payment-history"
                className="group relative inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md"
                aria-label="Payment History"
                title="Payment History"
              >
                <History className="w-5 h-5 text-gray-600 group-hover:text-purple-600 transition-colors" strokeWidth={2} />
              </Link>
              <Link
                to="/gallery"
                className="group relative inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md"
                aria-label="Gallery"
                title="Gallery"
              >
                <Image className="w-5 h-5 text-gray-600 group-hover:text-indigo-600 transition-colors" strokeWidth={2} />
              </Link>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="group relative inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-sm hover:shadow-md"
                aria-label="Logout"
                title="Logout"
              >
                {isLoggingOut ? (
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" strokeWidth={2} />
                ) : (
                  <LogOut className="w-5 h-5 text-gray-600 group-hover:text-red-600 transition-colors" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          {/* SESSION INFO PANEL - Collapsible security info */}
          {showSessionInfo && activeSessionInfo && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 animate-slideInDown">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Shield className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Active Session</h3>
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Secure connection
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSessionInfo(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  ✕
                </button>
              </div>
              
              {/* Session Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Device Info */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Monitor className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-500">Device</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {activeSessionInfo.deviceInfo?.browser || 'Unknown'} / {activeSessionInfo.deviceInfo?.os || 'Unknown'}
                  </p>
                </div>
                
                {/* Session Duration */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-500">Session Duration</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {formatDuration(getSessionDuration())}
                  </p>
                </div>
                
                {/* Last Activity */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-500">Last Activity</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {getLastActivity()?.toLocaleTimeString() || 'Just now'}
                  </p>
                </div>
                
                {/* Session Started */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-500">Started</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {activeSessionInfo.createdAt 
                      ? new Date(activeSessionInfo.createdAt).toLocaleTimeString()
                      : 'Unknown'
                    }
                  </p>
                </div>
              </div>
              
              {/* Force Logout Other Devices */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-gray-100">
                <div className="text-sm text-gray-600">
                  <p className="font-medium text-gray-700">Security Notice</p>
                  <p className="text-xs">Only one device can be logged in at a time. New logins will end other sessions.</p>
                </div>
                <button
                  onClick={handleForceLogoutOthers}
                  disabled={isForceLoggingOut}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors disabled:opacity-50"
                >
                  {isForceLoggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                  <span>Refresh Session</span>
                </button>
              </div>
            </div>
          )}

          {/* PROFILE ALERT - Prominent but not intrusive */}
          {!isProfileComplete && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-400 p-4 md:p-5 rounded-r-lg animate-slideInDown flex items-start gap-4">
              <div className="flex-shrink-0 mt-0.5">
                <AlertCircle className="w-6 h-6 text-amber-600" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 mb-1">Complete Your Profile</h3>
                <p className="text-sm text-gray-700">Add your information to unlock seat booking and payments.</p>
              </div>
              <Link
                to="/profile"
                className="ml-4 flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg text-sm transition-all duration-200 active:scale-95"
              >
                Complete →
              </Link>
            </div>
          )}

          {/* PRIMARY ZONE - Hero CTA & Quick Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* ============================================ */}
            {/* YOUR BOOKED SEAT CARD - ONE-SEAT-PER-USER */}
            {/* Shows when user has an active booking */}
            {/* ============================================ */}
            {hasBookedSeat && bookedSeat && (
              <div className="md:col-span-3 bg-gradient-to-br from-green-500 via-green-600 to-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                {/* Animated Background */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-3xl"></div>
                
                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-4xl font-bold shadow-lg border border-white/30">
                        {bookedSeat.seatNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="w-5 h-5 text-green-200" />
                          <span className="text-green-100 text-sm font-medium uppercase tracking-wide">Your Booked Seat</span>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold">Seat {bookedSeat.seatNumber}</h3>
                        <p className="text-green-100 text-sm mt-1">
                          {bookedSeat.months} month(s) • {bookedSeat.dailyHours ? `${bookedSeat.dailyHours} hrs/day` : 'Full day'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      <Link
                        to="/seats"
                        className="px-5 py-2.5 bg-white text-green-600 rounded-lg font-semibold hover:bg-green-50 transition text-center text-sm"
                      >
                        View Seat Layout
                      </Link>
                      <Link
                        to="/payment-history"
                        className="px-5 py-2.5 bg-white/20 text-white rounded-lg font-semibold hover:bg-white/30 transition text-center text-sm border border-white/30"
                      >
                        Payment History
                      </Link>
                    </div>
                  </div>
                  
                  {/* One-seat-per-user info */}
                  <div className="mt-4 bg-white/10 rounded-lg p-3 border border-white/20">
                    <p className="text-green-100 text-xs sm:text-sm flex items-start gap-2">
                      <span className="flex-shrink-0">ℹ️</span>
                      <span>
                        <strong>One seat per user:</strong> You can only have one active booking at a time. 
                        To change seats, visit the seat layout and select a new seat.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Action Card - MAIN CTA */}
            <div className="md:col-span-2 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-2xl p-6 md:p-8 text-white shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden relative group">
              {/* Animated Background */}
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl group-hover:blur-2xl transition-all duration-500"></div>
              
              <div className="relative z-10">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-blue-100 uppercase tracking-wide">Ready to study?</h2>
                  <h3 className="text-3xl md:text-4xl font-bold mt-2">Book Your Seat</h3>
                </div>
                
                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-4 mb-6 py-6 border-t border-b border-white/20">
                  <div>
                    <p className="text-blue-100 text-sm font-medium mb-1">Available Now</p>
                    <p className="text-3xl font-bold">{vacantCount}</p>
                  </div>
                  <div>
                    <p className="text-blue-100 text-sm font-medium mb-1">Occupancy</p>
                    <p className="text-3xl font-bold">{occupancyPercentage}%</p>
                  </div>
                </div>

                <p className="text-blue-100 text-sm md:text-base mb-6">
                  {vacantCount > 0 
                    ? `${vacantCount} seats available. Start your study session now!`
                    : 'Library is full. Check back soon!'
                  }
                </p>

                {/* Primary CTA Button */}
                <Link
                  to={isProfileComplete ? "/seats" : "#"}
                  onClick={handleBookingSeat}
                  className={`inline-flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg transition-all duration-300 ${
                    isProfileComplete
                      ? 'bg-white text-blue-600 hover:bg-blue-50 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl'
                      : 'bg-white/40 text-white cursor-not-allowed opacity-70'
                  }`}
                  aria-label={isProfileComplete ? 'Book a seat now' : 'Complete profile to book seat'}
                >
                  <LayoutGrid className="w-6 h-6" strokeWidth={2.5} />
                  <span>{isProfileComplete ? 'Book a Seat Now' : 'Complete Profile First'}</span>
                  {isProfileComplete && (
                    <span className="ml-1">→</span>
                  )}
                </Link>
              </div>
            </div>

            {/* Occupancy Card - Secondary Priority */}
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" strokeWidth={2} />
                <span>Occupancy</span>
              </h3>
              
              {/* Progress Bar */}
              <div className="mb-5">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500 rounded-full"
                    style={{ width: `${occupancyPercentage}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600 mt-2">{occupancyPercentage}% Full</p>
              </div>

              {/* Stat Boxes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                  <span className="text-sm font-medium text-gray-700">✓ Booked</span>
                  <span className="text-lg font-bold text-green-600">{bookedCount}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-sm font-medium text-gray-700">○ Vacant</span>
                  <span className="text-lg font-bold text-blue-600">{vacantCount}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECONDARY ZONE - Fee & Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fee Calculator Card */}
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" strokeWidth={2} />
                <span>Fee Calculator</span>
              </h3>

              <div className="space-y-4">
                {/* Hour Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Duration
                  </label>
                  <select
                    value={selectedHours}
                    onChange={(e) => setSelectedHours(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base"
                  >
                    {[4, 6, 8, 10, 12].map((hour) => (
                      <option key={hour} value={hour}>
                        {hour} Hours
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cost Breakdown */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Hourly Rate</span>
                    <span className="font-semibold text-gray-900">₹{HOURLY_RATE}/hr</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Duration</span>
                    <span className="font-semibold text-gray-900">{selectedHours} hrs</span>
                  </div>
                  <div className="border-t border-blue-200 pt-3 flex justify-between">
                    <span className="font-bold text-gray-900">Total Amount</span>
                    <span className="text-lg font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      ₹{totalFee}
                    </span>
                  </div>
                </div>

                {/* Secondary CTA */}
                <Link
                  to={isProfileComplete ? "/seats" : "#"}
                  onClick={handleBookingSeat}
                  className={`block w-full text-center px-4 py-2.5 rounded-lg font-semibold transition-all duration-200 ${
                    isProfileComplete
                      ? 'bg-green-500 hover:bg-green-600 text-white hover:scale-105 active:scale-95 shadow-sm hover:shadow-md'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-70'
                  }`}
                >
                  <LayoutGrid className="w-5 h-5 inline-block mr-2 -mt-1" />
                  Book a Seat Now
                </Link>
              </div>
            </div>

            {/* Quick Session Info Card */}
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <span className="text-xl">⏱️</span> Your Session
              </h3>

              <div className="space-y-3">
                {/* Session Stats - Empty State with Guidance */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center">
                  <p className="text-2xl font-bold text-gray-900">0</p>
                  <p className="text-sm text-gray-600 mt-1">Active Sessions</p>
                  <p className="text-xs text-gray-500 mt-2">
                    📌 No active bookings yet. Book a seat to get started!
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-100 text-center">
                    <p className="text-lg font-bold text-purple-700">0 hrs</p>
                    <p className="text-xs text-purple-600 mt-1">Total Hours</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-100 text-center">
                    <p className="text-lg font-bold text-green-700">₹0</p>
                    <p className="text-xs text-green-600 mt-1">Spent</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TERTIARY ZONE - Support & Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Location Card */}
            <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-100">
              <h3 className="font-semibold text-gray-900 p-6 pb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" strokeWidth={2} />
                <span>Location</span>
              </h3>
              
              <div className="px-6 pb-6">
                <div className="w-full aspect-video rounded-lg overflow-hidden mb-4 border border-gray-200 bg-gray-100">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.1234567890!2d72.8776559!3d19.0759837!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTnCsDA0JzMzLjUiTiA3MsKwNTInMzkuNiJF!5e0!3m2!1sen!2sin!4v1234567890123!5m2!1sen!2sin"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Library Location"
                  ></iframe>
                </div>
                <p className="text-sm text-gray-600 text-center font-medium">
                  📌 123 Education Street, Learning City
                </p>
              </div>
            </div>

            {/* Help & Support Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-6 border border-blue-100">
              <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <span className="text-xl">🆘</span> Help & Support
              </h3>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">📞</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Call Us</p>
                    <p className="text-sm text-gray-900 font-medium">+91-XXXX-XXXX-XXXX</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">📧</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Email</p>
                    <p className="text-sm text-gray-900 font-medium">support@shivika.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0 mt-0.5">🕐</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Available</p>
                    <p className="text-sm text-gray-900 font-medium">9 AM - 9 PM Daily</p>
                  </div>
                </div>

                <button className="w-full mt-4 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm transition-all duration-200 active:scale-95 hover:scale-105">
                  💬 Chat Now
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* STICKY MOBILE CTA - Mobile Optimization */}
      <div className="fixed md:hidden bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50">
        <div className="p-4">
          <Link
            to={isProfileComplete ? "/seats" : "#"}
            onClick={handleBookingSeat}
            className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-center transition-all duration-300 ${
              isProfileComplete
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg active:scale-95'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-70'
            }`}
            aria-label={isProfileComplete ? 'Book a seat' : 'Complete profile first'}
          >
            <LayoutGrid className="w-5 h-5" strokeWidth={2.5} />
            <span>{isProfileComplete ? 'Book a Seat' : 'Complete Profile'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}