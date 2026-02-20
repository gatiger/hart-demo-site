// alerts.js
// JSON-driven site-wide alert banner (WCAG-friendly)

const ALERT_PRIORITY = {
  critical: 4,
  important: 3,
  info: 2,
  success: 1
};

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isWithinWindow(now, startStr, endStr) {
  const start = safeDate(startStr);
  const end = safeDate(endStr);
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

function getDismissedAlertIds() {
  try {
    const raw = localStorage.getItem("hc_dismissed_alerts");
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter(x => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function dismissAlertId(id) {
  if (!id) return;
  const set = getDismissedAlertIds();
  set.add(id);
  try {
    localStorage.setItem("hc_dismissed_alerts", JSON.stringify([...set]));
  } catch {
    // ignore
  }
}

function pickTopAlert(alerts) {
  const now = new Date();
  const dismissed = getDismissedAlertIds();

  const active = (Array.isArray(alerts) ? alerts : [])
    .filter(a => a && a.active === true)
    .filter(a => isWithinWindow(now, a.start, a.end))
    .filter(a => !(a.dismissible === true && dismissed.has(String(a.id))));

  active.sort((a, b) => {
    const pa = ALERT_PRIORITY[a.level] || 0;
    const pb = ALERT_PRIORITY[b.level] || 0;
    if (pb !== pa) return pb - pa;

    // Tie-breaker: soonest end date first (if both have end)
    const ea = safeDate(a.end);
    const eb = safeDate(b.end);
    if (ea && eb) return ea.getTime() - eb.getTime();
    if (ea && !eb) return -1;
    if (!ea && eb) return 1;
    return 0;
  });

  return active[0] || null;
}

function ensureAlertMount() {
  // Prefer an existing mount if you add <div id="siteAlert"></div>
  let mount = document.getElementById("siteAlert");
  if (mount) return mount;

  // Otherwise, create it and insert it right after <body> starts
  mount = document.createElement("div");
  mount.id = "siteAlert";

  // Insert before your header/nav if possible
  const header = document.querySelector("header");
  if (header && header.parentNode) {
    header.parentNode.insertBefore(mount, header);
  } else {
    document.body.insertBefore(mount, document.body.firstChild);
  }
  return mount;
}

function escapeText(str) {
  return String(str ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "\"": return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}

function renderAlertInto(mount, alert) {
  if (!mount) return;

  if (!alert) {
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
  const link = alert.link && typeof alert.link === "object" ? alert.link : null;
  const linkLabel = link?.label ? escapeText(link.label) : "Learn more";
  const linkHref = link?.href ? String(link.href) : "";
  const dismissible = alert.dismissible === true;
  const id = String(alert.id || "");

  // role="alert" only for truly urgent content
  const roleAttr = isCritical ? ` role="alert"` : "";
  const ariaLiveAttr = isCritical ? ` aria-live="assertive"` : ` aria-live="polite"`;

  // Template markup
  const bodyHtml = (template === "compact")
    ? `
      <div class="hc-alert__main">
        <span class="hc-alert__title">${title}</span>
        <span class="hc-alert__msg">${message}</span>
      </div>
    `
    : `
      <div class="hc-alert__main">
        <div class="hc-alert__title">${title}</div>
        <div class="hc-alert__msg">${message}</div>
      </div>
    `;

  const linkHtml = linkHref
    ? `<a class="hc-alert__link" href="${escapeText(linkHref)}">${linkLabel}</a>`
    : "";

  const dismissHtml = dismissible
    ? `<button class="hc-alert__dismiss" type="button" aria-label="Dismiss notice">✕</button>`
    : "";

  mount.innerHTML = `
    <div class="hc-alert hc-alert--${escapeText(level)} hc-alert--${escapeText(template)}"${roleAttr}${ariaLiveAttr}>
      ${bodyHtml}
      <div class="hc-alert__actions">
        ${linkHtml}
        ${dismissHtml}
      </div>
    </div>
  `;

  if (dismissible) {
    const btn = mount.querySelector(".hc-alert__dismiss");
    if (btn) {
      btn.addEventListener("click", () => {
        dismissAlertId(id);
        // Hide immediately
        mount.innerHTML = "";
        mount.style.display = "none";
      });
    }
  }
}

/**
 * Public API:
 * Call renderSiteAlert(data) after your JSON loads.
 */
export function renderSiteAlert(data) {
  const mount = ensureAlertMount();
  const top = pickTopAlert(data?.alerts);
  renderAlertInto(mount, top);
}