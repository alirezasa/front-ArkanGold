/**
 * صفحه‌ی جزئیات شمش — یک منبع مشترک برای HTML و سئو
 * ----------------------------------------------------
 * همین تابع‌ها هم در build (صفحه‌ی ایستای /shop/{slug} برای سئو) و هم در مرورگر
 * (صفحه‌ی /shop/item?slug=... برای شمش‌هایی که بعد از آخرین build اضافه شده‌اند)
 * استفاده می‌شوند تا ظاهر و محتوای صفحه‌ی محصول همیشه یکسان باشد.
 * رفتار تعاملی صفحه (انتخاب وزن، قیمت لحظه‌ای، گالری) در ingotDetailClient.ts است.
 */
import { formatToman } from './goldPrice';
import {
  formatGrams,
  ingotImages,
  ingotWeights,
  karatLabel,
  priceRange,
  sanitizeDescription,
  specValue,
  toNumber,
  weightLabel,
  type GoldIngot,
  type IngotVariant,
} from './goldIngots';
import { esc, ingotDetailPath, safeHref, INGOT_PLACEHOLDER_IMAGE } from './ingotCard';
import { iconSvg, type IconName } from './icons';
import { OFFICE_ADDRESS_PARTS, SUPPORT_PHONE, SUPPORT_PHONE_FA, TRADE_FEE_LABEL } from '../config/site';

const SITE = 'https://arkan.gold';

/* ------------------------------------------------------------------
 * داده‌های کمکی
 * ------------------------------------------------------------------ */

export function sortedVariants(p: GoldIngot): IngotVariant[] {
  return [...(p.variants ?? [])].sort((a, b) => toNumber(a.weightGrams) - toNumber(b.weightGrams));
}

/** اولین وزن موجود (سبک‌ترین) به‌عنوان انتخاب پیش‌فرض */
export function initialVariant(p: GoldIngot): IngotVariant | undefined {
  const variants = sortedVariants(p);
  return variants.find((v) => v.inStock) ?? variants[0];
}

const categoryOf = (p: GoldIngot) => p.category?.name || 'شمش طلا';

/** معادل قیمت هر گرم برای یک وزن (تومان) */
const perGram = (v: IngotVariant) => {
  const w = toNumber(v.weightGrams);
  return w > 0 ? toNumber(v.finalPriceToman) / w : 0;
};

/** پرسش‌های متداول اختصاصی هر محصول — هم در صفحه نمایش داده می‌شود و هم به‌صورت FAQPage در schema */
export function ingotFaq(p: GoldIngot): { question: string; answer: string }[] {
  const karat = karatLabel(p.purityKarat);
  const weights = weightLabel(p);
  return [
    {
      question: `قیمت ${p.name} امروز چقدر است؟`,
      answer: `قیمت ${p.name} به‌صورت لحظه‌ای و بر اساس نرخ روز طلای ${karat} محاسبه می‌شود و در همین صفحه هر چند ثانیه یک‌بار به‌روز می‌شود. قیمت نهایی هنگام ثبت سفارش در داشبورد آرکان گلد قطعی می‌شود.`,
    },
    {
      question: `عیار و وزن ${p.name} چقدر است؟`,
      answer: `این محصول ${karat} است${weights ? ` و در وزن ${weights} عرضه می‌شود` : ''}. مشخصات کامل در جدول مشخصات فنی همین صفحه آمده است.`,
    },
    {
      question: 'چطور از اصالت شمش آرکان گلد مطمئن شوم؟',
      answer: 'هر شمش آرکان گلد یک کد ۶ رقمی یکتا روی هولوگرام کارت پلمپ دارد که در صفحه‌ی «استعلام اصالت شمش» سایت به‌صورت رایگان و آنلاین قابل بررسی است. همراه هر خرید فاکتور رسمی نیز صادر می‌شود.',
    },
    {
      question: 'مراحل خرید و تحویل شمش چگونه است؟',
      answer: 'وزن موردنظر را انتخاب کنید و روی دکمه‌ی «خرید شمش» بزنید تا به داشبورد آرکان گلد منتقل شوید. پس از پرداخت آنلاین، شمش به‌صورت بیمه‌شده ارسال می‌شود یا می‌توانید آن را حضوری از دفتر مرکزی تحویل بگیرید.',
    },
    {
      question: 'آیا امکان فروش مجدد شمش به آرکان گلد وجود دارد؟',
      answer: `بله؛ شمش‌های آرکان گلد را می‌توانید هر زمان با قیمت لحظه‌ای به آرکان گلد بفروشید. کارمزد معاملات ${TRADE_FEE_LABEL} درصد است.`,
    },
  ];
}

