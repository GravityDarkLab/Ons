/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FAF9F7',
        surface: '#FFFFFF',
        primary: '#111111',
        accent: '#C96442',
        'accent-light': '#F2E8E3',
        muted: '#8B8178',
        border: '#E5E0DA',
        error: '#D94F3D',
        success: '#3D9970',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      maxWidth: {
        form: '520px',
      },
    },
  },
  plugins: [],
}
