import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAF8F2",
        ink: { DEFAULT: "#1B2430", muted: "#5B6472" },
        seal: { DEFAULT: "#B08D2F", dark: "#8A6E22" },
        valid: { DEFAULT: "#2F6B4F", bg: "#E7F1EB" },
        invalid: { DEFAULT: "#A23B32", bg: "#F6E8E6" },
        border: "#D8D2C4",
      },
      borderRadius: {
        DEFAULT: "4px",
      },
      fontFamily: {
        serif: ["var(--font-source-serif-4)", "Source Serif 4", "serif"],
        sans: ["var(--font-ibm-plex-sans)", "IBM Plex Sans", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
