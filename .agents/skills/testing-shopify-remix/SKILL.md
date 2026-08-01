---
name: Testing Shopify Remix embedded apps (returns-manager)
description: How to set up and end-to-end test a Shopify Remix embedded app that uses Prisma + MySQL, including local build/dev server, public customer portal routes, and OAuth-gated admin routes.
---

# Testing Shopify Remix embedded apps

## Devin Secrets Needed

- `DATABASE_URL` or use the docker-compose default: `mysql://returns:returns@localhost:3306/returns_manager`
- `SHOPIFY_API_KEY` (for `shopify.server.ts` / `shopify app dev`)
- `SHOPIFY_API_SECRET` (for `shopify.server.ts` / `shopify app dev`)
- `SHOPIFY_APP_URL` (public app / tunnel URL)
- `SHOPIFY_PARTNER_EMAIL` / `SHOPIFY_PARTNER_PASSWORD` (only useful for manual Partner dashboard login; Shopify CLI uses OAuth, not these credentials)
- `SHOPIFY_STOREFRONT_PASSWORD` / `SHOPIFY_STORE_EMAIL` / `SHOPIFY_STORE_PASSWORD` (if a dev store is available)

## Local stack setup

1. Start MySQL:
   ```bash
   docker compose up -d
   ```
2. Install dependencies (Node 20.18 may need `--force` because the repo engines require `>=20.19`):
   ```bash
   npm install --force
   ```
3. Generate Prisma client and apply migrations:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
   Prefer `migrate deploy` over `migrate dev` in automated testing to avoid interactive prompts.
4. Build:
   ```bash
   npm run lint
   DATABASE_URL='mysql://...' SHOPIFY_API_KEY='dummy' SHOPIFY_API_SECRET='dummy' SCOPES='read_orders,write_orders,read_products,read_customers,write_customers' SHOPIFY_APP_URL='http://localhost:3000' npm run build
   ```

## Running the production server locally

```bash
DATABASE_URL='mysql://...' SHOPIFY_API_KEY='dummy' SHOPIFY_API_SECRET='dummy' SCOPES='...' SHOPIFY_APP_URL='http://localhost:3000' npm run start
```

Dummy API credentials are sufficient for public routes; the server will start and Prisma works. Admin routes under `/app/*` require a real Shopify OAuth session and will return `410` or redirect if not embedded/authenticated.

## Running the Shopify dev server

`npm run dev` maps to `shopify app dev`. As of this repo, `@shopify/cli` is **not** in `package.json`, so the command may fail with `shopify: not found`. Workarounds:

- Install `@shopify/cli` globally or add it to devDependencies.
- For Node 20.x, use an older CLI version such as `npx @shopify/cli@3.75.0 app dev` because `@shopify/cli@latest` requires Node `>=22.12.0`.

`shopify app dev` needs:

1. Partner account login (OAuth — opens a browser/activation URL).
2. A linked app (`shopify.app.toml` `client_id`).
3. An existing development store, or permission to create one.

If any of these are missing, mark admin/embedded routes as **untestable** and report the exact blocker.

## Common failure modes to watch for

- **Public routes using Polaris `Page`/`Card` crash with `MissingAppProviderError`**: every public route using Polaris components must export a `links` function loading `polarisStyles` and wrap its JSX in `<AppProvider i18n={translations}>`. Admin routes get this from `app.tsx` via `AppProvider` from `@shopify/shopify-app-remix/react`, but standalone public routes must do it themselves.
- **`@shopify/cli` not installed**: check `node_modules/.bin/shopify` before relying on `npm run dev`.
- **Node version mismatch**: Node `20.18.x` may need `--force`; Node `22.12+` for CLI v4.x.
- **Build CSS warning**: `esbuild css minify` may warn about `@media (--p-breakpoints-md-up) and print{` but the build still passes.