/* ------------------------------------------------------------------
 * سئو
 * ------------------------------------------------------------------ */

export interface IngotSeo {
  title: string;
  description: string;
  path: string;
  url: string;
  image?: string;
  imageAlt: string;
  schemas: Record<string, unknown>[];
  meta: { property: string; content: string }[];
}

const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

export function ingotSeo(p: GoldIngot, serviceEnabled = true): IngotSeo {
  const path = ingotDetailPath(p.slug);
  const url = `${SITE}${path}`;
  const images = ingotImages(p);
  const weights = ingotWeights(p);
  const variants = sortedVariants(p);
  const { from, to } = priceRange(p);
  const code = specValue(p, 'کد محصول');
  const gtin = specValue(p, 'کد GTIN');
  const karat = karatLabel(p.purityKarat);
  const inStock = serviceEnabled && p.inStock;

  const title = `قیمت و خرید ${p.name} امروز`;
  const description = clip(
    p.shortDescription?.trim() ||
      `خرید ${p.name} ${karat}${weights.length ? ` در وزن ${weightLabel(p)}` : ''} با قیمت لحظه‌ای، فاکتور رسمی، کد هولوگرام قابل استعلام اصالت و ارسال بیمه‌شده از آرکان گلد.`,
    158
  );

  const seller = { '@type': 'Organization', name: 'آرکان گلد', url: SITE };
  const availability = (ok: boolean) => (ok ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock');
  // ارز در schema باید کد ISO باشد؛ تومان × ۱۰ = ریال (IRR)
  const rial = (toman: number) => String(Math.round(toman * 10));
  const offerOf = (v: IngotVariant) => ({
    '@type': 'Offer',
    url: `${url}?variant=${encodeURIComponent(v.id)}`,
    sku: v.sku || undefined,
    price: rial(toNumber(v.finalPriceToman)),
    priceCurrency: 'IRR',
    availability: availability(serviceEnabled && v.inStock),
    itemCondition: 'https://schema.org/NewCondition',
    seller,
  });

  const pricedVariants = variants.filter((v) => toNumber(v.finalPriceToman) > 0);
  let offers: Record<string, unknown> | undefined;
  if (pricedVariants.length === 1) {
    offers = { ...offerOf(pricedVariants[0]), url };
  } else if (pricedVariants.length > 1) {
    offers = {
      '@type': 'AggregateOffer',
      url,
      priceCurrency: 'IRR',
      lowPrice: rial(from),
      highPrice: rial(to || from),
      offerCount: pricedVariants.length,
      availability: availability(inStock),
      offers: pricedVariants.map(offerOf),
    };
  } else if (from > 0) {
    offers = { '@type': 'Offer', url, price: rial(from), priceCurrency: 'IRR', availability: availability(inStock), seller };
  }

  const product: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: p.name,
    description: description,
    url,
    category: categoryOf(p),
    material: `طلا ${karat}`,
    brand: { '@type': 'Brand', name: 'آرکان گلد' },
    manufacturer: { '@type': 'Organization', name: 'آرکان گلد', url: SITE },
    ...(code ? { sku: code, mpn: code } : {}),
    ...(gtin ? { gtin } : {}),
    ...(images.length ? { image: images.map((i) => i.src) } : { image: `${SITE}/images/logo.png` }),
    ...(weights.length === 1 ? { weight: { '@type': 'QuantitativeValue', value: weights[0], unitCode: 'GRM' } } : {}),
    additionalProperty: (p.specifications ?? []).map((s) => ({ '@type': 'PropertyValue', name: s.label, value: s.value })),
    ...(offers ? { offers } : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'آرکان گلد', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'فروشگاه', item: `${SITE}/shop` },
      { '@type': 'ListItem', position: 3, name: p.name, item: url },
    ],
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ingotFaq(p).map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'ItemPage',
    '@id': `${url}#webpage`,
    url,
    name: title,
    description,
    inLanguage: 'fa-IR',
    mainEntity: { '@id': `${url}#product` },
    isPartOf: { '@type': 'WebSite', name: 'آرکان گلد', url: SITE },
    publisher: {
      '@type': 'Organization',
      name: 'آرکان گلد',
      url: SITE,
      telephone: `+98${SUPPORT_PHONE.replace(/^0/, '')}`,
      address: { '@type': 'PostalAddress', ...OFFICE_ADDRESS_PARTS },
    },
  };

  const meta = [
    { property: 'product:brand', content: 'آرکان گلد' },
    { property: 'product:availability', content: inStock ? 'in stock' : 'out of stock' },
    { property: 'product:condition', content: 'new' },
    ...(from > 0
      ? [
          { property: 'product:price:amount', content: rial(from) },
          { property: 'product:price:currency', content: 'IRR' },
        ]
      : []),
    ...(code ? [{ property: 'product:retailer_item_id', content: code }] : []),
  ];

  return {
    title,
    description,
    path,
    url,
    image: images[0]?.src,
    imageAlt: images[0]?.alt || p.name,
    schemas: [product, breadcrumb, faq, webPage],
    meta,
  };
}

