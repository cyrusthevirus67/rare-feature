// Stripe → Supabase. When someone pays through a Rare Feature payment link, this creates their
// portal login and assigns the plan they bought. It also keeps billing dates and cancellations in sync.
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_WEBHOOK_SECRET (required), RESEND_API_KEY (for emails).
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://rarefeature.com";

// Keyed by Stripe payment link id.
const PLANS = {
  plink_1UNIwRGoXXmRNVk9WF0KYX6s: { plan: "Starter", price_cents: 99700, billing: "monthly", videos_per_month: 8, sessions_per_month: 1, platforms: "Instagram, Facebook" },
  plink_1UNIxrGoXXmRNVk9C0LarrwZ: { plan: "Growth", price_cents: 149700, billing: "monthly", videos_per_month: 12, sessions_per_month: 2, platforms: "Instagram, Facebook, TikTok" },
  plink_1UNIyaGoXXmRNVk9ONs89d56: { plan: "Premium", price_cents: 249700, billing: "monthly", videos_per_month: 20, sessions_per_month: 4, platforms: "Instagram, Facebook, TikTok, YouTube Shorts" },
  plink_1UNIzRGoXXmRNVk9sbneHq7u: { plan: "Growth Plan", price_cents: 49700, billing: "one-time", videos_per_month: 0, sessions_per_month: 0, platforms: "Audit + 90-day plan + strategy call" },
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const day = (d) => d.toISOString().slice(0, 10);
const addMonths = (d, n) => { const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + n); return x; };
const money = (cents) => `$${(cents / 100).toLocaleString("en-US")}`;

