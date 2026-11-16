/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bar: {
          bg: "rgba(24, 24, 27, 0.94)",
          border: "rgba(255, 255, 255, 0.12)",
        },
      },
      boxShadow: {
        bar: "0 8px 32px rgba(0, 0, 0, 0.45)",
      },
      borderRadius: {
        capsule: "9999px",
      },
    },
  },
  plugins: [],
};
