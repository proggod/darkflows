import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0070f3',
        secondary: '#ff4081',
        success: '#00c853',
        warning: '#ffd600',
        error: '#ff1744',
      },
      screens: {
        '3xl': '1920px',
      },
    },
  },
  plugins: [],
};

export default config;