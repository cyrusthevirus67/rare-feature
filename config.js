// Rare Feature site settings.
// Paste your Stripe links between the quotes. Anything left as "" falls back safely:
// buy buttons send people to the contact form, and the client portal shows an email link.
window.RF_CONFIG = {
  // Stripe Payment Links (Stripe Dashboard → Payment Links). One per package.
  checkout: {
    "growth-plan": "", // $497 one-time
    starter: "",       // $997/mo
    growth: "",        // $1,497/mo
    premium: "",       // $2,497/mo
  },
  // Stripe customer portal login link (Stripe Dashboard → Settings → Billing → Customer portal).
  // Used by the "Manage billing & invoices" button inside the client portal.
  portal: "",
  // Supabase project for the client portal (Supabase → Project Settings → API).
  // The anon key is designed to be public; never paste the service_role key here.
  supabase: { url: "https://hjvezrxvrshdlprnalin.supabase.co", anonKey: "sb_publishable_KHYN133iCCSZ8buwdY2FiA_Yoxgr7Ys" },
  // Optional form service URL (e.g. Formspree) so requests arrive without opening an email app.
  formEndpoint: "",
  email: "cyrus@rareft.com",
};
