/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Snowfall bar colors
        'snow-light': 'var(--color-snow-light)',
        'snow-powder': 'var(--color-snow-powder)',
        'snow-mixed': 'var(--color-snow-mixed)',
        // Snow quality colors
        'quality-powder': 'var(--color-quality-powder)',
        'quality-wind': 'var(--color-quality-wind)',
        'quality-packed': 'var(--color-quality-packed)',
        'quality-soft': 'var(--color-quality-soft)',
        'quality-spring': 'var(--color-quality-spring)',
        'quality-icy': 'var(--color-quality-icy)',
        'quality-variable': 'var(--color-quality-variable)',
        // Alert states
        'alert-powder': 'var(--color-alert-powder)',
        'alert-active': 'var(--color-alert-active)',
        // App chrome
        'bg-dark': 'var(--color-bg-dark)',
        'bg-card': 'var(--color-bg-card)',
        'bg-card-hover': 'var(--color-bg-card-hover)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        accent: 'var(--color-accent)',
      },
    },
  },
  plugins: [],
}
