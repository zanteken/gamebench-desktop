/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
        },
        surface: {
          DEFAULT: "#0f1724",
          card: "#1a2233",
          hover: "#1f2b3f",
        },
        border: {
          DEFAULT: "#1e293b",
        },
      },
    },
  },
  plugins: [],
};
