export interface Product {
  slug: string;
  name: string;
  category: 'شمش طلا' | 'سکه طلا' | 'مصنوعات طلا';
  weightGram: number;
  priceToman: number;
  image: string;
}

export const products: Product[] = [
  { slug: 'shamsh-1g', name: 'شمش طلای ۱ گرمی آرکان', category: 'شمش طلا', weightGram: 1, priceToman: 8_950_000, image: '/images/products/shamsh-1g.jpg' },
  { slug: 'shamsh-5g', name: 'شمش طلای ۵ گرمی آرکان', category: 'شمش طلا', weightGram: 5, priceToman: 44_200_000, image: '/images/products/shamsh-5g.jpg' },
  { slug: 'sekke-emami', name: 'سکه طلای تمام امامی', category: 'سکه طلا', weightGram: 8.13, priceToman: 71_500_000, image: '/images/products/sekke-emami.jpg' },
  { slug: 'sekke-nim', name: 'نیم سکه طلا', category: 'سکه طلا', weightGram: 4.07, priceToman: 36_100_000, image: '/images/products/sekke-nim.jpg' },
  { slug: 'gerdanband-ab-shode', name: 'گردنبند طلای آب‌شده ظریف', category: 'مصنوعات طلا', weightGram: 3.2, priceToman: 29_800_000, image: '/images/products/gerdanband.jpg' },
  { slug: 'anghoshtar-ab-shode', name: 'انگشتر طلای آب‌شده کلاسیک', category: 'مصنوعات طلا', weightGram: 2.5, priceToman: 23_300_000, image: '/images/products/angoshtar.jpg' },
];
