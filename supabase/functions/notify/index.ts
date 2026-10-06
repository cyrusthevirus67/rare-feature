// Emails the owner about new website leads and new client requests.
// Called by a database trigger after each insert. It only ever sends rows that haven't been
// sent yet, so calling it repeatedly (or by a stranger) is harmless.
// Secret needed: RESEND_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://rarefeature.com";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND = { support: "Message", change: "Plan change request", cancellation: "Cancellation request" };

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
<tr><td class="rf-pad" bgcolor="${BRAND.ink}" style="background:${BRAND.ink};border-radius:16px 16px 0 0;padding:26px 40px;font-family:'Arial Black','Helvetica Neue',Arial,sans-serif;font-size:21px;font-weight:900;letter-spacing:1.5px;line-height:1;color:#ffffff;text-transform:uppercase;">Rare <span style="color:${BRAND.red};font-size:13px;vertical-align:middle;">&#9679;</span> Feature</td></tr>
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


export async function handle(sb, env) {
  // Health check first, so a call always tells us whether the function can reach the database.
  const probe = await sb.from("leads").select("id", { count: "exact", head: true });
  if (probe.error) return json({ error: `database: ${probe.error.message}`, env: env.names }, 500);
  if (!env.resend) return json({ ok: true, database: "ok", skipped: "RESEND_API_KEY not set" });
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const send = async (subject, html, replyTo) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resend}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.from, to: env.owner, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) console.error("email failed", res.status, await res.text());
    return res.ok;
  };
  let sent = 0;

  const leads = await sb.from("leads").select("*").is("notified_at", null).gte("created_at", since).order("created_at").limit(20);
  if (leads.error) return json({ error: leads.error.message }, 500);
  for (const l of leads.data) {
    const ok = await send(`New lead: ${l.name} — ${l.interest || "website request"}`, layout({
      preheader: `${esc(l.name)} sent a request from the website.`,
      label: "New lead",
      heading: esc(l.name),
      body: rows([["Email", l.email], ["Type", l.type], ["Interested in", l.interest], ["Handle / site", l.handle]]) +
        quote(l.message) + p("Reply to this email to answer them directly."),
      cta: { text: "Open leads", url: `${SITE}/admin.html` },
    }), l.email);
    if (ok) { await sb.from("leads").update({ notified_at: new Date().toISOString() }).eq("id", l.id); sent++; }
  }

  const reqs = await sb.from("requests").select("*, profiles(full_name, business_name, email)").is("notified_at", null).gte("created_at", since).order("created_at").limit(20);
  if (reqs.error) return json({ error: reqs.error.message }, 500);
  for (const r of reqs.data) {
    const who = r.profiles?.business_name || r.profiles?.full_name || r.profiles?.email || "A client";
    const ok = await send(`${KIND[r.kind] || "Request"} from ${who}`, layout({
      preheader: `${esc(who)} sent this from their client portal.`,
      label: KIND[r.kind] || "Request",
      heading: esc(who),
      body: rows([["Email", r.profiles?.email], ["Sent from", "Client portal"]]) +
        quote(r.message) + p("Reply to this email to answer them directly."),
      cta: { text: "Open admin", url: `${SITE}/admin.html` },
    }), r.profiles?.email);
    if (ok) { await sb.from("requests").update({ notified_at: new Date().toISOString() }).eq("id", r.id); sent++; }
  }
  return json({ ok: true, sent });
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
  Deno.serve(() => handle(
    createClient(Deno.env.get("SUPABASE_URL"), serviceKey(), { auth: { persistSession: false } }),
    {
      resend: Deno.env.get("RESEND_API_KEY"),
      owner: Deno.env.get("OWNER_EMAIL") ?? "cyrus@rareft.com",
      from: Deno.env.get("EMAIL_FROM") ?? "Rare Feature <portal@rarefeature.com>",
      names: Object.keys(Deno.env.toObject()).filter((k) => k.startsWith("SUPABASE_")), // names only, never values
    },
  ));
}
