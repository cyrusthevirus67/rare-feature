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
  portal: "",
  // Optional form service URL (e.g. Formspree) so requests arrive without opening an email app.
  formEndpoint: "",
  email: "cyrus@rarefeature.com",
};
