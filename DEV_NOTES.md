# DEV_NOTES.md

## Project
**Brand:** SalahNearMe  
**Scope:** Multi-city UK mosque + halal business discovery platform  
**Stack:** Next.js App Router + Supabase + Stripe

---

## Local development

### Start the Next.js app
```bash
npm run dev
```

This usually starts the site at:
```bash
http://localhost:3000
```

### Stop the app
In the terminal running the dev server:
```bash
Ctrl + C
```

### Install dependencies
If needed:
```bash
npm install
```

### Production build test
Use this before deployment to catch issues that may not appear in dev:
```bash
npm run build
npm start
```

---

## Stripe local testing

Your project has these Stripe files:
- `lib/stripe.ts`
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/webhook/route.ts`

### Stripe checkout route
`POST /api/stripe/checkout`

Expected request body:
```json
{
  "business_id": "<business uuid>",
  "plan": "featured" | "sponsor",
  "sponsor_mosque_id": "<mosque uuid if sponsor plan>"
}
```

### Start Stripe webhook forwarding locally
If Stripe CLI is installed, the command is usually:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

When you run that command, Stripe CLI prints a webhook signing secret that usually looks like:
```bash
whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Put that value into your local env file as:
```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Trigger a test webhook manually
```bash
stripe trigger checkout.session.completed
```

### Stop Stripe listener
In the terminal running Stripe:
```bash
Ctrl + C
```

---

## Environment variables

Create a local env file if you have not already:
```bash
.env.local
```

Based on your current code, these variables are needed:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_FEATURED_BUSINESS=
STRIPE_PRICE_SPONSOR_MOSQUE=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Notes on each env var
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon key used by the app
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key for secure updates in Stripe routes
- `STRIPE_SECRET_KEY`: Stripe secret API key
- `STRIPE_WEBHOOK_SECRET`: webhook secret from Stripe CLI locally, or from Stripe dashboard in production
- `STRIPE_PRICE_FEATURED_BUSINESS`: Stripe price ID for featured listing payments
- `STRIPE_PRICE_SPONSOR_MOSQUE`: Stripe price ID for mosque sponsorship payments
- `NEXT_PUBLIC_APP_URL`: base app URL; local is usually `http://localhost:3000`

### Important security note
Never expose `SUPABASE_SERVICE_ROLE_KEY` in client-side code.
It should only be used in server routes like your Stripe API routes.

---

## Current Stripe flow in this project

### 1) Checkout route
File:
- `app/api/stripe/checkout/route.ts`

What it does:
- receives `business_id` and selected plan
- validates sponsor plan requires `sponsor_mosque_id`
- creates a Stripe Checkout Session
- stores:
  - `stripe_session_id`
  - `stripe_payment_status = "created"`
  - selected `plan`
  - `sponsor_mosque_id` if sponsor flow
- returns checkout URL to the frontend

### 2) Webhook route
File:
- `app/api/stripe/webhook/route.ts`

