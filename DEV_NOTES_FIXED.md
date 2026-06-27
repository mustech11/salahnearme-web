# DEV_NOTES.md — SalahNearMe

## Project overview
SalahNearMe is a Next.js app for discovering mosques and halal businesses across UK cities, with Stripe-powered paid plans for featured listings and mosque sponsorship.

## Local development

### Start the app
```bash
npm run dev
```

Then open:
```text
http://localhost:3000
```

### Stop the app
In the terminal running Next.js:
```text
Ctrl + C
```

### Install dependencies
```bash
npm install
```

### Production build test
```bash
npm run build
npm start
```

## Stripe local testing

### Log in to Stripe CLI
```bash
stripe login
```

### Forward webhooks to local app
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This prints a webhook signing secret that usually looks like:
```text
whsec_...
```

Put that value into:
```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Trigger a test webhook
```bash
stripe trigger checkout.session.completed
```

## Environment variables

Create a `.env.local` file with values like these:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_FEATURED_BUSINESS=...
STRIPE_PRICE_SPONSOR_MOSQUE=...

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Important environment rules

- `NEXT_PUBLIC_*` variables are exposed to the browser.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.
- `STRIPE_SECRET_KEY` must stay server-only.
- Local Stripe webhook secret from Stripe CLI is not the same as the live production webhook secret.
- `NEXT_PUBLIC_APP_URL` should be `http://localhost:3000` locally and your real domain in production.

## Key routes

### Public pages
- `/`
- `/{city}`
- `/{city}/mosques`
- `/{city}/businesses`
- `/mosque/{slug}`
- `/business/{slug}`
- `/sponsor/mosque/{slug}`

### Stripe routes
- `/api/stripe/checkout`
- `/api/stripe/webhook`

## Stripe payment flow

1. User selects a business and plan.
2. Frontend posts to `/api/stripe/checkout`.
3. App creates a Stripe Checkout session.
4. Session ID and pending status are stored in Supabase.
5. User pays on Stripe Checkout.
6. Stripe sends webhook to `/api/stripe/webhook`.
7. Webhook marks business as paid/featured/sponsored in Supabase.

## Common commands

### Check git status
```bash
git status
```

### Add all changes
```bash
git add .
```

### Commit changes
```bash
git commit -m "Describe your change"
```

## Deployment reminders

Before going live:

- set all production environment variables
- set the real production Stripe webhook endpoint in Stripe
- use the live Stripe webhook secret in production
- set `NEXT_PUBLIC_APP_URL` to your real production domain
- confirm Supabase Row Level Security and policies are correct
- test checkout, webhook, success page, cancel page, and bad URL handling

## Troubleshooting

### App does not start
Check:
- Node.js is installed
- `.env.local` exists
- dependencies are installed

### Stripe checkout fails
Check:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_FEATURED_BUSINESS`
- `STRIPE_PRICE_SPONSOR_MOSQUE`
- `NEXT_PUBLIC_APP_URL`

### Webhook fails
Check:
- Stripe CLI is running locally
- `STRIPE_WEBHOOK_SECRET` matches the secret printed by `stripe listen`
- local route is `/api/stripe/webhook`

### Supabase update fails
Check:
- `SUPABASE_SERVICE_ROLE_KEY`
- table columns exist
- IDs being written match your DB types

## Recommended next files to review
- `lib/supabaseServer.ts`
- `lib/stripe.ts`
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `components/SponsorMosqueClient.tsx`
