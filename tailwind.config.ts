import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#050509",
        graphite: "#101018",
        violetline: "#8b5cf6",
        terminal: "#76f7c7"
      },
      boxShadow: {
        glow: "0 0 48px rgba(139, 92, 246, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