/* ------------------------------------------------------------------
 * HTML صفحه‌ی جزئیات
 * ------------------------------------------------------------------ */

const services: { icon: IconName; title: string; desc: string; href: string }[] = [
  { icon: 'shield', title: 'استعلام اصالت', desc: 'با کد ۶ رقمی هولوگرام شمش', href: '/verify' },
  { icon: 'location', title: 'تحویل فیزیکی', desc: 'ارسال بیمه‌شده یا تحویل حضوری', href: '/services' },
  { icon: 'invoice', title: 'فاکتور رسمی', desc: 'صدور فاکتور معتبر برای هر خرید', href: '/licenses' },
  { icon: 'trend-up', title: 'فروش مجدد', desc: 'فروش به آرکان گلد با قیمت لحظه‌ای', href: '/sell-gold' },
];

const buySteps = [
  { title: 'انتخاب وزن', desc: 'وزن شمش موردنظر را از باکس قیمت انتخاب کنید.' },
  { title: 'ورود به داشبورد', desc: 'با دکمه‌ی «خرید شمش» به داشبورد آرکان گلد منتقل می‌شوید.' },
  { title: 'پرداخت آنلاین', desc: 'سفارش با قیمت لحظه‌ای نهایی و پرداخت امن ثبت می‌شود.' },
  { title: 'دریافت شمش', desc: 'ارسال بیمه‌شده یا تحویل حضوری همراه فاکتور رسمی.' },
];

const packagingPrice = (priceToman: string) => {
  const n = toNumber(priceToman);
  return n > 0 ? formatToman(n) : 'رایگان';
};

/** متن توضیحات پیش‌فرض وقتی API توضیحات کامل ندارد (برای محتوای سئو) */
function fallbackDescription(p: GoldIngot): string {
  const karat = karatLabel(p.purityKarat);
  const weights = weightLabel(p);
  return [
    `<p>${esc(p.name)} محصول آرکان گلد، شمش طلای ${esc(karat)}${weights ? ` در وزن ${esc(weights)}` : ''} است که با قیمت لحظه‌ای و بر اساس نرخ روز طلا عرضه می‌شود. این شمش همراه با کارت پلمپ امنیتی، کد ۶ رقمی یکتا روی هولوگرام و فاکتور رسمی تحویل داده می‌شود.</p>`,
    '<p>شمش طلا یکی از مطمئن‌ترین روش‌ها برای پس‌انداز و حفظ ارزش دارایی است؛ چون هزینه‌ی ساخت و اجرت زیورآلات را ندارد و نقدشوندگی بالایی دارد. شمش‌های آرکان گلد را می‌توانید هر زمان با قیمت لحظه‌ای دوباره به آرکان گلد بفروشید.</p>',
    '<h3>ویژگی‌های شمش آرکان گلد</h3>',
    '<ul><li>عیار استاندارد و قابل استعلام آنلاین</li><li>کارت پلمپ امنیتی با هولوگرام و کد یکتا</li><li>فاکتور رسمی برای هر خرید</li><li>ارسال بیمه‌شده یا تحویل حضوری در دفتر مرکزی</li></ul>',
  ].join('');
}

