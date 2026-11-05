// On-site checkout page: order summary + Stripe Embedded Checkout.
// Falls back to the Stripe payment link if the checkout function isn't set up yet.
(() => {
  const CFG = window.RF_CONFIG || {};
  const ITEMS = {
    starter: {
      name: "Starter", price: "$997", per: "/month",
      desc: "Consistent, professional content without lifting a finger.",
      list: ["1 filming session a month", "8 short videos", "Instagram + Facebook", "Captions & scheduling", "Monthly report"],
      terms: "3-month minimum, then month to month. Billed monthly in advance.",
    },
    growth: {
      name: "Growth", price: "$1,497", per: "/month",
      desc: "More content, more platforms, and hands-on engagement.",
      list: ["2 filming sessions a month", "12 short videos", "Instagram + Facebook + TikTok", "Captions & scheduling", "Light engagement", "Monthly report"],
      terms: "3-month minimum, then month to month. Billed monthly in advance.",
    },
    premium: {
      name: "Premium", price: "$2,497", per: "/month",
      desc: "Full-scale content and paid ads, handled end to end.",
      list: ["Weekly filming", "16–20 short videos", "All platforms, incl. YouTube Shorts", "Captions, scheduling & engagement", "Ad management (ad spend separate)", "Monthly report"],
      terms: "3-month minimum, then month to month. Billed monthly in advance.",
    },
    "growth-plan": {
      name: "Growth Plan", price: "$497", per: " one-time",
      desc: "A full audit of your accounts, a 90-day content plan, and a 60-minute strategy call.",
      list: ["Full account audit", "90-day content plan", "60-minute strategy call"],
      terms: "Sign up for a monthly package within 30 days and the full $497 is credited to your first month.",
    },
  };

  const plan = new URLSearchParams(location.search).get("plan");
  const item = ITEMS[plan];
  if (!item) { location.replace("/pricing"); return; }

  const $ = (id) => document.getElementById(id);
  document.title = `Checkout: ${item.name} — Rare Feature`;
  $("co-title").textContent = item.name;
  $("co-price").innerHTML = `<b>${item.price}</b>${item.per}`;
  $("co-desc").textContent = item.desc;
  $("co-list").innerHTML = item.list.map((t) => `<li>${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</li>`).join("");
  $("co-terms").textContent = item.terms;

  const box = $("checkout");
  const fallback = () => {
    const link = (CFG.checkout || {})[plan];
    box.innerHTML = link
      ? `<div class="co__fallback"><p>Continue to our secure Stripe checkout to finish your purchase.</p><a class="btn btn--red btn--block" href="${link}">Continue to secure payment →</a></div>`
      : `<div class="co__fallback"><p>Online checkout isn’t available right now. Email <a href="mailto:${CFG.email}">${CFG.email}</a> and we’ll get you set up.</p></div>`;
  };

  (async () => {
    try {
      const sb = CFG.supabase || {};
      if (!window.Stripe || !CFG.stripeKey || !sb.url) throw new Error("not ready");
      const res = await fetch(`${sb.url}/functions/v1/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: sb.anonKey },
        body: JSON.stringify({ item: plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.clientSecret) throw new Error(data.error || "checkout unavailable");
      const stripe = window.Stripe(CFG.stripeKey);
      const checkout = await stripe.initEmbeddedCheckout({ fetchClientSecret: async () => data.clientSecret });
      box.innerHTML = "";
      box.classList.add("is-live");
      checkout.mount(box);
    } catch (err) {
      console.warn("Embedded checkout unavailable:", err.message);
      fallback();
    }
  })();
})();
