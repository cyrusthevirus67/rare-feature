// The signing page. Opens one agreement from its private link (sign.html?id=…), lets the person sign it,
// and afterwards shows the signed copy. sign.html?blank=<template> prints an empty form for signing on paper.
(async () => {
  const { api, configured, DEMO, esc } = window.RF;
  const C = window.RFContracts;
  const q = new URLSearchParams(location.search);
  const doc = document.getElementById("doc");
  const form = document.getElementById("signform");
  const notice = document.getElementById("notice");
  const printBtn = document.getElementById("print");
  document.getElementById("demo-bar").hidden = !DEMO;
  printBtn.addEventListener("click", () => window.print());

  const when = (iso) => new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "long" });
  const say = (title, text) => { doc.innerHTML = `<div class="paper__empty"><h1>${esc(title)}</h1><p>${text}</p></div>`; };
  const safeDrawing = (d) => (typeof d === "string" && d.startsWith("data:image/png;base64,") ? d : "");

  // ---------- blank printable form ----------
  const blank = q.get("blank");
  if (blank) {
    const t = C.templates[blank];
    if (!t) return say("Form not found", "That form doesn’t exist.");
    const out = C.render(blank, { party_org: q.get("org") || "", company_legal: q.get("co") || "" }, { blank: true });
    document.title = `${t.title} — Rare Feature`;
    document.getElementById("tag").textContent = "Printable form";
    const lines = t.printOnly ? "" : `<div class="wet">
        <div><span class="blank blank--sig"></span><small>${esc(t.signer)} signature</small></div><div><span class="blank blank--short"></span><small>Date</small></div>
        <div><span class="blank blank--sig"></span><small>Printed name and title</small></div><div></div>
        <div><span class="blank blank--sig"></span><small>For Rare Feature</small></div><div><span class="blank blank--short"></span><small>Date</small></div>
      </div>`;
    doc.innerHTML = `<header class="paper__head"><h1>${esc(out.title)}</h1></header><div class="paper__body">${out.html}</div>${lines}`;
    printBtn.hidden = false;
    return;
  }

  // ---------- one agreement ----------
  const id = q.get("id");
  if (!id) return say("No document selected", "Open the link you were sent to review and sign your document.");
  if (!DEMO && !configured) return say("Signing isn’t available yet", "Online signing is still being set up. Please contact us and we’ll send your document another way.");

  let a;
  try { a = await api.getAgreement(id); }
  catch (err) { console.error(err); return say("We couldn’t open this document", "Please check your connection and try the link again."); }
  if (!a) return say("Document not found", "This link isn’t valid. Check that you copied the whole link, or ask us to send it again.");

  const sigBlock = () => {
    const drawing = safeDrawing(a.signed_drawing);
    const signer = a.status === "signed"
      ? `<div class="sig sig--done">${drawing ? `<img src="${drawing}" alt="Drawn signature">` : `<span class="sig__script">${esc(a.signed_name)}</span>`}
           <b>${esc(a.signed_name)}</b><small>Signed electronically · ${esc(when(a.signed_at))}</small></div>`
      : `<div class="sig sig--wait"><span class="sig__script">&nbsp;</span><b>${esc(a.party_name)}</b><small>${a.status === "void" ? "Not signed — document withdrawn" : "Awaiting signature"}</small></div>`;
    const provider = a.provider_signed_name
      ? `<div class="sig sig--done"><span class="sig__script">${esc(a.provider_signed_name)}</span><b>${esc(a.provider_signed_name)}, for Rare Feature</b><small>Signed electronically · ${esc(when(a.provider_signed_at))}</small></div>`
      : "";
    return `<section class="sigs"><h2>Signatures</h2><div class="sigs__grid">${signer}${provider}</div></section>`;
  };

  const certificate = () => a.status !== "signed" ? "" : `<section class="cert"><h2>Signature record</h2><dl>
      <div><dt>Document</dt><dd>${esc(a.title)}</dd></div>
      <div><dt>Document ID</dt><dd>${esc(a.id)}</dd></div>
      <div><dt>Signed by</dt><dd>${esc(a.signed_name)}</dd></div>
      <div><dt>Signed on</dt><dd>${esc(when(a.signed_at))}</dd></div>
      ${a.signed_ip ? `<div><dt>Internet address</dt><dd>${esc(a.signed_ip)}</dd></div>` : ""}
      <div><dt>Document fingerprint (SHA-256)</dt><dd class="cert__hash">${esc(a.body_sha256 || "")}</dd></div>
    </dl><p>The signer typed their name, confirmed they had read the document, and agreed to sign electronically. The fingerprint identifies the exact text that was signed.</p></section>`;

  const render = () => {
    document.title = `${a.title} — Rare Feature`;
    doc.innerHTML = `<header class="paper__head"><h1>${esc(a.title)}</h1>
        <p>${a.party_org ? `${esc(a.party_org)} · ` : ""}${esc(a.party_name)} · Document ID ${esc(a.id.slice(0, 8))}</p></header>
      <div class="paper__body">${a.body_html}</div>${sigBlock()}${certificate()}`;
    printBtn.hidden = false;
    form.hidden = a.status !== "sent";
    notice.hidden = a.status === "sent";
    notice.className = `notice notice--${a.status}`;
    notice.innerHTML = a.status === "signed"
      ? `<b>Signed.</b> This document was signed on ${esc(when(a.signed_at))}. Use “Print / Save as PDF” to keep a copy — this link will keep working too.`
      : a.status === "void" ? "<b>Withdrawn.</b> This document was withdrawn and can’t be signed. Contact us if you were expecting to sign it." : "";
    document.getElementById("who").textContent = a.party_org ? `${a.party_name}, ${a.party_org}` : a.party_name;
  };
  render();

  // ---------- drawn signature pad ----------
  const pad = document.getElementById("pad");
  const ctx = pad.getContext("2d");
  let drawing = false, drawn = false;
  ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
  const at = (e) => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * (pad.width / r.width), (e.clientY - r.top) * (pad.height / r.height)]; };
  pad.addEventListener("pointerdown", (e) => { drawing = true; drawn = true; pad.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...at(e)); e.preventDefault(); });
  pad.addEventListener("pointermove", (e) => { if (!drawing) return; ctx.lineTo(...at(e)); ctx.stroke(); e.preventDefault(); });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) => pad.addEventListener(t, () => { drawing = false; }));
  document.getElementById("clear").addEventListener("click", () => { ctx.clearRect(0, 0, pad.width, pad.height); drawn = false; });

  // ---------- sign ----------
  const msg = document.getElementById("msg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "signform__msg";
    const name = form.name.value.trim();
    if (name.length < 2) { msg.textContent = "Please type your full legal name."; msg.classList.add("is-error"); form.name.focus(); return; }
    if (!form.read.checked || !form.consent.checked) { msg.textContent = "Please tick both boxes to sign."; msg.classList.add("is-error"); return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; msg.textContent = "Signing…";
    try {
      a = await api.signAgreement(a.id, name, true, drawn ? pad.toDataURL("image/png") : null);
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      msg.textContent = err?.message || "Something went wrong. Please try again.";
      msg.classList.add("is-error");
      btn.disabled = false;
    }
  });
})();