export interface DetailHtmlOptions {
  serviceEnabled: boolean;
}

export function ingotDetailHtml(p: GoldIngot, { serviceEnabled }: DetailHtmlOptions): string {
  const images = ingotImages(p);
  const weights = ingotWeights(p);
  const variants = sortedVariants(p);
  const first = initialVariant(p);
  const code = specValue(p, 'کد محصول');
  const packaging = p.packagingOptions ?? [];
  const descriptionHtml = sanitizeDescription(p.description) || fallbackDescription(p);
  const canBuy = serviceEnabled && !!first?.inStock && !!safeHref(first?.buyUrl);
  const buyLabel = !serviceEnabled ? 'فروش موقتاً غیرفعال است' : canBuy ? 'خرید شمش' : 'ناموجود';
  const firstPrice = first?.inStock ? formatToman(toNumber(first.finalPriceToman)) : 'ناموجود';
  const firstWeight = first ? formatGrams(toNumber(first.weightGrams)) : '';
  const mainImage = images[0]?.src || INGOT_PLACEHOLDER_IMAGE;
  const onErr = `this.onerror=null;this.src='${INGOT_PLACEHOLDER_IMAGE}'`;
  const disabledCls = canBuy ? '' : ' opacity-50 pointer-events-none';
  const buyAttrs = canBuy ? `href="${esc(safeHref(first!.buyUrl))}"` : 'aria-disabled="true"';

  const gallery = `
    <div class="min-w-0 lg:sticky lg:top-32">
      <div class="aspect-square rounded-xl2 bg-white border border-brand-100/40 shadow-card overflow-hidden">
        <img id="product-main-image" src="${esc(mainImage)}" alt="${esc(images[0]?.alt || p.name)}" class="h-full w-full object-contain p-4" width="640" height="640" fetchpriority="high" onerror="${onErr}" />
      </div>
      ${
        images.length > 1
          ? `<div class="mt-3 grid grid-cols-5 gap-2">${images
              .map(
                (img, i) => `<button type="button" class="gallery-thumb aspect-square rounded-lg border-2 overflow-hidden bg-white border-transparent data-[active=true]:border-brand" data-src="${esc(img.src)}" data-alt="${esc(img.alt)}" data-active="${i === 0}" aria-label="نمایش تصویر ${(i + 1).toLocaleString('fa-IR')}">
                  <img src="${esc(img.src)}" alt="" class="h-full w-full object-contain" loading="lazy" width="120" height="120" />
                </button>`
              )
              .join('')}</div>`
          : ''
      }
    </div>`;

  const variantPicker = variants.length
    ? `<fieldset>
        <legend class="mb-2 text-xs font-medium text-ink-soft">انتخاب وزن</legend>
        <div class="grid ${variants.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2" role="radiogroup">
          ${variants
            .map((v) => {
              const active = v.id === first?.id;
              return `<button type="button" role="radio" class="variant-btn flex min-w-0 flex-col items-start gap-0.5 rounded-lg border-2 px-3 py-2.5 text-right transition-colors border-brand-100/40 hover:border-brand/60 data-[active=true]:border-brand data-[active=true]:bg-brand-50 disabled:opacity-50 disabled:cursor-not-allowed" data-variant-id="${esc(v.id)}" data-buy-url="${esc(safeHref(v.buyUrl))}" data-active="${active}" aria-checked="${active}"${v.inStock ? '' : ' disabled'}>
                <span class="font-semibold text-brand tnum" data-variant-weight>${esc(formatGrams(toNumber(v.weightGrams)))}</span>
                <span class="text-[11px] text-ink-soft tnum" data-variant-price>${esc(v.inStock ? formatToman(toNumber(v.finalPriceToman)) : 'ناموجود')}</span>
              </button>`;
            })
            .join('')}
        </div>
      </fieldset>`
    : '';

  const packagingHtml = packaging.length
    ? `<div class="mt-5">
        <p class="mb-2 text-xs font-medium text-ink-soft">بسته‌بندی</p>
        <ul class="space-y-2">
          ${packaging
            .map(
              (o) => `<li class="flex items-start gap-3 rounded-lg bg-canvas-100 px-3 py-3 sm:px-4" data-packaging-id="${esc(o.id)}">
              ${
                safeHref(o.imageUrl)
                  ? `<img src="${esc(safeHref(o.imageUrl))}" alt="${esc(o.name)}" class="h-12 w-12 shrink-0 rounded-md object-cover bg-white" width="48" height="48" loading="lazy" />`
                  : `<span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-brand">${iconSvg('gift-card', 'h-5 w-5')}</span>`
              }
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-center gap-2 text-sm font-semibold text-brand">${esc(o.name)}${o.isDefault ? '<span class="rounded-full bg-brand text-white px-2 py-0.5 text-[10px] font-medium">پیش‌فرض</span>' : ''}</p>
                ${o.description ? `<p class="text-xs leading-6 text-ink-soft">${esc(o.description)}</p>` : ''}
                ${toNumber(o.freeThresholdToman) > 0 ? `<p class="text-[11px] text-success tnum">رایگان برای خرید بالای ${esc(formatToman(toNumber(o.freeThresholdToman)))}</p>` : ''}
              </div>
              <p class="shrink-0 text-xs font-semibold text-ink tnum text-left">
                <span data-packaging-price>${esc(packagingPrice(o.priceToman))}</span>
                ${o.perUnit && toNumber(o.priceToman) > 0 ? '<span class="block text-[10px] font-normal text-ink-soft">به ازای هر عدد</span>' : ''}
              </p>
            </li>`
            )
            .join('')}
        </ul>
      </div>`
    : '';

  const info = `
    <div class="min-w-0">
      <p class="text-xs text-brand-300 mb-2">${esc(categoryOf(p))}</p>
      <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-brand mb-3 leading-[1.6]">${esc(p.name)}</h1>

      <div class="flex flex-wrap items-center gap-2 mb-5 text-[11px]">
        <span class="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand tnum">${esc(karatLabel(p.purityKarat))}</span>
        ${weights.length ? `<span class="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand tnum">${esc(weightLabel(p))}</span>` : ''}
        <span class="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand">قابل استعلام اصالت</span>
        <span class="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand">فاکتور رسمی</span>
        <span id="stock-badge" class="rounded-full px-3 py-1 font-semibold ${p.inStock ? 'bg-success-50 text-success' : 'bg-danger-50 text-danger'}">${p.inStock ? 'موجود' : 'ناموجود'}</span>
      </div>
      ${code ? `<p class="mb-4 text-xs text-ink-soft">کد محصول: <span class="latin-digits">${esc(code)}</span></p>` : ''}

      ${p.shortDescription ? `<p class="text-sm leading-8 text-ink-soft mb-6">${esc(p.shortDescription)}</p>` : ''}

      <!-- باکس قیمت لحظه‌ای و خرید -->
      <div id="product-price-box" class="rounded-xl2 bg-white border border-brand-100/40 shadow-card-hover p-4 sm:p-5 md:p-6">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p class="flex items-center gap-1.5 text-xs text-ink-soft"><span class="live-dot"></span> قیمت لحظه‌ای</p>
          <p class="text-[11px] text-ink-soft tnum">طلای ۱۸ عیار هر گرم: <span data-price-bind="pricePerGram" data-price-format="toman">--</span></p>
        </div>

        <p id="service-off" class="${serviceEnabled ? 'hidden ' : ''}mb-4 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger">فروش آنلاین شمش در حال حاضر موقتاً غیرفعال است.</p>

        ${variantPicker}
        ${packagingHtml}

        <div class="mt-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-brand-100/40 pt-4">
          <div>
            <p class="text-[11px] text-ink-soft">قیمت شمش <span id="selected-weight" class="tnum">${firstWeight ? `(${esc(firstWeight)})` : ''}</span></p>
            <p class="text-[11px] text-ink-soft/80">بروزرسانی: <span id="price-updated" class="tnum">--</span></p>
          </div>
          <p id="selected-price" class="text-xl sm:text-2xl font-extrabold text-brand tnum">${esc(firstPrice)}</p>
        </div>
        <p id="selected-per-gram" class="mt-1 text-left text-[11px] text-ink-soft tnum">${first && perGram(first) > 0 && first.inStock ? `معادل هر گرم: ${esc(formatToman(perGram(first)))}` : ''}</p>

        <a id="buy-btn" ${buyAttrs} class="btn-primary shine-hover mt-4 w-full${disabledCls}">
          ${iconSvg('wallet', 'h-4.5 w-4.5')}
          <span data-label>${esc(buyLabel)}</span>
        </a>
        <p class="mt-3 text-[11px] leading-6 text-ink-soft/80 text-center">
          با کلیک روی «خرید شمش» به داشبورد آرکان گلد منتقل می‌شوید و سفارش را با قیمت لحظه‌ای نهایی و پرداخت آنلاین ثبت می‌کنید.
        </p>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a href="/verify" class="btn-outline !py-3 text-xs">${iconSvg('shield', 'h-4 w-4')} استعلام اصالت شمش</a>
        <a href="tel:${esc(SUPPORT_PHONE)}" class="btn-outline !py-3 text-xs">${iconSvg('headset', 'h-4 w-4')} مشاوره خرید <span class="tnum">${esc(SUPPORT_PHONE_FA)}</span></a>
      </div>
    </div>`;

  // ردیف‌های تکمیلی فقط وقتی API همان مشخصه را نداده باشد
  const hasSpec = (re: RegExp) => (p.specifications ?? []).some((sp) => re.test(sp.label));
  const specRow = (label: string, value: string) =>
    `<tr><th scope="row" class="px-5 sm:px-6 py-3 text-right font-medium text-ink-soft w-2/5">${esc(label)}</th><td class="px-5 sm:px-6 py-3 text-ink tnum">${esc(value)}</td></tr>`;
  const extraSpecs = [
    hasSpec(/عیار|خلوص/) ? '' : specRow('عیار', karatLabel(p.purityKarat)),
    weights.length && !hasSpec(/وزن/) ? specRow(weights.length > 1 ? 'وزن‌های موجود' : 'وزن', weightLabel(p)) : '',
    hasSpec(/برند|سازنده/) ? '' : specRow('برند', 'آرکان گلد'),
  ].join('');

  const specs = `
    <aside class="min-w-0 rounded-xl2 bg-white border border-brand-100/40 shadow-card overflow-hidden">
      <h2 class="text-lg font-bold text-brand px-5 sm:px-6 pt-6 pb-3">مشخصات فنی ${esc(p.name)}</h2>
      <table class="w-full table-fixed text-sm">
        <tbody class="divide-y divide-brand-100/30">
          ${(p.specifications ?? [])
            .map(
              (s) => `<tr>
              <th scope="row" class="px-5 sm:px-6 py-3 text-right align-top font-medium text-ink-soft w-2/5">${esc(s.label)}</th>
              <td class="px-5 sm:px-6 py-3 text-ink tnum break-words">${/^کد/.test(s.label) ? `<span class="latin-digits">${esc(s.value)}</span>` : esc(s.value)}</td>
            </tr>`
            )
            .join('')}
          ${extraSpecs}
          <tr>
            <th scope="row" class="px-5 sm:px-6 py-3 text-right font-medium text-ink-soft w-2/5">موجودی</th>
            <td class="px-5 sm:px-6 py-3 text-ink" id="stock-cell">${p.inStock ? 'موجود' : 'ناموجود'}</td>
          </tr>
        </tbody>
      </table>
    </aside>`;

  const faqHtml = ingotFaq(p)
    .map(
      (f) => `<details class="group rounded-xl2 bg-white border border-brand-100/40 shadow-card px-5 py-4">
        <summary class="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-brand marker:content-none [&::-webkit-details-marker]:hidden">
          <h3 class="leading-7">${esc(f.question)}</h3>
          ${iconSvg('chevron', 'h-4 w-4 shrink-0 transition-transform group-open:rotate-180')}
        </summary>
        <p class="mt-3 text-sm leading-8 text-ink-soft">${esc(f.answer)}</p>
      </details>`
    )
    .join('');

  return `
  <nav aria-label="مسیر صفحه" class="container-page pt-6 text-xs text-ink-soft">
    <ol class="flex flex-wrap items-center gap-1.5">
      <li><a href="/" class="hover:text-brand">خانه</a></li>
      <li aria-hidden="true">/</li>
      <li><a href="/shop" class="hover:text-brand">فروشگاه</a></li>
      <li aria-hidden="true">/</li>
      <li class="text-brand font-medium" aria-current="page">${esc(p.name)}</li>
    </ol>
  </nav>

  <section class="container-page py-6 sm:py-8 grid gap-8 lg:gap-10 lg:grid-cols-2 items-start">
    ${gallery}
    ${info}
  </section>

  <section class="container-page pb-6 grid gap-6 items-start lg:grid-cols-[minmax(0,1fr)_420px]">
    <article class="min-w-0 rounded-xl2 bg-white border border-brand-100/40 shadow-card p-5 sm:p-6 md:p-8">
      <h2 class="text-xl font-bold text-brand mb-4">معرفی و بررسی ${esc(p.name)}</h2>
      <div class="product-description text-sm leading-8 text-ink-soft">${descriptionHtml}</div>
    </article>
    ${specs}
  </section>

  <section class="container-page py-6" aria-labelledby="buy-steps-title">
    <h2 id="buy-steps-title" class="text-xl font-bold text-brand mb-4">مراحل خرید ${esc(p.name)}</h2>
    <ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      ${buySteps
        .map(
          (s, i) => `<li class="flex items-start gap-3 rounded-xl2 bg-white border border-brand-100/40 shadow-card px-4 py-4">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white text-sm font-bold tnum">${(i + 1).toLocaleString('fa-IR')}</span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-brand">${esc(s.title)}</span>
            <span class="block text-xs leading-6 text-ink-soft">${esc(s.desc)}</span>
          </span>
        </li>`
        )
        .join('')}
    </ol>
  </section>

  <section class="container-page py-6">
    <div class="grid gap-3 grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4">
      ${services
        .map(
          (s) => `<a href="${s.href}" class="flex items-center gap-3 rounded-xl2 bg-white border border-brand-100/40 shadow-card px-4 py-4 card-lift">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">${iconSvg(s.icon, 'h-5 w-5')}</span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold text-brand">${esc(s.title)}</span>
            <span class="block text-[11px] text-ink-soft">${esc(s.desc)}</span>
          </span>
        </a>`
        )
        .join('')}
    </div>
  </section>

  <section class="container-page py-6" aria-labelledby="product-faq-title">
    <h2 id="product-faq-title" class="text-xl font-bold text-brand mb-4">سوالات متداول درباره ${esc(p.name)}</h2>
    <div class="grid gap-3">${faqHtml}</div>
  </section>

  <!-- نوار خرید ثابت پایین صفحه در موبایل -->
  <div id="mobile-buy-bar" class="fixed inset-x-0 bottom-0 z-40 translate-y-full border-t border-brand-100/50 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(51,5,9,0.35)] backdrop-blur transition-transform duration-300 lg:hidden" aria-hidden="true">
    <div class="mx-auto flex max-w-content items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-[11px] text-ink-soft">${esc(p.name)} <span data-bar-weight class="tnum">${firstWeight ? `(${esc(firstWeight)})` : ''}</span></p>
        <p data-bar-price class="truncate font-extrabold text-brand tnum">${esc(firstPrice)}</p>
      </div>
      <a data-bar-buy ${buyAttrs} class="btn-primary shrink-0 !px-5 !py-3 text-xs${disabledCls}" tabindex="-1">${esc(buyLabel)}</a>
    </div>
  </div>`;
}
