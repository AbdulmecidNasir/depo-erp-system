/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          500: '#22c55e',
          600: '#16a34a',
        }
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem'
      },
      boxShadow: {
        soft: '0 10px 30px -10px rgba(0,0,0,0.15)',
        glass: '0 8px 24px rgba(31, 38, 135, 0.2)'
      },
      backdropBlur: {
        xs: '2px'
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' }
        }
      },
      animation: {
        'fade-in-up': 'fadeInUp 300ms ease-out both',
        shimmer: 'shimmer 2.5s linear infinite'
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.35) 100%)',
        'brand-gradient': 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)'
      }
    },
  },
  plugins: [],
};
