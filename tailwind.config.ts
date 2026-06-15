import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(220 13% 91%)",
        input: "hsl(220 13% 91%)",
        ring: "hsl(220 65% 32%)",
        background: "hsl(210 40% 98%)",
        foreground: "hsl(220 20% 10%)",
        primary: {
          DEFAULT: "hsl(220 65% 32%)",
          foreground: "hsl(0 0% 98%)",
        },
        secondary: {
          DEFAULT: "hsl(220 14% 95%)",
          foreground: "hsl(220 20% 10%)",
        },
        muted: {
          DEFAULT: "hsl(220 14% 95%)",
          foreground: "hsl(220 10% 46%)",
        },
        accent: {
          DEFAULT: "hsl(220 65% 32%)",
          foreground: "hsl(0 0% 98%)",
        },
        destructive: {
          DEFAULT: "hsl(0 72% 51%)",
          foreground: "hsl(0 0% 98%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(220 20% 10%)",
        },
        popover: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(220 20% 10%)",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "xl": "0.75rem",
        "lg": "0.625rem",
        "md": "0.375rem",
      },
      fontFamily: {
        sans: ["'Inter'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "3xl": ["30px", { lineHeight: "1.2", fontWeight: "800" }],
        "2xl": ["24px", { lineHeight: "1.2", fontWeight: "800" }],
        "xl": ["20px", { lineHeight: "1.2", fontWeight: "700" }],
        "lg": ["18px", { lineHeight: "1.3", fontWeight: "600" }],
        "base": ["16px", { lineHeight: "1.4", fontWeight: "400" }],
        "sm": ["14px", { lineHeight: "1.4", fontWeight: "400" }],
        "xs": ["12px", { lineHeight: "1.4", fontWeight: "400" }],
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};

export default config;
