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
function renderDirectory(items){
  const list = document.getElementById("directoryList");
  if(!list) return;

  const safe = (v) => (v === undefined || v === null) ? "" : String(v).trim();

  // Optional: hide disabled entries if you add enabled:false later
  const visible = (items || []).filter(d => d.enabled !== false);

  list.innerHTML = visible.map(d => {
    const name = safe(d.name);
    const phone = safe(d.phone);
    const hours = safe(d.hours);
    const desc  = safe(d.description);

    return `
      <article class="item" aria-label="${name || "Department"}">
        <h3 class="itemTitle">${name}</h3>
        ${phone ? `<div class="meta">${phone}</div>` : ""}
        ${hours ? `<div class="meta">Hours: ${hours}</div>` : ""}
        ${desc  ? `<p class="sub" style="margin-top:6px">${desc}</p>` : ""}
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

function renderAlert(site){
  const alerts = site?.alerts;
  const mount = ensureAlertMount();
  const top = pickTopAlert(alerts);
  renderAlertInto(mount, top);
}

const ALERT_PRIORITY = {
  critical: 4,
  important: 3,
  info: 2,
  success: 1
};

function ensureAlertMount(){
  let mount = document.getElementById("siteAlert");
  if(mount) return mount;

  mount = document.createElement("div");
  mount.id = "siteAlert";

  const header = document.querySelector("header");
  if(header && header.parentNode){
    header.parentNode.insertBefore(mount, header);
  } else {
    document.body.insertBefore(mount, document.body.firstChild);
  }
  return mount;
}

function safeDate(value){
  if(!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isWithinWindow(now, startStr, endStr){
  const start = safeDate(startStr);
  const end = safeDate(endStr);
  if(start && now < start) return false;
  if(end && now > end) return false;
  return true;
}

function getDismissedAlertIds(){
  try{
    const raw = localStorage.getItem("hc_dismissed_alerts");
    if(!raw) return new Set();
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) return new Set();
    return new Set(arr.filter(x => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function dismissAlertId(id){
  if(!id) return;
  const set = getDismissedAlertIds();
  set.add(id);
  try{
    localStorage.setItem("hc_dismissed_alerts", JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function pickTopAlert(alerts){
  const now = new Date();
  const dismissed = getDismissedAlertIds();

  const active = (Array.isArray(alerts) ? alerts : [])
    .filter(a => a && a.active === true)
    .filter(a => isWithinWindow(now, a.start, a.end))
    .filter(a => !(a.dismissible === true && dismissed.has(String(a.id))));

  active.sort((a,b) => {
    const pa = ALERT_PRIORITY[(a.level || "").toLowerCase()] || 0;
    const pb = ALERT_PRIORITY[(b.level || "").toLowerCase()] || 0;
    if(pb !== pa) return pb - pa;

    // tie-breaker: soonest end first if both have end dates
    const ea = safeDate(a.end);
    const eb = safeDate(b.end);
    if(ea && eb) return ea.getTime() - eb.getTime();
    if(ea && !eb) return -1;
    if(!ea && eb) return 1;
    return 0;
  });

  return active[0] || null;
}

function escapeText(str){
  return String(str ?? "").replace(/[&<>"']/g, (ch) => {
    switch(ch){
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}

function renderAlertInto(mount, alert){
  if(!mount) return;

  if(!alert){
    mount.innerHTML = "";
    mount.style.display = "none";
    return;
  }

  mount.style.display = "";

  const level = (alert.level || "info").toLowerCase();
  const template = (alert.template || "banner").toLowerCase();
  const isCritical = level === "critical";

  const title = escapeText(alert.title || "");
  const message = escapeText(alert.message || "");

  const link = (alert.link && typeof alert.link === "object") ? alert.link : null;
  const linkLabel = link?.label ? escapeText(link.label) : "Learn more";
  const linkHref = link?.href ? String(link.href) : "";

  const dismissible = alert.dismissible === true;
  const id = String(alert.id || "");

  // role="alert" only for truly urgent items
  const roleAttr = isCritical ? ` role="alert" aria-live="assertive"` : ` aria-live="polite"`;

  const bodyHtml = (template === "compact")
    ? `<div class="hc-alert__main">
         <span class="hc-alert__title">${title}</span>
         <span class="hc-alert__msg">${message}</span>
       </div>`
    : `<div class="hc-alert__main">
         <div class="hc-alert__title">${title}</div>
         <div class="hc-alert__msg">${message}</div>
       </div>`;

  const linkHtml = linkHref
    ? `<a class="hc-alert__link" href="${escapeText(linkHref)}">${linkLabel}</a>`
    : "";

  const dismissHtml = dismissible
    ? `<button class="hc-alert__dismiss" type="button" aria-label="Dismiss notice">✕</button>`
    : "";

  mount.innerHTML = `
    <div class="hc-alert hc-alert--${escapeText(level)} hc-alert--${escapeText(template)}"${roleAttr}>
      ${bodyHtml}
      <div class="hc-alert__actions">
        ${linkHtml}
        ${dismissHtml}
      </div>
    </div>
  `;

  if(dismissible){
    const btn = mount.querySelector(".hc-alert__dismiss");
    if(btn){
      btn.addEventListener("click", () => {
        dismissAlertId(id);
        mount.innerHTML = "";
        mount.style.display = "none";
      });
    }
  }
}
/* -------------------------
   Boot
-------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  initMobileMenu();

  // Use relative paths (plays nicer on a county server subfolder)
  const site = await loadJSON("./content/site.json");
  const alerts = await loadJSON("./content/alerts.json");
  const directory = await loadJSON("./content/directory.json");
  const news = await loadJSON("./content/news.json");

  // Alerts: prefer alerts.json, fall back to site.json if needed
  if (alerts) renderAlert(alerts);
  else if (site) renderAlert(site);

  if (directory?.items) renderDirectory(directory.items);
  if (news?.items) renderNews(news.items);
});

