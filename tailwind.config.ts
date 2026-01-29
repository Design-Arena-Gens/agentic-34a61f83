import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          100: "#F0F4FF",
          200: "#D6E2FF",
          500: "#4C7BFF",
          600: "#365EEB",
          700: "#2B4BC7"
        },
        accent: {
          100: "#FFF4E6",
          400: "#FFB347",
          500: "#FF9F1C"
        }
      },
      boxShadow: {
        soft: "0 12px 40px rgba(28, 51, 140, 0.12)",
        glow: "0 0 45px rgba(76, 123, 255, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
