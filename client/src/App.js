import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
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
import DemoBanner from './components/DemoBanner';
import './App.css';
import './responsive.css';
import './modern-ui.css';

// Protected Route Component - Requires both auth and MongoDB registration
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading, isDemo } = useAuth();
  const { isProfileComplete, loading: profileLoading } = useProfile();
  const { userData, loading: userLoading, needsRegistration } = useUser();
  
  if (loading || (!isDemo && (profileLoading || userLoading))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl font-medium text-gray-600">Loading...</div>
      </div>
    );
  }
  
  if (!currentUser && !isDemo) {
    return <Navigate to="/login" />;
  }

  // If user is authenticated but not registered in MongoDB, redirect to signup
  if (needsRegistration && !isDemo) {
    return <Navigate to="/signup" state={{ 
      needsProfileCompletion: true, 
      firebaseUser: {
        uid: currentUser?.uid,
        email: currentUser?.email,
        displayName: currentUser?.displayName,
        photoURL: currentUser?.photoURL
      }
    }} />;
  }
  
  return children;
};

// Admin Route Component - Requires admin role or Admin Demo mode
const AdminRoute = ({ children }) => {
  const { isDemo, currentUser } = useAuth();
  const { userData, loading } = useUser();

  const isDemoAdmin =
    isDemo &&
    (sessionStorage.getItem("demo_role") === "admin" ||
      currentUser?.isAdminDemo ||
      currentUser?.uid === "demo-admin-uid");

  if (loading && !isDemoAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl font-medium text-gray-600">
          Verifying Admin Access...
        </div>
      </div>
    );
  }

  const isAdmin = userData?.role === "admin" || isDemoAdmin;

  if (!isAdmin) {
    toast.error("🔒 Access Restricted: Admin permissions required.");
    return <Navigate to="/dashboard" replace />;
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
                <DemoBanner />
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
                        <AdminRoute>
                          <AdminPanel />
                        </AdminRoute>
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

