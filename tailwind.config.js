/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            opacity: {
                '8': '0.08',
                '12': '0.12',
            },
            colors: {
                // LiveLingo brand palette — chosen to feel conversational, energetic,
                // and global; avoiding generic SaaS blue / Duolingo green.
                ink: {
                    DEFAULT: '#14142B',
                    soft: '#4A4759',
                    muted: '#8B879A',
                },
                cream: {
                    DEFAULT: '#FAFAFA',
                    warm: '#FFF9F2',
                },
                indigo: {
                    50: '#EEEFFE',
                    100: '#DCDEFC',
                    400: '#7A7EF0',
                    500: '#5B5FE9',
                    600: '#4347D4',
                    700: '#3437B0',
                },
                coral: {
                    50: '#FFF1ED',
                    400: '#FF9C7C',
                    500: '#FF8A65',
                    600: '#F26845',
                },
                mint: {
                    50: '#EAFBF8',
                    400: '#6FE0D2',
                    500: '#4ECDC4',
                    600: '#34B2A9',
                },
                sun: {
                    50: '#FFF8DB',
                    400: '#FFDF5A',
                    500: '#FFD93D',
                    600: '#E8BF1F',
                },
            },
            fontFamily: {
                display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
                sans: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            fontSize: {
                // Bigger, more confident display sizes
                'display-xl': ['clamp(3.5rem, 8vw, 6.5rem)', {lineHeight: '0.95', letterSpacing: '-0.03em'}],
                'display-lg': ['clamp(2.5rem, 5vw, 4rem)', {lineHeight: '1.02', letterSpacing: '-0.025em'}],
                'display-md': ['clamp(1.75rem, 3vw, 2.5rem)', {lineHeight: '1.1', letterSpacing: '-0.02em'}],
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
            },
            boxShadow: {
                'soft': '0 1px 2px rgba(20,20,43,0.04), 0 8px 24px rgba(20,20,43,0.06)',
                'card': '0 2px 4px rgba(20,20,43,0.04), 0 24px 48px -12px rgba(20,20,43,0.12)',
                'lift': '0 20px 48px -16px rgba(91,95,233,0.32)',
            },
            keyframes: {
                'float-slow': {
                    '0%, 100%': {transform: 'translateY(0px) rotate(0deg)'},
                    '50%': {transform: 'translateY(-12px) rotate(0.5deg)'},
                },
                'float-medium': {
                    '0%, 100%': {transform: 'translateY(0px) rotate(0deg)'},
                    '50%': {transform: 'translateY(-8px) rotate(-0.5deg)'},
                },
                'shimmer': {
                    '0%': {backgroundPosition: '-200% 0'},
                    '100%': {backgroundPosition: '200% 0'},
                },
                'pulse-dot': {
                    '0%, 100%': {opacity: '1', transform: 'scale(1)'},
                    '50%': {opacity: '0.6', transform: 'scale(0.85)'},
                },
            },
            animation: {
                'float-slow': 'float-slow 6s ease-in-out infinite',
                'float-medium': 'float-medium 4.5s ease-in-out infinite',
                'shimmer': 'shimmer 3s linear infinite',
                'pulse-dot': 'pulse-dot 1.6s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}
