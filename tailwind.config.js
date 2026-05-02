/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "bg-dark": "var(--bg-dark)",
        panel: "var(--bg-panel)",
        card: "var(--bg-card)",
        hover: "var(--bg-hover)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        purple: "var(--accent-purple)",
        cyan: "var(--accent-cyan)",
      },
      borderColor: {
        light: "rgba(255, 255, 255, 0.05)",
        "bg-panel": "var(--bg-panel)",
      },
    },
  },
  plugins: [],
};

