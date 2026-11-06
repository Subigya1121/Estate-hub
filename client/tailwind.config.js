/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Charcoal text and dark surfaces
        ink: {
          50: "#f6f5f3", 100: "#e9e7e3", 200: "#d2cfc8", 300: "#b3afa6", 400: "#928e84",
          500: "#75716a", 600: "#5a5750", 700: "#403e39", 800: "#2b2a27", 900: "#1c1b19", 950: "#121110",
        },
        // Warm ivory backgrounds and hairline borders
        sand: {
          50: "#faf8f4", 100: "#f4f0e8", 200: "#e9e3d7", 300: "#dbd3c3", 400: "#c4baa6",
          500: "#a69c88", 600: "#867d6b", 700: "#675f50", 800: "#4a443a", 900: "#35312a",
        },
        // Restrained bronze accent
        bronze: {
          50: "#faf6f0", 100: "#f1e8da", 200: "#e3d0b3", 300: "#d0b088", 400: "#b8915f",
          500: "#9c7a4d", 600: "#7f633d", 700: "#644d30", 800: "#4b3924", 900: "#33271a",
        },
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', "system-ui", "-apple-system", "sans-serif"],
        display: ["Jost", '"Hanken Grotesk"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,27,25,0.04)",
        "card-hover": "0 10px 30px rgba(28,27,25,0.08)",
        nav: "0 1px 0 rgba(28,27,25,0.06)",
        search: "0 12px 40px rgba(28,27,25,0.08)",
      },
      animation: { "fade-in": "fadeIn 0.9s ease-out both" },
      keyframes: {
        fadeIn: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
      },
    },
  },
  plugins: [],
};
