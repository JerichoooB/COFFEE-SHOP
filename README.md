# Brew Haven

A responsive coffee shop storefront with a cream and espresso palette, React customer flows, an Express REST API, and a Neon PostgreSQL data layer. The frontend and API run independently. Currency is Philippine pesos; orders are **Pay at Counter**, with pickup or dine-in.

## Requirements

- Node.js 22.12+ (validated here with Node 24), npm 11
- A **Neon PostgreSQL pooled connection string**, retaining the TLS parameters supplied by Neon
- No local database, Firebase, or Supabase is used

## Quick start

```sh
npm ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` locally. Never commit it or paste credentials into a chat:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@YOUR-ENDPOINT-pooler.REGION.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
PORT=5000
CLIENT_URL=http://localhost:5173
```

Use the **pooled** URL from Neon’s Connect dialog. Keep its security parameters (including `sslmode` and `channel_binding` when supplied); do not disable certificate verification. The backend rejects local/non-Neon hosts, non-pooled URLs, and non-TLS URLs. Generate your own session key with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and save it directly to the local environment file. The database URL belongs only in the backend, never in any `VITE_` variable.

Migrations create tables; seeds add sample products. Run only against the intended development Neon database:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Migrations are recorded in `schema_migrations` and run in one transaction with a transaction-scoped advisory lock, compatible with Neon pooling. Concurrent deployment builds serialize schema changes. Seeds are repeatable and preserve existing catalog records. No administrative account is seeded. Register an account through the website, then promote that existing account:

```sh
npm run admin -w backend -- YOUR_ACCOUNT_EMAIL
```

Sign out and back in, then visit `/admin`. Roles are loaded from the database on each authenticated request.

### Run independently

```sh
npm run dev -w backend
npm run dev -w frontend
```

The frontend uses port 5173 and proxies `/api` to port 5000. The backend loads `backend/.env` regardless of the current directory. If you change the frontend origin, update `CLIENT_URL` to that exact origin. For an independent frontend deployment, set `VITE_API_URL` to the public API URL and configure HTTPS and same-site frontend/API hosting for the session cookie. Cross-site hosting requires a separate, deliberate cookie/CSRF deployment design.

Without `DATABASE_URL`, the frontend displays an explicitly labeled **sample catalog**; all database API calls return 503. Carts, accounts, and orders do not fake success or store persistent application data in the browser. Development can run with an ephemeral session key; production requires a configured key, database URL, and client origin.

## Features

- Responsive home, story, gallery, configurable contact/map placeholder, category filtering, search, and product detail dialog
- Registration, login/logout, profile, authenticated persistent carts, pickup/dine-in checkout, confirmation, and order history
- Admin overview with seven-day completed-sales chart, products/availability/featured flags, categories, orders/status filters, and customers/order history
- PostgreSQL migrations covering users, categories, products, carts/items, orders/items, and reviews
- Transactional orders using current database prices, integer-cent calculations, immutable item name/price snapshots, and serialized cart changes
- HttpOnly SameSite session cookies, secure cookies in production, JWT verification, bcrypt, Zod validation, parameterized SQL, rate limits, CORS, origin checks, Helmet, and backend role/ownership enforcement

The newsletter is visibly disabled until an email subscription provider is implemented. Contact information and opening hours are not invented. Configure the optional `VITE_CAFE_*` variables in `frontend/.env` and rebuild. The gallery, menu photos, use Unsplash and need browser network access to images.unsplash.com. A bundled coffee illustration replaces blocked images. Inter and Playfair Display fonts are bundled locally through Fontsource. No specific visual reference image was included beyond the written Minimal Elegant brief.

## API

All endpoints are under `/api`. Send JSON for mutations. Authenticated requests use the HttpOnly cookie (`withCredentials` in Axios); no tokens are saved in localStorage. Browser mutations must include the exact configured `Origin`.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` — executes `SELECT NOW()`; 503 when disconnected |
| Authentication | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Products | `GET /products?search=&category=UUID`, `GET /products/:id`; admin `POST /products`, `PUT /products/:id`, `DELETE /products/:id` |
| Categories | `GET /categories`; admin `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id` |
| Cart | `GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id` |
| Orders | `POST /orders`, `GET /orders/my-orders`, `GET /orders/:id` (owner only) |
| Admin | `GET /admin/orders?status=`, `PATCH /admin/orders/:id/status`, `GET /admin/dashboard/stats`, `GET /admin/customers`, `GET /admin/customers/:id/orders` |

Checkout accepts only `customer_name`, `contact_number`, `order_type` (`pickup` or `dine-in`), and optional `notes`; items come from the user’s persisted cart. Client prices and totals are rejected. Product quantities are limited to 1–20. Product deletion retains past order snapshots; categories containing products cannot be deleted.

