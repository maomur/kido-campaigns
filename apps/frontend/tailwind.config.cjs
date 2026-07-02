const colors = require('tailwindcss/colors');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    // En este monorepo (npm workspaces) @tremor/react queda hoisted al
    // node_modules de la raiz, no al de apps/frontend.
    '../../node_modules/@tremor/**/*.{js,jsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tremor: {
          brand: {
            faint: colors.blue[50],
            muted: colors.blue[200],
            subtle: colors.blue[400],
            DEFAULT: colors.blue[600],
            emphasis: colors.blue[700],
            inverted: colors.white,
          },
          background: {
            muted: colors.gray[50],
            subtle: colors.gray[100],
            DEFAULT: colors.white,
            emphasis: colors.gray[700],
          },
          border: {
            DEFAULT: colors.gray[200],
          },
          ring: {
            DEFAULT: colors.gray[200],
          },
          content: {
            subtle: colors.gray[400],
            DEFAULT: colors.gray[500],
            emphasis: colors.gray[700],
            strong: colors.gray[900],
            inverted: colors.white,
          },
        },
      },
    },
  },
  safelist: [
    {
      // Tremor construye algunas clases de color dinamicamente (ej.
      // `fill-${color}-500` en DonutChart/BarChart), por lo que el scan
      // estatico de contenido de Tailwind no las detecta solo. "fill" y
      // "stroke" son imprescindibles para que los graficos SVG se pinten.
      pattern:
        /^(bg|text|border|ring|fill|stroke)-(blue|emerald|violet|amber|gray|rose|cyan|indigo|pink|orange|lime|teal|sky|fuchsia)-(50|100|200|300|400|500|600|700|800|900)$/,
      variants: ['hover', 'dark'],
    },
  ],
  plugins: [],
};
