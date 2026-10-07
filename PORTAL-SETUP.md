# Client portal setup

The portal (`client.html` → `portal.html`, plus `admin.html` for you) runs on Supabase.
Until it is connected, `client.html` shows an "email us" button, and you can preview
everything with sample data at `portal.html?demo` and `admin.html?demo`.

## Connect it (about 10 minutes)

1. **Create a Supabase project** at supabase.com (the free plan is enough to start).
2. **Create the tables:** SQL Editor → New query → paste all of `supabase/schema.sql` → Run.
3. **Allow sign-in links to return to the site:** Authentication → URL Configuration
   - Site URL: `https://rarefeature.com`
   - Redirect URLs: add `https://rarefeature.com/portal.html`
4. **Copy two values** from Project Settings → API into `config.js` under `supabase`:
   - Project URL → `url`
   - `anon` `public` key → `anonKey` (this one is safe to publish; never use the `service_role` key)
5. **Admin:** `cyrus@rareft.com` becomes the admin automatically the first time it signs in at
   `rarefeature.com/client.html`.

## Day to day

- A new client signs in at `rarefeature.com/client.html` with their email (one-time link, no password).
- Open `rarefeature.com/admin.html`, pick them, assign a package under **Plan**, then add their
  videos (**Content**), **Filming** sessions, and monthly **Reports**.
- Set a video's status to "Needs your review" and add a preview link; the client can approve it or
  request changes from their portal. Their messages, plan-change requests, and cancellation requests
  show up under **Requests**.

## Billing

Card payments, invoices, and card updates are handled by Stripe. Paste your Stripe customer portal
link into `config.js` (`portal`) and the "Manage billing & invoices" button inside the portal opens it.
A cancellation request in the portal does not stop billing by itself: cancel the subscription in Stripe
when you process the request.

## Good to know

- Supabase's built-in email sender is limited to a few sign-in emails per hour. Before you have many
  clients, add your own email sender under Authentication → SMTP.
- Clients can only ever read their own data; this is enforced in the database (row-level security),
  not just in the page.

## Automation

- `supabase/functions/stripe-webhook` — Stripe calls this after a payment. It creates the client's login,
  assigns the plan they bought, keeps the next billing date current, and marks plans cancelled when the
  subscription ends in Stripe. Needs the secret `STRIPE_WEBHOOK_SECRET` (the signing secret of the Stripe
  webhook endpoint that points at it).
- `supabase/functions/notify` — emails the owner about new website leads and new client requests. A database
  trigger calls it after each insert.
- Both send email through Resend and need the secret `RESEND_API_KEY`. Without it, everything still works
  but no emails are sent. Optional secrets: `OWNER_EMAIL` (default cyrus@rareft.com) and `EMAIL_FROM`.
- Both functions must be deployed with "Verify JWT" turned off (Stripe and the database trigger call them
  without a Supabase login).

## Contracts and e-signature

- **Templates** live in `contracts.js`: Client Service Agreement, Starter Client Agreement (no-fee), Independent
  Contractor Agreement, On-Camera Release (staff), and a paper-only Patient Authorization. They are drafts —
  have an attorney review them. Bump a template's `version` whenever its wording changes.
- **Creating one:** Admin → **Agreements** → pick a type, fill in the details, type your name to sign for
  Rare Feature, and click **Create signing link**. The wording is frozen at that moment.
- **Signing:** the other person opens the private link (`sign.html?id=…`), reads the document, types their
  name, optionally draws a signature, ticks two boxes, and signs. No account needed. The same link then shows
  the signed copy with a signature record (name, date and time, internet address, and a fingerprint of the
  exact text signed) and can be printed or saved as a PDF.
- **Rules enforced by the database** (`supabase/schema.sql`, "Agreements and e-signatures"): the text cannot be
  edited after creation, a document can be signed only once, a signed document cannot be changed or deleted,
  and clients can only see agreements addressed to their own email.
- **Patient authorizations are paper-only on purpose.** They contain patient health information, which this
  site's storage is not set up to hold. Print the blank form (Admin → Agreements → Printable blank forms),
  have it signed at the practice, and let the practice keep the original.
- **To switch it on:** run the "Agreements and e-signatures" section of `supabase/schema.sql` once in the
  Supabase SQL editor. Until then the Agreements tab shows "One step left" and links cannot be saved.
