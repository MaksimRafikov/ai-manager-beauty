# AI-маркетолог салона красоты — демо-сайт

Публичное демо управленческой аналитики клиентской базы (YClients).

- Продукт: **AI-маркетолог салона красоты**
- Демо-салон: **M-Salon**, Уфа
- Хостинг (план): `ai-manager-beauty.maximrafikov.ru`
- Стек: Vite + TypeScript, ECharts, Driver.js, SheetJS

## Важно

Репозиторий **публичный** и не содержит реальных данных Sisters, токенов и ID `41059` / `948848`.
JSON собирается в приватном продуктовом репозитории:

```bash
python scripts/30_export_demo_site_json.py --out ../ai-manager-beauty/public/data/demo-dashboard.json
```

## Локальный запуск

```bash
npm install
npm run dev
```

Перед продом:

1. Подставить ID Яндекс.Метрики в `src/metrika.ts`
2. DNS (Cloudflare, зона `maximrafikov.ru`):

   | Type  | Name                 | Target                     | Proxy |
   |-------|----------------------|----------------------------|-------|
   | CNAME | `ai-manager-beauty`  | `MaksimRafikov.github.io`  | DNS only (grey cloud) |

   После записи: в репо Settings → Pages → Custom domain = `ai-manager-beauty.maximrafikov.ru`, Enforce HTTPS.

Форма заявки: **Formspree** `https://formspree.io/f/xppwgapv` → письмо на `maxim.rafikov@gmail.com`.  
Если POST падает — fallback: черновик в Telegram `@mxm_r`.

Деплой: push в `main` → GitHub Actions → GitHub Pages (`public/CNAME`).

## Этап 1

Метод, интерактивный дашборд, тур 8 шагов, Excel, форма, мобильная вёрстка, цели Метрики.