## Validation

```sh
npm test
npm run build
curl -i http://127.0.0.1:5000/api/health
```

The automated backend suite tests health failures/success with injected database doubles, authentication/authorization, origin checks, session cookie clearing, validation, Neon URL restrictions, cent arithmetic, checkout commit, rollback, and unavailable/empty cart handling. These tests **do not establish live Neon connectivity**.

Live database verification remains required after supplying credentials: migrate, seed, require a 200 `connected` health response, register/login a disposable test account, add a product, change quantities, place an order, confirm the server total and cleared cart, inspect history, and verify customer/admin permissions and dashboard data. Test against a development Neon branch. No local PostgreSQL substitute should be used.

For production, use HTTPS, a persistent JWT secret, a managed Node process, restrictive network settings, backups, and the built `frontend/dist` with SPA route fallback. Rate limiting uses Vercel’s proxy-written `x-real-ip` header only when `VERCEL=1`, and the direct socket address elsewhere. Arbitrary `Forwarded`/`X-Forwarded-For` headers are not used as client identities. IPv6 addresses are grouped into /56 subnets. Limits use per-instance memory; Vercel instances do not share counters. The Vite development server is for development.

## Deploy the full application to Vercel

Import this GitHub repository into Vercel. Use the repository root as **Root Directory** (leave it blank), not `frontend/`. The included `vercel.json` builds the Vite frontend into `frontend/dist`, deploys `api/index.js` as the Express serverless handler, and sends frontend routes to the SPA. The function imports the application without starting an HTTP listener.

In Vercel project settings, add these variables to **Production** before deploying:

- `DATABASE_URL`: the Neon pooled PostgreSQL URL with its TLS parameters
- `JWT_SECRET`: a stable random secret of at least 32 characters
- `CLIENT_URL`: the exact HTTPS production domain, with no trailing slash
- `NODE_ENV`: `production`

Leave `VITE_API_URL` unset (the default `/api` keeps cookies and API requests on the same site). Do not expose database credentials in `VITE_` variables. Preview deployments need their own matching `CLIENT_URL` and preferably a separate development Neon branch.

Commit and push the project to the connected production branch (usually `main`), then inspect **Deployments** in Vercel. Changing environment variables requires a new deployment. A configured domain alone does not create a deployment. If automatic deployments are disabled, choose **Create Deployment** for the connected branch in Vercel, or deploy from an authenticated CLI with `vercel --prod`.

Vercel now runs `npm run db:migrate && npm run db:seed && npm run build` automatically. Set `DATABASE_URL` in Vercel **before** deploying: the deployment build creates missing tables, applies new migrations once, and seeds the catalog without overwriting existing product records. A missing or inaccessible database fails the build instead of deploying an unusable API. If you previously enabled a Build Command override in Vercel settings, disable it so `vercel.json` is used. `npm run build` alone remains a frontend-only build for local development. Confirm `/api/health` returns HTTP 200 and `database: connected`, then test account creation and ordering on the deployed domain. Promote an existing owner account with the documented admin script. Vercel credentials and live Neon access are required to verify an actual production deployment; local tests do not establish deployment success.

## Drink sizes and updated interface

Drinks offer Small, Medium, and Large. Starting seed prices are the base price, +₱20, and +₱40 respectively; admins can edit all three prices in Products. New products are single-size until “Offer Small, Medium, and Large” is enabled. Pastries/desserts remain Regular. The customer chooses a size in the product dialog; different sizes occupy separate cart lines, appear through checkout/history/admin, and are priced again from the current database catalog during checkout. A removed size cannot be purchased. Migration `002_drink_sizes.sql` preserves historic order prices and labels, and converts existing drink carts to Small.

The UI includes the custom SVG Brew Haven mark (`frontend/public/logo.svg`), a matching favicon, refined menu cards, price sorting, size controls, mobile filters, and refreshed account/cart panels. Registration requires 8–15 characters; login still accepts existing longer passwords.

### Browser regression tests

```sh
npx playwright install chromium
npm run test:e2e
```

For an installed Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Browser tests cover desktop/mobile layouts, menu filtering/sorting, drink sizes, cart/checkout, signup limits, and admin price editing with an explicitly mocked API. They do not establish live Neon readiness.

The PostgreSQL pool explicitly uses `sslmode=verify-full` (with all other connection parameters preserved), retaining the certificate and hostname verification that pg currently applies to `require`. You do not need to change your Neon connection string to silence pg’s SSL compatibility warning.

Vercel explicitly rewrites `/api/:path*` to the single `api/index.js` function before the frontend SPA fallback. This is required for nested routes such as `/api/auth/login` and `/api/orders/my-orders`. API responses are checked before entering React state; malformed responses show an error instead of turning the account page blank.
