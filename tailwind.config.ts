import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces claires : page, cartes, remplissages discrets.
        surface: {
          DEFAULT: "#f5f7fa",
          raised: "#ffffff",
          overlay: "#e8edf4",
        },
        // Texte, du plus contrasté au plus discret.
        ink: {
          DEFAULT: "#0f172a",
          muted: "#5b6b82",
          subtle: "#94a3b8",
        },
        // Teal assombri pour rester lisible sur fond blanc.
        accent: {
          DEFAULT: "#0d9488",
          dim: "#0f766e",
          soft: "#ccfbf1",
          glow: "#14b8a6",
        },
        status: {
          online: "#16a34a",
          warning: "#d97706",
          offline: "#dc2626",
          idle: "#94a3b8",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)",
        "card-hover": "0 2px 4px rgba(15, 23, 42, 0.06), 0 12px 28px rgba(15, 23, 42, 0.10)",
        glow: "0 0 0 3px rgba(13, 148, 136, 0.12)",
        "glow-lg": "0 8px 24px rgba(13, 148, 136, 0.18)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
