/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'bg-green-100',
    'text-green-700',
    'border-green-200',
    'bg-red-100',
    'text-red-700',
    'border-red-200',
  ]
}
