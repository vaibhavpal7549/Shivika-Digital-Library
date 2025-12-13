import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { database } from '../firebase/config';
import { ref, set } from 'firebase/database';
import toast from 'react-hot-toast';
import { getDaysRemaining } from '../utils/feeUtils';

export default function Profile() {
  const { currentUser, logout } = useAuth();
  const { profile, updateProfile, feeStatus, hasPendingDues } = useProfile();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    profilePhoto: '',
    fullName: '',
    fatherName: '',
    dateOfBirth: '',
    email: '',
    phoneNumber: '',
    fullAddress: '',
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [showChangeSeatPopup, setShowChangeSeatPopup] = useState(false);
  const [showContactUs, setShowContactUs] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        profilePhoto: profile.profilePhoto || '',
        fullName: profile.fullName || '',
        fatherName: profile.fatherName || '',
        dateOfBirth: profile.dateOfBirth || '',
        email: profile.email || currentUser?.email || '',
        phoneNumber: profile.phoneNumber || '',
        fullAddress: profile.fullAddress || '',
      });
    } else {
      // Initialize with user email if available
      setFormData(prev => ({
        ...prev,
        email: currentUser?.email || '',
      }));
    }
  }, [profile, currentUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // For now, we'll store as base64 or URL
      // In production, upload to Firebase Storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          profilePhoto: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(formData);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update profile');
      console.error(error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      // Error handled in context
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-3 rounded-xl shadow-lg">
                <span className="text-2xl">👤</span>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                My Profile
              </h1>
            </div>
            <div className="flex gap-3">
              <Link
                to="/dashboard"
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Fee Status Section */}
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-6 mb-6 border border-blue-100">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-4">
            Fee Status
          </h2>
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
            <div>
              <p className="text-sm text-gray-600 mb-1">Current Status</p>
              <p className={`text-2xl font-bold ${
                feeStatus === 'PAID' ? 'text-green-600' : 'text-red-600'
              }`}>
                {feeStatus === 'PAID' ? '✓ Paid' : '⚠ Pending'}
              </p>
              {feeStatus === 'PAID' && profile?.feePaymentDate && (
                <p className="text-sm text-gray-600 mt-1">
                  Valid for {getDaysRemaining(profile.feePaymentDate)} more days
                </p>
              )}
            </div>
            {hasPendingDues ? (
              <Link
                to="/fee-payment"
                className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition"
              >
                Pay Now
              </Link>
            ) : (
              <div className="text-green-600 font-semibold">
                Fee Active
              </div>
            )}
          </div>
        </div>

        {/* Profile Section Options */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border border-gray-100">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-4">
            Profile Options
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
            >
              {isEditing ? 'Cancel Edit' : 'Edit Profile'}
            </button>
            <button
              onClick={() => setShowContactUs(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Contact Us
            </button>
            <button
              onClick={() => setShowChangeSeatPopup(true)}
              className="bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition"
            >
              Change Seat Number
            </button>
          </div>
        </div>

        {/* Profile Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {isEditing ? 'Edit Profile' : 'Profile Information'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Photo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Photo *
              </label>
              <div className="flex items-center gap-4">
                {formData.profilePhoto && (
                  <img
                    src={formData.profilePhoto}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-purple-600"
                  />
                )}
                {isEditing && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                  />
                )}
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              ) : (
                <p className="text-gray-800">{formData.fullName || 'Not provided'}</p>
              )}
            </div>

            {/* Father's Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Father's Name *
              </label>
              {isEditing ? (
                <input
                  type="text"
                  name="fatherName"
                  value={formData.fatherName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter father's name"
                />
              ) : (
                <p className="text-gray-800">{formData.fatherName || 'Not provided'}</p>
              )}
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth *
              </label>
              {isEditing ? (
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              ) : (
                <p className="text-gray-800">{formData.dateOfBirth || 'Not provided'}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              {isEditing ? (
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              ) : (
                <p className="text-gray-800">{formData.email || 'Not provided'}</p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="9876543210"
                />
              ) : (
                <p className="text-gray-800">{formData.phoneNumber || 'Not provided'}</p>
              )}
            </div>

            {/* Full Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Address *
              </label>
              {isEditing ? (
                <textarea
                  name="fullAddress"
                  value={formData.fullAddress}
                  onChange={handleInputChange}
                  required
                  rows="4"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your complete address"
                />
              ) : (
                <p className="text-gray-800 whitespace-pre-line">{formData.fullAddress || 'Not provided'}</p>
              )}
            </div>

            {isEditing && (
              <button
                type="submit"
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Save Profile
              </button>
            )}
          </form>
        </div>
      </div>

      {/* Change Seat Number Popup */}
      {showChangeSeatPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Change Seat Number</h3>
            <p className="text-gray-600 mb-6">
              Contact the office for the seat change request.
            </p>
            <button
              onClick={() => setShowChangeSeatPopup(false)}
              className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Contact Us Popup */}
      {showContactUs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Contact Us</h3>
            <div className="space-y-4 text-gray-700">
              <p><strong>Email:</strong> library@example.com</p>
              <p><strong>Phone:</strong> +91 1234567890</p>
              <p><strong>Address:</strong> 123 Education Street, Learning City, 400001</p>
              <p><strong>Office Hours:</strong> Monday - Friday, 9:00 AM - 5:00 PM</p>
            </div>
            <button
              onClick={() => setShowContactUs(false)}
              className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition mt-6"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