// ---- Branded email design ----
// The same block lives in both edge functions (they deploy as single files) and produced the
// static templates in supabase/email-templates/. Change all of them together.
const BRAND = { ink: "#0a0a0a", red: "#ff3b2f", bg: "#f2f0ec", text: "#1c1b1a", muted: "#6b6863", line: "#eceae5", soft: "#f7f5f1" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
export const p = (html) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${BRAND.text};">${html}</p>`;
export const small = (html) => `<p style="margin:16px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${BRAND.muted};">${html}</p>`;
export const rows = (pairs) => {
  const shown = pairs.filter(([, v]) => v);
  if (!shown.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border:1px solid ${BRAND.line};border-radius:12px;border-collapse:separate;">${shown.map(([k, v], i) =>
    `<tr><td style="padding:12px 16px;${i ? `border-top:1px solid ${BRAND.line};` : ""}font-family:${FONT};font-size:13px;color:${BRAND.muted};white-space:nowrap;" width="130">${esc(k)}</td><td style="padding:12px 16px;${i ? `border-top:1px solid ${BRAND.line};` : ""}font-family:${FONT};font-size:15px;font-weight:600;color:${BRAND.ink};">${esc(v)}</td></tr>`).join("")}</table>`;
};
export const quote = (text) => text ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr><td style="border-left:3px solid ${BRAND.red};background:${BRAND.soft};padding:14px 18px;font-family:${FONT};font-size:16px;line-height:1.6;color:${BRAND.text};">${esc(text)}</td></tr></table>` : "";
export function layout({ preheader = "", label = "", heading, body, cta, note = "" }) {
  const button = cta ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px;"><tr><td bgcolor="${BRAND.red}" style="background:${BRAND.red};border-radius:999px;"><a href="${cta.url}" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">${cta.text} &rarr;</a></td></tr></table>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${heading}</title>
<style>@media (max-width:520px){.rf-pad{padding-left:24px!important;padding-right:24px!important}.rf-h{font-size:26px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.bg}" style="background:${BRAND.bg};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td class="rf-pad" bgcolor="${BRAND.ink}" style="background:${BRAND.ink};border-radius:16px 16px 0 0;padding:26px 40px;line-height:1;"><img src="https://rarefeature.com/assets/logo-email.png" width="224" height="30" alt="RARE FEATURE" style="display:block;border:0;outline:none;width:224px;height:30px;font-family:'Arial Black','Helvetica Neue',Arial,sans-serif;font-size:18px;font-weight:900;letter-spacing:1.5px;color:#ffffff;"></td></tr>
<tr><td bgcolor="${BRAND.red}" style="background:${BRAND.red};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td class="rf-pad" bgcolor="#ffffff" style="background:#ffffff;padding:40px 40px 34px;">
${label ? `<p style="margin:0 0 14px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${BRAND.red};">${label}</p>` : ""}
<h1 class="rf-h" style="margin:0 0 20px;font-family:${FONT};font-size:30px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;color:${BRAND.ink};">${heading}</h1>
${body}${button}${note}
</td></tr>
<tr><td class="rf-pad" bgcolor="#ffffff" style="background:#ffffff;border-top:1px solid ${BRAND.line};border-radius:0 0 16px 16px;padding:22px 40px 26px;font-family:${FONT};font-size:13px;line-height:1.6;color:${BRAND.muted};"><b style="color:${BRAND.ink};">Rare Feature</b> &middot; Social media growth &amp; consulting<br><a href="https://rarefeature.com" style="color:${BRAND.muted};">rarefeature.com</a> &middot; <a href="mailto:cyrus@rareft.com" style="color:${BRAND.muted};">cyrus@rareft.com</a></td></tr>
</table>
</td></tr></table>
</body></html>`;
}
// ---- end email design ----


async function validSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const sigs = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => {
    if (s.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  });
}

async function sendEmail(env, to, subject, html) {
  if (!env.resend) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.from, to, subject, html }),
  });
  if (!res.ok) console.error("email failed", res.status, await res.text());
}

async function checkoutCompleted(s, sb, env) {
  const preset = PLANS[s.payment_link];
  if (!preset) return { ignored: "not a Rare Feature payment link" };
  if (s.payment_status && s.payment_status === "unpaid") return { ignored: "unpaid" };
  const email = (s.customer_details?.email || s.customer_email || "").trim().toLowerCase();
  if (!email) throw new Error("checkout session has no customer email");
  const name = s.customer_details?.name || null;

  // Find or create the client's login.
  let { data: profile, error } = await sb.from("profiles").select("id, full_name").eq("email", email).maybeSingle();
  if (error) throw error;
  if (!profile) {
    const created = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name } });
    if (created.error) throw created.error;
    profile = { id: created.data.user.id, full_name: null };
    // The database trigger normally creates the profile row; make sure it exists either way.
    const up = await sb.from("profiles").upsert({ id: profile.id, email }, { onConflict: "id", ignoreDuplicates: true });
    if (up.error) throw up.error;
  }
  if (name && !profile.full_name) {
    const upd = await sb.from("profiles").update({ full_name: name }).eq("id", profile.id);
    if (upd.error) throw upd.error;
  }

  // Assign the plan. A one-time Growth Plan never replaces a running monthly package.
  const current = await sb.from("client_plans").select("plan, billing, status, stripe_session_id").eq("client_id", profile.id).maybeSingle();
  if (current.error) throw current.error;
  if (s.id && current.data?.stripe_session_id === s.id) return { already_provisioned: email }; // Stripe sometimes delivers an event twice
  const keepsMonthly = preset.billing === "one-time" && current.data?.billing === "monthly" && ["active", "paused", "onboarding", "cancel_requested"].includes(current.data.status);
  if (!keepsMonthly) {
    const now = new Date();
    const monthly = preset.billing === "monthly";
    const saved = await sb.from("client_plans").upsert({
      client_id: profile.id, ...preset, status: "active",
      started_on: day(now),
      minimum_term_ends: monthly ? day(addMonths(now, 3)) : null,
      next_billing_on: monthly ? day(addMonths(now, 1)) : null,
      stripe_customer_id: typeof s.customer === "string" ? s.customer : null,
      stripe_subscription_id: typeof s.subscription === "string" ? s.subscription : null,
      stripe_session_id: s.id ?? null,
      updated_at: now.toISOString(),
    }, { onConflict: "client_id" });
    if (saved.error) throw saved.error;
  }

  const price = `${money(preset.price_cents)}${preset.billing === "monthly" ? "/mo" : " one-time"}`;
  await sendEmail(env, email, `Welcome to Rare Feature — your ${preset.plan} portal is ready`, layout({
    preheader: `Your ${esc(preset.plan)} plan is active. Sign in to see your client portal.`,
    label: "Welcome",
    heading: `Welcome to Rare Feature${name ? `, ${esc(name.split(" ")[0])}` : ""}.`,
    body: p(`Thank you for choosing us. Your <b>${esc(preset.plan)}</b> plan is active and your client portal is ready.`) +
      rows([["Plan", preset.plan], ["Price", price], ["Sign-in email", email]]) +
      p("Inside your portal you’ll find your plan, your content as it’s made, your filming schedule, and your monthly reports. We’ll be in touch shortly to schedule your kickoff."),
    cta: { text: "Sign in to my portal", url: `${SITE}/client.html` },
    note: small("No password needed. Enter your email and we’ll send you a one-time sign-in link."),
  }));
  await sendEmail(env, env.owner, `New purchase: ${preset.plan} (${price}) — ${name || email}`, layout({
    preheader: `${esc(name || email)} bought ${esc(preset.plan)}.`,
    label: "New purchase",
    heading: `${esc(name || email)} bought ${esc(preset.plan)}`,
    body: rows([["Client", name], ["Email", email], ["Plan", preset.plan], ["Price", price]]) +
      p(`Their portal was created automatically${keepsMonthly ? ", and their existing monthly plan was left in place" : ""}. Add their content, filming sessions, and reports in admin.`),
    cta: { text: "Open admin", url: `${SITE}/admin.html` },
  }));
  return { provisioned: email, plan: preset.plan, kept_monthly: keepsMonthly };
}

async function invoicePaid(inv, sb) {
  const sub = inv.subscription ?? inv.parent?.subscription_details?.subscription;
  const end = inv.lines?.data?.[0]?.period?.end;
  if (typeof sub !== "string" || !end) return { ignored: "no subscription on invoice" };
  const upd = await sb.from("client_plans").update({ next_billing_on: day(new Date(end * 1000)), updated_at: new Date().toISOString() }).eq("stripe_subscription_id", sub);
  if (upd.error) throw upd.error;
  return { billing_date_updated: sub };
}

async function subscriptionDeleted(sub, sb, env) {
  const upd = await sb.from("client_plans").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id).select("client_id, plan");
  if (upd.error) throw upd.error;
  if (upd.data?.length) await sendEmail(env, env.owner, `Subscription cancelled: ${upd.data[0].plan}`, layout({
    label: "Subscription cancelled",
    heading: `A ${esc(upd.data[0].plan)} subscription was cancelled`,
    body: p("It was cancelled in Stripe, and the client’s portal now shows the plan as cancelled."),
    cta: { text: "Open admin", url: `${SITE}/admin.html` },
  }));
  return { cancelled: sub.id };
}

export async function handle(req, sb, env) {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const payload = await req.text();
  if (!(await validSignature(payload, req.headers.get("stripe-signature"), env.secret))) return json({ error: "invalid signature" }, 400);
  let event;
  try { event = JSON.parse(payload); } catch { return json({ error: "invalid JSON" }, 400); }
  try {
    const o = event.data?.object ?? {};
    let result = { ignored: event.type };
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") result = await checkoutCompleted(o, sb, env);
    else if (event.type === "invoice.paid") result = await invoicePaid(o, sb);
    else if (event.type === "customer.subscription.deleted") result = await subscriptionDeleted(o, sb, env);
    else if (event.type === "invoice.payment_failed") {
      await sendEmail(env, env.owner, "A client payment failed", layout({
        label: "Payment failed",
        heading: "A client payment didn’t go through",
        body: rows([["Client", o.customer_email]]) + p("Stripe will retry automatically. You can see the details in your Stripe dashboard."),
        cta: { text: "Open Stripe", url: "https://dashboard.stripe.com/invoices" },
      }));
      result = { notified: "payment failed" };
    }
    return json({ ok: true, ...result });
  } catch (err) {
    console.error(event.type, err);
    return json({ error: String(err?.message ?? err) }, 500); // Stripe retries on 5xx
  }
}

// Privileged database key. Newer projects expose it as SUPABASE_SECRET_KEYS; older ones as SUPABASE_SERVICE_ROLE_KEY.
function serviceKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  if (!raw) return undefined;
  try { const j = JSON.parse(raw); return typeof j === "string" ? j : (j.default ?? Object.values(j)[0]); } catch { return raw; }
}

if (typeof Deno !== "undefined") {
  Deno.serve((req) => handle(
    req,
    createClient(Deno.env.get("SUPABASE_URL"), serviceKey(), { auth: { persistSession: false } }),
    {
      secret: Deno.env.get("STRIPE_WEBHOOK_SECRET"),
      resend: Deno.env.get("RESEND_API_KEY"),
      owner: Deno.env.get("OWNER_EMAIL") ?? "cyrus@rareft.com",
      from: Deno.env.get("EMAIL_FROM") ?? "Rare Feature <portal@rarefeature.com>",
    },
  ));
}
