/**
 * مدل داده‌ی فروشگاه + کاتالوگ پشتیبان
 * ----------------------------------------------------
 * منبع اصلی محصولات، فروشگاه واقعی آرکان گلد است (src/lib/shop.ts آن را از
 * WooCommerce Store API می‌خواند). این فایل فقط وقتی استفاده می‌شود که API
 * فروشگاه در زمان build در دسترس نباشد، تا صفحه فروشگاه هرگز خالی نماند.
 *
 * تمام شمش‌های آرکان گلد ۷۵۰ عیار (۱۸ عیار) هستند و قیمت آن‌ها در مرورگر
 * بر اساس قیمت لحظه‌ای هر گرم طلای ۱۸ عیار محاسبه می‌شود.
 */
import { APP_URL, BAR_PURITY } from '../config/site';

export type ProductVisual = 'bar' | 'gift' | 'card';

export interface ProductCategory {
  slug: string;
  name: string;
  description: string;
  visual: ProductVisual;
  image?: string;
}

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  /** وزن طلا به گرم — اگر مشخص باشد قیمت به‌صورت لحظه‌ای محاسبه می‌شود */
  weightGram: number | null;
  /** عیار در هزار (۷۵۰ = ۱۸ عیار) */
  purity: number;
  /** اجرت ضرب و بسته‌بندی به درصد از ارزش طلا (اگر فروشگاه تعریف کرده باشد) */
  wagePercent: number;
  /** قیمت ثابت فروشگاه به تومان — فقط برای محصولاتی که وزن ندارند */
  fixedPriceToman: number | null;
  images: ProductImage[];
  visual: ProductVisual;
  shortDescription: string;
  /** توضیحات کامل (HTML پاک‌سازی‌شده از فروشگاه یا متن ساده) */
  descriptionHtml: string;
  features: string[];
  specs: ProductSpec[];
  sku: string;
  inStock: boolean;
  /** لینک ثبت سفارش */
  buyUrl: string;
  buyLabel: string;
  source: 'store' | 'fallback';
}

export const fallbackCategories: ProductCategory[] = [
  {
    slug: 'gold-bar',
    name: 'شمش طلا',
    description: 'شمش‌های ۷۵۰ عیار آرکان با سریال یکتا و گواهی اصالت',
    visual: 'bar',
  },
  {
    slug: 'gift-bar',
    name: 'شمش هدیه',
    description: 'شمش طلا در بسته‌بندی هدیه برای مناسبت‌های خاص',
    visual: 'gift',
  },
  {
    slug: 'corporate-gift-card',
    name: 'کارت هدیه سازمانی',
    description: 'خرید شمش هدیه با کارت هدیه سازمانی برای کارکنان و مشتریان',
    visual: 'card',
  },
];

const faWeight = (g: number) => g.toLocaleString('fa-IR');

const commonFeatures = [
  `عیار ${BAR_PURITY.toLocaleString('fa-IR')} (طلای ۱۸ عیار)`,
  'دارای شماره سریال یکتا و قابل استعلام آنلاین',
  'پلمپ امنیتی و فاکتور رسمی',
  'قابل فروش مجدد به آرکان گلد با قیمت لحظه‌ای',
];

function barSpecs(weight: number, packaging: string): ProductSpec[] {
  return [
    { label: 'وزن', value: `${faWeight(weight)} گرم` },
    { label: 'عیار', value: `${BAR_PURITY.toLocaleString('fa-IR')} (۱۸ عیار)` },
    { label: 'برند', value: 'آرکان گلد' },
    { label: 'بسته‌بندی', value: packaging },
    { label: 'گواهی اصالت', value: 'دارد — استعلام با شماره سریال' },
    { label: 'فاکتور', value: 'فاکتور رسمی' },
  ];
}

function makeBar(weight: number, slugWeight: string): Product {
  return {
    id: `bar-${slugWeight}`,
    slug: `shamsh-${slugWeight}g`,
    name: `شمش طلای ${faWeight(weight)} گرمی آرکان`,
    categorySlug: 'gold-bar',
    categoryName: 'شمش طلا',
    weightGram: weight,
    purity: BAR_PURITY,
    wagePercent: 0,
    fixedPriceToman: null,
    images: [],
    visual: 'bar',
    shortDescription: `شمش ${faWeight(weight)} گرمی ۷۵۰ عیار آرکان گلد با سریال یکتا، پلمپ امنیتی و فاکتور رسمی.`,
    descriptionHtml: `<p>شمش ${faWeight(weight)} گرمی آرکان گلد از طلای ۷۵۰ عیار (۱۸ عیار) ضرب شده و در بسته‌بندی پلمپ‌شده همراه با شماره سریال یکتا عرضه می‌شود. اصالت هر شمش از طریق صفحه «استعلام اصالت شمش» و با وارد کردن شماره سریال درج‌شده روی بسته‌بندی قابل بررسی است.</p><p>قیمت این محصول بر اساس نرخ لحظه‌ای هر گرم طلای ۱۸ عیار محاسبه می‌شود و پیش از پرداخت، مبلغ دقیق به همراه کارمزد به شما نمایش داده خواهد شد.</p>`,
    features: commonFeatures,
    specs: barSpecs(weight, 'کارت پلمپ امنیتی'),
    sku: `AG750-${slugWeight}`,
    inStock: true,
    buyUrl: APP_URL,
    buyLabel: 'خرید شمش',
    source: 'fallback',
  };
}

