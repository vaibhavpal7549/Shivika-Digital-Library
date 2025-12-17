import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { currentUser } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-3 sm:p-4 md:p-6 lg:p-8 relative overflow-hidden">
      {/* Animated background elements - Modern design */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 sm:top-16 md:top-20 left-4 sm:left-8 lg:left-10 w-40 sm:w-56 md:w-72 h-40 sm:h-56 md:h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob"></div>
        <div className="absolute top-20 sm:top-32 md:top-40 right-4 sm:right-8 lg:right-10 w-40 sm:w-56 md:w-72 h-40 sm:h-56 md:h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-4 sm:bottom-0 md:-bottom-8 left-1/2 w-40 sm:w-56 md:w-72 h-40 sm:h-56 md:h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-5xl w-full text-center relative z-10 page-enter">
        {/* Logo/Brand - Modern styling */}
        <div className="mb-6 sm:mb-8 md:mb-10">
          <div className="inline-block bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-xl rounded-2xl p-3 sm:p-4 md:p-5 mb-3 sm:mb-4 md:mb-5 shadow-2xl border border-white/10 hover:border-white/20 transition-all duration-300">
            <span className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl block">📚</span>
          </div>
        </div>

        {/* Heading - Improved typography with hierarchy */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white mb-2 sm:mb-3 md:mb-4 drop-shadow-2xl leading-tight px-2">
          <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
            Shivika Digital Library
          </span>
        </h1>
        
        {/* Tagline */}
        <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 mb-2 sm:mb-3 font-medium px-2">
          Smart Seat Booking for Modern Learners
        </p>
        
        {/* Description - Improved clarity */}
        <p className="text-sm sm:text-base md:text-lg text-white/75 mb-8 sm:mb-10 md:mb-14 px-2 max-w-2xl mx-auto leading-relaxed">
          Book your study seat in seconds. Real-time availability, instant confirmation, and seamless payment processing.
        </p>
        
        {/* CTA Buttons - Modern design with micro-interactions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 md:gap-6 justify-center flex-wrap mb-10 sm:mb-14 md:mb-20 px-2">
          {currentUser ? (
            <>
              <Link
                to="/dashboard"
                className="group btn btn-primary inline-flex gap-2 text-sm sm:text-base md:text-lg shadow-lg hover:shadow-2xl"
              >
                <span>📊 Dashboard</span>
                <span className="group-hover:translate-x-1 transition-transform duration-300 hidden sm:inline">→</span>
              </Link>
              <Link
                to="/seats"
                className="group btn btn-primary inline-flex gap-2 text-sm sm:text-base md:text-lg shadow-lg hover:shadow-2xl"
              >
                <span>🪑 View Seats</span>
                <span className="group-hover:translate-x-1 transition-transform duration-300 hidden sm:inline">→</span>
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="group btn btn-primary inline-flex gap-2 text-sm sm:text-base md:text-lg shadow-lg hover:shadow-2xl px-8 sm:px-10 md:px-12"
            >
              <span>✨ Get Started</span>
              <span className="group-hover:translate-x-1 transition-transform duration-300 hidden sm:inline">→</span>
            </Link>
          )}
        </div>

        {/* Feature Cards - Modern card design with hover effects */}
        <div className="mt-10 sm:mt-14 md:mt-18 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 text-left px-2">
          {/* Card 1 - Real-time Updates */}
          <div className="group bg-white/10 backdrop-blur-xl p-4 sm:p-6 md:p-7 rounded-xl sm:rounded-2xl border border-white/20 hover:bg-white/15 hover:border-white/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer">
            <div className="text-3xl sm:text-4xl md:text-5xl mb-2 sm:mb-3 md:mb-4 transform group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300">🚀</div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2 md:mb-3">Real-time Updates</h3>
            <p className="text-xs sm:text-sm md:text-base text-white/85 leading-relaxed">See seat availability changes instantly with live synchronization</p>
          </div>

          {/* Card 2 - Secure Payment */}
          <div className="group bg-white/10 backdrop-blur-xl p-4 sm:p-6 md:p-7 rounded-xl sm:rounded-2xl border border-white/20 hover:bg-white/15 hover:border-white/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer">
            <div className="text-3xl sm:text-4xl md:text-5xl mb-2 sm:mb-3 md:mb-4 transform group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300">🔒</div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2 md:mb-3">Secure Payment</h3>
            <p className="text-xs sm:text-sm md:text-base text-white/85 leading-relaxed">Bank-grade encryption with Razorpay for safe transactions</p>
          </div>

          {/* Card 3 - Easy Booking */}
          <div className="group bg-white/10 backdrop-blur-xl p-4 sm:p-6 md:p-7 rounded-xl sm:rounded-2xl border border-white/20 hover:bg-white/15 hover:border-white/40 transition-all duration-300 hover:scale-105 hover:shadow-2xl cursor-pointer">
            <div className="text-3xl sm:text-4xl md:text-5xl mb-2 sm:mb-3 md:mb-4 transform group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300">⚡</div>
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2 md:mb-3">Quick Booking</h3>
            <p className="text-xs sm:text-sm md:text-base text-white/85 leading-relaxed">Book a seat in just 3 steps - no hassle, no complications</p>
          </div>
        </div>

        {/* Trust Indicators - Social proof */}
        {currentUser && (
          <div className="mt-12 sm:mt-16 md:mt-20 pt-6 sm:pt-8 border-t border-white/20">
            <p className="text-white/60 text-xs sm:text-sm mb-3">Already using Shivika</p>
            <div className="flex justify-center gap-4 sm:gap-6 flex-wrap">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">60</div>
                <p className="text-white/60 text-xs sm:text-sm">Available Seats</p>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">24/7</div>
                <p className="text-white/60 text-xs sm:text-sm">Open Access</p>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white">2min</div>
                <p className="text-white/60 text-xs sm:text-sm">Average Booking</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

