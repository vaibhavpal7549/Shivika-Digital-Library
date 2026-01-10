import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { SocketProvider } from './contexts/SocketContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import SeatViewer from './pages/SeatViewer';
import Booking from './pages/Booking';
import Profile from './pages/Profile';
import PaymentHistory from './pages/PaymentHistory';
import FeePayment from './pages/FeePayment';
import Gallery from './pages/Gallery';
import AdminPanel from './pages/AdminPanel';
import './App.css';
import './responsive.css';
import './modern-ui.css';

// Protected Route Component - Requires both auth and MongoDB registration
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const { isProfileComplete, loading: profileLoading } = useProfile();
  const { userData, loading: userLoading, needsRegistration } = useUser();
  
  if (loading || profileLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // If user is authenticated but not registered in MongoDB, redirect to signup
  if (needsRegistration) {
    return <Navigate to="/signup" state={{ 
      needsProfileCompletion: true, 
      firebaseUser: {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      }
    }} />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <UserProvider>
        <ProfileProvider>
          <SocketProvider>
            <Router>
              <div className="App">
                <Toaster position="top-right" />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
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
                  <Route 
                    path="/gallery" 
                    element={
                      <ProtectedRoute>
                        <Gallery />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/admin" 
                    element={
                      <ProtectedRoute>
                        <AdminPanel />
                      </ProtectedRoute>
                    } 
                  />
                </Routes>
              </div>
            </Router>
          </SocketProvider>
        </ProfileProvider>
      </UserProvider>
    </AuthProvider>
  );
}

export default App;

