# Shopify Returns, Exchanges & Store Credit Manager

A Shopify embedded app that lets merchants manage return and exchange requests, issue store credit, and offer customers a self-service returns portal.

## Features

- **Admin dashboard** — overview of returns, exchanges and outstanding store credit.
- **Returns management** — review, approve, reject and complete return requests.
- **Exchanges management** — review and approve exchange requests with new item details.
- **Store credit** — issue and track customer credit balances.
- **Customer portal** — public `/returns/:shop` page where customers can look up an order by number and email, select items, and submit a return.
- **Settings** — configure return window, allowed resolutions, and default refund method.
- **MySQL database** — Prisma ORM with a MySQL backend (local Docker compose included).

## Tech stack

- [Remix](https://remix.run)
- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix)
- [Polaris](https://polaris.shopify.com/) + [App Bridge](https://shopify.dev/docs/api/app-bridge)
- [Prisma](https://prisma.io/) + MySQL
- [Docker Compose](https://docs.docker.com/compose/)

## Prerequisites

- Node.js `>=20.19` (the engine check may require `--force` on Node 20.18)
- npm 10+
- Docker & Docker Compose (for local MySQL)
- [Shopify Partner account](https://partners.shopify.com/signup) and a development store

## Local setup

1. Clone the repo and install dependencies:

```shell
npm install --force
```

2. Start the local MySQL container:

```shell
docker compose up -d
```

3. Copy the example environment file and fill in your Shopify Partner app credentials:

```shell
cp .env.example .env
```

4. Run the database migrations:

```shell
npx prisma migrate dev
```

5. Start the Shopify development server:

```shell
npm run dev
```

The Shopify CLI will log in to your Partner account, create a tunnel, and connect the app.

## Environment variables

See `.env.example` for required variables:

- `SHOPIFY_API_KEY` — from your Shopify app partner dashboard
- `SHOPIFY_API_SECRET` — from your Shopify app partner dashboard
- `SCOPES` — `read_orders,write_orders,read_products,read_customers,write_customers`
- `DATABASE_URL` — MySQL connection string, e.g. `mysql://returns:returns@localhost:3306/returns_manager`
- `SHOPIFY_APP_URL` — public app URL (provided by `shopify app dev` tunnel)

## Scopes

The app requests:

- `read_orders`, `write_orders` — to read order data and create refunds/returns
- `read_products` — to display product details
- `read_customers`, `write_customers` — to identify customers and store credit balances

## Customer portal

After installing the app, customers can visit:

```
https://<your-app-host>/returns/<shop-domain>?orderName=<order>&email=<email>
```

Merchants can find the portal URL in the **Settings** page inside the Shopify Admin app.

## Deployment

Build the app with:

```shell
npm run build
```

Host on a platform that supports Node.js (Fly.io, Heroku, Railway, Render, etc.). Set `NODE_ENV=production` and a production `DATABASE_URL`.

## License

MIT
