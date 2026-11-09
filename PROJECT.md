# مستند پروژه‌ی سایت آرکان گلد

خلاصه‌ی کامل پروژه: معماری، صفحه‌ها، منبع داده‌ها، سئو، مجله، اجرا و دیپلوی، تنظیمات و کارهای رایج.
جزئیات بیشتر هر بخش در [`README.md`](README.md) آمده است.

---

## ۱. معرفی

سایت `https://arkan.gold`، سامانه‌ی خرید و فروش آنلاین طلای آب‌شده و شمش طلای ۷۵۰ عیار آرکان گلد
(شرکت گنجینه طلای پروانه زر). فارسی، راست‌به‌چپ، و با قیمت لحظه‌ای طلا.

| بخش | فناوری |
|---|---|
| فریم‌ورک | [Astro](https://astro.build) نسخه ۴ در حالت `hybrid`، با آداپتور `@astrojs/node` |
| استایل | Tailwind CSS 3 با پالت برند (زرشکی `#330509`، طلایی `#c5a059` فقط برای جزئیات) |
| نمودار | Chart.js |
| اجرا | یک برنامه‌ی Node.js (نسخه‌ی ۱۸.۱۷ به بالا، پیشنهادی ۲۰) |
| محتوای مجله | وردپرس هدلس روی `https://cms.arkan.gold` |
| ورود و معامله | اپلیکیشن جدا روی `https://app.arkan.gold` |

---

## ۲. معماری

```
                    ┌────────────────────────── arkan.gold (برنامه‌ی Node.js) ──────────────────────────┐
بازدیدکننده ──────▶ │ server/server.mjs                                                                   │
                    │   ├─ فایل‌های ایستا (client/): صفحه‌های ساخته‌شده در build، CSS/JS، تصاویر، فونت   │
                    │   └─ صفحه‌های پویا (entry/): Astro SSR + middleware قیمت + کش حافظه                │
                    └───────────────┬──────────────────────────┬──────────────────────────┬─────────────┘
                                    │                          │                          │
                         api.arkan.gold                cms.arkan.gold              app.arkan.gold
                    (قیمت طلا، تاریخچه، شمش‌ها)   (وردپرس: مجله، استعلام شمش)   (ورود، معامله، چت آنلاین)
```

- **صفحه‌های ایستا** یک بار در build ساخته می‌شوند. سریع‌ترین حالت را دارند و به هیچ API وابسته نیستند.
- **صفحه‌های پویا** هنگام هر بازدید روی سرور ساخته می‌شوند (SSR). داده‌ی API ها در حافظه کش می‌شود:
  - قیمت لحظه‌ای در HTML نوشته می‌شود.
  - شمش و مطلب جدید بدون build جدید دیده می‌شوند.
- **در مرورگر** قیمت هر ۳۰ ثانیه به‌روز می‌شود. ماشین‌حساب، نمودار، استعلام اصالت و چت آنلاین هم در مرورگر کار می‌کنند.

---

## ۳. صفحه‌ها

| آدرس | نوع | توضیح | فایل |
|---|---|---|---|
| `/` | پویا | صفحه‌ی اصلی: هیرو، ماشین‌حساب، نمودار، محصولات و خدمات، سامانه‌ی ناظر، مطالب مجله و ... | `src/pages/index.astro` |
| `/price` | پویا | قیمت لحظه‌ای و نمودار | `src/pages/price.astro` |
| `/buy-gold`، `/sell-gold` | پویا | خرید و فروش طلای آب‌شده با ماشین‌حساب | `src/pages/buy-gold.astro`، `sell-gold.astro` |
| `/delivery` | پویا | تحویل فیزیکی (وزن‌های موجود شمش از API) | `src/pages/delivery.astro` |
| `/shop` | پویا | فروشگاه شمش طلا | `src/pages/shop.astro` |
| `/shop/{slug}` | پویا | صفحه‌ی هر شمش با schema محصول | `src/pages/shop/[slug].astro` |
| `/shop/item?slug=` | ریدایرکت ۳۰۱ | آدرس قدیمی، به `/shop/{slug}` | `src/pages/shop/item.astro` |
| `/verify` | ایستا | استعلام اصالت شمش با کد ۸ رقمی | `src/pages/verify.astro` |
| `/licenses` | ایستا | مجوزها و اعتبار | `src/pages/licenses.astro` |
| `/about`، `/contact`، `/faq`، `/rules`، `/services`، `/cooperation` | ایستا | صفحه‌های اطلاعاتی | `src/pages/*.astro` |
| `/login` | ریدایرکت ۳۰۲ | به `app.arkan.gold` | `src/pages/login.astro` |
| `/mag/...` | پویا | مجله (بخش ۷) | `src/mag/MagPage.astro` |
| `/wp-content/uploads/...` | پویا | تصاویر مجله از وردپرس، با کش دیسک | `src/mag/media.ts` |
| `/robots.txt` | ایستا | | `src/pages/robots.txt.ts` |
| `/sitemap-index.xml` | ایستا | همه‌ی صفحه‌های با آدرس ثابت | `@astrojs/sitemap` |
| `/sitemap-shop.xml` | پویا | همه‌ی شمش‌ها | `src/pages/sitemap-shop.xml.ts` |
| `/healthz` | پویا، noindex | وضعیت سرور و اتصال به API ها (JSON) | `src/pages/healthz.ts` |
| `404` | ایستا | صفحه‌ی پیدا نشد | `src/pages/404.astro` |

برای پویا کردن یک صفحه، در frontmatter آن بنویسید `export const prerender = false;`. اگر صفحه قیمت طلا نمایش می‌دهد، `Astro.locals.livePrice = true;` را هم اضافه کنید.

---

## ۴. ساختار پوشه‌ها

```
astro.config.mjs          تنظیمات Astro (hybrid، آداپتور Node، sitemap، فعال‌سازی مجله)
Dockerfile, .dockerignore ایمیج Docker برای رانفلر و سرویس‌های مشابه
server/
  server.mjs              سرور HTTP: فایل ایستا با br/gzip و ETag، صفحه‌های پویا، ۳۰۱، ۴۰۴، هدرهای امنیتی
  app.cjs                 فایل شروع برای Passenger (cPanel)
src/
  config/site.ts          ثابت‌های مرکزی: آدرس‌ها، کارمزد، تلفن، آدرس دفتر، شبکه‌های اجتماعی، API ها
  data/                   محتوای ثابت: منوها (nav.ts)، سوالات متداول، قوانین، نمادهای فوتر (trustSeals.ts)
  layouts/BaseLayout.astro قالب همه‌ی صفحه‌ها (سئو، schema سازمان، هدر، فوتر، چت آنلاین)
  components/             هدر، فوتر، سئو، آیکون، کارت محصول، نمادهای فوتر (TrustSeals)
    sections/             بخش‌های صفحه‌ی اصلی و صفحه‌های دیگر
    mag/                  کامپوننت‌های مجله (کارت، صفحه‌ی اصلی، صفحه‌ی مطلب، ویجت قیمت، ...)
  pages/                  صفحه‌ها (هر فایل یک آدرس)
  mag/                    مسیرهای مجله (فقط وقتی مجله فعال است اضافه می‌شوند)
  lib/                    منطق: قیمت، شمش‌ها، کش، وردپرس، مجله، آیکون‌ها، رفتار مرورگر
  middleware.ts           نوشتن قیمت لحظه‌ای در HTML صفحه‌های پویا
  integrations/node-app.mjs ساخت بسته‌ی dist/app بعد از build (به‌همراه فشرده‌سازی br/gz)
  assets/trust/           تصاویر نمادهای فوتر (بخش ۱۰)
  styles/global.css       استایل‌های سراسری، دکمه‌ها، متن مطالب مجله
public/                   favicon، manifest (PWA)، فونت‌ها، لوگوها
wordpress/
  arkan-headless/         افزونه‌ی وردپرس مجله (هدایت به سایت، noindex، پاک‌سازی کش، ریدایرکت‌ها)
  arkan-bar-verify/       افزونه‌ی وردپرس استعلام اصالت شمش (API و ثبت شمش‌ها)
.github/workflows/deploy.yml دیپلوی خودکار با SSH/FTP (برای هاست‌های غیر رانفلر)
```

---

## ۵. منبع داده‌ها و API ها

| داده | آدرس | کجا خوانده می‌شود |
|---|---|---|
| قیمت لحظه‌ای | `GET https://api.arkan.gold/market/price` | سرور (`serverPrice.ts`) و مرورگر (`goldPrice.ts`، هر ۳۰ ثانیه) |
| تاریخچه‌ی قیمت | `GET https://api.arkan.gold/market/price/history?hours=` | مرورگر (نمودار) |
| شمش‌ها | `GET https://api.arkan.gold/public/gold-ingots` و `.../{slug}` | سرور (`goldIngots.ts`) و مرورگر (`liveIngots.ts`) |
| مطالب مجله | `https://cms.arkan.gold/wp-json/wp/v2/...` | سرور (`magazine.ts`، `wp.ts`) |
| استعلام اصالت | `GET https://cms.arkan.gold/wp-json/arkan/v1/verify-bar?code=` | مرورگر (`barVerify.ts`) |
| چت آنلاین | `https://app.arkan.gold/livechat-embed.js` | مرورگر (`support.ts`) |

`api.arkan.gold` باید برای دامنه‌ی `https://arkan.gold` هدر CORS بدهد، چون مرورگر هم مستقیم از آن می‌خواند.

### کش سرور (`src/lib/cache.ts`)
| داده | تازه | نمایش نسخه‌ی قبلی در قطعی منبع |
|---|---|---|
| قیمت طلا | ۲۰ ثانیه | حداکثر ۵ دقیقه |
| فروشگاه | ۶۰ ثانیه | حداکثر ۱ ساعت |
| صفحه‌های مجله | ۲ دقیقه (بعد از انتشار فوراً پاک می‌شود) | حداکثر ۲۴ ساعت |

- **درخواست‌های هم‌زمان:** برای یک صفحه فقط یک درخواست به API فرستاده می‌شود.
- **حافظه:** حداکثر ۶۰۰ کلید در کش نگه داشته می‌شود.
- **سقف انتظار:** صفحه‌ها برای داده‌ی اختیاری حداکثر چند ثانیه منتظر می‌مانند (`withDeadline`):

  | داده | سقف انتظار |
  |---|---|
  | قیمت | ۱.۲ ثانیه |
  | مطالب صفحه‌ی اصلی | ۱.۵ ثانیه |
  | فروشگاه | ۴ ثانیه |
  | هر بررسی `/healthz` | ۴ ثانیه |

  پس کندی API ها صفحه را معطل نمی‌کند.

---

## ۶. سئو

- **هر صفحه:** title و description، canonical، Open Graph، Twitter Card و robots (`src/components/Seo.astro`).
- **schema:**
  - Organization روی همه‌ی صفحه‌ها.
  - FAQPage در صفحه‌ی اصلی و سوالات متداول.
  - Product با Offer به ریال، Breadcrumb، FAQ و ItemPage برای هر شمش.
  - BlogPosting و Breadcrumb برای مطالب مجله.
- **قیمت در HTML:** قیمت طلا در HTML صفحه‌های پویا نوشته می‌شود. پس موتورهای جست‌وجو و پیش‌نمایش لینک در پیام‌رسان‌ها قیمت واقعی را می‌بینند.
- **sitemap:** سه sitemap (`sitemap-index.xml`، `sitemap-shop.xml`، `mag/sitemap.xml`)، همه معرفی‌شده در `robots.txt`.
- **کد وضعیت:** ۴۰۴ واقعی برای صفحه‌ی ناموجود، ۳۰۱ برای آدرس‌های قدیمی و آدرس‌های با `/` در انتها، ۵۰۳ با `Retry-After` در قطعی موقت.
- **noindex:** جست‌وجوی مجله، `/healthz` و صفحه‌های ۴۰۴. `/login` در `robots.txt` بسته است.

---

## ۷. مجله (`/mag`) — وردپرس هدلس

- **ساختار:** نویسنده‌ها در `https://cms.arkan.gold/wp-admin` کار می‌کنند. صفحه‌های `arkan.gold/mag` هنگام بازدید از REST API وردپرس ساخته می‌شوند. انتشار مطلب به build نیاز ندارد.
- **آدرس‌ها:** دقیقاً همان آدرس‌های وردپرس حفظ می‌شوند: مطلب، دسته، برچسب، نویسنده و صفحه‌بندی `page/2`.
- **صفحه‌ها:**
  - **صفحه‌ی اصلی مجله:** مطالب ویژه (سنجاق‌شده‌ها)، بخش دسته‌های پرمطلب، بنر قیمت و خرید، و آخرین مطالب با تب دسته‌ها.
  - **صفحه‌ی مطلب:** فهرست مطالب خودکار، نوار پیشرفت مطالعه، اشتراک‌گذاری، معرفی نویسنده، ستون کناری (قیمت، آخرین مطالب، دسته‌ها) و مطالب مرتبط.
  - **صفحه‌های دیگر:** جست‌وجو `/mag?s=`، RSS در `/mag/rss.xml`، sitemap در `/mag/sitemap.xml`.
- **تصاویر:** با آدرس `arkan.gold/wp-content/uploads` سرو می‌شوند (پروکسی و کش). آدرس cms در صفحه‌ها نیست.
- **سئو از Yoast یا Rank Math (Pro):** عنوان، توضیحات، تصویر، noindex، schema های Pro (FAQ، HowTo و ...) و ریدایرکت‌های Rank Math.
- **پنهان ماندن cms از گوگل:** افزونه‌ی `arkan-headless` صفحه‌های عمومی cms را با ۳۰۱ به arkan.gold می‌فرستد و به همه‌ی پاسخ‌های وردپرس هدر noindex می‌دهد.
- **انتشار فوری:** افزونه بعد از هر انتشار یا ویرایش، `POST /mag/wp-revalidate` را با توکن `MAG_REVALIDATE_TOKEN` صدا می‌زند و کش مجله پاک می‌شود.
- **غیرفعال کردن مجله:** `PUBLIC_WP_API_URL=off`. منوها به آدرس قدیمی لینک می‌دهند.

### افزونه‌ی وردپرس `wordpress/arkan-headless` (نسخه ۲.۳)
| امکان | توضیح |
|---|---|
| هدایت ۳۰۱ | صفحه‌های عمومی cms ← همان آدرس در `arkan.gold/mag` (پیشخوان، API، پیش‌نمایش و آپلودها دست‌نخورده) |
| noindex | هدر `X-Robots-Tag` روی همه‌ی پاسخ‌ها؛ sitemap خود وردپرس خاموش |
| پاک‌سازی کش | با هر انتشار، ویرایش، حذف و تغییر دسته یا برچسب؛ دکمه‌ی دستی در «تنظیمات ← مجله هدلس» |
| `arkan_noindex` | فیلد REST برای noindex بودن مطلب، دسته، برچسب و نویسنده طبق Rank Math یا Yoast |
| `/wp-json/arkan/v1/redirects` | ریدایرکت‌های فعال ماژول Redirections رنک مث |
| بدون کش REST | هدرهای no-cache برای LiteSpeed Cache و CDN |

تنظیمات لازم Rank Math (Headless CMS Support، خاموش کردن Sitemap، Instant Indexing و 404 Monitor) در README آمده است.

---

## ۸. متغیرهای محیطی

| متغیر | زمان | پیش‌فرض | کاربرد |
|---|---|---|---|
| `PUBLIC_ARKAN_API_URL` | build | `https://api.arkan.gold` | API قیمت و شمش‌ها |
| `PUBLIC_WP_API_URL` | build | `https://cms.arkan.gold/wp-json` | REST API وردپرس مجله؛ `off` = مجله غیرفعال |
| `PUBLIC_VERIFY_API_URL` | build | `{WP}/arkan/v1/verify-bar` | API استعلام اصالت |
| `PUBLIC_GA4_ID` | build | — | گوگل آنالیتیکس |
| `PUBLIC_YEKTANET_ID` | build | — | یکتانت |
| `PUBLIC_ENAMAD_ID`، `PUBLIC_ENAMAD_CODE` | build | — | نماد اعتماد الکترونیکی (کد رسمی اینماد) |
| `PORT` | اجرا | `4321` (در Docker `3000`) | پورت سرور |
| `HOST` | اجرا | همه‌ی رابط‌ها | آدرس گوش دادن سرور |
| `MAG_REVALIDATE_TOKEN` | اجرا | — | رمز پاک‌سازی کش مجله (حداقل ۱۶ کاراکتر؛ همان رمز در افزونه‌ی وردپرس) |
| `PUBLIC_IR_MIRROR` | build | روشن | دامنه‌ی جایگزین arkangold.ir؛ `off` = غیرفعال |
| `MEDIA_CACHE_DIR` | اجرا | `./cache/uploads` | محل کش تصاویر مجله (مثلا روی دیسک ماندگار) |

متغیرهای `PUBLIC_*` در build خوانده و داخل خروجی نوشته می‌شوند. برای تغییرشان باید دوباره build کرد. نمونه‌ی همه‌ی متغیرها در `.env.example` آمده است.

ثابت‌هایی که در کد هستند و متغیر محیطی ندارند، در `src/config/site.ts` تعریف شده‌اند: کارمزد معامله (`TRADE_FEE_PERCENT`)، عیار، تلفن، آدرس دفتر، ساعات کاری، شبکه‌های اجتماعی و چت آنلاین.

---

## ۹. اجرا و دیپلوی

### روی سیستم خودتان
```bash
npm install
```
```bash
npm run dev
```
`npm run dev` سایت را در حالت توسعه روی `http://localhost:4321` اجرا می‌کند. برای اجرای خروجی production:
```bash
npm run build
```
```bash
npm start
```

### خروجی build
پوشه‌ی `dist/app` (حدود ۳ مگابایت). روی سرور `npm install` لازم نیست.
```
dist/app/
  client/     فایل‌های ایستا (+ نسخه‌ی فشرده‌ی .br و .gz)
  entry/      باندل سرور Astro
  server.mjs  سرور (npm start)
  app.cjs     فایل شروع Passenger
  package.json, tmp/restart.txt
```

### رانفلر (هاست فعلی)
- **روش GIT (پیشنهادی، خودکار):** مخزن و شاخه‌ی `main` را وصل کنید.
  - پورت `3000` و متغیر `PORT=3000`.
  - اگر بدون Docker build می‌کند: build با `npm run build` و اجرا با `npm start`.
- **روش دستی:** `npm run build` و zip **محتوای** پوشه‌ی `dist/app`، بدون `node_modules`.
- **متغیرهای سرویس:** `MAG_REVALIDATE_TOKEN`، و اختیاری `MEDIA_CACHE_DIR` روی دیسک ماندگار.
- **دیسک:** لازم نیست. فقط کش تصاویر مجله را بعد از دیپلوی نگه می‌دارد.
- **دامنه:** `arkan.gold` را به سرویس وصل کنید و بعد `/healthz` را بررسی کنید.

### Docker
```bash
docker build -t arkan-gold .
```
```bash
docker run -p 3000:3000 -e MAG_REVALIDATE_TOKEN=... arkan-gold
```

### cPanel (Setup Node.js App)
- Application root: پوشه‌ی آپلود `dist/app`
- Application URL: `arkan.gold`
- Startup file: `app.cjs`
- بعد از هر آپلود، `tmp/restart.txt` را آخر از همه آپلود کنید.

### GitHub Actions
`.github/workflows/deploy.yml` با هر push به `main` سایت را build می‌کند و با SSH یا FTP روی هاست آپلود می‌کند. Secrets لازم در README آمده است. با روش GIT رانفلر این workflow لازم نیست.

### بعد از دیپلوی
- `https://arkan.gold/healthz`: باید `goldPrice`، `shop` و `magazine` هر سه `"ok": true` باشند.
- Search Console: سه sitemap ثبت شده باشند و **Test Live URL** موفق باشد. هاست باید به گوگل، یعنی ترافیک خارج از ایران، دسترسی بدهد.

---

## ۹-ب. دامنه‌ی جایگزین arkangold.ir (قطعی اینترنت بین‌الملل)

همان برنامه و محتوا روی `arkan.gold` و `arkangold.ir` اجرا می‌شود. هر سرویس آدرس هم‌ارز `.ir` دارد:
`api.arkangold.ir`، `app.arkangold.ir` و `cms.arkangold.ir` (`src/lib/endpoints.ts`).

- **درخواست‌ها:** مرورگر اول سرویس هم‌دامنه‌ی صفحه را صدا می‌زند. سرور، که داخل ایران است، اول `.ir` را صدا می‌زند. اگر خطای شبکه یا ۵۰۲/۵۰۳/۵۰۴ بیاید، دامنه‌ی دیگر امتحان می‌شود و دامنه‌ای که جواب داده به خاطر سپرده می‌شود.
- **لینک‌ها روی arkangold.ir:** ورود، خرید، ماشین‌حساب، چت آنلاین و `/login` به `app.arkangold.ir` می‌روند (`src/lib/domainLinks.ts`).
- **سئو:** canonical، og:url، schema و sitemap ها روی هر دو دامنه **همیشه** `arkan.gold` هستند. گوگل `arkangold.ir` را نسخه‌ی تکراری نمی‌بیند و اعتبارش به `arkan.gold` می‌رسد.
  - `arkangold.ir` را noindex نکنید و به `arkan.gold` ریدایرکت نکنید؛ ریدایرکت در قطعی، دسترسی کاربران را قطع می‌کند.
  - در Search Console برای `arkangold.ir` ملک Domain بسازید ولی sitemap ثبت نکنید. وضعیت «Alternate page with proper canonical tag» برای صفحه‌های آن طبیعی است.
  - بک‌لینک‌ها و تبلیغات را به `arkan.gold` بدهید.
  - لینک فوتر به `arkangold.ir` با `rel="nofollow"` است.
- **پیش‌نیاز سرورها:**
  - گواهی SSL معتبر روی هر سه آدرس `.ir`.
  - `api.arkangold.ir` باید هدر CORS برای هر دو origin بدهد: `https://arkan.gold` و `https://arkangold.ir`.
  - `cms.arkangold.ir` باید REST API و فایل‌های `wp-content/uploads` را مثل `cms.arkan.gold` سرو کند.
  - `app.arkangold.ir` باید کامل کار کند: ورود، پرداخت و چت.
- **غیرفعال کردن:** `PUBLIC_IR_MIRROR=off`.

---

## ۱۰. کارهای رایج

| کار | کجا |
|---|---|
| تغییر کارمزد، تلفن، آدرس، ساعات کاری، شبکه‌های اجتماعی | `src/config/site.ts` |
| تغییر منوهای هدر، موبایل و فوتر | `src/data/nav.ts` (لینک‌های اضافه‌ی فوتر در `src/components/Footer.astro`) |
| کارت‌های «محصولات و خدمات طلا» صفحه‌ی اصلی | `src/components/sections/ProductCategories.astro` |
| بخش سامانه‌ی ناظر بانک مرکزی | `src/components/sections/SupervisorBanner.astro` |
| فهرست مجوزها | `src/pages/licenses.astro` (آرایه‌ی ابتدای فایل) |
| سوالات متداول | `src/data/faq.ts` |
| قوانین و مقررات | `src/data/rules.ts` |
| **تصویر نمادهای فوتر** (اتحادیه کسب‌وکارهای مجازی، اتحادیه طلا، فین‌تک، بانک مرکزی) | فایل تصویر را با نام `virtual-business-union`، `gold-union`، `fintech` یا `central-bank` (پسوند png/jpg/webp/svg) در `src/assets/trust/` بگذارید. نام و لینک‌ها در `src/data/trustSeals.ts` است |
| نماد اعتماد الکترونیکی (اینماد) | `PUBLIC_ENAMAD_ID` و `PUBLIC_ENAMAD_CODE` |
| آیکون جدید | `src/lib/icons.ts` |
| رنگ‌ها و اندازه‌ی فونت | `tailwind.config.mjs` و `src/styles/global.css` |
| صفحه‌ی جدید | فایل جدید در `src/pages/` با `BaseLayout` |
| مطلب، دسته یا نویسنده‌ی مجله | پنل وردپرس `cms.arkan.gold` (بدون تغییر کد) |
| ثبت شمش برای استعلام اصالت | پنل وردپرس ← «شمش‌های آرکان» (افزونه‌ی `arkan-bar-verify`) |

---

## ۱۱. عیب‌یابی سریع

| مشکل | علت و راه‌حل |
|---|---|
| `npm run build`: `Cannot find module '@astrojs/node'` | بعد از گرفتن تغییرات، `npm install` بزنید |
| همه‌ی صفحه‌ها خطای ۵۰۰ در `npm run dev` | نسخه‌ی قدیمی؛ تغییرات جدید را بگیرید (`noExternal` فقط در build) |
| مجله ۴۰۴ می‌دهد | `/healthz` ← بخش `magazine` علت را نشان می‌دهد (مثلا بسته بودن REST API وردپرس) |
| ویرایش مطلب دیده نمی‌شود | حداکثر ~۲.۵ دقیقه؛ برای فوری بودن `MAG_REVALIDATE_TOKEN` را روی سرویس و افزونه یکی کنید (README) |
| قیمت «در حال دریافت...» می‌ماند | `api.arkan.gold` در دسترس نیست یا CORS برای `arkan.gold` باز نیست |
| آدرس cms در گوگل | افزونه‌ی `arkan-headless` فعال، گزینه‌ی «جلوگیری از ایندکس» وردپرس خاموش، قطعه‌ی `.htaccess` روی cms، و Removals در Search Console |
| گوگل صفحه‌ها را نمی‌بیند | Test Live URL در Search Console؛ اگر خطا داد، هاست ترافیک خارج از ایران را بسته است |
