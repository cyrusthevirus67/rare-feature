// Set to a form service URL (e.g. Formspree) to receive submissions; empty falls back to mailto.
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "cyrus@rarefeature.com";

document.getElementById("year").textContent = new Date().getFullYear();

// Sticky nav border
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Mobile menu
const toggle = document.querySelector(".nav__toggle");
const menu = document.getElementById("mobile-menu");
const setMenu = (open) => {
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  menu.hidden = !open;
};
toggle.addEventListener("click", () => setMenu(menu.hidden));
menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

// Who-we-help tabs
const tabs = [...document.querySelectorAll(".tab")];
const selectTab = (tab) => {
  tabs.forEach((t) => {
    const on = t === tab;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  });
};
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    selectTab(next);
    next.focus();
  });
});

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
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Free consult request — " + data.name)}&body=${encodeURIComponent(body)}`;
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
    status.textContent = "Thanks! We'll reach out soon to set up your free consult.";
  } catch {
    status.textContent = `Something went wrong. Email us directly at ${CONTACT_EMAIL}.`;
    status.classList.add("is-error");
  } finally {
    btn.disabled = false;
  }
});
