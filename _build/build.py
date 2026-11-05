#!/usr/bin/env python3
"""Builds the public pages of rarefeature.com.

Every page shares one header, footer and <head>. Page content lives in
_build/pages/<name>.main.html; this script wraps it and writes <name>.html
at the site root. Run it from anywhere:  python3 _build/build.py
(Folders starting with "_" are not published by GitHub Pages.)
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = Path(__file__).resolve().parent / "pages"
SITE = "https://rarefeature.com"
V = {"css": 16, "js": 11, "config": 13, "calendly": 1, "portal_css": 5, "core": 3, "logo": 3, "icon": 4}

ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>'

NAV = [
    ("services", "/services", "Services"),
    ("who", "/who-we-help", "Who we help"),
    ("process", "/process", "Process"),
    ("pricing", "/pricing", "Pricing"),
    ("faq", "/faq", "FAQ"),
    ("contact", "/contact", "Contact"),
]

# name: settings for each generated page
SITE_PAGES = {
    "index": dict(
        title="Rare Feature — Social Media Growth & Consulting",
        desc="Rare Feature is a social media growth and consulting company. We help businesses and content creators build audiences that stop, watch, and buy.",
        path="/", home=True, cta=True,
    ),
    "services": dict(
        title="Services — Rare Feature",
        desc="Social media strategy, short-form content, filming and editing, and one-on-one consulting for businesses and content creators.",
        path="/services", active="services", cta=True, next=("Who we help", "/who-we-help"),
    ),
    "who-we-help": dict(
        title="Who we help — Rare Feature",
        desc="Rare Feature works with businesses that want customers from social media, and creators who want to turn their talent into a brand.",
        path="/who-we-help", active="who", cta=True, next=("The process", "/process"),
    ),
    "process": dict(
        title="How it works — Rare Feature",
        desc="From a free audit to monthly filming, posting and reporting: here is exactly how working with Rare Feature works.",
        path="/process", active="process", cta=True, next=("Pricing", "/pricing"),
    ),
    "pricing": dict(
        title="Pricing — Rare Feature",
        desc="Simple, upfront pricing. A free audit, a one-time Growth Plan, and monthly content packages from $997/mo.",
        path="/pricing", active="pricing", cta=True, next=("Questions", "/faq"),
    ),
    "faq": dict(
        title="FAQ — Rare Feature",
        desc="Answers to common questions about working with Rare Feature: getting started, content, contracts, billing and cancellation.",
        path="/faq", active="faq", cta=True, next=("Get in touch", "/contact"),
    ),
    "book": dict(
        title="Book a call — Rare Feature",
        desc="Book a free call with Rare Feature. Pick a time that works and get a calendar invite right away.",
        path="/book", active="book", scripts=["calendly"],
    ),
    "contact": dict(
        title="Contact — Rare Feature",
        desc="Request your free social media audit or ask about a package. Tell us a little about yourself and we’ll be in touch.",
        path="/contact", active="contact",
    ),
    "client": dict(
        title="Client portal — Rare Feature",
        desc="Sign in to see your Rare Feature plan, update billing, download invoices, or cancel.",
        path="/client", solid=True, extra_css=["portal"], scripts=["supabase", "core"],
    ),
    "welcome": dict(
        title="Welcome — Rare Feature", desc="Thanks for joining Rare Feature.",
        path="/welcome", solid=True, robots="noindex",
    ),
    "terms": dict(
        title="Terms of service — Rare Feature",
        desc="Terms for Rare Feature packages: billing, minimum term, cancellation, and content ownership.",
        path="/terms", solid=True,
    ),
    "privacy": dict(
        title="Privacy policy — Rare Feature", desc="How Rare Feature collects and uses information.",
        path="/privacy", solid=True,
    ),
}

ORG_JSONLD = """  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Organization","name":"Rare Feature","url":"https://rarefeature.com/","logo":"https://rarefeature.com/assets/favicon.png","email":"cyrus@rareft.com","description":"Social media growth and consulting for businesses and content creators."}
  </script>
"""

# Old one-page links (index.html#pricing etc.) still land on the right page.
HASH_REDIRECT = """  <script>
    (function () {
      var to = { services: "/services", who: "/who-we-help", process: "/process", pricing: "/pricing", faq: "/faq", book: "/book", contact: "/contact" }[location.hash.slice(1)];
      if (to) location.replace(to + location.search);
    })();
  </script>
"""


def head(p):
    url = SITE + p["path"]
    robots = f'\n  <meta name="robots" content="{p["robots"]}">' if p.get("robots") else ""
    css = "".join(f'\n  <link rel="stylesheet" href="/{c}.css?v={V[c + "_css"]}">' for c in p.get("extra_css", []))
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{p["title"]}</title>
  <meta name="description" content="{p["desc"]}">{robots}
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Rare Feature">
  <meta property="og:title" content="{p["title"]}">
  <meta property="og:description" content="{p["desc"]}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{SITE}/assets/og.png?v={V["icon"]}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0a0a0a">
  <link rel="icon" href="/favicon.ico?v={V["icon"]}" sizes="any">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="icon" href="/assets/favicon-48.png?v={V["icon"]}" type="image/png" sizes="48x48">
  <link rel="icon" href="/assets/favicon.png?v={V["icon"]}" type="image/png" sizes="512x512">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png?v={V["icon"]}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://images.unsplash.com">
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v={V["css"]}">{css}
{ORG_JSONLD if p.get("home") else ""}{HASH_REDIRECT if p.get("home") else ""}</head>
"""


