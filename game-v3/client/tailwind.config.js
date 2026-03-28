/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'brand-green': '#22c55e',
        'brand-red': '#ef4444',
        'brand-orange': '#f97316',
        'brand-blue': '#3b82f6',
        'brand-purple': '#a855f7',
        'heat-cold': '#6b7280',
        'heat-warm': '#eab308',
        'heat-hot': '#f97316',
        'heat-burning': '#ef4444',
        'heat-fugitive': '#a855f7',
      },
    },
  },
  plugins: [],
};
