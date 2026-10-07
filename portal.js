// Client portal: what a signed-in client sees.
(async () => {
  const { CFG, DEMO, configured, api, STATUS, esc, safeUrl, asDate, fmtDate, fmtMonth, fmtTime, money, iso, badge, toast } = window.RF;
  const view = document.getElementById("view");
  const q = DEMO ? "?demo" : "";

  if (!DEMO && !configured) { location.replace("client.html"); return; }

  let me, plan, deliverables, sessions, reports, requests, agreements = [];
  try {
    me = await api.me();
    if (!me) { location.replace("client.html"); return; }
  } catch (err) {
    view.innerHTML = `<div class="empty"><h2>We couldn’t load your portal</h2><p>Please refresh the page. If it keeps happening, email <a href="mailto:${esc(CFG.email)}">${esc(CFG.email)}</a>.</p></div>`;
    return;
  }

  const load = async () => {
    [plan, deliverables, sessions, reports, requests] = await Promise.all([
      api.plan(me.id), api.list("deliverables", me.id), api.list("filming_sessions", me.id), api.list("reports", me.id), api.list("requests", me.id),
    ]);
    // Agreements live in a table added later; a client's portal must still load if it isn't there yet.
    try { agreements = await api.myAgreements(me.email); } catch (err) { console.warn("agreements unavailable", err); agreements = []; }
  };

  // ---------- shell ----------
  document.getElementById("demo-bar").hidden = !DEMO;
  document.getElementById("admin-link").hidden = !me.is_admin;
  document.getElementById("admin-link").href = `admin.html${q}`;
  document.getElementById("signout").addEventListener("click", async () => { await api.signOut(); location.href = "client.html"; });
  const paintWho = () => {
    const name = me.full_name || me.email || "";
    document.getElementById("who-name").textContent = name;
    document.getElementById("who-biz").textContent = me.business_name || me.email || "";
    document.getElementById("avatar").textContent = (name.trim()[0] || "·").toUpperCase();
  };

  const thisMonth = () => iso(new Date()).slice(0, 7);
  const needsReview = () => deliverables.filter((d) => d.status === "review");
  const upcoming = () => sessions.filter((s) => s.status === "scheduled" && asDate(s.starts_at) >= new Date());
  const inMinimum = () => plan && plan.minimum_term_ends && asDate(plan.minimum_term_ends) > new Date();

  // ---------- views ----------
  const views = {
    overview() {
      if (!plan) {
        return `<header class="vhead"><h1>Welcome${me.full_name ? `, ${esc(me.full_name.split(" ")[0])}` : ""}</h1></header>
          <div class="empty"><h2>Your portal is being set up</h2>
          <p>Thanks for signing in. As soon as your plan is active you’ll see your content, filming schedule, and reports here.</p>
          <div class="row"><a class="btn btn--red btn--sm" href="index.html#pricing">See packages</a><a class="btn btn--line btn--sm" href="#support">Message us</a></div></div>`;
      }
      const month = deliverables.filter((d) => d.month.slice(0, 7) === thisMonth());
      const done = month.filter((d) => ["approved", "scheduled", "posted"].includes(d.status)).length;
      const target = plan.videos_per_month || month.length;
      const pct = target ? Math.min(100, Math.round((done / target) * 100)) : 0;
      const next = upcoming()[0];
      const review = needsReview();
      const report = reports[0];
      return `<header class="vhead"><p class="vhead__k">${esc(fmtDate(new Date(), { weekday: "long", month: "long", day: "numeric" }))}</p>
          <h1>Welcome back${me.full_name ? `, ${esc(me.full_name.split(" ")[0])}` : ""}</h1></header>
        ${toSign().length ? `<a class="alert" href="${signUrl(toSign()[0].id)}" target="_blank" rel="noopener"><b>Your ${esc(toSign()[0].title)} is ready to sign</b><span>Review &amp; sign →</span></a>` : ""}
        ${review.length ? `<a class="alert" href="#content"><b>${review.length} video${review.length > 1 ? "s" : ""} waiting for your review</b><span>Approve or request changes →</span></a>` : ""}
        <div class="grid">
          <section class="card card--plan">
            <p class="card__k">Your plan</p>
            <h2>${esc(plan.plan)}</h2>
            <p class="card__price">${money(plan.price_cents)}<small>${plan.billing === "monthly" ? "/mo" : " one-time"}</small> ${badge(plan.status)}</p>
            <dl class="kv"><div><dt>Next billing</dt><dd>${plan.billing === "monthly" ? esc(fmtDate(plan.next_billing_on)) : "—"}</dd></div>
              <div><dt>Platforms</dt><dd>${esc(plan.platforms || "—")}</dd></div></dl>
            <a class="link" href="#billing">Plan &amp; billing →</a>
          </section>
          <section class="card">
            <p class="card__k">${esc(fmtMonth(new Date()))}</p>
            <h2>${done}<small> of ${target} videos ready</small></h2>
            <div class="bar"><i style="width:${pct}%"></i></div>
            <ul class="mini">${["review", "editing", "filming", "planned"].map((s) => {
              const n = month.filter((d) => d.status === s).length;
              return n ? `<li>${badge(s)}<b>${n}</b></li>` : "";
            }).join("")}</ul>
            <a class="link" href="#content">See all content →</a>
          </section>
          <section class="card">
            <p class="card__k">Next filming session</p>
            ${next ? `<h2>${esc(fmtDate(next.starts_at, { weekday: "short", month: "short", day: "numeric" }))}<small> · ${esc(fmtTime(next.starts_at))}</small></h2>
              <p class="muted">${esc(next.location || "Location to be confirmed")}</p>${next.notes ? `<p class="note">${esc(next.notes)}</p>` : ""}`
              : `<h2><small>Nothing scheduled yet</small></h2><p class="muted">We’ll add your next session here as soon as it’s booked.</p>`}
            <a class="link" href="#schedule">Full schedule →</a>
          </section>
          <section class="card">
            <p class="card__k">Latest report</p>
            ${report ? `<h2><small>${esc(fmtMonth(report.month))}</small></h2><p><b>${esc(report.headline || "Monthly report")}</b></p><p class="muted clamp">${esc(report.summary || "")}</p>`
              : `<h2><small>No reports yet</small></h2><p class="muted">Your first monthly report appears here after your first full month.</p>`}
            <a class="link" href="#reports">All reports →</a>
          </section>
        </div>`;
    },

    content() {
      if (!deliverables.length) return head("Content", "Every video we make for you, from idea to posted.") + empty("No content yet", "Your videos will show up here as soon as we start planning your first batch.");
      const months = [...new Set(deliverables.map((d) => d.month.slice(0, 7)))];
      return head("Content", "Every video we make for you, from idea to posted. Approve videos or ask for changes right here.") +
        months.map((m) => `<section class="block"><h2 class="block__h">${esc(fmtMonth(`${m}-01`))}</h2><ul class="list">${
          deliverables.filter((d) => d.month.slice(0, 7) === m).map((d) => `<li class="item${d.status === "review" ? " item--review" : ""}">
            <div class="item__main"><b>${esc(d.title)}</b><span>${esc(d.platform || "")}</span>${d.client_feedback ? `<p class="note">Your note: ${esc(d.client_feedback)}</p>` : ""}</div>
            <div class="item__side">${badge(d.status)}${safeUrl(d.view_url) ? `<a class="btn btn--line btn--xs" href="${esc(safeUrl(d.view_url))}" target="_blank" rel="noopener">Watch</a>` : ""}</div>
            ${d.status === "review" ? `<form class="review" data-id="${esc(d.id)}">
              <textarea name="feedback" rows="2" placeholder="Anything to change? (optional if approving)"></textarea>
              <div class="row"><button class="btn btn--red btn--xs" name="approve" value="1">Approve</button><button class="btn btn--line btn--xs" name="approve" value="0">Request changes</button></div>
            </form>` : ""}</li>`).join("")}</ul></section>`).join("");
    },

    schedule() {
      const up = upcoming(), past = sessions.filter((s) => !up.includes(s)).reverse();
      const row = (s) => `<li class="item"><div class="date"><b>${esc(fmtDate(s.starts_at, { day: "numeric" }))}</b><span>${esc(fmtDate(s.starts_at, { month: "short" }))}</span></div>
        <div class="item__main"><b>${esc(fmtDate(s.starts_at, { weekday: "long" }))} · ${esc(fmtTime(s.starts_at))}</b><span>${esc(s.location || "Location to be confirmed")}</span>${s.notes ? `<p class="note">${esc(s.notes)}</p>` : ""}</div>
        <div class="item__side">${badge(s.status)}</div></li>`;
      return head("Schedule", "Your filming sessions. Need to move one? Send us a message and we’ll sort it out.") + booking() +
        `<section class="block"><h2 class="block__h">Upcoming</h2>${up.length ? `<ul class="list">${up.map(row).join("")}</ul>` : empty("Nothing scheduled", "We’ll add your next filming session here as soon as it’s booked.")}</section>` +
        (past.length ? `<section class="block"><h2 class="block__h">Past</h2><ul class="list list--dim">${past.map(row).join("")}</ul></section>` : "") +
        `<a class="btn btn--line btn--sm" href="#support">Request a change</a>`;
    },

    reports() {
      return head("Reports", "A plain-English look at how your content performed each month.") +
        (reports.length ? `<div class="grid">${reports.map((r) => `<section class="card"><p class="card__k">${esc(fmtMonth(r.month))}</p><h2><small>${esc(r.headline || "Monthly report")}</small></h2>
          <p class="muted">${esc(r.summary || "")}</p>${safeUrl(r.url) ? `<a class="btn btn--line btn--sm" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener">Open full report</a>` : ""}</section>`).join("")}</div>`
          : empty("No reports yet", "Your first monthly report appears here after your first full month."));
    },

    billing() {
      if (!plan) return head("Plan & billing", "") + empty("No active plan", "Once you choose a package, your plan and billing details appear here.") + `<a class="btn btn--red btn--sm" href="index.html#pricing">See packages</a>` + agreementsBlock();
      const monthly = plan.billing === "monthly";
      const billingBtn = CFG.portal
        ? `<a class="btn btn--red btn--sm" href="${esc(CFG.portal)}" target="_blank" rel="noopener">Manage billing &amp; invoices</a>`
        : `<a class="btn btn--line btn--sm" href="mailto:${esc(CFG.email)}?subject=${encodeURIComponent("Billing question")}">Email us about billing</a>`;
      const cancelled = ["cancel_requested", "cancelled"].includes(plan.status);
      return head("Plan & billing", "Your package, what’s included, and everything to do with payment.") +
        `<div class="grid grid--2">
          <section class="card card--plan">
            <p class="card__k">Current plan</p><h2>${esc(plan.plan)}</h2>
            <p class="card__price">${money(plan.price_cents)}<small>${monthly ? "/mo" : " one-time"}</small> ${badge(plan.status)}</p>
            <dl class="kv">
              <div><dt>Started</dt><dd>${esc(fmtDate(plan.started_on))}</dd></div>
              ${monthly ? `<div><dt>Next billing</dt><dd>${esc(fmtDate(plan.next_billing_on))}</dd></div>
              <div><dt>Minimum term ends</dt><dd>${esc(fmtDate(plan.minimum_term_ends))}</dd></div>` : ""}
            </dl>
          </section>
          <section class="card">
            <p class="card__k">What’s included</p>
            <ul class="incl">
              ${plan.sessions_per_month ? `<li><b>${plan.sessions_per_month}</b> filming session${plan.sessions_per_month > 1 ? "s" : ""} a month</li>` : ""}
              ${plan.videos_per_month ? `<li><b>${plan.videos_per_month}</b> short videos a month</li>` : ""}
              ${plan.platforms ? `<li>${esc(plan.platforms)}</li>` : ""}
              ${monthly ? "<li>Captions, scheduling &amp; monthly report</li>" : ""}
            </ul>
          </section>
        </div>
        ${agreementsBlock()}
        <section class="block"><h2 class="block__h">Payment</h2>
          <p class="muted">Update your card, download invoices, and see your payment history. Billing is handled securely by Stripe.</p>${billingBtn}</section>
        ${monthly ? `<section class="block"><h2 class="block__h">Change plan</h2>
          <p class="muted">Want more videos, more platforms, or ads? Tell us which package you’d like and we’ll switch you over.</p>
          <form class="inline" id="change-form"><select name="plan" aria-label="New plan">${["Starter", "Growth", "Premium"].filter((p) => p !== plan.plan).map((p) => `<option>${p}</option>`).join("")}</select>
          <button class="btn btn--line btn--sm">Request change</button></form></section>
        <section class="block block--danger"><h2 class="block__h">Cancel plan</h2>
          ${cancelled ? `<p class="muted">${plan.status === "cancelled" ? "Your plan has been cancelled." : "We’ve received your cancellation request and will confirm your end date by email."}</p>`
            : `<p class="muted">${inMinimum()
              ? `Your 3-month minimum term runs through <b>${esc(fmtDate(plan.minimum_term_ends))}</b>. You can request cancellation now and it will take effect after that date.`
              : "You can cancel anytime. Your plan stays active through the end of your current billing period."}</p>
            <form id="cancel-form"><textarea name="message" rows="2" placeholder="Mind telling us why? (optional)"></textarea>
            <button class="btn btn--line btn--sm btn--danger">Request cancellation</button></form>`}</section>` : ""}`;
    },

    support() {
      return head("Support", "Questions, ideas, or something to change? Send it here and we’ll get back to you.") +
        `<section class="block"><form id="support-form" class="stack"><textarea name="message" rows="4" placeholder="How can we help?" required></textarea>
          <div class="row"><button class="btn btn--red btn--sm">Send message</button><a class="link" href="mailto:${esc(CFG.email)}">or email ${esc(CFG.email)}</a></div></form></section>
        <section class="block"><h2 class="block__h">Your requests</h2>${requests.length ? `<ul class="list">${requests.map((r) => `<li class="item">
          <div class="item__main"><b>${esc({ support: "Message", change: "Plan change", cancellation: "Cancellation", booking: "Filming booked" }[r.kind] || r.kind)}</b><span>${esc(fmtDate(r.created_at))}</span>${r.message ? `<p class="note">${esc(r.message)}</p>` : ""}</div>
          <div class="item__side">${badge(r.status)}</div></li>`).join("")}</ul>` : empty("Nothing yet", "Messages you send us will show up here with their status.")}</section>`;
    },

    account() {
      return head("Account", "Your details. We use these on your content and reports.") +
        `<section class="block"><form id="account-form" class="stack fields">
          <label>Email<input value="${esc(me.email)}" disabled></label>
          <label>Your name<input name="full_name" value="${esc(me.full_name)}" autocomplete="name"></label>
          <label>Business or channel name<input name="business_name" value="${esc(me.business_name)}"></label>
          <label>Instagram handle<input name="instagram" value="${esc(me.instagram)}" placeholder="@yourhandle"></label>
          <div class="row"><button class="btn btn--red btn--sm">Save changes</button></div></form></section>
        <section class="block"><h2 class="block__h">Sign-in</h2><p class="muted">You sign in with a one-time link sent to your email — there’s no password to remember or reset.</p>
          <div class="row"><button class="btn btn--line btn--sm" id="signout-2">Sign out</button>${me.is_admin ? `<a class="btn btn--line btn--sm" href="admin.html${q}">Open admin</a>` : ""}</div></section>`;
    },
  };
  // Filming-session booking (Calendly). Only clients with an active monthly plan get the scheduler.
  const filmingUrl = (CFG.calendly || {}).filming;
  const canSchedule = window.RFCalendly && window.RFCalendly.valid(filmingUrl);
  const isMember = () => plan && plan.billing === "monthly" && ["active", "onboarding"].includes(plan.status);
  const booking = () => {
    if (!canSchedule) return "";
    if (isMember()) {
      const n = plan.sessions_per_month;
      return `<section class="block"><h2 class="block__h">Book a filming session</h2>
        <p class="muted">${n ? `Your ${esc(plan.plan)} plan includes <b>${n}</b> filming session${n > 1 ? "s" : ""} a month. ` : ""}Pick a time that works and you’ll get a calendar invite by email.</p>
        <div class="cal" id="cal-filming"><p class="cal__msg">Loading available times…</p></div></section>`;
    }
    const why = !plan || plan.billing !== "monthly"
      ? "Filming sessions are part of our monthly packages. Choose one and you can book your filming times right here."
      : "Your plan isn’t active right now, so booking is paused. Message us and we’ll get you back on the calendar.";
    return `<section class="block"><h2 class="block__h">Book a filming session</h2><div class="empty empty--sm"><b>Members only</b><p>${why}</p>
      <div class="row" style="margin-top:12px">${!plan || plan.billing !== "monthly" ? `<a class="btn btn--red btn--sm" href="index.html#pricing">See packages</a>` : `<a class="btn btn--line btn--sm" href="#support">Message us</a>`}</div></div></section>`;
  };
  const afterRender = {
    schedule() {
      const el = document.getElementById("cal-filming");
      if (el) window.RFCalendly.inline(el, filmingUrl, { name: me.full_name || "", email: me.email || "" });
    },
  };
  // Let the team know a session was booked. It is confirmed by Calendly's own email either way.
  if (canSchedule) window.RFCalendly.onBooked(async () => {
    const note = "Booked a filming session through the scheduler.";
    try { await api.request(me.id, "booking", note); }
    catch { try { await api.request(me.id, "support", note); } catch (err) { console.error(err); } }
    toast("Booked. Check your email for the calendar invite.");
    // Refresh the data quietly; re-rendering now would wipe Calendly's confirmation screen.
    try { await load(); } catch (err) { console.error(err); }
  });

  const signUrl = (id) => `sign.html?id=${id}${DEMO ? "&demo" : ""}`;
  const toSign = () => agreements.filter((x) => x.status === "sent");
  const agreementsBlock = () => !agreements.length ? "" : `<section class="block"><h2 class="block__h">Agreements</h2><ul class="list">${agreements.map((x) => `<li class="item${x.status === "sent" ? " item--review" : ""}">
      <div class="item__main"><b>${esc(x.title)}</b><span>${x.status === "signed" ? `Signed ${esc(fmtDate(x.signed_at))}` : `Sent ${esc(fmtDate(x.created_at))}`}</span></div>
      <div class="item__side">${badge(x.status)}<a class="btn ${x.status === "sent" ? "btn--red" : "btn--line"} btn--xs" href="${signUrl(x.id)}" target="_blank" rel="noopener">${x.status === "sent" ? "Review & sign" : "View signed copy"}</a></div></li>`).join("")}</ul></section>`;

  const head = (title, sub) => `<header class="vhead"><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ""}</header>`;
  const empty = (title, text) => `<div class="empty empty--sm"><b>${esc(title)}</b><p>${esc(text)}</p></div>`;

  // ---------- render + actions ----------
  const render = () => {
    const name = (location.hash.slice(1) || "overview");
    const key = views[name] ? name : "overview";
    view.innerHTML = views[key]();
    afterRender[key]?.();
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("is-on", a.dataset.view === key));
    const n = needsReview().length, count = document.getElementById("review-count");
    count.hidden = !n; count.textContent = n;
    document.getElementById("main").scrollTo?.(0, 0); window.scrollTo(0, 0);
  };

  const run = async (fn, okMsg) => {
    try { await fn(); await load(); render(); toast(okMsg); }
    catch (err) { console.error(err); toast("Something went wrong. Please try again.", true); }
  };

  view.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target, data = Object.fromEntries(new FormData(f));
    if (f.classList.contains("review")) {
      const approve = e.submitter?.value === "1";
      if (!approve && !data.feedback.trim()) { toast("Tell us what to change so we can fix it.", true); f.feedback.focus(); return; }
      run(() => api.review(f.dataset.id, approve, data.feedback.trim()), approve ? "Approved — we’ll get it scheduled." : "Got it — we’ll make those changes.");
    } else if (f.id === "support-form") {
      run(() => api.request(me.id, "support", data.message.trim()), "Message sent. We’ll be in touch.");
    } else if (f.id === "change-form") {
      run(() => api.request(me.id, "change", `Requested plan change: ${plan.plan} → ${data.plan}`), "Request sent. We’ll confirm your new plan by email.");
    } else if (f.id === "cancel-form") {
      if (!confirm("Request cancellation of your plan?")) return;
      run(() => api.request(me.id, "cancellation", data.message.trim()), "Cancellation request received.");
    } else if (f.id === "account-form") {
      const fields = { full_name: data.full_name.trim(), business_name: data.business_name.trim(), instagram: data.instagram.trim() };
      run(async () => { await api.saveProfile(fields); Object.assign(me, fields); paintWho(); }, "Saved.");
    }
  });
  view.addEventListener("click", (e) => { if (e.target.id === "signout-2") document.getElementById("signout").click(); });
  window.addEventListener("hashchange", render);

  paintWho();
  try { await load(); render(); }
  catch (err) { console.error(err); view.innerHTML = `<div class="empty"><h2>We couldn’t load your portal</h2><p>Please refresh the page.</p></div>`; }
})();
