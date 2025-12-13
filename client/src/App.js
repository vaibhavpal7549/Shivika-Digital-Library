import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SeatViewer from './pages/SeatViewer';
import Booking from './pages/Booking';
import Profile from './pages/Profile';
import PaymentHistory from './pages/PaymentHistory';
import FeePayment from './pages/FeePayment';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const { isProfileComplete, loading: profileLoading } = useProfile();
  
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <Router>
          <div className="App">
            <Toaster position="top-right" />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/seats" 
                element={
                  <ProtectedRoute>
                    <SeatViewer />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/booking/:seatNumber" 
                element={
                  <ProtectedRoute>
                    <Booking />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/payment-history" 
                element={
                  <ProtectedRoute>
                    <PaymentHistory />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/fee-payment" 
                element={
                  <ProtectedRoute>
                    <FeePayment />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </div>
        </Router>
      </ProfileProvider>
    </AuthProvider>
  );
}

export default App;

