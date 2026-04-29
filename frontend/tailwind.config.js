/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      colors: {
        anshuman: '#10b981',
        abhimanyu: '#f59e0b',
        kshitij: '#8b5cf6',
      },
      keyframes: {
        bounce3: {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        bounce3: 'bounce3 1.4s infinite ease-in-out both',
        slideUp: 'slideUp 0.3s ease',
      },
    },
  },
  plugins: [],
}