def header(p):
    active = p.get("active")
    cur = lambda k: ' aria-current="page"' if k == active else ""
    links = "".join(f'\n        <a href="{href}"{cur(k)}>{label}</a>' for k, href, label in NAV)
    mlinks = "".join(f'\n      <a href="{href}"{cur(k)}>{label}</a>' for k, href, label in NAV)
    solid = " nav--solid" if p.get("solid") else ""
    return f"""<body>
  <a class="skip" href="#main">Skip to content</a>

  <header class="nav{solid}" id="top">
    <div class="wrap nav__inner">
      <a href="/" class="brand" aria-label="Rare Feature home"><img src="/assets/logo-lockup.png?v={V["logo"]}" alt="Rare Feature" width="718" height="96"></a>
      <nav class="nav__links" aria-label="Primary">{links}
      </nav>
      <a href="/client" class="nav__login"{cur("client")}>Client login</a>
      <a href="/book" class="btn btn--red btn--sm nav__cta"{cur("book")}>Book a call</a>
      <button class="nav__toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
        <span></span><span></span>
      </button>
    </div>
    <div class="mobile-menu" id="mobile-menu" hidden>{mlinks}
      <a href="/client">Client login</a>
      <a href="/book" class="btn btn--red">Book a call</a>
      <a href="/contact?plan=audit" class="btn btn--line">Get a free audit</a>
    </div>
  </header>
"""


def cta():
    return f"""
    <section class="cta">
      <div class="cta__media" aria-hidden="true">
        <img src="https://images.unsplash.com/photo-1632187981988-40f3cbaeef5e?auto=format&fit=crop&w=2000&q=65" alt="" loading="lazy">
      </div>
      <div class="wrap cta__inner">
        <p class="label">Let’s talk</p>
        <h2 class="display display--xl">Ready to get <em>featured?</em></h2>
        <p class="head__sub">Start with a free audit of your page, or book a call and talk through your goals. No pressure, no obligation.</p>
        <div class="cta__actions">
          <a href="/contact?plan=audit" class="btn btn--red">Get a free audit {ARROW}</a>
          <a href="/book" class="btn btn--glass">Book a call</a>
        </div>
      </div>
    </section>
"""


def nextpage(label, href):
    return f"""
    <nav class="nextpage" aria-label="Next page">
      <div class="wrap">
        <a href="{href}"><span class="nextpage__k">Next</span><span class="nextpage__t">{label} <i aria-hidden="true">→</i></span></a>
      </div>
    </nav>
"""


def footer():
    return f"""
  <footer class="footer">
    <div class="wrap">
      <div class="footer__top">
        <div class="footer__brand"><img src="/assets/logo-full.png?v={V["logo"]}" alt="Rare Feature" width="749" height="449" loading="lazy"><p>Social media growth &amp; consulting<br>for businesses and creators.</p></div>
        <nav aria-label="Footer">
          <p class="footer__k">Explore</p>
          <a href="/">Home</a><a href="/services">Services</a><a href="/who-we-help">Who we help</a><a href="/process">Process</a><a href="/pricing">Pricing</a><a href="/faq">FAQ</a>
        </nav>
        <div>
          <p class="footer__k">Get started</p>
          <a href="/contact?plan=audit">Get a free audit</a>
          <a href="/book">Book a call</a>
          <a href="/contact">Contact</a>
          <a href="/client">Client login</a>
          <a href="mailto:cyrus@rareft.com">cyrus@rareft.com</a>
        </div>
      </div>
      <p class="footer__word" aria-hidden="true">RARE <span>FEATURE</span></p>
      <div class="footer__bottom">
        <p>© <span id="year"></span> Rare Feature</p>
        <p><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · Photography via <a href="https://unsplash.com" rel="noopener">Unsplash</a></p>
        <a href="#top">Back to top ↑</a>
      </div>
    </div>
  </footer>
"""


def scripts(p):
    s = []
    if "supabase" in p.get("scripts", []):
        s.append('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>')
    s.append(f'<script src="/config.js?v={V["config"]}"></script>')
    if "calendly" in p.get("scripts", []):
        s.append(f'<script src="/calendly.js?v={V["calendly"]}"></script>')
    if "core" in p.get("scripts", []):
        s.append(f'<script src="/portal-core.js?v={V["core"]}"></script>')
    s.append(f'<script src="/script.js?v={V["js"]}"></script>')
    return "\n" + "".join(f"  {x}\n" for x in s) + "</body>\n</html>\n"


def build():
    for name, p in SITE_PAGES.items():
        main = (PAGES / f"{name}.main.html").read_text().rstrip() + "\n"
        main = main.replace("{{arrow}}", ARROW)
        page_cls = ' class="page"' if p.get("solid") else ""
        out = head(p) + header(p) + f'\n  <main id="main"{page_cls}>\n' + main
        if p.get("next"):
            out += nextpage(*p["next"])
        if p.get("cta"):
            out += cta()
        out += "  </main>\n" + footer() + scripts(p)
        (ROOT / f"{name}.html").write_text(out)
        print("built", f"{name}.html")


if __name__ == "__main__":
    build()
