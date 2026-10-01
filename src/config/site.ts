/**
 * تنظیمات مرکزی سایت آرکان گلد
 * ----------------------------------------------------
 * هر عددی که در چند جای سایت تکرار می‌شود (کارمزد، عیار، آدرس اپ و API ها)
 * فقط از همین فایل خوانده می‌شود تا تغییر آن در یک نقطه انجام شود.
 */

/** آدرس اپلیکیشن / نسخه تحت وب — تمام دکمه‌های ورود، ثبت‌نام و معامله به اینجا می‌روند */
export const APP_URL = 'https://app.arkan.gold';

/** کارمزد خرید و فروش طلای آب‌شده و محصولات فروشگاه (درصد) */
export const TRADE_FEE_PERCENT = 0.5;

/** عیار تمام شمش‌های آرکان گلد (۷۵۰ = طلای ۱۸ عیار) */
export const BAR_PURITY = 750;

/** شماره پشتیبانی تلفنی */
export const SUPPORT_PHONE = '02198765431';
export const SUPPORT_PHONE_FA = '۰۲۱۹۸۷۶۵۴۳۱';

/**
 * API اصلی آرکان گلد — قیمت لحظه‌ای طلا، تاریخچه‌ی قیمت و محصولات فروشگاه (شمش طلا)
 * همگی از همین آدرس خوانده می‌شوند:
 *   GET {ARKAN_API_URL}/market/price
 *   GET {ARKAN_API_URL}/market/price/history?hours=24
 *   GET {ARKAN_API_URL}/public/gold-ingots?page=1&limit=50&inStock=true
 *   GET {ARKAN_API_URL}/public/gold-ingots/{slug}
 * با متغیر محیطی PUBLIC_ARKAN_API_URL قابل تغییر است.
 */
export const ARKAN_API_URL: string = (import.meta.env.PUBLIC_ARKAN_API_URL || 'https://api.arkan.gold').replace(/\/$/, '');

/**
 * API استعلام اصالت شمش (افزونه‌ی وردپرس wordpress/arkan-bar-verify/).
 * کد ۶ رقمی هولوگرام به‌صورت query ارسال می‌شود:
 *   GET {VERIFY_API_URL}?code=123456
 * با متغیر محیطی PUBLIC_VERIFY_API_URL قابل تغییر است.
 */
export const VERIFY_API_URL: string =
  import.meta.env.PUBLIC_VERIFY_API_URL || 'https://arkan.gold/mag/wp-json/arkan/v1/verify-bar';

/** فرمت فارسی درصد کارمزد، مثلا «۰٫۵» */
export const TRADE_FEE_LABEL = TRADE_FEE_PERCENT.toLocaleString('fa-IR');
