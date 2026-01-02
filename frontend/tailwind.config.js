/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"], // Activa el modo oscuro manual
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        
        // --- NUESTRA PALETA "EMERALD ORCHESTRATOR" ---
        emerald: {
          DEFAULT: "#10B981", 
          glow: "#34D399",    // Verde neón para brillos
          950: "#022c22",     // Fondo profundo
        },
        ruby: {
          DEFAULT: "#E11D48", // Rojo Dorothy (Error)
          glow: "#FB7185",
        },
        gold: {
          DEFAULT: "#F59E0B", // Amarillo Camino (Warning)
          glow: "#FCD34D",
        },
        
        // Reemplazamos el 'primary' de shadcn para que sea nuestro Emerald
        primary: {
          DEFAULT: "#10B981",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#27272a", // Zinc-800
          foreground: "#ffffff",
        },
        destructive: {
          DEFAULT: "#E11D48", // Ruby
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#27272a", // Zinc-800
          foreground: "#a1a1aa", // Zinc-400
        },
        accent: {
          DEFAULT: "#27272a",
          foreground: "#ffffff",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'loading': 'loading 1.5s ease-in-out infinite',
      },
      keyframes: {
        loading: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        }
      }
    },
  },
  plugins: [
    require("tailwindcss-animate") // Necesario para Shadcn
  ],
}