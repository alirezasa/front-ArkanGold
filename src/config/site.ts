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
 * API فروشگاه واقعی (WooCommerce Store API روی وردپرس آرکان گلد).
 * محصولات و دسته‌بندی‌ها در زمان build از این آدرس خوانده می‌شوند؛
 * اگر در دسترس نبود، کاتالوگ پشتیبان src/data/products.ts نمایش داده می‌شود.
 * با متغیر محیطی PUBLIC_SHOP_API_URL قابل تغییر است.
 */
export const SHOP_API_URL: string =
  import.meta.env.PUBLIC_SHOP_API_URL || 'https://arkan.gold/mag/wp-json/wc/store/v1';

/**
 * API استعلام اصالت شمش. سریال (و در صورت وجود کد امنیتی) به‌صورت query ارسال می‌شود:
 *   GET {VERIFY_API_URL}?serial=AG750-...&code=1234
 * پیاده‌سازی سمت وردپرس در wordpress/arkan-bar-verify/ موجود است.
 * با متغیر محیطی PUBLIC_VERIFY_API_URL قابل تغییر است.
 */
export const VERIFY_API_URL: string =
  import.meta.env.PUBLIC_VERIFY_API_URL || 'https://arkan.gold/mag/wp-json/arkan/v1/verify-bar';

/** فرمت فارسی درصد کارمزد، مثلا «۰٫۵» */
export const TRADE_FEE_LABEL = TRADE_FEE_PERCENT.toLocaleString('fa-IR');
