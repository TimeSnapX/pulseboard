import { formatLong, formatShort, today } from "./dates.js";
import { clearCharts } from "./charts.js";
import { load, mutate, resetDemo, summary as summarise } from "./store.js";
import { esc, money, signedMoney } from "./ui.js";
import * as habits from "./habits.js";
import * as goals from "./goals.js";
import * as moneyTab from "./money.js";
import * as trading from "./trading.js";
import * as intake from "./intake.js";
import * as karate from "./karate.js";

const mods = { habits, goals, money: moneyTab, trading, intake, karate };
const TABS = ["habits", "goals", "money", "trading", "intake", "karate"];

let tab = "habits";
let state = load();

const main = document.getElementById("main");
const summaryEl = document.getElementById("summary");
const dateEl = document.getElementById("today-date");
const tabsEl = document.getElementById("tabs");

function ctx() {
  return { state, mutate, redraw, today: today() };
}

function renderSummary() {
  const s = summarise(state, today());
  const weekOver = s.weekSpend > s.weekBudget;
  const pnlLabel = !s.tradingStarted && state.trading.status === "preparing" ? "not started" : signedMoney(s.tradingPnl);
  const chips = [
    { label: "Habits today", value: `${s.habitsDone}/${s.habitsTotal}`, tone: s.habitsDone === s.habitsTotal && s.habitsTotal ? "good" : "" },
    { label: "Current streak", value: s.streak ? `${s.streak} day${s.streak === 1 ? "" : "s"}` : "—", tone: "accent" },
    { label: "Weekly spend", value: `${money(s.weekSpend)} / ${money(s.weekBudget)}`, tone: weekOver ? "warn" : "good" },
    { label: "Savings", value: money(s.savings) },
    { label: "IG paper P&L", value: pnlLabel, tone: s.tradingPnl > 0 ? "good" : s.tradingPnl < 0 ? "warn" : "" },
    { label: "Cigs today", value: String(s.cigsToday), tone: s.cigsToday === 0 ? "good" : "" },
    { label: "Drinks this week", value: String(s.drinksWeek) },
    { label: "Next karate", value: formatShort(s.nextKarate), tone: "accent" },
  ];
  summaryEl.innerHTML = chips
    .map(
      (c) =>
        `<div class="summary-chip ${c.tone || ""}"><span>${esc(c.label)}</span><strong>${c.value}</strong></div>`
    )
    .join("");
}

function render() {
  state = load();
  dateEl.textContent = formatLong(today());
  tabsEl.querySelectorAll("button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  clearCharts();
  renderSummary();
  main.classList.remove("view");
  void main.offsetWidth;
  main.classList.add("view");
  mods[tab].render(main, ctx());
}

function redraw() {
  const ae = document.activeElement;
  const restore =
    ae && main.contains(ae) && ae.matches("input, textarea, select")
      ? {
          id: ae.id,
          act: ae.dataset.actInput || "",
          key: ae.dataset.key || "",
          path: ae.dataset.path || "",
          start: ae.selectionStart,
          end: ae.selectionEnd,
        }
      : null;
  state = load();
  render();
  if (!restore) return;
  const el = [...main.querySelectorAll("input, textarea, select")].find(
    (x) =>
      (restore.id && x.id === restore.id) ||
      (restore.act &&
        x.dataset.actInput === restore.act &&
        (x.dataset.key || "") === restore.key &&
        (x.dataset.path || "") === restore.path)
  );
  if (!el) return;
  el.focus();
  try {
    if (restore.start != null) el.setSelectionRange(restore.start, restore.end);
  } catch {
    /* not a text field */
  }
}

document.addEventListener("click", (e) => {
  if (e.target.closest("input, select, textarea")) return;
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const [mod, action] = el.dataset.act.split(".");
  if (mod === "app") {
    if (action === "tab") {
      tab = el.dataset.tab;
      if (!TABS.includes(tab)) tab = "habits";
      render();
    } else if (action === "reset") {
      if (confirm("Reset PulseBoard to the seeded demo? Your local edits will be replaced.")) {
        resetDemo();
        tab = "habits";
        redraw();
      }
    }
    return;
  }
  const fn = mods[mod]?.actions?.[action];
  if (fn) fn(el, ctx());
});

document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const [mod, action] = el.dataset.act.split(".");
  const fn = mods[mod]?.actions?.[action];
  if (fn) fn(el, ctx());
});

let inputTimer = 0;
document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-act-input]");
  if (!el) return;
  const [mod, action] = el.dataset.actInput.split(".");
  const fn = mods[mod]?.inputs?.[action];
  if (!fn) return;
  const live = action === "rate" || action === "capital";
  clearTimeout(inputTimer);
  if (live) {
    inputTimer = setTimeout(() => fn(el, ctx()), 280);
  } else {
    fn(el, ctx());
  }
});

document.getElementById("modal").addEventListener("click", (e) => {
  if (e.target.id === "modal") e.target.close();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.getElementById("modal")?.close();
});

render();
