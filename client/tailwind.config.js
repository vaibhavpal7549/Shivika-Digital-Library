/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '320px',
        'sm': '375px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1366px',
        '2xl': '1920px',
      },
      spacing: {
        'safe-left': 'max(1rem, env(safe-area-inset-left))',
        'safe-right': 'max(1rem, env(safe-area-inset-right))',
        'safe-top': 'max(1rem, env(safe-area-inset-top))',
        'safe-bottom': 'max(1rem, env(safe-area-inset-bottom))',
      },
      padding: {
        'safe-left': 'max(1rem, env(safe-area-inset-left))',
        'safe-right': 'max(1rem, env(safe-area-inset-right))',
        'safe-top': 'max(1rem, env(safe-area-inset-top))',
        'safe-bottom': 'max(1rem, env(safe-area-inset-bottom))',
      },
      animation: {
        'blink': 'blink 1.5s ease-in-out infinite',
        'blob': 'blob 7s infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-down': 'slideDown 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        blob: {
          '0%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
          '33%': {
            transform: 'translate(30px, -50px) scale(1.1)',
          },
          '66%': {
            transform: 'translate(-20px, 20px) scale(0.9)',
          },
          '100%': {
            transform: 'translate(0px, 0px) scale(1)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.7)',
          },
          '50%': {
            opacity: '0.8',
            boxShadow: '0 0 0 10px rgba(59, 130, 246, 0)',
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      fontSize: {
        'clamp-xs': 'clamp(12px, 1.5vw, 14px)',
        'clamp-sm': 'clamp(13px, 1.8vw, 15px)',
        'clamp-base': 'clamp(14px, 2vw, 16px)',
        'clamp-lg': 'clamp(16px, 2.5vw, 20px)',
        'clamp-xl': 'clamp(20px, 3vw, 24px)',
        'clamp-2xl': 'clamp(24px, 3.5vw, 30px)',
        'clamp-3xl': 'clamp(28px, 4vw, 36px)',
        'clamp-4xl': 'clamp(32px, 5vw, 48px)',
        'clamp-5xl': 'clamp(36px, 6vw, 60px)',
        'clamp-6xl': 'clamp(40px, 7vw, 72px)',
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      width: {
        'safe-screen': 'calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right))',
      },
      maxWidth: {
        'safe-screen': 'calc(100vw - env(safe-area-inset-left) - env(safe-area-inset-right))',
      },
    },
  },
  plugins: [
    // Custom plugin for responsive utilities
    function ({ addUtilities, e, theme }) {
      const newUtilities = {
        '.touch-target': {
          minHeight: '44px',
          minWidth: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
        '.safe-area': {
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        },
      };

      addUtilities(newUtilities);
    },
  ],
}

