/**
 * سیاست ارسال و مرجوعی فروشگاه برای structured data گوگل (Merchant listings)
 * ----------------------------------------------------
 * در schema محصول هر شمش (src/lib/ingotDetail.ts) و schema سازمان (BaseLayout) استفاده می‌شود.
 * اگر شرایط ارسال یا مرجوعی عوض شد، فقط همین فایل را تغییر دهید.
 */

/**
 * ارسال شمش (Merchant listings ← shippingDetails): فقط داخل ایران، ۲ تا ۵ روز کاری.
 * هزینه‌ی ارسال به آدرس کاربر بستگی دارد (تحویل حضوری در دفتر رایگان است)، پس shippingRate عمدا
 * نیامده تا عدد نادرستی به گوگل داده نشود.
 */
export const SHIPPING_DETAILS = {
  '@type': 'OfferShippingDetails',
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IR' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 4, unitCode: 'DAY' },
  },
};

/** مرجوعی (Merchant listings ← hasMerchantReturnPolicy): شمش مرجوع نمی‌شود؛ فقط امکان فروش مجدد به قیمت روز */
export const RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'IR',
  returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
};
