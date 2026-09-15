import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Zap, LogOut, Info } from 'lucide-react';

export default function DemoBanner() {
  const { isDemo, exitDemoMode } = useAuth();
  const navigate = useNavigate();

  if (!isDemo) return null;

  const handleExit = async () => {
    await exitDemoMode();
    navigate('/login');
  };

  return (
    <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white shadow-md z-50 sticky top-0 border-b border-amber-500/30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-sm font-medium">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-yellow-200 animate-pulse">
            <Zap className="w-4 h-4" />
          </div>
          <span className="flex items-center gap-1.5 font-semibold text-amber-50">
            <span className="bg-amber-800/60 text-amber-200 text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
              Demo Mode
            </span>
            <span>You're exploring a sample account. Real data will not be modified.</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/20 transition-all duration-200 active:scale-95 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Demo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
