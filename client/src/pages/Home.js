import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-5xl w-full text-center relative z-10">
        {/* Logo/Brand */}
        <div className="mb-6">
          <div className="inline-block bg-white/20 backdrop-blur-lg rounded-full p-4 mb-4 shadow-2xl">
            <span className="text-6xl">📚</span>
          </div>
        </div>

        <h1 className="text-6xl md:text-7xl font-extrabold text-white mb-4 drop-shadow-2xl">
          <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
            Shivika Digital Library
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-white/95 mb-2 font-medium">
          Your Gateway to Knowledge & Learning
        </p>
        <p className="text-lg text-white/80 mb-10">
          Book your study seat in real-time. Experience seamless booking with instant updates.
        </p>
        
        <div className="flex gap-4 justify-center flex-wrap mb-12">
          {currentUser ? (
            <>
              <Link
                to="/dashboard"
                className="group bg-white text-blue-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform"
              >
                <span className="flex items-center gap-2">
                  Dashboard
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </Link>
              <Link
                to="/seats"
                className="group bg-gradient-to-r from-blue-600 to-blue-700 text-white px-10 py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform"
              >
                <span className="flex items-center gap-2">
                  View Seats
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="group bg-white text-blue-600 px-12 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 transform"
            >
              <span className="flex items-center gap-2">
                Get Started
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </span>
            </Link>
          )}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6 text-left">
          <div className="group bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform">🪑</div>
            <h3 className="text-2xl font-bold text-white mb-3">60 Seats Available</h3>
            <p className="text-white/90 leading-relaxed">Real-time seat status updates with instant synchronization</p>
          </div>
          <div className="group bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform">💳</div>
            <h3 className="text-2xl font-bold text-white mb-3">Secure Payment</h3>
            <p className="text-white/90 leading-relaxed">Safe and secure payment processing with Razorpay</p>
          </div>
          <div className="group bg-white/10 backdrop-blur-lg p-8 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
            <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform">⚡</div>
            <h3 className="text-2xl font-bold text-white mb-3">Live Updates</h3>
            <p className="text-white/90 leading-relaxed">See seat availability changes in real-time</p>
          </div>
        </div>
      </div>
    </div>
  );
}

