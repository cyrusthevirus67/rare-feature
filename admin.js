// Admin: manage every client's plan, content, filming sessions, reports, and requests.
(async () => {
  const { CFG, DEMO, configured, api, PLANS, STATUS, esc, fmtDate, fmtMonth, fmtTime, money, iso, badge, toast } = window.RF;
  const view = document.getElementById("view");
  const q = DEMO ? "?demo" : "";
  document.getElementById("demo-bar").hidden = !DEMO;
  document.getElementById("back").href = `portal.html${q}`;

  if (!DEMO && !configured) { location.replace("client.html"); return; }
  let me;
  try { me = await api.me(); } catch { me = null; }
  if (!me) { location.replace("client.html"); return; }
  if (!me.is_admin) {
    view.innerHTML = `<div class="empty"><h2>Admins only</h2><p>This page is for the Rare Feature team.</p><a class="btn btn--line btn--sm" href="portal.html${q}">Back to my portal</a></div>`;
    return;
  }

  const opts = (keys) => keys.map((k) => [k, STATUS[k] || k]);
  const PLATFORMS = ["Instagram Reel", "Instagram Post", "Instagram Story", "TikTok", "Facebook", "YouTube Shorts", "LinkedIn", "X"].map((p) => [p, p]);
  const localDT = (v) => { const d = new Date(v); return `${iso(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

  // [name, input type, label, options | {wide, required}]
  const TABLES = {
    deliverables: {
      label: "Content", noun: "video",
      fields: [["title", "text", "Title", { wide: true, required: true }], ["month", "month", "Month", { required: true }], ["platform", "select", "Platform", PLATFORMS],
        ["status", "select", "Status", opts(["planned", "filming", "editing", "review", "approved", "scheduled", "posted"])], ["view_url", "url", "Preview link (client taps “Watch”)", { wide: true }]],
      row: (r) => [r.title, `${fmtMonth(r.month)} · ${r.platform || "—"}`, r.client_feedback ? `Client note: ${r.client_feedback}` : ""],
    },
    filming_sessions: {
      label: "Filming", noun: "session",
      fields: [["starts_at", "datetime-local", "Date & time", { required: true }], ["status", "select", "Status", opts(["scheduled", "completed", "cancelled"])],
        ["location", "text", "Location", { wide: true }], ["notes", "textarea", "Notes for the client", { wide: true }]],
      row: (r) => [`${fmtDate(r.starts_at, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${fmtTime(r.starts_at)}`, r.location || "—", r.notes || ""],
    },
    reports: {
      label: "Reports", noun: "report",
      fields: [["month", "month", "Month", { required: true }], ["headline", "text", "Headline"], ["summary", "textarea", "Summary", { wide: true }], ["url", "url", "Link to full report", { wide: true }]],
      row: (r) => [r.headline || "Monthly report", fmtMonth(r.month), r.summary || ""],
    },
    requests: {
      label: "Requests", noun: "request", noAdd: true,
      fields: [["status", "select", "Status", opts(["open", "in_progress", "done"])]],
      row: (r) => [{ support: "Message", change: "Plan change", cancellation: "Cancellation" }[r.kind] || r.kind, fmtDate(r.created_at), r.message || ""],
    },
  };

  let clients = [], plans = {}, openReqs = [], current = null, tab = "plan", rows = [], editing = null;

  const loadClients = async () => {
    clients = await api.clients();
    const all = await Promise.all(clients.map((c) => api.plan(c.id)));
    plans = Object.fromEntries(clients.map((c, i) => [c.id, all[i]]));
    openReqs = (await api.list("requests")).filter((r) => r.status !== "done");
    if (!current && clients.length) current = clients[0].id;
  };
  const loadTab = async () => { rows = TABLES[tab] ? await api.list(tab, current) : []; editing = null; };

  // ---------- form helpers ----------
  const input = ([name, type, label, extra], value) => {
    const o = Array.isArray(extra) ? {} : extra || {};
    let v = value ?? "";
    if (type === "month" && v) v = String(v).slice(0, 7);
    if (type === "datetime-local" && v) v = localDT(v);
    const attrs = `name="${name}"${o.required ? " required" : ""}`;
    const control = type === "select"
      ? `<select ${attrs}>${extra.map(([val, text]) => `<option value="${esc(val)}"${val === v ? " selected" : ""}>${esc(text)}</option>`).join("")}</select>`
      : type === "textarea" ? `<textarea ${attrs} rows="3">${esc(v)}</textarea>`
      : `<input type="${type}" ${attrs} value="${esc(v)}">`;
    return `<label class="afield${o.wide ? " afield--wide" : ""}">${esc(label)}${control}</label>`;
  };
  const readForm = (form, fields) => {
    const data = Object.fromEntries(new FormData(form));
    const out = {};
    fields.forEach(([name, type]) => {
      let v = (data[name] ?? "").trim();
      if (type === "month") v = v ? `${v}-01` : null;
      else if (type === "datetime-local") v = v ? new Date(v).toISOString() : null;
      else if (type === "number") v = Number(v) || 0;
      else if (type === "date" || type === "url") v = v || null;
      out[name] = v;
    });
    return out;
  };

  // ---------- views ----------
  const PLAN_FIELDS = [["plan", "select", "Package", Object.keys(PLANS).map((p) => [p, p])], ["price", "number", "Price ($)"], ["billing", "select", "Billing", [["monthly", "Monthly"], ["one-time", "One-time"]]],
    ["status", "select", "Status", opts(["onboarding", "active", "paused", "cancel_requested", "cancelled"])], ["started_on", "date", "Start date"], ["minimum_term_ends", "date", "Minimum term ends"],
    ["next_billing_on", "date", "Next billing date"], ["videos_per_month", "number", "Videos per month"], ["sessions_per_month", "number", "Filming sessions per month"], ["platforms", "text", "Platforms", { wide: true }]];

  const planView = () => {
    const p = plans[current] || { plan: "Starter", ...PLANS.Starter, status: "onboarding", started_on: iso(new Date()) };
    return `<form class="aform" id="plan-form"><h3>${plans[current] ? "Edit plan" : "No plan yet — assign one"}</h3>
      ${PLAN_FIELDS.map((f) => input(f, f[0] === "price" ? p.price_cents / 100 : p[f[0]])).join("")}
      <div class="row"><button class="btn btn--red btn--sm">Save plan</button><span class="muted">Picking a package fills in the usual price and amounts. Minimum term defaults to 3 months after the start date.</span></div></form>`;
  };

  const detailsView = () => {
    const c = clients.find((x) => x.id === current);
    return `<form class="aform" id="details-form"><h3>Client details</h3>
      ${input(["full_name", "text", "Name"], c.full_name)}${input(["business_name", "text", "Business or channel"], c.business_name)}${input(["instagram", "text", "Instagram handle"], c.instagram)}
      <label class="afield">Email<input value="${esc(c.email)}" disabled></label>
      <div class="row"><button class="btn btn--red btn--sm">Save details</button></div></form>`;
  };

  const tableView = () => {
    const t = TABLES[tab];
    const form = (editing || !t.noAdd) ? `<form class="aform" id="row-form"><h3>${editing ? `Edit ${t.noun}` : `Add a ${t.noun}`}</h3>
      ${t.fields.map((f) => input(f, editing ? editing[f[0]] : f[1] === "month" ? iso(new Date()) : "")).join("")}
      <div class="row"><button class="btn btn--red btn--sm">${editing ? "Save changes" : `Add ${t.noun}`}</button>${editing ? `<button type="button" class="btn btn--line btn--sm" data-act="cancel">Cancel</button>` : ""}</div></form>` : "";
    const list = rows.length ? `<ul class="list">${rows.map((r) => { const [a, b, c] = t.row(r); return `<li class="item">
      <div class="item__main"><b>${esc(a)}</b><span>${esc(b)}</span>${c ? `<p class="note">${esc(c)}</p>` : ""}</div>
      <div class="item__side">${r.status ? badge(r.status) : ""}<button class="btn btn--line btn--xs" data-act="edit" data-id="${esc(r.id)}">Edit</button><button class="btn btn--line btn--xs btn--danger" data-act="delete" data-id="${esc(r.id)}">Delete</button></div></li>`; }).join("")}</ul>`
      : `<div class="empty empty--sm"><b>Nothing here yet</b><p>${t.noAdd ? "Messages and requests from this client will appear here." : `Add this client’s first ${t.noun} above.`}</p></div>`;
    return form + list;
  };

  const render = () => {
    const c = clients.find((x) => x.id === current);
    const tabs = [["plan", "Plan"], ...Object.entries(TABLES).map(([k, t]) => [k, t.label]), ["details", "Details"]];
    view.innerHTML = `<header class="vhead"><p class="vhead__k">Admin</p><h1>Clients</h1>
        <p>${clients.length} ${clients.length === 1 ? "person has" : "people have"} signed in. ${openReqs.length ? `<b>${openReqs.length} open request${openReqs.length > 1 ? "s" : ""}.</b>` : "No open requests."}</p></header>
      <details class="block" style="margin:0 0 24px"><summary class="link">How do I add a new client?</summary>
        <ol class="steps-help" style="margin-top:14px"><li>Send them to <code>rarefeature.com/client.html</code> and have them sign in with their email (a one-time link — no password).</li>
        <li>They’ll appear in the list below. Until you assign a plan they see “Your portal is being set up.”</li>
        <li>Pick them, choose a package under <b>Plan</b>, and save. Then add their videos, filming sessions, and reports.</li></ol></details>
      ${clients.length ? `<div class="admin">
        <ul class="clients">${clients.map((x) => { const p = plans[x.id]; const n = openReqs.filter((r) => r.client_id === x.id).length; return `<li><button data-client="${esc(x.id)}" class="${x.id === current ? "is-on" : ""}">
          <b>${esc(x.business_name || x.full_name || x.email)}</b><small>${p ? `${esc(p.plan)} · ${money(p.price_cents)}` : "No plan yet"}${n ? ` ${badge("open")}` : ""}</small></button></li>`; }).join("")}</ul>
        <div><h2 class="block__h">${esc(c.business_name || c.full_name || c.email)} · ${esc(c.email)}</h2>
          <div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? "is-on" : ""}">${esc(l)}</button>`).join("")}</div>
          ${tab === "plan" ? planView() : tab === "details" ? detailsView() : tableView()}</div></div>`
        : `<div class="empty"><h2>No clients yet</h2><p>Clients appear here after they sign in for the first time.</p></div>`}`;
  };

  // ---------- actions ----------
  const run = async (fn, okMsg) => {
    try { await fn(); render(); if (okMsg) toast(okMsg); }
    catch (err) { console.error(err); toast(err.message || "Something went wrong.", true); }
  };

  view.addEventListener("click", (e) => {
    const el = e.target.closest("[data-client],[data-tab],[data-act]");
    if (!el) return;
    if (el.dataset.client) run(async () => { current = el.dataset.client; await loadTab(); });
    else if (el.dataset.tab) run(async () => { tab = el.dataset.tab; await loadTab(); });
    else if (el.dataset.act === "edit") { editing = rows.find((r) => r.id === el.dataset.id); render(); view.querySelector("#row-form")?.scrollIntoView({ block: "center" }); }
    else if (el.dataset.act === "cancel") { editing = null; render(); }
    else if (el.dataset.act === "delete") {
      if (!confirm("Delete this? The client will no longer see it.")) return;
      run(async () => { await api.remove(tab, el.dataset.id); await loadTab(); openReqs = openReqs.filter((r) => r.id !== el.dataset.id); }, "Deleted.");
    }
  });

  view.addEventListener("change", (e) => {
    const f = e.target.form;
    if (!f || f.id !== "plan-form") return;
    if (e.target.name === "plan") {
      const p = PLANS[e.target.value];
      f.price.value = p.price_cents / 100; f.billing.value = p.billing; f.videos_per_month.value = p.videos_per_month;
      f.sessions_per_month.value = p.sessions_per_month; f.platforms.value = p.platforms;
    }
    if (e.target.name === "started_on" && e.target.value && !f.minimum_term_ends.value) {
      const d = new Date(`${e.target.value}T12:00:00`); d.setMonth(d.getMonth() + 3); f.minimum_term_ends.value = iso(d);
    }
  });

  view.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.id === "plan-form") {
      const d = readForm(f, PLAN_FIELDS);
      if (d.billing === "monthly" && d.started_on && !d.minimum_term_ends) { const x = new Date(`${d.started_on}T12:00:00`); x.setMonth(x.getMonth() + 3); d.minimum_term_ends = iso(x); }
      const row = { ...d, client_id: current, price_cents: Math.round(d.price * 100) };
      delete row.price;
      run(async () => { await api.save("client_plans", row); plans[current] = await api.plan(current); }, "Plan saved.");
    } else if (f.id === "details-form") {
      const d = readForm(f, [["full_name", "text"], ["business_name", "text"], ["instagram", "text"]]);
      run(async () => { await api.save("profiles", { id: current, ...d }); Object.assign(clients.find((x) => x.id === current), d); }, "Details saved.");
    } else if (f.id === "row-form") {
      const row = { ...readForm(f, TABLES[tab].fields), client_id: current };
      if (editing) row.id = editing.id;
      run(async () => {
        await api.save(tab, row);
        await loadTab();
        if (tab === "requests") openReqs = (await api.list("requests")).filter((r) => r.status !== "done");
      }, "Saved.");
    }
  });

  try { await loadClients(); await loadTab(); render(); }
  catch (err) { console.error(err); view.innerHTML = `<div class="empty"><h2>Couldn’t load clients</h2><p>${esc(err.message || "Please refresh the page.")}</p></div>`; }
})();
