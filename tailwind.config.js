/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'Instrument Serif'", "Georgia", "serif"],
        sans: ["'Manrope'", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      colors: {
        'bg-main': '#EAF5FF',
        'bg-highlight': '#F5FAFF',
        'navy-text': '#09172A',
        'slate-text': '#526984',
        'river-blue': '#1769C2',
        'accent-blue': '#288EE8',
        'subtle-border': '#CADDF0',
      },
    },
  },
  plugins: [],
};
