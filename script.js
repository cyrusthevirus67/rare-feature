// Set to a form service URL (e.g. Formspree) to receive submissions; empty falls back to mailto.
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "cyrus@rarefeature.com";

document.getElementById("year").textContent = new Date().getFullYear();

// Sticky nav border
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
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${(i % 4) * 80}ms`;
  io.observe(el);
});

// Contact form
const form = document.getElementById("contact-form");
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
    status.textContent = "Please fill in your name, a valid email, and a short message.";
    status.classList.add("is-error");
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  if (!FORM_ENDPOINT) {
    const body = `Name: ${data.name}\nEmail: ${data.email}\nI am a: ${data.type}\nHandle/site: ${data.handle || "-"}\n\n${data.message}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Free call request — " + data.name)}&body=${encodeURIComponent(body)}`;
    status.textContent = "Opening your email app to send your request…";
    return;
  }

  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  status.textContent = "Sending…";
  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error();
    form.reset();
    status.textContent = "Thanks! We'll reach out soon to set up your free call.";
  } catch {
    status.textContent = `Something went wrong. Email us directly at ${CONTACT_EMAIL}.`;
    status.classList.add("is-error");
  } finally {
    btn.disabled = false;
  }
});
