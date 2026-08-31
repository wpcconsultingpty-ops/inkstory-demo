import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: { bg: "#0b0b0d", surface: "#111114", edge: "#1a1a20", muted: "#8a8a94", ring: "#2a2a34" },
        accent: { DEFAULT: "#c9a26b", soft: "#f0d9b3" }
      },
      fontFamily: {
        serif: ["'Fraunces'", "ui-serif", "Georgia", "serif"],
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
export default config;
