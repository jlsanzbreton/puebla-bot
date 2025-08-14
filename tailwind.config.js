/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './app.js',
    './src/**/*.{js,ts,jsx,tsx}',
    './content/**/*.json'
  ],
  theme: {
    extend: {
      colors: {
        brand: '#0a0a0a'
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,.05)'
      },
      borderRadius: {
        xl: '16px'
      }
    }
  },
  plugins: []
}
