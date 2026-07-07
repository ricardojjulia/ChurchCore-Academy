import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--sis-border-hsl) / <alpha-value>)",
        input: "hsl(var(--sis-border-hsl) / <alpha-value>)",
        ring: "hsl(var(--sis-primary-hsl) / <alpha-value>)",
        background: "hsl(var(--sis-bg-canvas-hsl) / <alpha-value>)",
        foreground: "hsl(var(--sis-text-primary-hsl) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--sis-primary-hsl) / <alpha-value>)",
          foreground: "hsl(var(--sis-surface-hsl) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--sis-secondary-light-hsl) / <alpha-value>)",
          foreground: "hsl(var(--sis-text-primary-hsl) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--sis-secondary-light-hsl) / <alpha-value>)",
          foreground: "hsl(var(--sis-text-secondary-hsl) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--sis-primary-hsl) / <alpha-value>)",
          foreground: "hsl(var(--sis-surface-hsl) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--sis-error-hsl) / <alpha-value>)",
          foreground: "hsl(var(--sis-surface-hsl) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--sis-surface-hsl) / <alpha-value>)",
          foreground: "hsl(var(--sis-text-primary-hsl) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--sis-surface-hsl) / <alpha-value>)",
          foreground: "hsl(var(--sis-text-primary-hsl) / <alpha-value>)",
        },
        sis: {
          primary: "var(--sis-primary)",
          "primary-dark": "var(--sis-primary-dark)",
          secondary: "var(--sis-secondary)",
          warning: "var(--sis-warning)",
          error: "var(--sis-error)",
          canvas: "var(--sis-bg-canvas)",
          surface: "var(--sis-surface)",
          border: "var(--sis-border)",
          "text-primary": "var(--sis-text-primary)",
          "text-secondary": "var(--sis-text-secondary)",
        },
      },
      borderRadius: {
        "2xl": "calc(var(--sis-radius-md) * 2)",
        "xl": "calc(var(--sis-radius-md) * 1.5)",
        "lg": "calc(var(--sis-radius-md) * 1.25)",
        "md": "var(--sis-radius-md)",
        "sm": "var(--sis-radius-sm)",
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
        sm: "var(--sis-shadow-elev)",
        academy: "var(--shadow-card)",
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
