// Calendly scheduling, loaded only when a page actually shows a booking widget.
// Links come from config.js (calendly.call / calendly.filming).
window.RFCalendly = (() => {
  let loading;
  const load = () => (loading ||= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://assets.calendly.com/assets/external/widget.css";
    const js = document.createElement("script");
    js.src = "https://assets.calendly.com/assets/external/widget.js"; js.onload = resolve; js.onerror = reject;
    document.head.append(css, js);
  }));
  // Match the site: black background, off-white text, red buttons.
  const themed = (url) => {
    const u = new URL(url);
    u.searchParams.set("background_color", "0a0a0a");
    u.searchParams.set("text_color", "f3f1ee");
    u.searchParams.set("primary_color", "ff3b2f");
    return u.href;
  };
  return {
    valid: (url) => /^https:\/\/calendly\.com\/[\w.-]+/.test(url || ""),
    async inline(el, url, prefill = {}) {
      try {
        await load();
        el.innerHTML = "";
        window.Calendly.initInlineWidget({ url: themed(url), parentElement: el, prefill });
      } catch {
        el.innerHTML = `<p class="cal__msg">The scheduler didn’t load. <a href="${url}" target="_blank" rel="noopener">Open it in a new tab</a>.</p>`;
      }
    },
    // Calls fn once each time someone finishes booking in an embedded widget.
    onBooked(fn) {
      window.addEventListener("message", (e) => {
        if (e.origin === "https://calendly.com" && e.data?.event === "calendly.event_scheduled") fn(e.data.payload);
      });
    },
  };
})();
