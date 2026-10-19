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
        'jd-bg': '#F5F8FC',
        'jd-surface': '#FFFFFF',
        'jd-surface-muted': '#EDF4FA',
        'jd-navy': '#10243B',
        'jd-text-secondary': '#526984',
        'jd-river-blue': '#1769C2',
        'jd-sky-blue': '#288EE8',
        'jd-border': '#DCE6EF',
        'jd-risk-high': '#D94C55',
        'jd-risk-moderate': '#D9952C',
        'jd-risk-low': '#2879D8',
        'jd-success': '#27836E',
      },
    },
  },
  plugins: [],
};
