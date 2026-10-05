// Emails the owner about new website leads and new client requests.
// Called by a database trigger after each insert. It only ever sends rows that haven't been
// sent yet, so calling it repeatedly (or by a stranger) is harmless.
// Secret needed: RESEND_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://rarefeature.com";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const KIND = { support: "Message", change: "Plan change request", cancellation: "Cancellation request" };

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
    const ok = await send(`New lead: ${l.name} — ${l.interest || "website request"}`,
      `<p><b>${esc(l.name)}</b> (${esc(l.email)}) sent a request from the website.</p>
       <p>Type: ${esc(l.type || "—")}<br>Interested in: ${esc(l.interest || "—")}<br>Handle / site: ${esc(l.handle || "—")}</p>
       ${l.message ? `<p>“${esc(l.message)}”</p>` : ""}
       <p>Reply to this email to answer them, or <a href="${SITE}/admin.html">open Leads in admin</a>.</p>`, l.email);
    if (ok) { await sb.from("leads").update({ notified_at: new Date().toISOString() }).eq("id", l.id); sent++; }
  }

  const reqs = await sb.from("requests").select("*, profiles(full_name, business_name, email)").is("notified_at", null).gte("created_at", since).order("created_at").limit(20);
  if (reqs.error) return json({ error: reqs.error.message }, 500);
  for (const r of reqs.data) {
    const who = r.profiles?.business_name || r.profiles?.full_name || r.profiles?.email || "A client";
    const ok = await send(`${KIND[r.kind] || "Request"} from ${who}`,
      `<p><b>${esc(who)}</b> (${esc(r.profiles?.email || "")}) sent a ${esc((KIND[r.kind] || "request").toLowerCase())} from their portal.</p>
       ${r.message ? `<p>“${esc(r.message)}”</p>` : ""}
       <p><a href="${SITE}/admin.html">Open admin</a> to respond.</p>`, r.profiles?.email);
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
