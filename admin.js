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
      row: (r) => [{ support: "Message", change: "Plan change", cancellation: "Cancellation", booking: "Filming booked" }[r.kind] || r.kind, fmtDate(r.created_at), r.message || ""],
    },
  };

  let clients = [], plans = {}, openReqs = [], leads = [], mode = "clients", current = null, tab = "plan", rows = [], editing = null;
  // agreements (contracts + e-signature)
  const C = window.RFContracts;
  let agreements = [], agReady = true, agTemplate = "client-service", agDraft = null, agPreview = "", agLink = null;

  const loadClients = async () => {
    clients = await api.clients();
    const all = await Promise.all(clients.map((c) => api.plan(c.id)));
    plans = Object.fromEntries(clients.map((c, i) => [c.id, all[i]]));
    openReqs = (await api.list("requests")).filter((r) => r.status !== "done");
    leads = await api.list("leads");
    await loadAgreements();
    if (!current && clients.length) current = clients[0].id;
  };
  // The agreements table is added by a database update; until it has been run, show a note instead of failing.
  const loadAgreements = async () => {
    try { agreements = await api.agreements(); agReady = true; }
    catch (err) { console.warn("agreements unavailable", err); agreements = []; agReady = false; }
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

  const leadsView = () => leads.length ? `<ul class="list">${leads.map((l) => `<li class="item${l.status === "new" ? " item--review" : ""}">
      <div class="item__main"><b>${esc(l.name)} · <a href="mailto:${esc(l.email)}">${esc(l.email)}</a></b>
        <span>${esc([l.type, l.interest, l.handle].filter(Boolean).join(" · "))} · ${esc(fmtDate(l.created_at))}</span>${l.message ? `<p class="note">${esc(l.message)}</p>` : ""}</div>
      <div class="item__side">${badge(l.status)}
        ${l.status === "new" ? `<button class="btn btn--line btn--xs" data-lead="${esc(l.id)}" data-status="contacted">Mark contacted</button>` : ""}
        ${l.status !== "closed" ? `<button class="btn btn--line btn--xs" data-lead="${esc(l.id)}" data-status="closed">Close</button>` : ""}
        <button class="btn btn--line btn--xs btn--danger" data-lead="${esc(l.id)}" data-status="delete">Delete</button></div></li>`).join("")}</ul>`
    : `<div class="empty"><h2>No leads yet</h2><p>Requests from the website’s contact form appear here.</p></div>`;

  // ---------- agreements ----------
  const signLink = (id) => new URL(`sign.html?id=${id}${DEMO ? "&demo" : ""}`, location.href).href;
  const blankLink = (id) => `sign.html?blank=${id}${DEMO ? "&demo" : ""}`;
  const remembered = () => { try { return JSON.parse(localStorage.getItem("rf-contract-defaults") || "{}"); } catch { return {}; } };
  const agDefaults = (id, keep = {}) => {
    const saved = remembered();
    return Object.fromEntries(C.templates[id].fields.map((f) => [f.name,
      keep[f.name] !== undefined && keep[f.name] !== "" ? keep[f.name] : f.name === "start_date" ? iso(new Date()) : saved[f.name] ?? f.default ?? (f.type === "checkbox" ? false : "")]));
  };
  const cfield = (f, val) => {
    const req = f.required ? " required" : "";
    if (f.type === "checkbox") return `<label class="afield afield--wide afield--check"><input type="checkbox" name="${f.name}"${val ? " checked" : ""}><span>${esc(f.label)}</span></label>`;
    const control = f.type === "select"
      ? `<select name="${f.name}">${f.options.map((o) => `<option${o === val ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`
      : f.type === "textarea" ? `<textarea name="${f.name}" rows="4"${req}>${esc(val)}</textarea>`
      : `<input type="${f.type}" name="${f.name}" value="${esc(val)}"${req}>`;
    return `<label class="afield${f.wide ? " afield--wide" : ""}">${esc(f.label)}${control}</label>`;
  };
  const readAgForm = (form) => {
    const t = C.templates[agTemplate], out = {};
    t.fields.forEach((f) => { out[f.name] = f.type === "checkbox" ? form[f.name].checked : String(form[f.name].value ?? "").trim(); });
    return out;
  };

  const agreementsView = () => {
    if (!agDraft) agDraft = agDefaults(agTemplate);
    const t = C.templates[agTemplate];
    const waiting = agreements.filter((x) => x.status === "sent").length;
    const linkCard = agLink ? `<div class="aglink"><b>Signing link ready for ${esc(agLink.party_name)}</b>
        <p class="muted">Send them this private link. Anyone who has it can open and sign the document, so only send it to the person who should sign.</p>
        <div class="aglink__row"><input readonly value="${esc(signLink(agLink.id))}" aria-label="Signing link" onclick="this.select()">
          <button class="btn btn--red btn--xs" data-ag="copy" data-link="${esc(signLink(agLink.id))}">Copy link</button>
          ${agLink.party_email ? `<a class="btn btn--line btn--xs" href="mailto:${esc(agLink.party_email)}?subject=${encodeURIComponent(`${agLink.title} — please review and sign`)}&body=${encodeURIComponent(`Hi ${agLink.party_name.split(" ")[0]},\n\nHere is your ${agLink.title} from Rare Feature. Please review and sign it at this private link:\n\n${signLink(agLink.id)}\n\nLet me know if you have any questions.\n\nThanks,\n${me.full_name || "Rare Feature"}`)}">Email it</a>` : ""}
          <a class="btn btn--line btn--xs" href="${esc(signLink(agLink.id))}" target="_blank" rel="noopener">Open</a></div></div>` : "";
    const form = `<form class="aform" id="ag-form"><h3>New agreement</h3>
        <label class="afield afield--wide">Type<select name="template">${Object.entries(C.templates).map(([id, x]) => `<option value="${id}"${id === agTemplate ? " selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label>
        <p class="muted afield--wide" style="margin:-4px 0 4px">${esc(t.about)}</p>
        ${!t.printOnly && clients.length ? `<label class="afield afield--wide">Fill in from a client (optional)<select name="_client"><option value="">—</option>${clients.map((x) => `<option value="${esc(x.id)}">${esc(x.business_name || x.full_name || x.email)}</option>`).join("")}</select></label>` : ""}
        ${t.fields.map((f) => cfield(f, agDraft[f.name])).join("")}
        ${t.printOnly
          ? `<div class="row"><a class="btn btn--red btn--sm" id="ag-print" href="${blankLink(agTemplate)}" target="_blank" rel="noopener">Open printable form</a><span class="muted">Print it, have it signed on paper at the practice, and keep the original there.</span></div>`
          : `<label class="afield afield--wide">Signed for Rare Feature by (your name — this is your signature on the agreement)<input name="_provider" value="${esc(agDraft._provider ?? me.full_name ?? "")}" required></label>
             <div class="row"><button type="button" class="btn btn--line btn--sm" data-ag="preview">Preview</button><button class="btn btn--red btn--sm">Create signing link</button>
             <span class="muted">Once created, the wording is locked. To change it, withdraw it and create a new one.</span></div>`}</form>`;
    const list = agreements.length ? `<ul class="list">${agreements.map((x) => `<li class="item">
        <div class="item__main"><b>${esc(x.title)}</b><span>${esc([x.party_name, x.party_org, x.party_email].filter(Boolean).join(" · "))}</span>
          <span>Created ${esc(fmtDate(x.created_at))}${x.signed_at ? ` · Signed ${esc(fmtDate(x.signed_at))} by ${esc(x.signed_name || "")}` : ""}</span></div>
        <div class="item__side">${badge(x.status)}<a class="btn btn--line btn--xs" href="${esc(signLink(x.id))}" target="_blank" rel="noopener">${x.status === "signed" ? "View signed copy" : "Open"}</a>
          ${x.status === "sent" ? `<button class="btn btn--line btn--xs" data-ag="copy" data-link="${esc(signLink(x.id))}">Copy link</button><button class="btn btn--line btn--xs btn--danger" data-ag="void" data-id="${esc(x.id)}">Withdraw</button>` : ""}</div></li>`).join("")}</ul>`
      : `<div class="empty empty--sm"><b>No agreements yet</b><p>Create one above and send the signing link.</p></div>`;
    const blanks = `<section class="block"><h2 class="block__h">Printable blank forms</h2><p class="muted">For signing on paper. The patient authorization is paper-only on purpose: it contains patient health information, so the practice should keep it, not this website.</p>
        <div class="row">${Object.entries(C.templates).map(([id, x]) => `<a class="btn btn--line btn--xs" href="${blankLink(id)}" target="_blank" rel="noopener">${esc(x.title.split(" — ")[0].split(" (")[0])}</a>`).join("")}</div></section>`;
    return `<header class="vhead"><p class="vhead__k">Admin</p><h1>Agreements</h1><p>Create a contract, send its private signing link, and see when it’s signed. ${waiting ? `<b>${waiting} awaiting signature.</b>` : ""}</p></header>${"%%TABS%%"}
      ${agReady ? "" : `<div class="alert" style="cursor:default"><b>One step left to switch this on</b><span>The agreements database update hasn’t been run yet, so signing links can’t be saved.</span></div>`}
      ${linkCard}${form}${agPreview ? `<article class="paper paper--preview">${agPreview}</article>` : ""}
      <section class="block"><h2 class="block__h">All agreements</h2>${list}</section>${blanks}`;
  };

  const render = () => {
    const newLeads = leads.filter((l) => l.status === "new").length;
    const waitingAg = agreements.filter((x) => x.status === "sent").length;
    const modeTabs = `<div class="tabs tabs--mode"><button data-mode="clients" class="${mode === "clients" ? "is-on" : ""}">Clients (${clients.length})</button>
      <button data-mode="leads" class="${mode === "leads" ? "is-on" : ""}">Leads${newLeads ? ` · ${newLeads} new` : ""}</button>
      <button data-mode="agreements" class="${mode === "agreements" ? "is-on" : ""}">Agreements${waitingAg ? ` · ${waitingAg} waiting` : ""}</button></div>`;
    if (mode === "agreements") { view.innerHTML = agreementsView().replace("%%TABS%%", modeTabs); return; }
    if (mode === "leads") {
      view.innerHTML = `<header class="vhead"><p class="vhead__k">Admin</p><h1>Leads</h1><p>Free-audit and package requests sent through the website. Reply by email, then mark them contacted.</p></header>${modeTabs}${leadsView()}`;
      return;
    }
    const c = clients.find((x) => x.id === current);
    const tabs = [["plan", "Plan"], ...Object.entries(TABLES).map(([k, t]) => [k, t.label]), ["details", "Details"]];
    view.innerHTML = `<header class="vhead"><p class="vhead__k">Admin</p><h1>Clients</h1>
        <p>${clients.length} ${clients.length === 1 ? "person has" : "people have"} signed in. ${openReqs.length ? `<b>${openReqs.length} open request${openReqs.length > 1 ? "s" : ""}.</b>` : "No open requests."}</p></header>
      ${modeTabs}
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
    const el = e.target.closest("[data-client],[data-tab],[data-act],[data-mode],[data-lead],[data-ag]");
    if (!el) return;
    if (el.dataset.ag === "copy") {
      navigator.clipboard?.writeText(el.dataset.link).then(() => toast("Link copied."), () => toast("Couldn’t copy. Select the link and copy it by hand.", true));
      return;
    }
    if (el.dataset.ag === "preview") {
      const f = document.getElementById("ag-form");
      agDraft = { ...readAgForm(f), _provider: f._provider.value };
      const out = C.render(agTemplate, agDraft);
      agPreview = `<header class="paper__head"><h1>${esc(out.title)}</h1><p>Preview — not sent yet</p></header><div class="paper__body">${out.html}</div>`;
      render(); view.querySelector(".paper--preview")?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (el.dataset.ag === "void") {
      if (!confirm("Withdraw this agreement? Its link will stop working for signing.")) return;
      run(async () => { await api.voidAgreement(el.dataset.id); await loadAgreements(); if (agLink?.id === el.dataset.id) agLink = null; }, "Withdrawn.");
      return;
    }
    if (el.dataset.mode) { mode = el.dataset.mode; render(); return; }
    if (el.dataset.lead) {
      const id = el.dataset.lead, st = el.dataset.status;
      if (st === "delete" && !confirm("Delete this lead?")) return;
      run(async () => {
        if (st === "delete") await api.remove("leads", id); else await api.save("leads", { ...leads.find((l) => l.id === id), status: st });
        leads = await api.list("leads");
      }, st === "delete" ? "Deleted." : "Updated.");
      return;
    }
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
    if (f && f.id === "ag-form") {
      const name = e.target.name;
      if (name === "template") {
        const keep = C.templates[agTemplate].printOnly ? {} : readAgForm(f);
        agTemplate = e.target.value; agDraft = agDefaults(agTemplate, keep); agPreview = ""; render();
      } else if (C.templates[agTemplate].printOnly) {
        // keep the "Open printable form" link in step with what was typed (e.g. the practice name)
        const link = document.getElementById("ag-print");
        if (link) link.href = `${blankLink(agTemplate)}&org=${encodeURIComponent(f.party_org?.value || "")}&co=${encodeURIComponent(f.company_legal?.value || "")}`;
      } else if (name === "package" && C.PACKAGES[e.target.value]) {
        const p = C.PACKAGES[e.target.value];
        ["price", "sessions", "videos", "platforms", "extras"].forEach((k) => { if (f[k]) f[k].value = p[k]; });
      } else if (name === "_client" && e.target.value) {
        const c = clients.find((x) => x.id === e.target.value), p = plans[c.id];
        if (f.party_name && c.full_name) f.party_name.value = c.full_name;
        if (f.party_email && c.email) f.party_email.value = c.email;
        if (f.party_org && c.business_name) f.party_org.value = c.business_name;
        if (p && f.package && C.PACKAGES[p.plan]) { f.package.value = p.plan; f.package.dispatchEvent(new Event("change", { bubbles: true })); }
        if (p && f.price) f.price.value = p.price_cents / 100;
      }
      return;
    }
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
    if (f.id === "ag-form") {
      const t = C.templates[agTemplate];
      if (t.printOnly) return;
      const fields = readAgForm(f), provider = f._provider.value.trim();
      const missing = t.fields.find((x) => x.required && !String(fields[x.name] ?? "").trim());
      if (missing) { toast(`Please fill in: ${missing.label}`, true); f[missing.name].focus(); return; }
      if (provider.length < 2) { toast("Type your name to sign for Rare Feature.", true); f._provider.focus(); return; }
      const out = C.render(agTemplate, fields);
      try { localStorage.setItem("rf-contract-defaults", JSON.stringify({ company_legal: fields.company_legal, state: fields.state || remembered().state })); } catch { /* private mode */ }
      run(async () => {
        const made = await api.createAgreement({
          template: agTemplate, template_version: out.version, title: out.title, body_html: out.html, fields,
          party_name: fields.party_name, party_email: fields.party_email || null, party_org: fields.party_org || null, provider_signed_name: provider,
        });
        agLink = { id: made.id, title: out.title, party_name: fields.party_name, party_email: fields.party_email };
        agDraft = null; agPreview = "";
        await loadAgreements();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, "Agreement created. Send the signing link.");
      return;
    }
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
