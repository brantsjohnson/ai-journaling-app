/** @type {import('tailwindcss').Config} */
import tailwindScrollbar from "tailwind-scrollbar";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gray: {
          light: "#BDBDBD",
          body: "#474747",
        },
        brand: {
          orange: "#EB7437",
          dark: "#242424",
          red: "#B31F19",
        },
        white: "#F9F9F9",
      },
      fontFamily: {
        sans: ["Ubuntu", "sans-serif"],
        display: ["Changa One", "sans-serif"],
      },
    },
  },
  plugins: [tailwindScrollbar],
};
