// Rare Feature site settings.
// Paste your Stripe links between the quotes. Anything left as "" falls back safely:
// buy buttons send people to the contact form, and the client portal shows an email link.
window.RF_CONFIG = {
  // Stripe Payment Links (Stripe Dashboard → Payment Links). One per package.
  checkout: {
    "growth-plan": "https://buy.stripe.com/3cIfZhdrj8OLgHL0Wc0RG03", // $497 one-time
    starter: "https://buy.stripe.com/cNi14n86Z5Cz2QVbAQ0RG00",       // $997/mo
    growth: "https://buy.stripe.com/9B6cN5af78OL8bfgVa0RG01",        // $1,497/mo
    premium: "https://buy.stripe.com/eVq7sL1IB5Cz3UZbAQ0RG02",       // $2,497/mo
  },
  // Stripe customer portal login link (Stripe Dashboard → Settings → Billing → Customer portal).
  // Used by the "Manage billing & invoices" button inside the client portal.
  portal: "https://billing.stripe.com/p/login/cNi14n86Z5Cz2QVbAQ0RG00",
  // Supabase project for the client portal (Supabase → Project Settings → API).
  // The anon key is designed to be public; never paste the service_role key here.
  supabase: { url: "https://hjvezrxvrshdlprnalin.supabase.co", anonKey: "sb_publishable_KHYN133iCCSZ8buwdY2FiA_Yoxgr7Ys" },
  // Calendly links (Calendly → Event types → Copy link), e.g. "https://calendly.com/yourname/intro-call".
  //   call:    public "Book a call" scheduler on the website.
  //   filming: filming-session scheduler, shown only inside the portal to clients with an active monthly plan.
  // Leave "" to hide that scheduler.
  calendly: { call: "https://calendly.com/cyrus-rareft/30min", filming: "https://calendly.com/cyrus-rareft/30min" },
  // Optional form service URL (e.g. Formspree) so requests arrive without opening an email app.
  formEndpoint: "",
  email: "cyrus@rareft.com",
};
