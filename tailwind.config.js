/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // SiteCommand brand: dark blue. Token keeps its historical name so
        // existing utility classes keep working across the app.
        billnick: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd3fe',
          300: '#93b4fd',
          400: '#6090fa',
          500: '#1d4ed8', // primary dark blue
          600: '#1e40af',
          700: '#1e3a8a',
          800: '#1e3372',
          900: '#172554',
        },
        // Velron brand (developer)
        velron: {
          500: '#1b46c2',
          600: '#0f3aad',
          700: '#0a2f8f',
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d8e1',
          300: '#aeb6c6',
          400: '#828da6',
          500: '#64708b',
          600: '#4f5972',
          700: '#41495d',
          800: '#383f4f',
          900: '#1f2433',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04)',
        cardhover: '0 10px 25px -5px rgba(16,24,40,0.10), 0 4px 10px -4px rgba(16,24,40,0.06)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-fast': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Opacity-only page entrance. Deliberately no transform, so it does not
        // create a containing block that would trap position:fixed modals.
        'page-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(245,126,32,0.5)' },
          '70%': { boxShadow: '0 0 0 8px rgba(245,126,32,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(245,126,32,0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out both',
        'fade-in-fast': 'fade-in-fast 0.3s ease-out both',
        'page-in': 'page-in 0.4s ease-out',
        'slide-in': 'slide-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.35s ease-out both',
        'pulse-ring': 'pulse-ring 2s infinite',
      },
    },
  },
  plugins: [],
}
