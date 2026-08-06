import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0E1B2E",
          50: "#EEF1F5",
          100: "#D7DEE8",
          200: "#AFC0D2",
          300: "#8098B6",
          400: "#4F6B94",
          500: "#2E4A72",
          600: "#1D3557",
          700: "#152740",
          800: "#0E1B2E",
          900: "#080F1A",
        },
        gold: {
          DEFAULT: "#F2A93B",
          50: "#FEF6E9",
          100: "#FCE9C6",
          200: "#F9D48D",
          300: "#F5BE5F",
          400: "#F2A93B",
          500: "#E0921C",
          600: "#B87316",
          700: "#8F5811",
        },
        jade: {
          DEFAULT: "#2BB673",
          50: "#E9F8F0",
          100: "#C6EDD9",
          400: "#2BB673",
          500: "#219259",
          600: "#187045",
        },
        coral: {
          DEFAULT: "#FF6B5A",
          500: "#FF6B5A",
          600: "#E64C3B",
        },
        paper: "#F7F5F0",
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jbmono)", "monospace"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        converge: {
          "0%": { transform: "translateX(var(--from, 0))" },
          "100%": { transform: "translateX(var(--to, 0))" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.8" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
