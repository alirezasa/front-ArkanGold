/**
 * منوهای سایت — منبع مشترک هدر دسکتاپ، منوی موبایل و فوتر
 * با تغییر عنوان یا لینک در همین فایل، همه‌ی منوها یک‌جا به‌روز می‌شوند.
 */
import type { IconName } from '../lib/icons';
import { MAG_ENABLED, MAG_PATH } from '../config/site';

export interface NavLink {
  label: string;
  href: string;
  icon: IconName;
  desc?: string;
  external?: boolean;
}

export interface NavItem extends NavLink {
  children?: NavLink[];
}

/** مجله (وردپرس هدلس) بخشی از همین سایت است؛ فقط با PUBLIC_WP_API_URL=off به آدرس قدیمی لینک می‌دهد */
export const MAG_URL = MAG_ENABLED ? MAG_PATH : 'https://arkan.gold/mag';

export const servicesMenu: NavLink[] = [
  { label: 'خرید و فروش طلای آب‌شده', href: '/buy-gold', desc: 'خرید و فروش آنلاین طلای آب‌شده با قیمت لحظه‌ای', icon: 'gold-drop' },
  { label: 'خرید و فروش شمش طلا', href: '/shop', desc: 'خرید و فروش شمش ۷۵۰ عیار آرکان با فاکتور رسمی', icon: 'gold-bar' },
  { label: 'تحویل فیزیکی', href: '/delivery', desc: 'تحویل طلا در قالب شمش‌های استاندارد آرکان گلد', icon: 'location' },
];

export const otherMenu: NavLink[] = [
  { label: 'مجله آرکان گلد', href: MAG_URL, external: !MAG_ENABLED, desc: 'مقالات، اخبار و آموزش بازار طلا', icon: 'document' },
  { label: 'سوالات متداول', href: '/faq', desc: 'پاسخ پرسش‌های پرتکرار کاربران', icon: 'question' },
  { label: 'قوانین و مقررات', href: '/rules', desc: 'شرایط و مقررات استفاده از خدمات', icon: 'book' },
  { label: 'درباره ما', href: '/about', desc: 'آشنایی با آرکان گلد', icon: 'info' },
  { label: 'تماس با ما', href: '/contact', desc: 'راه‌های ارتباط با آرکان گلد', icon: 'phone' },
];

export const mainNav: NavItem[] = [
  { label: 'خدمات', href: '/services', icon: 'grid', children: servicesMenu },
  { label: 'قیمت طلا', href: '/price', icon: 'trend-up' },
  { label: 'محصولات', href: '/shop', icon: 'gold-bar' },
  { label: 'استعلام اصالت شمش', href: '/verify', icon: 'shield' },
  { label: 'مجوزها', href: '/licenses', icon: 'seal' },
  { label: 'سایر', href: '/about', icon: 'sparkle', children: otherMenu },
];
