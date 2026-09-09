/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        // پس‌زمینه‌ی خنثی کل صفحات
        canvas: {
          DEFAULT: '#efeff1',
          50: '#fafafb',
          100: '#efeff1',
          200: '#e2e2e5',
        },
        // رنگ اصلی و تنها رنگ برند — همه‌ی پس‌زمینه‌های تیره، دکمه‌ها و متن‌های کلیدی از همین طیف می‌آیند
        brand: {
          DEFAULT: '#330509',
          50: '#f6e7e8',
          100: '#e6c2c5',
          200: '#c98d92',
          300: '#7a171e',
          400: '#4d0a0f',
          500: '#330509',
          600: '#260306',
          700: '#1a0204',
        },
        // طلایی فقط برای جزئیات بسیار کوچک (آیکون، نقطه‌ی تزئینی) — هرگز برای پس‌زمینه یا گرادیان بزرگ
        gold: {
          DEFAULT: '#c5a059',
          50: '#faf5ea',
          100: '#f0e0c0',
          300: '#d8b878',
          400: '#c5a059',
          500: '#a9843f',
          600: '#8a6a30',
        },
        // alias برای سازگاری با کامپوننت‌های قدیمی
        maroon: {
          DEFAULT: '#330509',
          50: '#f6e7e8',
          400: '#4d0a0f',
          500: '#330509',
          600: '#260306',
          700: '#1a0204',
        },
        cream: {
          DEFAULT: '#efeff1',
          50: '#fafafb',
          100: '#efeff1',
          200: '#e2e2e5',
        },
        ink: {
          DEFAULT: '#211a17',
          soft: '#5c5449',
        },
        success: {
          DEFAULT: '#1E7D4F',
          50: '#E8F6EE',
          light: '#4ADE80',
        },
        danger: {
          DEFAULT: '#B4322F',
          50: '#FBEBEA',
          light: '#F87171',
        },
      },
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.8rem', { lineHeight: '1.35rem' }],
        sm: ['0.925rem', { lineHeight: '1.6rem' }],
        base: ['1.05rem', { lineHeight: '1.85rem' }],
        lg: ['1.2rem', { lineHeight: '1.9rem' }],
        xl: ['1.4rem', { lineHeight: '2.05rem' }],
        '2xl': ['1.7rem', { lineHeight: '2.3rem' }],
        '3xl': ['2.1rem', { lineHeight: '2.6rem' }],
        '4xl': ['2.6rem', { lineHeight: '3.1rem' }],
      },
      borderRadius: {
        card: '16px',
        xl2: '22px',
      },
      boxShadow: {
        card: '0 8px 30px -12px rgba(51,5,9,0.18)',
        'card-hover': '0 20px 45px -15px rgba(51,5,9,0.30)',
        // گلوی برند به‌جای گلوی طلایی — برای فوکوس/هاور عمومی
        glow: '0 0 0 1px rgba(51,5,9,0.18), 0 10px 34px -10px rgba(51,5,9,0.45)',
        'glow-brand': '0 10px 40px -12px rgba(51,5,9,0.55)',
        inset: 'inset 0 1px 0 0 rgba(255,255,255,0.6)',
      },
      backgroundImage: {
        // گرادیان تک‌تن از خودِ برند (نه طلایی) برای هاله‌های تزئینی پشت هیرو/آیکون‌ها
        'brand-glow-soft': 'radial-gradient(120% 120% at 20% 15%, rgba(51,5,9,0.10) 0%, rgba(51,5,9,0) 60%)',
        // پس‌زمینه‌ی تیره‌ی یکنواخت (بدون گرادیان چندرنگ) برای فوتر/هدر/پنل‌ها
        'brand-solid': 'linear-gradient(180deg, #330509 0%, #330509 100%)',
        // یک گرادیان بسیار ملایم فقط با تن‌های خودِ برند (برای عمق بصری کم، نه رنگ اضافه)
        'brand-radial': 'radial-gradient(120% 140% at 85% 10%, rgba(77,10,15,0.55) 0%, rgba(51,5,9,0.97) 0%, rgba(26,2,4,1) 100%)',
        // خط جداکننده‌ی ظریف طلایی — فقط برای یک خط نازک تزئینی، نه سطح بزرگ
        'gold-line': 'linear-gradient(90deg, rgba(197,160,89,0) 0%, rgba(197,160,89,0.85) 50%, rgba(197,160,89,0) 100%)',
        shimmer: 'linear-gradient(110deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 70%)',
        // دکمه‌ها و پس‌زمینه‌های اصلی: تک‌تن از برند با کمی روشن/تیره برای حس عمق، بدون رنگ دوم
        'cta-gradient': 'linear-gradient(135deg, #4d0a0f 0%, #330509 60%, #260306 100%)',
      },
      maxWidth: {
        content: '1360px',
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmerMove: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.55 },
        },
        countUp: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        priceTick: {
          '0%': { backgroundColor: 'rgba(51,5,9,0.12)' },
          '100%': { backgroundColor: 'transparent' },
        },
        drawIn: {
          '0%': { strokeDashoffset: '400' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        floaty: 'floaty 5s ease-in-out infinite',
        shimmer: 'shimmerMove 2.6s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2.2s ease-in-out infinite',
        countUp: 'countUp 0.4s ease-out',
        marquee: 'marquee 30s linear infinite',
        priceTick: 'priceTick 1s ease-out',
        drawIn: 'drawIn 1.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};