What it does:
- verifies Stripe signature
- handles:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.expired`
- when paid, updates the business with:
  - `stripe_customer_id`
  - `stripe_payment_status = "paid"`
  - `featured = true`
  - `featured_until`
  - `paid_until`
  - `plan`
  - `sponsor_mosque_id` depending on plan
- when expired, sets:
  - `stripe_payment_status = "expired"`

### 3) Stripe SDK file
File:
- `lib/stripe.ts`

Current code uses:
```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
});
```

---

## Recommended local workflow

### Start app
```bash
npm run dev
```

### Start Stripe listener in a second terminal
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Open the site
```bash
http://localhost:3000
```

### Test payment flow
1. Go to a sponsorship or featured payment flow in the UI
2. Start checkout
3. Complete payment using Stripe test card
4. Confirm webhook updates the `businesses` table

### Common Stripe test card
```bash
4242 4242 4242 4242
```
Use any future expiry date, any 3-digit CVC, and any postcode.

---

## Pages currently in the project flow

### Main public pages
- `/`
- `/{city}`
- `/{city}/mosques`
- `/{city}/businesses`
- `/mosque/{slug}`
- `/business/{slug}`
- `/sponsor/mosque/{slug}`

### Route support pages
- `app/loading.tsx`
- `app/error.tsx`
- `app/not-found.tsx`

---

## Data model notes from your project

### `cities`
Used for dynamic city routes.
Important columns visible from your screenshots/code:
- `id`
- `slug`
- `name`
- `country`
- `is_active`

### `mosques`
Used for mosque detail pages and city mosque listings.
Important columns seen in code/screenshots:
- `id`
- `name`
- `slug`
- `address`
- `area`
- `postcode`
- `city`
- `maps_url` (used in code)

### `businesses`
Used for business pages, city business listings, and Stripe monetisation.
Important columns seen in code/screenshots:
- `id`
- `name`
- `slug`
- `category`
- `area`
- `city`
- `address`
- `postcode`
- `featured`
- `featured_rank`
- `website`
- `maps_url`
- `plan`
- `sponsor_mosque_id`
- `stripe_session_id`
- `stripe_payment_status`
- `stripe_customer_id`
- `featured_until`
- `paid_until`

### `iqamah_reports`
Appears to store live prayer-related reporting.
Important columns visible in screenshot:
- `id`
- `mosque_id`
- `prayer`
- `report_type`
- `created_at`

### `mosque_friday_info`
Exists in schema; likely for Friday/Jumu'ah data.

### `profiles`
Appears to store user/admin records.
Important columns visible in screenshot:
- `id`
- `email`
- `role`
- `is_admin`
- `created_at`

### `mosques_stage`
Appears to hold staging/import data including coordinates.
Important screenshot columns:
- `id`
- `latitude`
- `longitude`

### `hadiths`
Exists in same database, but appears unrelated to the main mosque/business discovery flow.

---

## Deployment notes

### Local vs production
Local development:
- you run `npm run dev`
- you run Stripe CLI manually

Production:
- hosting platform runs the app automatically
- domain points to deployed app
- Stripe webhook should be set in Stripe dashboard to your real live URL
- you do **not** rely on local Stripe CLI for real traffic

### Before going live
Run:
```bash
npm run build
```

Check all of these:
- homepage loads
- city pages load
- mosque pages load
- business pages load
- sponsorship page works
- Stripe checkout creates session
- Stripe webhook updates business records
- bad URLs show not-found page
- errors show error page

---

## Recommended SQL indexes

These are the most important columns to index for performance:

```sql
create index if not exists idx_cities_slug on public.cities(slug);
create index if not exists idx_cities_is_active on public.cities(is_active);

create index if not exists idx_mosques_slug on public.mosques(slug);
create index if not exists idx_mosques_city on public.mosques(city);

create index if not exists idx_businesses_slug on public.businesses(slug);
create index if not exists idx_businesses_city on public.businesses(city);
create index if not exists idx_businesses_featured on public.businesses(featured);
create index if not exists idx_businesses_sponsor_mosque_id on public.businesses(sponsor_mosque_id);
```

---

## Important code notes

### Supabase server usage
You currently have a shared server client in:
- `lib/supabaseServer.ts`

Prefer using that shared server client in server components instead of creating extra Supabase clients in multiple places.

### Stripe service-role usage
In Stripe routes, using the service role key is correct because those routes need secure update access.

### Revalidation
Several of your pages now use:
```ts
export const revalidate = 300;
```
This helps performance by allowing cached regeneration instead of doing every request the slow way.

---

## Known next-step roadmap

Your selected direction was:

### Option B — Growth focus
**Add SEO city + mosque pages**

Recommended sequence:
1. Improve SEO metadata on city pages
2. Improve SEO metadata on mosque pages
3. Add structured data
4. Improve internal linking between city, mosque, and business pages
5. Later add city dropdown in navbar
6. After traffic grows, improve Stripe pricing tiers further

---

## Useful reminders

### Stop any running terminal process
```bash
Ctrl + C
```

### Start app again
```bash
npm run dev
```

### Start Stripe listener again
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## Final note
If anything breaks later, first check:
1. env vars are present
2. Stripe listener is running locally
3. app is running on port 3000
4. service role key is server-only
5. `npm run build` passes without errors
