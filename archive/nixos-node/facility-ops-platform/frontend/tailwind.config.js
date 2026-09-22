const theme = require('./src/styles/theme.js');

/**
 * Tailwind is configured entirely from src/styles/theme.js. Do not add
 * one-off hex values or font names directly in this file - add them to
 * theme.js instead, so every consumer (Tailwind classes, index.css via
 * theme(), and chart components importing theme.js directly) stays in sync.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: theme.colors.surface,
        border: theme.colors.border,
        text: theme.colors.text,
        brand: theme.colors.brand,
        status: theme.colors.status,
      },
      fontFamily: theme.typography.fontFamily,
      fontSize: theme.typography.scale,
      borderRadius: {
        sm: theme.radius.sm,
        md: theme.radius.md,
        card: theme.radius.card,
        panel: theme.radius.panel,
        full: theme.radius.full,
      },
      boxShadow: {
        panel: theme.shadow.panel,
        glowAmber: theme.shadow.glowAmber,
        glowTeal: theme.shadow.glowTeal,
        glowCritical: theme.shadow.glowCritical,
      },
      spacing: {
        card: theme.spacing.cardPadding,
        panel: theme.spacing.panelPadding,
      },
      gap: {
        grid: theme.spacing.gridGap,
      },
    },
  },
  plugins: [],
};
