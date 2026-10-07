// Rare Feature contract templates.
// Each template turns a set of fields into the exact text a person signs. The admin page uses these to
// create an agreement; the finished text is then frozen in the database, so later edits here never
// change something that was already sent or signed. Bump `version` whenever a template's wording changes.
//
// These are working drafts, not legal advice. Have a licensed attorney review them before relying on them.
window.RFContracts = (() => {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BLANK = '<span class="blank"></span>';
  const longDate = (s) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
  const money = (n) => (n === "" || n == null || isNaN(Number(n)) ? "" : `$${Number(n).toLocaleString("en-US")}`);
  const h = (n, title) => `<h2>${n}. ${title}</h2>`;
  const p = (html) => `<p>${html}</p>`;
  const ul = (items) => `<ul>${items.filter(Boolean).map((i) => `<li>${i}</li>`).join("")}</ul>`;
  const box = (label) => `<span class="check"></span> ${label}`;

  // v("name") → the escaped field value, or a fill-in line when it is empty or we are printing a blank form.
  const reader = (f, blank) => (name, format) => {
    const raw = f[name];
    if (blank || raw === undefined || raw === null || String(raw).trim() === "") return BLANK;
    return esc(format ? format(raw) : raw);
  };

  const PACKAGES = {
    Starter: { price: 997, sessions: "1", videos: "8", platforms: "Instagram and Facebook", extras: "" },
    Growth: { price: 1497, sessions: "2", videos: "12", platforms: "Instagram, Facebook, and TikTok", extras: "Light engagement (responding to comments on posts we publish)" },
    Premium: { price: 2497, sessions: "4 (weekly)", videos: "16–20", platforms: "Instagram, Facebook, TikTok, and YouTube Shorts", extras: "Engagement on posts we publish\nAd management (ad spend is paid separately by Client)" },
    Custom: { price: "", sessions: "", videos: "", platforms: "", extras: "" },
  };

  const COMPANY = { name: "company_legal", label: "Rare Feature’s legal business name", type: "text", default: "Rare Feature", required: true };
  const STATE = { name: "state", label: "Governing law (state)", type: "text", default: "Texas", required: true };
  const general = (v, extra = "") => p(`This Agreement is the entire agreement between the parties about its subject${extra}. It can be changed only in writing agreed to by both parties (email is fine). It is governed by the laws of the State of ${v("state")}. If any part is found unenforceable, the rest stays in effect. The parties agree that this Agreement may be signed electronically and that electronic signatures are as binding as handwritten ones.`);

  const templates = {
    // ------------------------------------------------------------------ 1. Client service agreement
    "client-service": {
      title: "Client Service Agreement",
      version: "2026-10-07",
      signer: "Client",
      about: "For every paying client. Signed before any work starts.",
      fields: [
        COMPANY,
        { name: "party_org", label: "Client’s business name", type: "text", required: true },
        { name: "party_name", label: "Person signing for the client", type: "text", required: true },
        { name: "party_title", label: "Their title (e.g. Owner)", type: "text" },
        { name: "party_email", label: "Their email", type: "email", required: true },
        { name: "package", label: "Package", type: "select", options: Object.keys(PACKAGES), default: "Growth" },
        { name: "price", label: "Monthly price ($)", type: "number", default: PACKAGES.Growth.price, required: true },
        { name: "sessions", label: "Filming sessions per month", type: "text", default: PACKAGES.Growth.sessions, required: true },
        { name: "videos", label: "Short videos per month", type: "text", default: PACKAGES.Growth.videos, required: true },
        { name: "platforms", label: "Platforms we post to", type: "text", default: PACKAGES.Growth.platforms, required: true, wide: true },
        { name: "extras", label: "Also included (one per line, optional)", type: "textarea", default: PACKAGES.Growth.extras, wide: true },
        { name: "start_date", label: "Start date", type: "date", required: true },
        { name: "healthcare", label: "Client is a medical or healthcare practice (adds patient-privacy and medical-content terms)", type: "checkbox", wide: true },
        STATE,
      ],
      body(v, f, blank) {
        const med = blank || !!f.healthcare;
        const extras = blank ? [BLANK] : String(f.extras || "").split("\n").map((s) => s.trim()).filter(Boolean).map(esc);
        return [
          p(`This Client Service Agreement (“Agreement”) is between <b>${v("company_legal")}</b> (“Rare Feature,” “we,” “us”) and <b>${v("party_org")}</b> (“Client,” “you”). It takes effect on <b>${v("start_date", longDate)}</b> (the “Start Date”).`),

          h(1, "What’s included"),
          p(`Package: <b>${v("package")}</b>. Each month we will provide:`),
          ul([
            `${v("sessions")} on-site filming session(s)`,
            `${v("videos")} short-form videos, edited and captioned`,
            `Posting and scheduling on: ${v("platforms")}`,
            "A monthly performance report",
            ...extras,
          ]),
          p("<b>Not included</b> unless listed above or agreed in writing: advertising budget (“ad spend”), which you pay directly to the platforms; extra filming sessions or videos beyond the monthly amounts; long-form video, photography-only shoots, and website work; and any service not listed in this section."),
          p("Filming sessions are scheduled in advance. If you miss a session or cancel it on short notice, we may not be able to reschedule it within the same month."),

          h(2, "Price and payment"),
          ul([
            `The price is <b>${v("price", money)} per month</b>.`,
            "Payment is due in advance on the 1st of each month (or on the monthly billing date shown on your checkout confirmation, if different) and is collected by automatic payment (autopay) from the payment method on file.",
            "If a payment is more than seven (7) days late, we may pause posting and all other work until your account is current. A pause does not extend the term or reduce the fees owed.",
            "Payments are for work that begins as soon as each month starts and are non-refundable except where the law requires otherwise.",
          ]),

          h(3, "Term and cancellation"),
          ul([
            "This Agreement has a minimum term of three (3) months from the Start Date. After that it continues month to month.",
            "After the minimum term, either party may cancel by giving thirty (30) days’ written notice (email is fine). Fees remain due through the notice period, and we keep working through it.",
            "Notice given during the minimum term takes effect at the end of the minimum term or thirty (30) days after the notice, whichever is later.",
            "We may suspend or end this Agreement if a payment is more than thirty (30) days late, or if you ask us to publish content we reasonably believe is unlawful or misleading.",
          ]),

          h(4, "Approvals and revisions"),
          ul([
            "We send content to you for approval before it is posted.",
            "Each video includes up to two (2) rounds of revisions. Additional rounds may be billed separately if we both agree in writing.",
            "If you do not respond within seventy-two (72) hours after content is sent for approval, it is treated as approved and we may post it.",
            med ? "<b>Exception for medical content.</b> Content that makes or implies any medical, clinical, treatment, or outcome claim, or that shows or identifies a patient (“Medical Content”), is never approved by silence. It will not be posted until you approve it in writing. An approval in the client portal or by email counts as written approval." : "",
          ]),

          h(5, "Who owns the content"),
          ul([
            "Once you have paid for the month in which a video was produced, the final delivered video is yours to use however you like.",
            "We keep ownership of raw footage, project files, templates, and our methods. Music, fonts, and stock material in a video are licensed from third parties, not owned by either of us.",
            "You give us permission to show the content we create for you, your business name and logo, and results such as views and follower growth, in our portfolio, on our website and social media, and in our sales materials. You can ask us in writing to stop using a particular piece going forward.",
            med ? "We will not show any patient in our own portfolio or marketing unless that patient’s signed authorization specifically allows it." : "",
          ]),

          h(6, "Your responsibilities"),
          ul([
            "Give us the account access we need and keep it working.",
            "Name one person who can approve content and answer questions promptly.",
            "Be ready and available for scheduled filming sessions.",
            "Make sure the facts, prices, offers, and claims you give us or approve are accurate, and that you have the right to use any logos, photos, music, or other materials you supply.",
            "Get a signed release from everyone who appears on camera for your business, such as staff and customers. We can provide a release form.",
            med ? "<b>Patients.</b> Before any patient appears in or can be identified from any content, you will obtain that patient’s signed written authorization that meets applicable privacy law (including HIPAA), keep the original, and give us a copy. You will not give us more patient information than we need to do the work." : "",
            med ? "<b>Medical content.</b> You are responsible for reviewing and approving all Medical Content for accuracy and for compliance with the advertising and professional rules that apply to your practice." : "",
          ]),

          h(7, "Confidentiality"),
          p("Each of us will keep the other’s non-public business information confidential and use it only to carry out this Agreement. This does not cover information that is already public, that the receiving party already knew, or that the law requires to be disclosed."),
          med ? p("We will not disclose any patient information we see or hear while working with you, and we will use patient images and footage only in content that you approved and that is covered by a signed patient authorization. If the law requires a business associate agreement between us, we will both sign one.") : "",

          h(8, "Results"),
          p("Social media results depend on many things outside our control, including platform algorithms. We do not guarantee any specific result, such as a number of followers, views, leads, or sales."),

          h(9, "Responsibility and limits"),
          ul([
            `You are responsible for the accuracy and legality of the claims, facts, and offers in content you approve${med ? ", including all Medical Content" : ""}. You agree to cover us against claims that arise from content you approved, from materials or information you supplied, or from a missing release or authorization that was your responsibility.`,
            "Our total liability for anything arising from this Agreement is limited to the total fees you have paid us under it. Neither party is liable for lost profits or for indirect or consequential damages.",
          ]),

          h(10, "Our team"),
          p("We are an independent contractor, not your employee or partner. We may use contractors, such as videographers, who are bound by confidentiality obligations at least as protective as the ones in this Agreement."),

          h(11, "General"),
          general(v, ". If it differs from the terms on our website, this Agreement controls"),
        ].join("");
      },
    },

    // ------------------------------------------------------------------ 2. Free starter client agreement
    starter: {
      title: "Starter Client Agreement (No-Fee)",
      version: "2026-10-07",
      signer: "Client",
      about: "For free starter clients. States what you deliver, for how long, and your right to use the results and a testimonial.",
      fields: [
        COMPANY,
        { name: "party_org", label: "Client’s business name", type: "text", required: true },
        { name: "party_name", label: "Person signing for the client", type: "text", required: true },
        { name: "party_title", label: "Their title (e.g. Owner)", type: "text" },
        { name: "party_email", label: "Their email", type: "email", required: true },
        { name: "deliverables", label: "What you’ll deliver (one per line)", type: "textarea", wide: true, required: true, default: "1 filming session a month\nUp to 8 short-form videos a month, edited and captioned\nPosting and scheduling on Instagram and Facebook\nA short monthly results summary" },
        { name: "duration", label: "How long", type: "text", default: "3 months", required: true },
        { name: "start_date", label: "Start date", type: "date", required: true },
        STATE,
      ],
      body(v, f, blank) {
        const items = blank ? [BLANK, BLANK, BLANK] : String(f.deliverables || "").split("\n").map((s) => s.trim()).filter(Boolean).map(esc);
        return [
          p(`This Agreement is between <b>${v("company_legal")}</b> (“Rare Feature,” “we,” “us”) and <b>${v("party_org")}</b> (“Client,” “you”). It starts on <b>${v("start_date", longDate)}</b>.`),

          h(1, "What we’ll do, at no charge"),
          p(`For <b>${v("duration")}</b> from the start date, we will provide the following social media services free of charge:`),
          ul(items),
          p("Advertising budget and any other third-party costs are not included. Anything beyond the list above needs a separate written agreement."),

          h(2, "What we need from you"),
          ul([
            "Access to the social media accounts we’ll be posting to.",
            "Your availability for scheduled filming.",
            "Feedback on content within seventy-two (72) hours after we send it. If we don’t hear back in that time, we’ll treat it as approved.",
            "A signed release from anyone who appears on camera for your business, including any customer or patient authorization the law requires.",
          ]),

          h(3, "Our right to use the results"),
          p("We are doing this work for free so that we can show what we can do. In return, you agree that we may use the following in our marketing, in any format, during and after this Agreement:"),
          ul([
            "the content we create for you;",
            "your business name and logo;",
            "your results and numbers, such as follower counts, views, engagement, and any leads or sales figures you share with us, including before-and-after comparisons; and",
            "your testimonial.",
          ]),
          p("At the end of the term you agree to give us your honest feedback and, if you are happy with the work, a short written or video testimonial that we may publish. Testimonials must reflect your real opinion. Where required, we will disclose that the services were provided free of charge."),
          p("You can ask us in writing to stop using your testimonial or logo in new marketing, and we will do so going forward."),

          h(4, "Who owns the content"),
          p("The final videos we deliver are yours to use. We keep our raw footage, project files, templates, and methods."),

          h(5, "No guarantees"),
          p("Social media results depend on many things outside our control. We do not guarantee any specific result. Because the services are free, they are provided as-is, and to the fullest extent the law allows our total liability under this Agreement is limited to one hundred dollars ($100)."),

          h(6, "Ending this agreement"),
          p("Either of us can end this Agreement at any time by email. Section 3 continues to apply to the work done before it ended. When the term is over you are welcome to continue on a paid package under a separate agreement, but you are under no obligation to."),

          h(7, "Confidentiality"),
          p("Each of us will keep the other’s non-public business information confidential, apart from the results and materials described in Section 3."),

          h(8, "General"),
          general(v),
        ].join("");
      },
    },

    // ------------------------------------------------------------------ 3. Contractor agreement
    contractor: {
      title: "Independent Contractor Agreement — Videography",
      version: "2026-10-07",
      signer: "Contractor",
      about: "For contractors who film for you. Pay per shoot, equipment, patient privacy, confidentiality, footage ownership, and non-solicitation. Collect a W-9 separately.",
      fields: [
        COMPANY,
        { name: "party_name", label: "Contractor’s full legal name", type: "text", required: true },
        { name: "party_email", label: "Contractor’s email", type: "email", required: true },
        { name: "rate", label: "Pay per shoot ($)", type: "number", required: true },
        { name: "shoot", label: "What counts as one shoot", type: "text", wide: true, required: true, default: "one on-site filming session of up to 3 hours, including setup and breakdown, and delivery of all footage" },
        { name: "deliver_hours", label: "Footage due within (hours after the shoot)", type: "number", default: 48, required: true },
        { name: "pay_days", label: "Paid within (days after footage is delivered)", type: "number", default: 7, required: true },
        { name: "nonsolicit_months", label: "Non-solicitation period (months)", type: "number", default: 12, required: true },
        { name: "start_date", label: "Start date", type: "date", required: true },
        STATE,
      ],
      body(v) {
        return [
          p(`This Independent Contractor Agreement (“Agreement”) is between <b>${v("company_legal")}</b> (“Rare Feature,” the “Company”) and <b>${v("party_name")}</b> (“Contractor”). It takes effect on <b>${v("start_date", longDate)}</b>.`),

          h(1, "Independent contractor"),
          p("Contractor is an independent contractor, not an employee, partner, or agent of the Company. Contractor decides how to carry out each assignment, may accept or decline any assignment, and may work for others, subject to Section 7. Contractor is not entitled to employee benefits and is responsible for Contractor’s own taxes."),

          h(2, "The work"),
          p("Contractor will film video content for the Company’s clients on assignments the Company offers. On each assignment Contractor will arrive on time, act professionally, follow the Company’s shot list and the rules of the client’s location, and take direction from the Company (not the client) about what to film."),
          p(`Contractor will deliver all footage to the Company within ${v("deliver_hours")} hours after each shoot, in the way the Company asks.`),

          h(3, "Pay"),
          ul([
            `The Company will pay Contractor <b>${v("rate", money)} per completed shoot</b>. A “shoot” means ${v("shoot")}.`,
            `Payment is made within ${v("pay_days")} days after the footage for that shoot is delivered.`,
            "There is no pay for a shoot that Contractor cancels or does not attend.",
            "Expenses are reimbursed only if the Company approved them in advance and Contractor provides receipts.",
            "Contractor will give the Company a completed IRS Form W-9 before the first payment. The Company will issue any tax form the law requires.",
          ]),

          h(4, "Equipment"),
          ul([
            "Unless the Company agrees otherwise for a particular shoot, Contractor supplies and maintains the camera, audio, lighting, and other equipment needed, and is responsible for it and for insuring it.",
            "Any equipment the Company provides remains the Company’s property. Contractor will use it only for Company shoots, take reasonable care of it, return it when asked or when this Agreement ends, and pay for loss or damage caused by Contractor’s carelessness, beyond normal wear.",
          ]),

          h(5, "Footage belongs to Rare Feature"),
          ul([
            "All footage, audio, photos, edits, and other material Contractor creates on an assignment (the “Footage”) is work made for hire for the Company. To the extent any of it is not, Contractor assigns all rights in it to the Company.",
            "Contractor will deliver every copy of the Footage to the Company and, within seven (7) days after the Company confirms it has received it, permanently delete it from Contractor’s cameras, cards, drives, phones, and cloud accounts.",
            "Contractor will not post, share, sell, or use any Footage, including in a portfolio, reel, or on social media, without the Company’s written permission.",
          ]),

          h(6, "Confidentiality and patient privacy"),
          p("Contractor will keep confidential everything Contractor learns about the Company and its clients that is not public, including client names, pricing, strategies, account access, and unpublished content, and will use it only to do the work."),
          p("Some clients are medical practices. At those locations Contractor may see or hear private information about patients. Contractor agrees to:"),
          ul([
            "film only the people and areas that the client’s staff have cleared for filming;",
            "never film or photograph patient charts, computer screens, schedules, or documents;",
            "never share, post, discuss, or keep any image of, or information about, a patient;",
            "store Footage only on secured devices, and never send it through personal messaging or personal cloud-sharing accounts;",
            "tell the Company the same day if any Footage or device is lost or stolen, or if any patient information is seen or shared by mistake; and",
            "follow each client’s privacy rules and sign any privacy or confidentiality form a client reasonably requires.",
          ]),
          p("This Section continues to apply after this Agreement ends."),

          h(7, "Non-solicitation"),
          p(`While this Agreement is in effect and for ${v("nonsolicit_months")} months after Contractor’s last assignment, Contractor will not, directly or through anyone else, (a) solicit, or provide videography, social media, or marketing services to, any Company client that Contractor worked with or learned about through the Company, except through the Company; or (b) encourage any Company client, employee, or contractor to stop working with the Company.`),
          p("This is not a general non-compete. Contractor remains free to work for anyone who is not a Company client covered by this Section. If a court finds this Section too broad, it should be enforced to the extent the law allows."),

          h(8, "Ending this agreement"),
          p("Either party may end this Agreement at any time by written notice (email is fine). The Company will pay for shoots completed before it ended. Sections 5, 6, and 7 continue after it ends, and Contractor will promptly return any Company property."),

          h(9, "Responsibility"),
          p("Contractor is responsible for Contractor’s own conduct, equipment, vehicle, and insurance while working, and for any loss the Company suffers because Contractor broke Section 5, 6, or 7."),

          h(10, "General"),
          general(v),
        ].join("");
      },
    },

    // ------------------------------------------------------------------ 4a. Staff / doctor on-camera release
    "talent-release": {
      title: "On-Camera Release — Staff and Team Members",
      version: "2026-10-07",
      signer: "Team member",
      about: "For staff, doctors, and owners who appear on camera. Not for patients — use the printable patient authorization for those.",
      fields: [
        COMPANY,
        { name: "party_org", label: "Business or practice they work for", type: "text", required: true },
        { name: "party_name", label: "Person appearing on camera", type: "text", required: true },
        { name: "party_title", label: "Their job title", type: "text" },
        { name: "party_email", label: "Their email (optional)", type: "email" },
      ],
      body(v) {
        return [
          p(`I, <b>${v("party_name")}</b>${v("party_title") === BLANK ? "" : `, ${v("party_title")}`}, give <b>${v("party_org")}</b> (the “Business”) and its marketing agency, <b>${v("company_legal")}</b> (“Rare Feature”), permission to photograph and record me and to use my image, voice, name, and job title in videos and photos that promote the Business.`),

          h(1, "Where it can be used"),
          p("This content may be used on the Business’s social media accounts and website, in its advertising, and in Rare Feature’s portfolio and marketing as an example of its work. It may be edited, but not in a way that misrepresents what I said or did."),

          h(2, "My choice"),
          ul([
            "Taking part is voluntary. It is not a condition of my job, and I will not be treated differently if I say no.",
            "I am not being paid anything for this beyond my normal pay.",
            "I am 18 or older. (If under 18, a parent or guardian must sign.)",
          ]),

          h(3, "Changing my mind"),
          p("I can withdraw this permission at any time by telling the Business in writing. After that, no new content featuring me will be made or posted, and the Business will make reasonable efforts to remove existing posts featuring me from its own accounts. I understand that copies already shared by other people, or printed, cannot be recalled."),
          p("This permission continues if I stop working for the Business, unless I withdraw it."),

          h(4, "Professional statements"),
          p("If I make professional or medical statements on camera, they are accurate to the best of my knowledge."),

          h(5, "Release"),
          p("I release the Business and Rare Feature from any claim for invasion of privacy, right of publicity, or defamation that arises from using this content as described above."),
        ].join("");
      },
    },

    // ------------------------------------------------------------------ 4b. Patient authorization (paper only)
    "patient-release": {
      title: "Patient Authorization to Use Image, Video, and Health Information for Marketing",
      version: "2026-10-07",
      signer: "Patient",
      printOnly: true,
      about: "Printed and signed on paper at the practice, which keeps the original. Not collected online, because it contains patient health information.",
      fields: [
        { name: "party_org", label: "Practice name (optional — prints on the form)", type: "text" },
        { name: "company_legal", label: "Rare Feature’s legal business name", type: "text", default: "Rare Feature" },
      ],
      body(v, f) {
        const practice = f.party_org && String(f.party_org).trim() ? `<b>${esc(f.party_org)}</b>` : BLANK;
        const agency = f.company_legal && String(f.company_legal).trim() ? `<b>${esc(f.company_legal)}</b>` : "<b>Rare Feature</b>";
        return [
          p(`Patient name: ${BLANK} &nbsp; Date of birth: <span class="blank blank--short"></span>`),
          p(`I authorize ${practice} (the “Practice”) to use and share the information described below for marketing and advertising.`),

          h(1, "What may be used"),
          p("(Check all that apply.)"),
          ul([
            box("Photographs and video of me"),
            box("My voice and what I say on camera"),
            box("My first name &nbsp;&nbsp; " + box("My full name")),
            box("The treatment or service I received, and my results, including before-and-after images"),
            box(`Other: ${BLANK}`),
          ]),

          h(2, "Who will receive it and why"),
          p(`The Practice may share this information with its marketing agency, ${agency}, which will film, edit, and publish it for the Practice. It may be shown to the public on the Practice’s social media accounts, website, and advertisements, in order to market the Practice’s services.`),
          p(box(`I also allow ${agency.replace(/<\/?b>/g, "")} to show this content in its own portfolio and marketing as an example of its work.`)),

          h(3, "My rights"),
          ul([
            "<b>This is voluntary.</b> The Practice will not condition my treatment, payment, enrollment, or eligibility for benefits on whether I sign this form.",
            "<b>I can cancel it.</b> I may revoke this authorization at any time by giving the Practice written notice at its office address. After that, the Practice will stop using my information in new marketing and will remove it from accounts it controls. Revoking does not apply to uses that already happened, and material already shared by other people cannot be recalled.",
            "<b>Privacy after sharing.</b> Once my information is published, it can be seen and re-shared by others and may no longer be protected by federal privacy law (HIPAA).",
            "<b>Payment.</b> I am not being paid for this. The Practice is not being paid by anyone else to use my information.",
            "I am entitled to a copy of this form after I sign it.",
          ]),

          h(4, "When it ends"),
          p(`This authorization expires on <span class="blank blank--short"></span> (date). If no date is written in, it expires two (2) years after the date I sign it.`),

          `<div class="wet">
            <div><span class="blank blank--sig"></span><small>Signature of patient or personal representative</small></div>
            <div><span class="blank blank--short"></span><small>Date</small></div>
            <div><span class="blank blank--sig"></span><small>Printed name</small></div>
            <div><span class="blank blank--sig"></span><small>If signed by a personal representative: relationship and authority to sign</small></div>
          </div>`,
          p(`<small>For the Practice: keep the signed original in the patient’s record, give the patient a copy, and send a copy to ${agency.replace(/<\/?b>/g, "")} before filming.</small>`),
        ].join("");
      },
    },
  };

  return {
    templates,
    PACKAGES,
    longDate,
    // Returns { title, version, html } for a template, with either real values or blank fill-in lines.
    render(id, fields = {}, { blank = false } = {}) {
      const t = templates[id];
      if (!t) return null;
      return { title: t.title, version: t.version, html: t.body(reader(fields, blank), fields, blank) };
    },
  };
})();
