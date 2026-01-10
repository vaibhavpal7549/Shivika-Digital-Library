import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import toast from 'react-hot-toast';
import { getDaysRemaining } from '../utils/feeUtils';
import { 
  User, 
  Edit3, 
  LogOut, 
  LayoutDashboard, 
  CreditCard, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Camera,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  MessageCircle,
  Armchair,
  Save,
  Loader2,
  Shield,
  Image as ImageIcon
} from 'lucide-react';

/**
 * ============================================
 * ENHANCED PROFILE PAGE
 * ============================================
 * 
 * UX Improvements Made:
 * 
 * 1. VISUAL HIERARCHY
 *    - Clear header with avatar, name, and quick actions
 *    - Organized sections with card-based layout
 *    - Primary/secondary button differentiation
 * 
 * 2. FEE STATUS SECTION
 *    - Clear status badges (Paid/Pending/Overdue)
 *    - Prominent Pay Now CTA when needed
 *    - Days remaining indicator
 * 
 * 3. PROFILE INFORMATION
 *    - 2-column grid on desktop, single column on mobile
 *    - Card-based sections (Personal, Contact)
 *    - Better label/value contrast
 * 
 * 4. PHOTO UPLOAD UX
 *    - Hover overlay with camera icon
 *    - Clear "Change Photo" affordance
 *    - Visual feedback during upload
 * 
 * 5. MICRO-INTERACTIONS
 *    - Smooth hover transitions (200ms)
 *    - Button press feedback (scale)
 *    - Loading states during save
 * 
 * 6. MOBILE OPTIMIZATION
 *    - Touch-friendly targets (44px+)
 *    - Responsive grid layout
 *    - Proper spacing on all screens
 * 
 * 7. ACCESSIBILITY
 *    - Proper ARIA labels
 *    - Focus states on all interactive elements
 *    - Semantic HTML structure
 */

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const { 
    profile, 
    updateProfile, 
    feeStatus, 
    hasPendingDues,
    // Booked seat data from ProfileContext (single source of truth)
    bookedSeat,
    bookedSeatLoading,
    hasBookedSeat
  } = useProfile();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    profilePhoto: '',
    fullName: '',
    fatherName: '',
    dateOfBirth: '',
    email: '',
    phoneNumber: '',
    gender: '',
    fullAddress: '',
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showChangeSeatPopup, setShowChangeSeatPopup] = useState(false);
  const [showContactUs, setShowContactUs] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    // Don't overwrite form data if user is currently editing
    if (isEditing) return;

    if (profile) {
      setFormData({
        profilePhoto: profile.profilePhoto || profile.photoURL || '',
        fullName: profile.fullName || '',
        fatherName: profile.fatherName || profile.profile?.fatherName || '',
        dateOfBirth: (profile.dateOfBirth || profile.profile?.dateOfBirth || '').split('T')[0],
        email: profile.email || currentUser?.email || '',
        phoneNumber: profile.phoneNumber || profile.phone || '',
        gender: profile.gender || profile.profile?.gender || '',
        fullAddress: profile.fullAddress || profile.profile?.address?.full || '',
      });
    } else {
      setFormData(prev => ({
        ...prev,
        email: currentUser?.email || '',
        profilePhoto: currentUser?.photoURL || '',
      }));
    }
  }, [profile, currentUser, isEditing]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    if (val.length <= 10) {
      setFormData(prev => ({
        ...prev,
        phoneNumber: val,
      }));
      setPhoneError('');
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          profilePhoto: reader.result,
        }));
        toast.success('Photo updated! Save to apply changes.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate phone number
    if (formData.phoneNumber.length !== 10) {
      setPhoneError('Phone number must be exactly 10 digits');
      toast.error('Please enter a 10-digit phone number');
      return;
    }
    
    setIsSaving(true);
    try {
      // Calculate User ID
      const userId = (formData.fullName?.slice(0, 3).toUpperCase() || 'XXX') + (formData.phoneNumber?.slice(-4) || 'XXXX');
      
      await updateProfile({
        ...formData,
        userId
      });
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      setPhoneError('');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      setIsLoggingOut(false);
    }
  };

  // Calculate days remaining for fee status
  const daysRemaining = profile?.feePaymentDate ? getDaysRemaining(profile.feePaymentDate) : 0;
  const isOverdue = daysRemaining < 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <div className="p-4 sm:p-6 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6 page-enter">

          {/* ============================================ */}
          {/* PROFILE HEADER SECTION */}
          {/* ============================================ */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Gradient Banner */}
            <div className="h-24 sm:h-32 bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700"></div>
            
            {/* Profile Info */}
            <div className="px-4 sm:px-6 md:px-8 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12 sm:-mt-16">
                {/* Avatar & Name */}
                <div className="flex items-end gap-4">
                  {/* Profile Photo with Upload */}
                  <div className="relative group">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white p-1 shadow-lg">
                      {formData.profilePhoto ? (
                        <img
                          src={formData.profilePhoto}
                          alt="Profile"
                          className="w-full h-full rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-full h-full rounded-xl bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                          <User className="w-12 h-12 sm:w-16 sm:h-16 text-blue-600" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    
                    {/* Photo Upload Overlay */}
                    {isEditing && (
                      <label className="absolute inset-1 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer flex items-center justify-center">
                        <div className="text-center text-white">
                          <Camera className="w-6 h-6 mx-auto mb-1" />
                          <span className="text-xs font-medium">Change</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  
                  {/* Name & Email - adjusted vertical alignment */}
                  <div className="pb-1 pt-2 sm:pt-4 self-end">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                      {formData.fullName || 'Your Name'}
                    </h1>
                    <p className="text-sm sm:text-base text-gray-500 mt-1.5">
                      {formData.email || currentUser?.email}
                    </p>
                  </div>
                </div>
                
                {/* Header Actions */}
                <div className="flex gap-2 sm:gap-3 sm:pb-2 flex-wrap">
                  <Link
                    to="/gallery"
                    className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md text-sm sm:text-base"
                    aria-label="View Gallery"
                    title="View library gallery"
                  >
                    <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                    <span className="hidden sm:inline">Gallery</span>
                  </Link>
                  <Link
                    to="/dashboard"
                    className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all duration-200 active:scale-95 shadow-sm hover:shadow-md text-sm sm:text-base"
                    aria-label="Go to Dashboard"
                  >
                    <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-red-50 hover:text-red-600 transition-all duration-200 active:scale-95 disabled:opacity-50 text-sm sm:text-base"
                    aria-label="Logout"
                  >
                    {isLoggingOut ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" strokeWidth={2} />
                    ) : (
                      <LogOut className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
                    )}
                    <span className="hidden sm:inline">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* FEE STATUS CARD - Premium Design */}
          {/* ============================================ */}
          <div className={`rounded-2xl shadow-sm border overflow-hidden ${
            feeStatus === 'PAID' 
              ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200' 
              : isOverdue 
                ? 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
                : 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200'
          }`}>
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Status Info */}
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className={`p-3 rounded-xl ${
                    feeStatus === 'PAID' 
                      ? 'bg-green-100' 
                      : isOverdue 
                        ? 'bg-red-100'
                        : 'bg-amber-100'
                  }`}>
                    {feeStatus === 'PAID' ? (
                      <CheckCircle className="w-6 h-6 text-green-600" strokeWidth={2} />
                    ) : isOverdue ? (
                      <AlertCircle className="w-6 h-6 text-red-600" strokeWidth={2} />
                    ) : (
                      <Clock className="w-6 h-6 text-amber-600" strokeWidth={2} />
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Fee Status</h3>
                    
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                        feeStatus === 'PAID' 
                          ? 'bg-green-100 text-green-700' 
                          : isOverdue 
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}>
                        {feeStatus === 'PAID' ? '✓ PAID' : isOverdue ? '⚠ OVERDUE' : '⏳ PENDING'}
                      </span>
                    </div>
                    
                    {/* Days Remaining */}
                    {feeStatus === 'PAID' && profile?.feePaymentDate && (
                      <p className="text-sm text-gray-600 mt-2">
                        Valid for <span className="font-semibold text-green-600">{daysRemaining}</span> more days
                      </p>
                    )}
                    {isOverdue && (
                      <p className="text-sm text-red-600 mt-2 font-medium">
                        Payment overdue by {Math.abs(daysRemaining)} days
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Pay Now CTA */}
                {hasPendingDues ? (
                  <Link
                    to="/fee-payment"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold hover:from-red-600 hover:to-red-700 transition-all duration-200 active:scale-95 shadow-lg hover:shadow-xl text-sm sm:text-base"
                  >
                    <CreditCard className="w-5 h-5" strokeWidth={2} />
                    <span>Pay Now</span>
                    <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-100 rounded-xl">
                    <Shield className="w-5 h-5 text-green-600" strokeWidth={2} />
                    <span className="font-semibold text-green-700">Fee Active</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* BOOKED SEAT CARD - Shows user's current booking */}
          {/* ============================================ */}
          {/* 
            CONDITIONAL LOGIC EXPLANATION:
            1. bookedSeatLoading: Shows loading spinner while fetching seat data
            2. hasBookedSeat (bookedSeat exists): Shows seat number with booking details
            3. !hasBookedSeat: Shows "No seat booked" with CTA to book
            
            Data comes from ProfileContext which fetches from Firebase 'seats' collection
            in real-time. This ensures:
            - No stale data on page refresh or direct navigation
            - Immediate updates when booking status changes
            - Single source of truth prevents inconsistencies
          */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Seat Info */}
                <div className="flex items-start gap-4">
                  {/* Seat Icon */}
                  <div className={`p-3 rounded-xl ${
                    bookedSeatLoading 
                      ? 'bg-gray-100 animate-pulse' 
                      : hasBookedSeat 
                        ? 'bg-purple-100' 
                        : 'bg-gray-100'
                  }`}>
                    <Armchair className={`w-6 h-6 ${
                      bookedSeatLoading 
                        ? 'text-gray-400' 
                        : hasBookedSeat 
                          ? 'text-purple-600' 
                          : 'text-gray-400'
                    }`} strokeWidth={2} />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Booked Seat</h3>
                    
                    {/* Conditional Seat Number Display */}
                    {bookedSeatLoading ? (
                      // Loading state - prevents showing incorrect data during fetch
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-6 bg-gray-200 rounded animate-pulse"></div>
                        <span className="text-sm text-gray-400">Loading...</span>
                      </div>
                    ) : hasBookedSeat ? (
                      // User has a confirmed booked seat
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-4 py-1.5 rounded-full text-lg font-bold bg-purple-100 text-purple-700">
                            🪑 Seat {bookedSeat.seatNumber}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            ✓ Confirmed
                          </span>
                        </div>
                        
                        {/* Booking Details */}
                        <div className="mt-2 text-sm text-gray-600 space-y-1">
                          {bookedSeat.months && (
                            <p>Duration: <span className="font-medium text-gray-800">{bookedSeat.months} month(s)</span></p>
                          )}
                          {bookedSeat.dailyHours && (
                            <p>Daily Hours: <span className="font-medium text-gray-800">{bookedSeat.dailyHours} hrs/day</span></p>
                          )}
                          {bookedSeat.bookedAt && (
                            <p>Booked: <span className="font-medium text-gray-800">
                              {new Date(bookedSeat.bookedAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span></p>
                          )}
                        </div>
                      </>
                    ) : (
                      // User has NOT booked any seat
                      <div>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                          No seat booked
                        </span>
                        <p className="text-sm text-gray-500 mt-2">
                          You haven't booked a seat yet. Book one to reserve your study space.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Book/View Seat CTA */}
                {!bookedSeatLoading && (
                  hasBookedSeat ? (
                    <Link
                      to="/dashboard"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition-all duration-200 active:scale-95 text-sm"
                    >
                      <Armchair className="w-4 h-4" strokeWidth={2} />
                      <span>View Dashboard</span>
                    </Link>
                  ) : (
                    <Link
                      to="/seats"
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-semibold hover:from-purple-600 hover:to-purple-700 transition-all duration-200 active:scale-95 shadow-md hover:shadow-lg text-sm"
                    >
                      <Armchair className="w-4 h-4" strokeWidth={2} />
                      <span>Book a Seat</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                    </Link>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ============================================ */}
          {/* QUICK ACTIONS */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Edit Profile */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`group flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 active:scale-98 ${
                isEditing 
                  ? 'bg-purple-600 border-purple-600 text-white shadow-lg'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-purple-300 hover:bg-purple-50'
              }`}
            >
              <div className={`p-2.5 rounded-lg ${isEditing ? 'bg-white/20' : 'bg-purple-100 group-hover:bg-purple-200'}`}>
                <Edit3 className={`w-5 h-5 ${isEditing ? 'text-white' : 'text-purple-600'}`} strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className="font-semibold">{isEditing ? 'Cancel Edit' : 'Edit Profile'}</p>
                <p className={`text-xs ${isEditing ? 'text-purple-200' : 'text-gray-500'}`}>
                  {isEditing ? 'Discard changes' : 'Update your info'}
                </p>
              </div>
            </button>
            
            {/* Contact Us */}
            <button
              onClick={() => setShowContactUs(true)}
              className="group flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 active:scale-98"
            >
              <div className="p-2.5 rounded-lg bg-blue-100 group-hover:bg-blue-200">
                <MessageCircle className="w-5 h-5 text-blue-600" strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className="font-semibold">Contact Us</p>
                <p className="text-xs text-gray-500">Get help & support</p>
              </div>
            </button>
            
            {/* Change Seat */}
            <button
              onClick={() => setShowChangeSeatPopup(true)}
              className="group flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 active:scale-98"
            >
              <div className="p-2.5 rounded-lg bg-orange-100 group-hover:bg-orange-200">
                <Armchair className="w-5 h-5 text-orange-600" strokeWidth={2} />
              </div>
              <div className="text-left">
                <p className="font-semibold">Change Seat</p>
                <p className="text-xs text-gray-500">Request seat change</p>
              </div>
            </button>
          </div>

          {/* ============================================ */}
          {/* PROFILE INFORMATION - Card Layout */}
          {/* ============================================ */}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Personal Information Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" strokeWidth={2} />
                  Personal Information
                </h3>
                
                <div className="space-y-5">
                  {/* User ID (Auto-generated) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      User ID <span className="text-xs text-gray-400">(Auto-generated)</span>
                    </label>
                    <input
                      type="text"
                      value={(formData.fullName?.slice(0, 3).toUpperCase() || 'XXX') + (formData.phoneNumber?.slice(-4) || 'XXXX')}
                      readOnly
                      disabled
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-100 text-gray-500 font-bold tracking-wider cursor-not-allowed"
                    />
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:outline-none transition-all duration-300 text-gray-900 placeholder-gray-400 font-medium"
                        placeholder="Enter your full name"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium py-2">{formData.fullName || <span className="text-gray-400 italic">Not provided</span>}</p>
                    )}
                  </div>
                  
                  {/* Father's Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Father's Name <span className="text-red-500">*</span>
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:outline-none transition-all duration-300 text-gray-900 placeholder-gray-400 font-medium"
                        placeholder="Enter father's name"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium py-2">{formData.fatherName || <span className="text-gray-400 italic">Not provided</span>}</p>
                    )}
                  </div>
                  
                  {/* Date of Birth */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date of Birth <span className="text-red-500">*</span>
                      </span>
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:outline-none transition-all duration-300 text-gray-900 font-medium"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium py-2">
                        {formData.dateOfBirth ? new Date(formData.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : <span className="text-gray-400 italic">Not provided</span>}
                      </p>
                    )}
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    {isEditing ? (
                      <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:outline-none transition-all duration-300 text-gray-900 font-medium appearance-none"
                      >
                        <option value="">Select Gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    ) : (
                      <p className="text-gray-900 font-medium py-2 capitalize">
                        {formData.gender || <span className="text-gray-400 italic">Not provided</span>}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Contact Information Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-green-600" strokeWidth={2} />
                  Contact Information
                </h3>
                
                <div className="space-y-5">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      <span className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Address <span className="text-red-500">*</span>
                      </span>
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:outline-none transition-all duration-300 text-gray-900 placeholder-gray-400 pointer-events-auto font-medium"
                        placeholder="your@email.com"
                        autoComplete="email"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium py-2">{formData.email || <span className="text-gray-400 italic">Not provided</span>}</p>
                    )}
                  </div>
                  
                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      <span className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Phone Number <span className="text-red-500">*</span>
                      </span>
                    </label>
                    {isEditing ? (
                      <div>
                        <input
                          type="tel"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={handlePhoneChange}
                          required
                          maxLength="10"
                          className={`w-full px-4 py-3 rounded-xl border-2 transition-all duration-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:shadow-lg focus:shadow-blue-500/20 pointer-events-auto font-medium ${
                            phoneError 
                              ? 'border-red-300 bg-red-50/50 focus:border-red-500' 
                              : 'border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500'
                          }`}
                          placeholder="Mobile Number (10 digits)"
                          autoComplete="tel"
                        />
                        {phoneError && (
                          <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {phoneError}
                          </p>
                        )}
                        {!phoneError && formData.phoneNumber.length > 0 && formData.phoneNumber.length < 10 && (
                          <p className="mt-1 text-xs text-gray-500">({formData.phoneNumber.length}/10 digits)</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-900 font-medium py-2">{formData.phoneNumber || <span className="text-gray-400 italic">Not provided</span>}</p>
                    )}
                  </div>
                  
                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      <span className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Full Address <span className="text-red-500">*</span>
                      </span>
                    </label>
                    {isEditing ? (
                      <textarea
                        name="fullAddress"
                        value={formData.fullAddress}
                        onChange={handleInputChange}
                        required
                        rows="3"
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-blue-500 focus:shadow-lg focus:shadow-blue-500/20 focus:outline-none transition-all duration-300 text-gray-900 placeholder-gray-400 resize-none font-medium"
                        placeholder="Enter your complete address"
                      />
                    ) : (
                      <p className="text-gray-900 font-medium py-2 whitespace-pre-line">{formData.fullAddress || <span className="text-gray-400 italic">Not provided</span>}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Save Button */}
            {isEditing && (
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 active:scale-95 disabled:opacity-50 shadow-lg hover:shadow-xl"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" strokeWidth={2} />
                      <span>Save Profile</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

        </div>
      </div>

      {/* ============================================ */}
      {/* CHANGE SEAT MODAL */}
      {/* ============================================ */}
      {showChangeSeatPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-scaleIn relative">
            {/* Close Button */}
            <button
              onClick={() => setShowChangeSeatPopup(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            
            {/* Icon */}
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Armchair className="w-8 h-8 text-orange-600" strokeWidth={2} />
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-3">Change Seat Number</h3>
            <p className="text-gray-600 text-center mb-6">
              To change your assigned seat, please contact the library office during working hours.
            </p>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-600">
                <strong>Office Hours:</strong> 9 AM - 9 PM Daily
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>Contact:</strong> +91 1234567890
              </p>
            </div>
            
            <button
              onClick={() => setShowChangeSeatPopup(false)}
              className="w-full py-3 rounded-xl bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors active:scale-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* CONTACT US MODAL */}
      {/* ============================================ */}
      {showContactUs && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-scaleIn relative">
            {/* Close Button */}
            <button
              onClick={() => setShowContactUs(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            
            {/* Icon */}
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <MessageCircle className="w-8 h-8 text-blue-600" strokeWidth={2} />
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 text-center mb-6">Contact Us</h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <Mail className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                  <p className="text-gray-900 font-medium">library@example.com</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <Phone className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
                  <p className="text-gray-900 font-medium">+91 1234567890</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <MapPin className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Address</p>
                  <p className="text-gray-900 font-medium">123 Education Street, Learning City</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <Clock className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Office Hours</p>
                  <p className="text-gray-900 font-medium">Monday - Sunday, 9 AM - 9 PM</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowContactUs(false)}
              className="w-full mt-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
