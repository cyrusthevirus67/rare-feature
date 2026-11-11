// Free guide: save the sign-up as a lead, then unlock the playbook on this device.
(() => {
  const CFG = window.RF_CONFIG || {};
  const KEY = "rf_guide_unlocked";
  const form = document.getElementById("guide-form");
  const guide = document.getElementById("guide");
  if (!form || !guide) return;

  const unlock = (name, scroll) => {
    guide.hidden = false;
    if (name) document.getElementById("guide-hi").textContent = `You’re in, ${name}. Here’s the playbook — bookmark this page, it stays unlocked on this device.`;
    form.innerHTML = `<h2>You’re in.</h2><p class="gform__fine">The playbook is unlocked below.</p><a class="btn btn--red btn--block" href="#guide">Read the playbook ↓</a>`;
    if (scroll) guide.scrollIntoView({ behavior: "smooth" });
  };
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
  if (saved) unlock(saved.name, false);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = form.querySelector(".form__status");
    const name = form.elements.name, email = form.elements.email;
    let ok = true;
    [name, email].forEach((f) => { const good = f.value.trim() && f.checkValidity(); f.classList.toggle("is-invalid", !good); if (!good) ok = false; });
    status.classList.remove("is-error");
    if (!ok) { status.textContent = "Please add your first name and a valid email."; status.classList.add("is-error"); return; }
    const btn = form.querySelector("button");
    btn.disabled = true; status.textContent = "Unlocking…";
    const sb = CFG.supabase || {};
    try {
      if (sb.url && sb.anonKey) {
        const res = await fetch(`${sb.url}/rest/v1/leads`, {
          method: "POST",
          headers: { apikey: sb.anonKey, Authorization: `Bearer ${sb.anonKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ name: name.value.trim(), email: email.value.trim(), type: form.elements.type.value, interest: "Free guide", message: "Downloaded the Stop-the-Scroll Playbook" }),
        });
        if (!res.ok) throw new Error();
      }
    } catch { /* never block the guide on a save error */ }
    const first = name.value.trim().split(" ")[0];
    try { localStorage.setItem(KEY, JSON.stringify({ name: first })); } catch {}
    unlock(first, true);
  });

  const print = document.getElementById("guide-print");
  if (print) print.addEventListener("click", () => window.print());
})();
