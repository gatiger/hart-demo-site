// Content loader (file-based CMS style)
async function loadJSON(path){
  try{
    const res = await fetch(path, { cache: "no-store" });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }catch(e){
    console.error("Content load failed:", path, e);
    return null;
  }
}

/* -------------------------
   Mobile menu (WCAG-friendly)
-------------------------- */
function initMobileMenu(){
  const btn = document.getElementById("menuBtn");
  const panel = document.getElementById("mobileMenu");
  const close = document.getElementById("menuClose");
  const backdrop = document.getElementById("menuBackdrop");

  // If any piece is missing, don't crash—just skip.
  if(!btn || !panel || !close || !backdrop) return;

  let lastFocus = null;

  // Ensure consistent starting state
  panel.hidden = true;
  backdrop.hidden = true;
  btn.setAttribute("aria-expanded", "false");

  const focusableSelectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  const getFocusable = () => {
    const all = [close, ...Array.from(panel.querySelectorAll(focusableSelectors))];
    // Filter out hidden elements
    return Array.from(new Set(all)).filter(el => el && el.offsetParent !== null);
  };

  const setOpen = (open) => {
    panel.hidden = !open;
    backdrop.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("menuOpen", open); // optional CSS: body.menuOpen{ overflow:hidden; }
  };

  const openMenu = () => {
    lastFocus = document.activeElement;
    setOpen(true);
    close.focus();
  };

  const closeMenu = () => {
    setOpen(false);
    if(lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    else btn.focus();
  };

  btn.addEventListener("click", () => {
    const expanded = btn.getAttribute("aria-expanded") === "true";
    expanded ? closeMenu() : openMenu();
  });

  close.addEventListener("click", closeMenu);
  backdrop.addEventListener("click", closeMenu);

  // Close when clicking a link in the menu
  panel.addEventListener("click", (e) => {
    const t = e.target;
    if(t && t.matches && t.matches("a")) closeMenu();
  });

  // Escape + focus trap
  document.addEventListener("keydown", (e) => {
    if(panel.hidden) return;

    if(e.key === "Escape"){
      e.preventDefault();
      closeMenu();
      return;
    }

    if(e.key !== "Tab") return;

    const focusables = getFocusable();
    if(!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if(!e.shiftKey && document.activeElement === last){
      e.preventDefault();
      first.focus();
    } else if(e.shiftKey && document.activeElement === first){
      e.preventDefault();
      last.focus();
    }
  });
}

/* -------------------------
   Renderers
-------------------------- */
function renderDirectory(items) {
  const list = document.getElementById("directoryList");
  if (!list) return;

  const safe = (v) => (v === undefined || v === null) ? "" : String(v).trim();

  const visible = (items || []).filter(d => d.enabled !== false);

  list.innerHTML = visible.map(d => {
    const name  = safe(d.name);
    const dept  = safe(d.department || d.dept || d.tag || "");
    const title = safe(d.title || d.role || "");

    const phone = safe(d.phone);
    const fax   = safe(d.fax);
    const email = safe(d.email);

    // Keep these separate on purpose:
    const pageUrl    = safe(d.url);       // internal page (recommended)
    const websiteUrl = safe(d.website);   // external site

    const hours = safe(d.hours);
    const desc  = safe(d.description);

    const telHref  = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
    const faxHref  = fax ? `tel:${fax.replace(/[^\d+]/g, "")}` : "";
    const mailHref = email ? `mailto:${email}` : "";

    // Normalize external website if provided
    const webHref = websiteUrl
      ? (websiteUrl.startsWith("http://") || websiteUrl.startsWith("https://")
          ? websiteUrl
          : `https://${websiteUrl}`)
      : "";

    // Title link preference: internal url first, then external website
    const titleHref = pageUrl || webHref;

    const metaParts = [];
    if (phone) metaParts.push(`<a href="${telHref}" class="phone-link">Phone: ${phone}</a>`);
    if (fax)   metaParts.push(`<a href="${faxHref}" class="phone-link">Fax: ${fax}</a>`);
    if (email) metaParts.push(`<a href="${mailHref}" class="link">Email ${name || "office"}</a>`);

    const displayTitle = title || name || "Unnamed";

    return `
      <article class="item" aria-label="${displayTitle}">
        <div class="itemTop">
          <div>
            <h3 class="itemTitle">
              ${titleHref
                ? `<a href="${titleHref}" class="title-link">${displayTitle}</a>`
                : displayTitle
              }
            </h3>
            ${title && name ? `<div class="sub" style="margin-top:4px">${name}</div>` : ""}
            ${dept ? `<div class="sub" style="margin-top:4px">${dept}</div>` : ""}
          </div>
        </div>

        ${metaParts.length ? `<div class="meta">${metaParts.join(`<span>•</span>`)}</div>` : ""}

        ${hours ? `<div class="meta"><span>Hours: ${hours}</span></div>` : ""}

        ${desc ? `<p class="sub" style="margin-top:6px">${desc}</p>` : ""}
      </article>
    `;
  }).join("");
}

function renderNews(items){
  const list = document.getElementById("newsList");
  if(!list) return;

  const safe = (v) => (v === undefined || v === null) ? "" : String(v).trim();
  const visible = (items || []).filter(n => n.enabled !== false);

  list.innerHTML = visible.map(n => {
    const title = safe(n.title);
    const date  = safe(n.date);
    const type  = safe(n.type);
    const body  = safe(n.body);

    return `
      <article class="item" aria-label="${title || "News item"}">
        <div class="itemTop">
          <h3 class="itemTitle">${title}</h3>
          ${type ? `<span class="tag">${type}</span>` : ""}
        </div>
        ${(date || body) ? `
          <div class="meta">
            ${date ? `<span>${date}</span>` : ""}
            ${(date && body) ? `<span>•</span>` : ""}
            ${body ? `<span>${body}</span>` : ""}
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}


/* -------------------------
   Boot
-------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  initMobileMenu();

  // Use relative paths (plays nicer on a county server subfolder)
  const site = await loadJSON("./content/site.json");
  const alerts = await loadJSON("./content/alerts.json");

  // Alerts: prefer alerts.json, fall back to site.json if needed
  if (alerts) window.renderAlert(alerts);
  else if (site) window.renderAlert(site);

  // Page-scoped content: only load JSON when the page declares it
  const dirEl = document.getElementById("directoryList");
  const dirPath = dirEl?.getAttribute("data-json");
  if (dirPath) {
    const directory = await loadJSON(dirPath);
    if (directory?.items) renderDirectory(directory.items);
    else if (Array.isArray(directory)) renderDirectory(directory);
  }

  const newsEl = document.getElementById("newsList");
  const newsPath = newsEl?.getAttribute("data-json");
  if (newsPath) {
    const news = await loadJSON(newsPath);
    if (news?.items) renderNews(news.items);
    else if (Array.isArray(news)) renderNews(news);
  }
});
