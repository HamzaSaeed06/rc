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
          900: '#0a0a0f',
          850: '#0f0f15',
          800: '#111118',
          700: '#1a1a2e',
          600: '#16213e',
          500: '#0f3460',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
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
        pulseRing: {
          '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(99,102,241,0.7)' },
          '70%': { transform: 'scale(1)', boxShadow: '0 0 0 10px rgba(99,102,241,0)' },
          '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(99,102,241,0)' },
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
