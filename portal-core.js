// Shared by the client portal, the admin page, and the sign-in page.
// Talks to Supabase when it is configured in config.js; `?demo` runs on sample data instead.
(() => {
  const CFG = window.RF_CONFIG || {};
  const DEMO = new URLSearchParams(location.search).has("demo");
  const configured = !!(CFG.supabase && CFG.supabase.url && CFG.supabase.anonKey && window.supabase);
  const sb = configured && !DEMO ? window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey) : null;

  const PLANS = {
    "Growth Plan": { price_cents: 49700, billing: "one-time", videos_per_month: 0, sessions_per_month: 0, platforms: "Audit + 90-day plan + strategy call" },
    Starter: { price_cents: 99700, billing: "monthly", videos_per_month: 8, sessions_per_month: 1, platforms: "Instagram, Facebook" },
    Growth: { price_cents: 149700, billing: "monthly", videos_per_month: 12, sessions_per_month: 2, platforms: "Instagram, Facebook, TikTok" },
    Premium: { price_cents: 249700, billing: "monthly", videos_per_month: 20, sessions_per_month: 4, platforms: "Instagram, Facebook, TikTok, YouTube Shorts" },
  };

  const STATUS = {
    planned: "Planned", filming: "Filming", editing: "Editing", review: "Needs your review",
    approved: "Approved", scheduled: "Scheduled", posted: "Posted",
    onboarding: "Onboarding", active: "Active", paused: "Paused", cancel_requested: "Cancellation requested", cancelled: "Cancelled",
    completed: "Completed", open: "Open", in_progress: "In progress", done: "Done",
  };

  const ORDER = {
    profiles: ["created_at", false], deliverables: ["month", false], filming_sessions: ["starts_at", true],
    reports: ["month", false], requests: ["created_at", false],
  };

  // ---------- helpers ----------
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");
  const asDate = (v) => (v instanceof Date ? v : new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v));
  const fmtDate = (v, opts = { month: "short", day: "numeric", year: "numeric" }) => (v ? asDate(v).toLocaleDateString("en-US", opts) : "—");
  const fmtMonth = (v) => fmtDate(v, { month: "long", year: "numeric" });
  const fmtTime = (v) => asDate(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const money = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const badge = (status) => `<span class="badge badge--${esc(status)}">${esc(STATUS[status] || status)}</span>`;

  let toastTimer;
  const toast = (msg, isError) => {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
    el.textContent = msg;
    el.className = `toast is-on${isError ? " toast--error" : ""}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 3600);
  };

  // ---------- Supabase data layer ----------
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const live = sb && {
    async session() { return ok(await sb.auth.getSession()).session; },
    async me() {
      const s = await this.session();
      if (!s) return null;
      return ok(await sb.from("profiles").select("*").eq("id", s.user.id).maybeSingle()) || { id: s.user.id, email: s.user.email };
    },
    async sendLink(email) {
      ok(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: new URL("portal.html", location.href).href } }));
    },
    async signOut() { await sb.auth.signOut(); },
    async plan(clientId) { return ok(await sb.from("client_plans").select("*").eq("client_id", clientId).maybeSingle()); },
    async list(table, clientId) {
      const [col, ascending] = ORDER[table];
      let q = sb.from(table).select("*");
      if (clientId) q = q.eq("client_id", clientId);
      return ok(await q.order(col, { ascending }));
    },
    async review(id, approve, feedback) { ok(await sb.rpc("review_deliverable", { p_id: id, p_approve: approve, p_feedback: feedback || null })); },
    async request(clientId, kind, message) {
      if (kind === "cancellation") ok(await sb.rpc("request_cancellation", { p_message: message || null }));
      else ok(await sb.from("requests").insert({ client_id: clientId, kind, message }));
    },
    async saveProfile(f) { ok(await sb.rpc("update_my_profile", { p_full_name: f.full_name, p_business_name: f.business_name, p_instagram: f.instagram })); },
    // admin
    async clients() { return this.list("profiles"); },
    async save(table, row) { return ok(await sb.from(table).upsert(row).select()); },
    async remove(table, id) { ok(await sb.from(table).delete().eq("id", id)); },
  };

  // ---------- Demo data layer (sample client, nothing is saved) ----------
  const day = (n, h = 10) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };
  const month = (n) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n); return iso(d); };
  let seq = 100;
  const uid = () => `demo-${seq++}`;
  const C1 = "demo-client-1", C2 = "demo-client-2", C3 = "demo-client-3";
  const db = {
    profiles: [
      { id: C1, email: "alex@brightsmilestudio.com", full_name: "Alex Rivera", business_name: "Bright Smile Studio", instagram: "@brightsmilestudio", is_admin: true, created_at: day(-64).toISOString() },
      { id: C2, email: "maya@mayamoves.co", full_name: "Maya Chen", business_name: "Maya Moves", instagram: "@mayamoves", is_admin: false, created_at: day(-20).toISOString() },
      { id: C3, email: "sam@northsideauto.com", full_name: "Sam Ortiz", business_name: "Northside Auto", instagram: "@northsideauto", is_admin: false, created_at: day(-3).toISOString() },
    ],
    client_plans: [
      { client_id: C1, plan: "Growth", ...PLANS.Growth, status: "active", started_on: iso(day(-64)), minimum_term_ends: iso(day(27)), next_billing_on: iso(day(12)) },
      { client_id: C2, plan: "Starter", ...PLANS.Starter, status: "active", started_on: iso(day(-20)), minimum_term_ends: iso(day(71)), next_billing_on: iso(day(10)) },
    ],
    deliverables: [
      { id: uid(), client_id: C1, title: "3 mistakes people make before a whitening visit", month: month(0), platform: "Instagram Reel", status: "review", view_url: "https://example.com/preview" },
      { id: uid(), client_id: C1, title: "Meet the team: Dr. Patel", month: month(0), platform: "Instagram Reel", status: "review", view_url: "https://example.com/preview" },
      { id: uid(), client_id: C1, title: "What a first visit actually looks like", month: month(0), platform: "TikTok", status: "scheduled", view_url: "https://example.com/preview" },
      { id: uid(), client_id: C1, title: "Patient FAQ: does it hurt?", month: month(0), platform: "Instagram Reel", status: "posted", view_url: "https://example.com/preview" },
      { id: uid(), client_id: C1, title: "Behind the scenes: morning setup", month: month(0), platform: "Facebook", status: "posted", view_url: "https://example.com/preview" },
      { id: uid(), client_id: C1, title: "Before & after story", month: month(0), platform: "Instagram Reel", status: "editing" },
      { id: uid(), client_id: C1, title: "Office tour in 30 seconds", month: month(0), platform: "TikTok", status: "editing" },
      { id: uid(), client_id: C1, title: "Myth vs. fact: flossing", month: month(0), platform: "Instagram Reel", status: "filming" },
      { id: uid(), client_id: C1, title: "Holiday hours announcement", month: month(0), platform: "Facebook", status: "planned" },
      { id: uid(), client_id: C1, title: "Why we opened this practice", month: month(-1), platform: "Instagram Reel", status: "posted", view_url: "https://example.com/preview" },
      { id: uid(), client_id: C1, title: "5-star review spotlight", month: month(-1), platform: "Facebook", status: "posted", view_url: "https://example.com/preview" },
      { id: uid(), client_id: C2, title: "Morning mobility routine", month: month(0), platform: "Instagram Reel", status: "review", view_url: "https://example.com/preview" },
    ],
    filming_sessions: [
      { id: uid(), client_id: C1, starts_at: day(-18, 9).toISOString(), location: "Bright Smile Studio — front office", notes: "Team intros and office b-roll.", status: "completed" },
      { id: uid(), client_id: C1, starts_at: day(4, 9).toISOString(), location: "Bright Smile Studio — treatment room 2", notes: "Bring: 2 outfit options. We’ll film 6 short videos.", status: "scheduled" },
      { id: uid(), client_id: C1, starts_at: day(18, 14).toISOString(), location: "Bright Smile Studio", notes: "Patient story (consent form signed).", status: "scheduled" },
    ],
    reports: [
      { id: uid(), client_id: C1, month: month(-1), headline: "Strong first full month", summary: "Reels outperformed photo posts across the board. The “why we opened” story drove the most profile visits, so we’re planning two more founder-led videos.", url: "https://example.com/report" },
      { id: uid(), client_id: C1, month: month(-2), headline: "Launch month", summary: "Profile refreshed, content pillars set, and the first batch of videos went live. Baseline numbers recorded for future comparison.", url: "https://example.com/report" },
    ],
    requests: [
      { id: uid(), client_id: C1, kind: "support", message: "Can we add our new Saturday hours to the next video?", status: "done", created_at: day(-9).toISOString() },
      { id: uid(), client_id: C3, kind: "support", message: "Just signed up — when do we start?", status: "open", created_at: day(-2).toISOString() },
    ],
  };
  const pause = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));
  const sortBy = (table, rows) => {
    const [col, asc] = ORDER[table];
    return [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
  };
  const demo = {
    session: () => pause({ user: { id: C1 } }),
    me: () => pause(db.profiles[0]),
    sendLink: () => pause(null),
    signOut: () => pause(null),
    plan: (clientId) => pause(db.client_plans.find((p) => p.client_id === clientId) || null),
    list: (table, clientId) => pause(sortBy(table, db[table].filter((r) => !clientId || r.client_id === clientId))),
    review(id, approve, feedback) {
      const d = db.deliverables.find((r) => r.id === id);
      Object.assign(d, { status: approve ? "approved" : "editing", client_feedback: feedback || null, approved_at: approve ? new Date().toISOString() : null });
      return pause(null);
    },
    request(clientId, kind, message) {
      db.requests.push({ id: uid(), client_id: clientId, kind, message, status: "open", created_at: new Date().toISOString() });
      if (kind === "cancellation") { const p = db.client_plans.find((r) => r.client_id === clientId); if (p) p.status = "cancel_requested"; }
      return pause(null);
    },
    saveProfile(f) { Object.assign(db.profiles[0], f); return pause(null); },
    clients: () => pause(sortBy("profiles", db.profiles)),
    save(table, row) {
      const key = table === "client_plans" ? "client_id" : "id";
      if (!row[key]) row[key] = uid();
      const i = db[table].findIndex((r) => r[key] === row[key]);
      if (i >= 0) Object.assign(db[table][i], row); else db[table].push({ created_at: new Date().toISOString(), ...row });
      return pause([row]);
    },
    remove(table, id) { db[table] = db[table].filter((r) => r.id !== id); return pause(null); },
  };

  window.RF = { CFG, DEMO, configured, api: DEMO ? demo : live, PLANS, STATUS, esc, safeUrl, asDate, fmtDate, fmtMonth, fmtTime, money, iso, badge, toast };
})();
