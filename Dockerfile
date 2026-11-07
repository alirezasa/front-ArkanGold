# ایمیج Docker سایت آرکان گلد — برای رانفلر یا هر سرویس مبتنی بر Docker/Kubernetes
#   docker build -t arkan-gold .
#   docker run -p 3000:3000 arkan-gold
# متغیرهای PUBLIC_* در build خوانده می‌شوند:  docker build --build-arg PUBLIC_GA4_ID=G-XXXX .
# MAG_REVALIDATE_TOKEN در زمان اجرا (تنظیمات سرویس) تعریف می‌شود.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# بررسی نصب: npm گاهی با خطای شبکه هم کد موفق برمی‌گرداند
RUN npm ci --no-audit --no-fund && test -x node_modules/.bin/astro
COPY . .
ARG PUBLIC_WP_API_URL=""
ARG PUBLIC_ARKAN_API_URL=""
ARG PUBLIC_VERIFY_API_URL=""
ARG PUBLIC_GA4_ID=""
ARG PUBLIC_YEKTANET_ID=""
ARG PUBLIC_ENAMAD_ID=""
ARG PUBLIC_ENAMAD_CODE=""
RUN npm run build

# اجرا: فقط خروجی build (باندل سرور همه‌ی وابستگی‌ها را دارد؛ node_modules لازم نیست)
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/dist/app ./
RUN mkdir -p cache && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=10s --start-period=20s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" >/dev/null || exit 1
CMD ["node", "server.mjs"]
