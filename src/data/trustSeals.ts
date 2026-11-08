/**
 * نمادها و مجوزهای فوتر سایت (src/components/TrustSeals.astro)
 * ----------------------------------------------------
 * اضافه کردن تصویر هر نماد: فایل تصویر را با نام id همان نماد در پوشه‌ی src/assets/trust/ بگذارید
 * (png، jpg، webp یا svg)، مثلا src/assets/trust/gold-union.png — بدون تغییر کد نمایش داده می‌شود.
 * تا وقتی تصویر نباشد، یک کادر با آیکون و نام نماد نمایش داده می‌شود.
 * href (اختیاری): لینک صفحه‌ی استعلام/مجوز روی سایت صادرکننده.
 *
 * نماد اعتماد الکترونیکی (اینماد) جداگانه از PUBLIC_ENAMAD_ID و PUBLIC_ENAMAD_CODE ساخته می‌شود
 * (کد رسمی اینماد)؛ اگر خالی باشند، مثل بقیه از تصویر src/assets/trust/enamad.* یا کادر جایگزین استفاده می‌شود.
 */
export interface TrustSeal {
  id: string;
  label: string;
  href?: string;
}

export const trustSeals: TrustSeal[] = [
  { id: 'enamad', label: 'نماد اعتماد الکترونیکی' },
  { id: 'virtual-business-union', label: 'اتحادیه کسب‌وکارهای مجازی' },
  { id: 'gold-union', label: 'اتحادیه طلا و جواهر' },
  { id: 'fintech', label: 'انجمن فین‌تک' },
  { id: 'central-bank', label: 'بانک مرکزی' },
];
