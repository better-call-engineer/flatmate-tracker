/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // --- Base surfaces ---
        background: '#080c14',
        surface:    '#0d1220',
        elevated:   '#141927',
        border:     'rgba(255,255,255,0.07)',

        // --- Accents ---
        primary:        '#7c3aed',
        'primary-light':'#1e1040',
        'primary-dark': '#5b21b6',
        cyan:           '#06b6d4',
        'cyan-light':   '#0c2a33',

        // --- Semantic ---
        positive:          '#10b981',
        'positive-light':  '#0d2e24',
        negative:          '#f43f5e',
        'negative-light':  '#2d0e17',
        pending:           '#f59e0b',
        'pending-light':   '#2a1d07',
        active:            '#10b981',
        'active-light':    '#0d2e24',
        muted:             '#64748b',
        'muted-light':     '#0f1724',

        // --- Text ---
        text: {
          primary:   '#f1f5f9',
          secondary: '#94a3b8',
          muted:     '#475569',
        },

        // --- Card (alias) ---
        card: '#0d1220',
      },

      fontFamily: {
        sans:    ['Space Grotesk', 'system-ui', 'sans-serif'],
        grotesk: ['Space Grotesk', 'sans-serif'],
      },

      boxShadow: {
        // Bento card glow effects
        'bento':       '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.5)',
        'bento-hover': '0 0 0 1px rgba(124,58,237,0.35), 0 8px 32px rgba(124,58,237,0.15), 0 4px 16px rgba(0,0,0,0.6)',
        'bento-cyan':  '0 0 0 1px rgba(6,182,212,0.35), 0 8px 32px rgba(6,182,212,0.15)',
        'bento-emerald':'0 0 0 1px rgba(16,185,129,0.35), 0 8px 32px rgba(16,185,129,0.12)',

        // Glow pulses
        'glow-violet': '0 0 20px rgba(124,58,237,0.5), 0 0 60px rgba(124,58,237,0.2)',
        'glow-cyan':   '0 0 20px rgba(6,182,212,0.5), 0 0 60px rgba(6,182,212,0.2)',
        'glow-emerald':'0 0 20px rgba(16,185,129,0.5), 0 0 60px rgba(16,185,129,0.2)',
        'glow-rose':   '0 0 20px rgba(244,63,94,0.5)',

        // Aliases
        card:          '0 0 0 1px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.5)',
        'card-hover':  '0 0 0 1px rgba(124,58,237,0.35), 0 8px 32px rgba(124,58,237,0.15)',
        'card-lg':     '0 10px 40px rgba(0,0,0,0.7)',
        fab:           '0 4px 20px rgba(124,58,237,0.6)',
      },

      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.35s ease-out',
        'pulse-soft': 'pulseSoft 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
        shimmer:      'shimmer 2s linear infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float':      'float 6s ease-in-out infinite',
        'scan':       'scan 4s linear infinite',
        'border-glow':'borderGlow 2s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.65' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.7', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.02)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(124,58,237,0.3)' },
          '50%':      { borderColor: 'rgba(124,58,237,0.8)' },
        },
      },

      borderRadius: {
        xl:   '0.875rem',
        '2xl':'1.125rem',
        '3xl':'1.5rem',
      },
    },
  },
  plugins: [],
};