function makeGiftBar(weight: number, slugWeight: string): Product {
  return {
    ...makeBar(weight, slugWeight),
    id: `gift-${slugWeight}`,
    slug: `shamsh-hedie-${slugWeight}g`,
    name: `شمش هدیه ${faWeight(weight)} گرمی آرکان`,
    categorySlug: 'gift-bar',
    categoryName: 'شمش هدیه',
    visual: 'gift',
    shortDescription: `شمش ${faWeight(weight)} گرمی ۷۵۰ عیار در بسته‌بندی هدیه آرکان گلد؛ هدیه‌ای ماندگار با ارزش واقعی.`,
    descriptionHtml: `<p>شمش هدیه ${faWeight(weight)} گرمی آرکان گلد، یک شمش ۷۵۰ عیار با سریال یکتا است که در جعبه هدیه مخصوص آرکان عرضه می‌شود. این محصول انتخابی مطمئن برای تولد، سالگرد، عیدی و سایر مناسبت‌هاست و گیرنده هر زمان بخواهد می‌تواند آن را با قیمت لحظه‌ای به آرکان گلد بفروشد.</p>`,
    specs: barSpecs(weight, 'جعبه هدیه آرکان گلد'),
    sku: `AG750-G${slugWeight}`,
    buyLabel: 'خرید شمش هدیه',
  };
}

function makeGiftCard(weight: number, slugWeight: string): Product {
  return {
    ...makeBar(weight, slugWeight),
    id: `card-${slugWeight}`,
    slug: `cart-hedie-sazmani-${slugWeight}g`,
    name: `کارت هدیه سازمانی شمش ${faWeight(weight)} گرمی`,
    categorySlug: 'corporate-gift-card',
    categoryName: 'کارت هدیه سازمانی',
    visual: 'card',
    shortDescription: `کارت هدیه سازمانی معادل شمش ${faWeight(weight)} گرمی ۷۵۰ عیار؛ مناسب هدیه به کارکنان و مشتریان.`,
    descriptionHtml: `<p>کارت هدیه سازمانی آرکان گلد به سازمان‌ها و شرکت‌ها امکان می‌دهد شمش هدیه ${faWeight(weight)} گرمی ۷۵۰ عیار را به‌صورت یکجا برای کارکنان یا مشتریان خود تهیه کنند. هر کارت دارای کد اختصاصی است و دارنده آن می‌تواند شمش را به‌صورت فیزیکی تحویل بگیرد یا معادل آن را به‌صورت طلای آب‌شده در حساب خود دریافت کند.</p><p>برای سفارش تعداد بالا، طراحی اختصاصی کارت با لوگوی سازمان و صدور فاکتور رسمی، درخواست خود را ثبت کنید تا کارشناسان آرکان گلد با شما تماس بگیرند.</p>`,
    features: [
      'قابل تبدیل به شمش فیزیکی یا طلای آب‌شده',
      'امکان طراحی اختصاصی با لوگوی سازمان',
      'فاکتور رسمی به نام سازمان',
      'قیمت‌گذاری بر اساس نرخ لحظه‌ای طلا',
    ],
    specs: [
      { label: 'معادل وزن طلا', value: `${faWeight(weight)} گرم` },
      { label: 'عیار', value: `${BAR_PURITY.toLocaleString('fa-IR')} (۱۸ عیار)` },
      { label: 'نوع', value: 'کارت هدیه سازمانی' },
      { label: 'نحوه استفاده', value: 'تحویل شمش یا شارژ طلای آب‌شده' },
      { label: 'فاکتور', value: 'فاکتور رسمی به نام سازمان' },
    ],
    sku: `AG750-C${slugWeight}`,
    buyUrl: '/contact',
    buyLabel: 'ثبت درخواست سازمانی',
  };
}

export const fallbackProducts: Product[] = [
  makeBar(0.25, '0.25'),
  makeBar(0.5, '0.5'),
  makeBar(1, '1'),
  makeBar(2, '2'),
  makeBar(5, '5'),
  makeBar(10, '10'),
  makeBar(20, '20'),
  makeGiftBar(0.25, '0.25'),
  makeGiftBar(0.5, '0.5'),
  makeGiftBar(1, '1'),
  makeGiftCard(0.25, '0.25'),
  makeGiftCard(0.5, '0.5'),
  makeGiftCard(1, '1'),
];
