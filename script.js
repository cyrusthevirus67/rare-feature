const CONFIG = window.RF_CONFIG || { checkout: {}, portal: "", formEndpoint: "", email: "cyrus@rarefeature.com" };

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

// Sticky nav background
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Mobile menu
const toggle = document.querySelector(".nav__toggle");
const menu = document.getElementById("mobile-menu");
const setMenu = (open) => {
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  menu.hidden = !open;
  nav.classList.toggle("is-open", open);
};
toggle.addEventListener("click", () => setMenu(menu.hidden));
menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

// Package buttons: go to Stripe checkout when a link is configured, otherwise pre-fill the contact form
const INTEREST = {
  audit: "Free Instagram audit",
  "growth-plan": "Growth Plan ($497 one-time)",
  starter: "Starter ($997/mo)",
  growth: "Growth ($1,497/mo)",
  premium: "Premium ($2,497/mo)",
};
const interest = document.getElementById("interest");
document.querySelectorAll("[data-plan]").forEach((el) => {
  const plan = el.dataset.plan;
  const link = CONFIG.checkout[plan];
  if (link) { el.href = link; return; }
  el.addEventListener("click", () => { if (interest) interest.value = INTEREST[plan]; });
});
const wanted = new URLSearchParams(location.search).get("plan");
if (interest && INTEREST[wanted]) interest.value = INTEREST[wanted];

// Client portal sign-in button
const portalBtn = document.getElementById("portal-btn");
if (portalBtn) {
  if (CONFIG.portal) {
    portalBtn.href = CONFIG.portal;
  } else {
    portalBtn.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent("Help with my plan")}`;
    portalBtn.querySelector("span").textContent = "Email us about your plan";
    document.getElementById("portal-note").hidden = false;
    document.getElementById("portal-how").hidden = true;
  }
}

// Hero REC timecode
const tc = document.getElementById("timecode");
if (tc) {
  const start = performance.now();
  const pad = (n) => String(n).padStart(2, "0");
  setInterval(() => {
    const t = (performance.now() - start) / 1000;
    tc.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t) % 60)}:${pad(Math.floor((t % 1) * 24))}`;
  }, 1000 / 24);
}

// Services: image preview follows the cursor
const preview = document.getElementById("svc-preview");
if (preview && window.matchMedia("(hover: hover) and (min-width: 901px)").matches) {
  const img = preview.querySelector("img");
  let x = 0, y = 0, px = 0, py = 0, raf;
  const loop = () => {
    px += (x - px) * 0.18; py += (y - py) * 0.18;
    preview.style.left = `${px}px`; preview.style.top = `${py}px`;
    raf = requestAnimationFrame(loop);
  };
  document.querySelectorAll(".svc__row").forEach((row) => {
    new Image().src = row.dataset.img;
    row.addEventListener("mouseenter", (e) => {
      img.src = row.dataset.img;
      if (!preview.classList.contains("is-on")) { px = x = e.clientX; py = y = e.clientY; }
      preview.classList.add("is-on");
      cancelAnimationFrame(raf); loop();
    });
    row.addEventListener("mousemove", (e) => { x = e.clientX + 180; y = e.clientY; });
    row.addEventListener("mouseleave", () => { preview.classList.remove("is-on"); });
  });
  document.getElementById("svc").addEventListener("mouseleave", () => cancelAnimationFrame(raf));
}

// Scroll reveal
const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }),
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 80}ms`;
  io.observe(el);
});

// Contact form
const form = document.getElementById("contact-form");
if (form) {
  const status = form.querySelector(".form__status");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.classList.remove("is-error");
    let valid = true;
    form.querySelectorAll("[required]").forEach((field) => {
      const ok = field.value.trim() && field.checkValidity();
      field.classList.toggle("is-invalid", !ok);
      if (!ok) valid = false;
    });
    if (!valid) {
      status.textContent = "Please add your name and a valid email.";
      status.classList.add("is-error");
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    if (!CONFIG.formEndpoint) {
      const body = `Name: ${data.name}\nEmail: ${data.email}\nI am a: ${data.type}\nHandle/site: ${data.handle || "-"}\nInterested in: ${data.interest}\n\n${data.message || ""}`;
      window.location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(`${data.interest} — ${data.name}`)}&body=${encodeURIComponent(body)}`;
      status.textContent = "Opening your email app to send your request…";
      return;
    }

    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    status.textContent = "Sending…";
    try {
      const res = await fetch(CONFIG.formEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      form.reset();
      status.textContent = "Thanks! We'll be in touch shortly.";
    } catch {
      status.textContent = `Something went wrong. Email us directly at ${CONFIG.email}.`;
      status.classList.add("is-error");
    } finally {
      btn.disabled = false;
    }
  });
}
