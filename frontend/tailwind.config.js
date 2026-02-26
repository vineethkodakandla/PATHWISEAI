/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        pw: {
          bg:        '#050d1a',
          surface:   '#0a1628',
          card:      '#0d1932',
          cyan:      '#00d4ff',
          purple:    '#7c3aed',
          green:     '#00ff88',
          orange:    '#ff8c00',
          red:       '#ff2d55',
          text:      '#e8f4f8',
          muted:     '#7a9bb5',
          border:    'rgba(0,212,255,0.12)',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 4s ease-in-out infinite',
        'slide-up': 'slideInUp 0.4s ease-out',
        'fade-scale': 'fadeInScale 0.3s ease-out',
        'gradient': 'gradient-shift 4s ease infinite',
        'network-pulse': 'networkPulse 2s ease-in-out infinite',
        'orb-drift': 'orb-drift 12s ease-in-out infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0, 212, 255, 0.4)',
        'glow-green': '0 0 20px rgba(0, 255, 136, 0.4)',
        'glow-purple': '0 0 20px rgba(124, 58, 237, 0.4)',
        'glow-orange': '0 0 20px rgba(255, 140, 0, 0.4)',
        'card': '0 8px 32px rgba(0,0,0,0.4)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};
