/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',
        secondary: '#9333EA',
        dark: '#0F0C29',
        card: '#1E1B4B',
        nav: '#13102E',
      },
    },
  },
  plugins: [],
};
