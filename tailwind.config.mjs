/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        // پوسته‌ی برند آرکان گلد — استخراج‌شده از هویت بصری فعلی سایت
        cream: {
          DEFAULT: '#F2EFE9', // پس‌زمینه‌ی گرم و خنثیِ صفحه
          50: '#FAF9F6',
          100: '#F2EFE9',
          200: '#E9E4DB',
        },
        gold: {
          DEFAULT: '#B4863B', // طلایی اصلی برند (دکمه‌ها، لوگو، تیترها)
          50: '#F7EFDD',
          100: '#EEDCAF',
          300: '#D2A85C',
          400: '#B4863B',
          500: '#96702F',
          600: '#7A5A26',
        },
        maroon: {
          DEFAULT: '#4A1015', // زرشکی/شرابیِ تیره — پنل «درباره ما» و فوتر
          50: '#F4E6E7',
          400: '#6B1A21',
          500: '#4A1015',
          600: '#38070B',
          700: '#26050A',
        },
        ink: {
          DEFAULT: '#2A2420', // متن اصلی، قهوه‌ای-مشکیِ گرم
          soft: '#5C5449',
        },
      },
      fontFamily: {
        // فونت واحد فارسی با طیف وزن‌ها برای سلسله‌مراتب تایپوگرافی
        sans: ['Vazirmatn', 'Tahoma', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 8px 30px -12px rgba(74,16,21,0.18)',
      },
      maxWidth: {
        content: '1360px',
      },
    },
  },
  plugins: [],
};
