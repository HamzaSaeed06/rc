/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        dark: {
          900: '#0e0e16',
          850: '#11111a',
          800: '#141420',
          700: '#1a1a26',
          600: '#1e1e2e',
          500: '#252538',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease both',
        'slide-up': 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-down': 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-right': 'slideRight 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
        'pulse-ring': 'pulseRing 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'typing-dot': 'typingDot 1.4s ease-in-out infinite',
        'speaking-glow': 'speakingGlow 1.5s ease-in-out infinite',
        'reaction-pop': 'reactionPop 0.25s ease-out',
        'float-up': 'floatUp 2.5s ease-out forwards',
        'bounce-soft': 'bounceSoft 1s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: {
          from: { opacity: 0, transform: 'translateY(10px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: 0, transform: 'translateY(-8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        slideRight: {
          from: { opacity: 0, transform: 'translateX(20px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: 0, transform: 'scale(0.95)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(79,70,229,0.7)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(79,70,229,0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(79,70,229,0)' },
        },
        typingDot: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%': { transform: 'translateY(-5px)', opacity: '1' },
        },
        speakingGlow: {
          '0%, 100%': { boxShadow: '0 0 0 2px rgba(74,222,128,0.6)' },
          '50%': { boxShadow: '0 0 0 5px rgba(74,222,128,0.9), 0 0 20px rgba(74,222,128,0.4)' },
        },
        reactionPop: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '70%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        floatUp: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': { transform: 'translateY(-120px) scale(1.4)', opacity: '0' },
        },
        bounceSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },
    },
  },
  plugins: [],
};
