import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        card: "var(--card)",
        well: "var(--well)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        line: "var(--line)",
        accent: "var(--accent)",
        espresso: "var(--espresso)",
        "espresso-ink": "var(--espresso-ink)",
        "ink-faint": "var(--ink-faint)",
        marigold: "var(--marigold)",
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        voice: ["var(--font-voice)"],
        hand: ["var(--font-hand)", "cursive"],
      },
      borderRadius: {
        sheet: "var(--radius-sheet)",
        card: "var(--radius-card)",
        hero: "var(--radius-hero)",
        cover: "var(--radius-cover)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        glass: "var(--glass-shadow)",
        card: "var(--card-shadow)",
        frost: "var(--frost-shadow)",
      },
    },
  },
  plugins: [],
};

export default config;
