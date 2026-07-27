/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--sw-bg)",
        "bg-2": "var(--sw-bg-2)",
        surface: "var(--sw-surface)",
        "surface-raised": "var(--sw-surface-raised)",
        border: "var(--sw-border)",
        "border-strong": "var(--sw-border-strong)",
        text: "var(--sw-text)",
        muted: "var(--sw-text-muted)",
        violet: "var(--sw-violet)",
        blue: "var(--sw-blue)",
        accent: "var(--sw-accent)",
        "accent-hover": "var(--sw-accent-hover)",
        "accent-fg": "var(--sw-accent-fg)",
        danger: "var(--sw-danger)",
        "danger-soft": "var(--sw-danger-soft)",
        success: "var(--sw-success)",
        "success-soft": "var(--sw-success-soft)",
        info: "var(--sw-info)",
        "info-soft": "var(--sw-info-soft)",
        warning: "var(--sw-warning)",
        "warning-soft": "var(--sw-warning-soft)",
      },
      backgroundImage: {
        brand: "var(--sw-gradient)",
        "brand-soft": "var(--sw-gradient-soft)",
      },
      boxShadow: {
        sw: "var(--sw-shadow)",
        glow: "var(--sw-glow)",
      },
      borderRadius: {
        sw: "var(--sw-radius)",
        "sw-lg": "var(--sw-radius-lg)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "translate(-50%, -48%) scale(0.96)" },
          to: { opacity: "1", transform: "translate(-50%, -50%) scale(1)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "dropdown-in": {
          from: { opacity: "0", transform: "translateY(-6px) scale(0.97)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "scale-in": "scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        "slide-in": "slide-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "dropdown-in": "dropdown-in 150ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
