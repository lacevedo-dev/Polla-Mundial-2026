/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                lime: {
                    50: '#f0fdf4',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#3EE93E', // Brand Secondary (Main)
                    500: '#32D832', // Hover
                    600: '#16a34a',
                    700: '#15803d',
                },
                purple: {
                    500: '#7B2CBF', // Brand Accent 1
                    600: '#6a25a6',
                    100: '#f3e8ff',
                },
                rose: {
                    500: '#E63946', // Brand Accent 2
                    400: '#f87171',
                    50: '#fff1f2',
                },
                cyan: {
                    400: '#00B4D8', // Brand Accent 3
                    500: '#0096B4',
                    50: '#ecfeff',
                },
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                brand: ['Montserrat', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
