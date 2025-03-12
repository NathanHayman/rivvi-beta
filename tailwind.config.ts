import type { Config } from "tailwindcss";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const svgToDataUri = require("mini-svg-data-uri");

const {
  default: flattenColorPalette,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
} = require("tailwindcss/lib/util/flattenColorPalette");

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    // Add color classes that might be used dynamically
    {
      pattern:
        /(bg|text|border|fill|stroke|ring|from|via|to|shadow)-(rivvi-purple|rivvi-orange|rivvi-lavender|rivvi-neutral|rivvi-cream|rivvi-peach|rivvi-teal|rivvi-light|rivvi-dark)-(50|100|200|300|400|500|600|700|800|900|950)/,
    },
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        heading: ["var(--font-heading)"],
      },
      colors: {
        gray: 'generateScale({ name: "gray" })',
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
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
          "6": "hsl(var(--chart-6))",
          "7": "hsl(var(--chart-7))",
          "8": "hsl(var(--chart-8))",
          "9": "hsl(var(--chart-9))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Rivvi Brand Colors
        // Purple/Blue scale (11 shades from the SVG)
        "rivvi-purple": {
          50: "#EEF1FF",
          100: "#DFE6FF",
          200: "#C6CEFF",
          300: "#A3AFFE",
          400: "#7E83FB",
          500: "#5955F4",
          600: "#5342E9",
          700: "#4734CE",
          800: "#3A2DA6",
          900: "#332C83",
          950: "#1F1A4C",
        },

        // Orange/Coral scale (11 shades from the SVG)
        "rivvi-orange": {
          50: "#FFF3ED",
          100: "#FFE5D5",
          200: "#FFE5D5", // Duplicate in SVG, kept as is
          300: "#FEC6AA",
          400: "#FD9F74",
          500: "#FB7649",
          600: "#FB7649", // Duplicate in SVG, kept as is
          700: "#FB7649", // Duplicate in SVG, kept as is
          800: "#FB7649", // Duplicate in SVG, kept as is
          900: "#FB7649", // Duplicate in SVG, kept as is
          950: "#FB7649", // Duplicate in SVG, kept as is
        },

        // Lavender/Purple accent
        "rivvi-lavender": {
          50: "#F9F5FC",
          100: "#F4EBF9",
          200: "#E8D5F3",
          300: "#D9BBE9",
          400: "#C597E2",
          500: "#B173D8",
          600: "#9D4FCF",
          700: "#8A3BBD",
          800: "#7730A0",
          900: "#632883",
          950: "#4F1F6A",
        },

        // Neutral/Gray
        "rivvi-neutral": {
          50: "#F4EFF6",
          100: "#EDE6F0",
          200: "#E6DDE9",
          300: "#D6CEDD",
          400: "#C6BED1",
          500: "#B6AEC5",
          600: "#A69EB9",
          700: "#968EAD",
          800: "#867EA1",
          900: "#766E95",
          950: "#5D5675",
        },

        // Cream/Beige
        "rivvi-cream": {
          50: "#FDFCF7",
          100: "#F9F7EF",
          200: "#F6F4E8",
          300: "#F3F0E0",
          400: "#F0ECD8",
          500: "#F0E8D3",
          600: "#E8DCBA",
          700: "#DFD0A1",
          800: "#D6C488",
          900: "#CDB86F",
          950: "#BFA64F",
        },

        // Peach/Skin
        "rivvi-peach": {
          50: "#FEF3ED",
          100: "#FBE7E0",
          200: "#F8DBD3",
          300: "#F2CFC6",
          400: "#E5CBCA",
          500: "#D8B7B6",
          600: "#CBA3A2",
          700: "#BE8F8E",
          800: "#B17B7A",
          900: "#A46766",
          950: "#8A5352",
        },

        // Blue/Teal
        "rivvi-teal": {
          50: "#F0F7FA",
          100: "#E1F0F5",
          200: "#D1E5EC",
          300: "#B3D6E2",
          400: "#95C7D8",
          500: "#77B8CE",
          600: "#59A9C4",
          700: "#3B9ABA",
          800: "#2D7A94",
          900: "#1F5A6E",
          950: "#11394A",
        },

        // Light (white-ish)
        "rivvi-light": {
          50: "#FFFFFF",
          100: "#FAFAFA",
          200: "#F5F5F5",
          300: "#F0F0F0",
          400: "#E8E8E8",
          500: "#E0E0E0",
          600: "#D0D0D0",
          700: "#C0C0C0",
          800: "#B0B0B0",
          900: "#A0A0A0",
          950: "#909090",
        },

        // Dark (black-ish)
        "rivvi-dark": {
          50: "#808080",
          100: "#707070",
          200: "#606060",
          300: "#505050",
          400: "#404040",
          500: "#303030",
          600: "#252525",
          700: "#1A1A1A",
          800: "#121212",
          900: "#0A0A0A",
          950: "#000000",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "scale-in": {
          "0%": {
            transform: "scale(0.95)",
          },
          "100%": {
            transform: "scale(1)",
          },
        },
        "fade-in": {
          "0%": {
            opacity: "0",
          },
          "100%": {
            opacity: "1",
          },
        },
        "scale-in-fade": {
          "0%": {
            transform: "scale(0.95)",
            opacity: "0",
          },
          "100%": {
            transform: "scale(1)",
            opacity: "1",
          },
        },
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "logo-carousel": {
          from: {
            transform: "translateX(0)",
          },
          to: {
            transform: "translateX(calc(-100% - 2rem))",
          },
        },
        "border-beam": {
          "100%": {
            "offset-distance": "100%",
          },
        },
        meteor: {
          "0%": {
            transform: "rotate(215deg) translateX(0)",
            opacity: "1",
          },
          "70%": {
            opacity: "1",
          },
          "100%": {
            transform: "rotate(215deg) translateX(-500px)",
            opacity: "0",
          },
        },
        "shiny-text": {
          "0%, 90%, 100%": {
            "background-position": "calc(-100% - var(--shiny-width)) 0",
          },
          "30%, 60%": {
            "background-position": "calc(100% + var(--shiny-width)) 0",
          },
        },
        gradient: {
          to: {
            backgroundPosition: "var(--bg-size) 0",
          },
        },
        ripple: {
          "0%, 100%": {
            transform: "translate(-50%, -50%) scale(1)",
          },
          "50%": {
            transform: "translate(-50%, -50%) scale(0.9)",
          },
        },
        hide: {
          from: {
            opacity: "1",
          },
          to: {
            opacity: "0",
          },
        },
        slideDownAndFade: {
          from: {
            opacity: "0",
            transform: "translateY(-6px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        slideLeftAndFade: {
          from: {
            opacity: "0",
            transform: "translateX(6px)",
          },
          to: {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        slideUpAndFade: {
          from: {
            opacity: "0",
            transform: "translateY(6px)",
          },
          to: {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        slideRightAndFade: {
          from: {
            opacity: "0",
            transform: "translateX(-6px)",
          },
          to: {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        accordionOpen: {
          from: {
            height: "0px",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        accordionClose: {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0px",
          },
        },
        dialogOverlayShow: {
          from: {
            opacity: "0",
          },
          to: {
            opacity: "1",
          },
        },
        dialogContentShow: {
          from: {
            opacity: "0",
            transform: "translate(-50%, -45%) scale(0.95)",
          },
          to: {
            opacity: "1",
            transform: "translate(-50%, -50%) scale(1)",
          },
        },
        drawerSlideLeftAndFade: {
          from: {
            opacity: "0",
            transform: "translateX(100%)",
          },
          to: {
            opacity: "1",
            transform: "translateX(0)",
          },
        },
        drawerSlideRightAndFade: {
          from: {
            opacity: "1",
            transform: "translateX(0)",
          },
          to: {
            opacity: "0",
            transform: "translateX(100%)",
          },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 0.2s ease-out forwards",
        "scale-in-fade": "scale-in-fade 0.2s ease-out forwards",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "logo-carousel": "logo-carousel 16s linear infinite",
        "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
        meteor: "meteor 5s linear infinite",
        "shiny-text": "shiny-text 8s infinite",
        gradient: "gradient 8s linear infinite",
        ripple: "ripple var(--duration,2s) ease calc(var(--i, 0)*.2s) infinite",
        hide: "hide 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideDownAndFade:
          "slideDownAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideLeftAndFade:
          "slideLeftAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideUpAndFade: "slideUpAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        slideRightAndFade:
          "slideRightAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        accordionOpen: "accordionOpen 150ms cubic-bezier(0.87, 0, 0.13, 1)",
        accordionClose: "accordionClose 150ms cubic-bezier(0.87, 0, 0.13, 1)",
        dialogOverlayShow:
          "dialogOverlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        dialogContentShow:
          "dialogContentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        drawerSlideLeftAndFade:
          "drawerSlideLeftAndFade 150ms cubic-bezier(0.16, 1, 0.3, 1)",
        drawerSlideRightAndFade: "drawerSlideRightAndFade 150ms ease-in",
      },
      boxShadow: {
        derek:
          "0px 0px 0px 1px rgb(0 0 0 / 0.06), 0px 1px 1px -0.5px rgb(0 0 0 / 0.06), 0px 3px 3px -1.5px rgb(0 0 0 / 0.06), 0px 6px 6px -3px rgb(0 0 0 / 0.06), 0px 12px 12px -6px rgb(0 0 0 / 0.06), 0px 24px 24px -12px rgb(0 0 0 / 0.06)",
        input:
          "`0px 2px 3px -1px rgba(0,0,0,0.1), 0px 1px 0px 0px rgba(25,28,33,0.02), 0px 0px 0px 1px rgba(25,28,33,0.08)`",
      },
    },
  },
  plugins: [
    // Tremor
    require("@tailwindcss/forms"),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("tailwindcss-animate"),
    addVariablesForColors,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function ({ matchUtilities, theme }: any) {
      matchUtilities(
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "bg-grid": (value: any) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="${value}"><path d="M0 .5H31.5V32"/></svg>`,
            )}")`,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "bg-grid-small": (value: any) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="8" height="8" fill="none" stroke="${value}"><path d="M0 .5H31.5V32"/></svg>`,
            )}")`,
          }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "bg-dot": (value: any) => ({
            backgroundImage: `url("${svgToDataUri(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="16" height="16" fill="none"><circle fill="${value}" id="pattern-circle" cx="10" cy="10" r="1.6257413380501518"></circle></svg>`,
            )}")`,
          }),
        },
        {
          values: flattenColorPalette(theme("backgroundColor")),
          type: "color",
        },
      );
    },
  ],
} satisfies Config;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addVariablesForColors({ addBase, theme }: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allColors = flattenColorPalette(theme("colors"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val]),
  );

  addBase({
    ":root": newVars,
  });
}

export default config;
