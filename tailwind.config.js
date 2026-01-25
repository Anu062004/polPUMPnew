/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Gaming & enhanced colors
        "neon-green": "#00FF88",
        "neon-red": "#FF3366",
        "neon-gold": "#FFD700",
        "neon-purple": "#8C52FF",
        "neon-cyan": "#00D1FF",
        "neon-pink": "#FF4F84",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "glow-sm": "0 0 10px rgba(255, 79, 132, 0.3)",
        "glow-md": "0 0 20px rgba(255, 79, 132, 0.4)",
        "glow-lg": "0 0 40px rgba(255, 79, 132, 0.5)",
        "glow-purple": "0 0 30px rgba(140, 82, 255, 0.5)",
        "glow-cyan": "0 0 30px rgba(18, 217, 200, 0.5)",
        "glow-green": "0 0 30px rgba(0, 255, 136, 0.5)",
        "glow-red": "0 0 30px rgba(255, 51, 102, 0.5)",
        "glass": "0 8px 32px rgba(0, 0, 0, 0.3)",
        "glass-hover": "0 12px 40px rgba(255, 79, 132, 0.25)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(255, 79, 132, 0.4)" },
          "50%": { boxShadow: "0 0 40px rgba(255, 79, 132, 0.8)" },
        },
        "number-tick": {
          "0%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-2px)" },
          "100%": { transform: "translateY(0)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        "confetti": {
          "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(-100vh) rotate(720deg)", opacity: "0" },
        },
        "countdown-pulse": {
          "0%, 100%": { transform: "scale(1)", color: "inherit" },
          "50%": { transform: "scale(1.1)", color: "#FF3366" },
        },
        "win-glow": {
          "0%": { boxShadow: "0 0 0 rgba(0, 255, 136, 0)" },
          "50%": { boxShadow: "0 0 60px rgba(0, 255, 136, 0.8)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 255, 136, 0.4)" },
        },
        "lose-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%": { transform: "translateX(-5px) rotate(-1deg)" },
          "75%": { transform: "translateX(5px) rotate(1deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "number-tick": "number-tick 0.3s ease-out",
        "float": "float 3s ease-in-out infinite",
        "scale-in": "scale-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "shake": "shake 0.5s ease-in-out",
        "confetti": "confetti 1s ease-out forwards",
        "countdown-pulse": "countdown-pulse 1s ease-in-out infinite",
        "win-glow": "win-glow 0.6s ease-out",
        "lose-shake": "lose-shake 0.4s ease-in-out",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

