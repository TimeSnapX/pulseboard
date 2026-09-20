export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

export function money(n, digits = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function money2(n) {
  return money(n, 2);
}

export function signedMoney(n, digits = 0) {
  const v = Number(n) || 0;
  const core = money(Math.abs(v), digits);
  if (v > 0) return "+" + core;
  if (v < 0) return "−" + core;
  return core;
}

export function pct(n, digits = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function num(n, digits = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-AU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fieldHtml(f) {
  const id = `f-${f.name}`;
  const label = `<label for="${id}">${esc(f.label)}</label>`;
  const req = f.required ? "required" : "";
  const val = f.value ?? "";
  if (f.type === "select") {
    const opts = (f.options || [])
      .map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const t = typeof o === "string" ? o : o.label;
        return `<option value="${esc(v)}" ${v == val ? "selected" : ""}>${esc(t)}</option>`;
      })
      .join("");
    return `<div class="field">${label}<select id="${id}" name="${f.name}" ${req}>${opts}</select></div>`;
  }
  if (f.type === "textarea") {
    return `<div class="field ${f.wide ? "wide" : ""}">${label}<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || "")}">${esc(val)}</textarea></div>`;
  }
  if (f.type === "color") {
    return `<div class="field">${label}<input id="${id}" name="${f.name}" type="color" value="${esc(val || "#f7931a")}"></div>`;
  }
  if (f.type === "checkbox") {
    return `<label class="check"><input type="checkbox" name="${f.name}" ${val ? "checked" : ""}> ${esc(f.label)}</label>`;
  }
  const step = f.step != null ? `step="${f.step}"` : "";
  const min = f.min != null ? `min="${f.min}"` : "";
  const max = f.max != null ? `max="${f.max}"` : "";
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : "";
  return `<div class="field">${label}<input id="${id}" name="${f.name}" type="${f.type || "text"}" value="${esc(val)}" ${req} ${step} ${min} ${max} ${ph}></div>`;
}

export function openForm({ title, fields, submit = "Save", extra = "", onSubmit }) {
  const modal = document.getElementById("modal");
  modal.innerHTML = `
    <form class="form-card" method="dialog">
      <header>
        <h2>${esc(title)}</h2>
        <button type="button" class="icon-btn" data-close-modal aria-label="Close">×</button>
      </header>
      <div class="form-grid">
        ${fields.map(fieldHtml).join("")}
      </div>
      ${extra}
      <div class="form-actions">
        <button type="button" class="btn" data-close-modal>Cancel</button>
        <button type="submit" class="btn primary">${esc(submit)}</button>
      </div>
    </form>
  `;
  if (!modal.open) modal.showModal();
  const form = modal.querySelector("form");
  const close = () => modal.close();
  modal.querySelectorAll("[data-close-modal]").forEach((b) => b.addEventListener("click", close));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = {};
    for (const f of fields) {
      if (f.type === "checkbox") data[f.name] = form.querySelector(`[name="${f.name}"]`)?.checked || false;
      else data[f.name] = fd.get(f.name);
    }
    onSubmit(data);
    modal.close();
  });
}

export function emptyState(title, body, actionLabel, act) {
  return `
    <div class="empty">
      <div class="empty-mark">◇</div>
      <h3>${esc(title)}</h3>
      <p>${esc(body)}</p>
      ${actionLabel ? `<button type="button" class="btn primary" data-act="${act}">${esc(actionLabel)}</button>` : ""}
    </div>
  `;
}

export function statCard(label, value, sub = "", tone = "") {
  return `
    <article class="stat ${tone}">
      <p class="stat-label">${esc(label)}</p>
      <p class="stat-value">${value}</p>
      ${sub ? `<p class="stat-sub">${sub}</p>` : ""}
    </article>
  `;
}

export function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2, 10);
}
