import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'mobile-landscape': {
          raw: '(orientation: landscape) and (max-height: 700px)',
        },
      },
      fontFamily: {
        primary: ['Inter', ...defaultTheme.fontFamily.sans],
        // 书名/小节标题用的"书卷"衬线：拉丁走 Georgia，中文依次落到宋体系。
        book: [
          'Georgia',
          '"Songti SC"',
          '"Noto Serif CJK SC"',
          '"Noto Serif SC"',
          'STSong',
          'SimSun',
          ...defaultTheme.fontFamily.serif,
        ],
      },
      colors: {
        // 漫画 / 小说专属的"暖纸书库"色板：浅色为纸，深色为墨，强调为赭石。
        // 这里刻意不复用 bg-white / bg-gray-*，因为管理端主题层会对那些类名做
        // !important 覆盖；书库区自成一套色板，不参与全站主题替换。
        library: {
          paper: '#f5f0e6',
          card: '#fdfbf6',
          edge: '#e6dccb',
          ink: '#2a241d',
          muted: '#7b6f5f',
          // 封面覆盖层上的纯白（角标文字、图标）。永远是纯白，不随明暗模式走——
          // 它压在封面图上，换成墨色反而会糊进画面。必须是自有令牌而非 bg-white /
          // text-white，否则会被管理端主题层的 [class*="bg-white"] !important 染掉。
          chip: '#ffffff',
          ochre: '#a8611f',
          'ochre-hover': '#8c5017',
          'ochre-tint': '#f2e5d0',
          night: '#13100d',
          'night-card': '#1e1a15',
          'night-edge': '#37302a',
          'night-ink': '#ece3d5',
          'night-muted': '#9c9083',
          'night-ochre': '#d9924a',
          'night-ochre-tint': '#3a2a17',
        },
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        dark: '#222222',
      },
      keyframes: {
        flicker: {
          '0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100%': {
            opacity: '0.99',
            filter:
              'drop-shadow(0 0 1px rgba(252, 211, 77)) drop-shadow(0 0 15px rgba(245, 158, 11)) drop-shadow(0 0 1px rgba(252, 211, 77))',
          },
          '20%, 21.999%, 63%, 63.999%, 65%, 69.999%': {
            opacity: '0.4',
            filter: 'none',
          },
        },
        shimmer: {
          '0%': {
            backgroundPosition: '-700px 0',
          },
          '100%': {
            backgroundPosition: '700px 0',
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInFromRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        flicker: 'flicker 3s linear infinite',
        shimmer: 'shimmer 1.3s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-in-out',
        'slide-down': 'slideDown 0.3s ease-in-out',
        'slide-in-from-right': 'slideInFromRight 0.3s ease-out',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
} satisfies Config;

export default config;
