/**
 * Centralized Theme Configuration
 * ------------------------------------------------------------------
 * This is the SINGLE SOURCE OF TRUTH for the platform's visual identity.
 *
 *   - tailwind.config.js `require()`s this file to generate utility
 *     classes (bg-surface-card, text-brand-primary, rounded-card, etc).
 *   - index.css reads the same tokens via Tailwind's theme() function,
 *     so no colors are hard-coded twice.
 *   - Chart components (Recharts) import this file directly for hex
 *     values, since SVG/canvas rendering needs real color strings
 *     rather than CSS classes.
 *
 * TO RESTYLE THE ENTIRE PLATFORM: edit the values below and restart
 * the dev server. Every dashboard, card, chart, and badge updates
 * automatically because they all consume these tokens rather than
 * hard-coded hex values.
 * ------------------------------------------------------------------
 */

const theme = {
  colors: {
    // Base surfaces - deep control-room navy rather than default white/grey.
    surface: {
      base: '#0A0E1A', // page background
      card: '#10162A', // standard card background
      elevated: '#161D35', // raised panels / modals / active nav
      sunken: '#080B14', // recessed wells (chart backgrounds)
    },
    border: {
      DEFAULT: '#232B45',
      muted: '#1A2138',
      strong: '#323C5E',
    },
    text: {
      primary: '#E8EBF5',
      secondary: '#8892B0',
      muted: '#5B6584',
      inverted: '#0A0E1A',
    },
    brand: {
      primary: '#F5A623', // amber - energy / electricity identity
      primaryMuted: '#3A2E14',
      secondary: '#22D3B8', // teal - water / cooling systems
      secondaryMuted: '#123531',
      accent: '#7C8CF8', // indigo - agent / AI intelligence identity
      accentMuted: '#211F45',
    },
    status: {
      success: '#34D399',
      successMuted: '#0F2B23',
      warning: '#FBBF24',
      warningMuted: '#332708',
      critical: '#F87171',
      criticalMuted: '#3A1518',
      info: '#60A5FA',
      infoMuted: '#122238',
    },
    chart: {
      // Ordered palette for multi-series charts (line/donut/bar).
      series: ['#F5A623', '#22D3B8', '#7C8CF8', '#F87171', '#60A5FA', '#34D399'],
      grid: '#1A2138',
      axis: '#5B6584',
    },
  },

  typography: {
    fontFamily: {
      heading: ['Sora', 'system-ui', 'sans-serif'],
      body: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
    },
    // Type scale (px) - used directly by Tailwind's fontSize theme key.
    scale: {
      xs: '0.75rem',
      sm: '0.8125rem',
      base: '0.9375rem',
      md: '1.0625rem',
      lg: '1.25rem',
      xl: '1.625rem',
      '2xl': '2.25rem',
      '3xl': '3rem',
    },
  },

  radius: {
    sm: '6px', // badges, pills, chips
    md: '10px', // buttons, inputs, small controls
    card: '12px', // KPI cards
    panel: '16px', // large containers / chart panels
    full: '999px',
  },

  shadow: {
    // Deliberately avoid the generic soft-grey drop shadow. Panels are
    // separated by border + a faint top highlight; "live" elements get
    // a colored glow instead of elevation shadow.
    panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 0 0 1px rgba(255,255,255,0.02)',
    glowAmber: '0 0 0 1px rgba(245,166,35,0.35), 0 0 20px -4px rgba(245,166,35,0.35)',
    glowTeal: '0 0 0 1px rgba(34,211,184,0.35), 0 0 20px -4px rgba(34,211,184,0.35)',
    glowCritical: '0 0 0 1px rgba(248,113,113,0.4), 0 0 20px -4px rgba(248,113,113,0.4)',
  },

  spacing: {
    cardPadding: '1.25rem',
    panelPadding: '1.5rem',
    gridGap: '1.25rem',
  },
};

export { theme };
export default theme;
