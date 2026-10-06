# Sign-in email templates

Paste these into Supabase → Authentication → Emails → Templates.

| Template in Supabase | File | Subject |
|---|---|---|
| Magic Link | `magic-link.html` | Your Rare Feature sign-in link |
| Confirm signup | `confirm-signup.html` | Confirm your email to open your Rare Feature portal |

They share their design with the emails sent by `supabase/functions/stripe-webhook` and
`supabase/functions/notify` (the `layout` block in each). Change all of them together.

The sender name and address are not set here. They come from Supabase → Authentication → Emails →
SMTP Settings; until a custom sender is configured, mail arrives from Supabase's own address.
