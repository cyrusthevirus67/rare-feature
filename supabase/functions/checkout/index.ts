// Creates a Stripe Embedded Checkout session for the checkout pages on rarefeature.com and
// society.rarefeature.com. The page shows Stripe's secure card form inside our own design.
// Secret (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY — a restricted key with
// "Checkout Sessions: Write" and "Products: Read". Without it the pages fall back to payment links.
// Deploy with "Verify JWT" off: visitors are not signed in when they buy.

const ITEMS = {
  starter: { product: "prod_VO548HQc8cFEN9", mode: "subscription", site: "https://rarefeature.com", meta: { rf_product: "agency", rf_plan: "starter" } },
  growth: { product: "prod_VO54GnBeU33S7y", mode: "subscription", site: "https://rarefeature.com", meta: { rf_product: "agency", rf_plan: "growth" } },
  premium: { product: "prod_VO55R2Sr6hSfFS", mode: "subscription", site: "https://rarefeature.com", meta: { rf_product: "agency", rf_plan: "premium" } },
  "growth-plan": { product: "prod_VO55vqjhJ53K7y", mode: "payment", site: "https://rarefeature.com", meta: { rf_product: "agency", rf_plan: "growth-plan" } },
  "society-membership": { product: "prod_VZgi6dJzeg0F0x", mode: "subscription", site: "https://society.rarefeature.com", meta: { rf_product: "society", rf_plan: "membership" } },
  "society-course": { product: "prod_VZgjwRAoP6c3D1", mode: "payment", site: "https://society.rarefeature.com", meta: { rf_product: "society", rf_plan: "course" } },
};

const ORIGINS = ["https://rarefeature.com", "https://www.rarefeature.com", "https://society.rarefeature.com"];
const cors = (origin) => ({
  "Access-Control-Allow-Origin": ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin || "") ? origin : ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  Vary: "Origin",
});
const json = (body, status, origin) => new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

async function stripe(key, path, params) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, ...(params ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

export async function handle(req, key) {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, origin);
  if (!key) return json({ error: "not_configured" }, 503, origin);
  let body;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON" }, 400, origin); }
  const item = ITEMS[body?.item];
  if (!item) return json({ error: "unknown item" }, 400, origin);
  const email = typeof body.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email) ? body.email.trim().toLowerCase() : "";
  try {
    const product = await stripe(key, `products/${item.product}`);
    const price = typeof product.default_price === "string" ? product.default_price : product.default_price?.id;
    if (!price) throw new Error("product has no default price");
    const back = ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) ? origin : item.site;
    const params = {
      ui_mode: "embedded",
      mode: item.mode,
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      return_url: `${back}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      "automatic_tax[enabled]": "true",
      billing_address_collection: "auto",
    };
    for (const [k, v] of Object.entries(item.meta)) {
      params[`metadata[${k}]`] = v;
      if (item.mode === "subscription") params[`subscription_data[metadata][${k}]`] = v;
    }
    if (item.mode === "payment") params.customer_creation = "always";
    if (email) params.customer_email = email;
    const session = await stripe(key, "checkout/sessions", params);
    return json({ clientSecret: session.client_secret }, 200, origin);
  } catch (err) {
    console.error(body?.item, err);
    return json({ error: String(err?.message ?? err) }, 502, origin);
  }
}

if (typeof Deno !== "undefined") {
  Deno.serve((req) => handle(req, Deno.env.get("STRIPE_SECRET_KEY")));
}
