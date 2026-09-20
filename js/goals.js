import { drawChart } from "./charts.js";
import { emptyState, esc, money, openForm, pct, uid } from "./ui.js";
import { HABIT_CATS, goalProgress, goalStatus } from "./store.js";
import { formatShort, today } from "./dates.js";

const CATS = [...HABIT_CATS, "Trading"];

function fmtValue(g, v) {
  if (g.unit === "AUD") return money(v);
  return `${Number(v).toLocaleString("en-AU")} ${esc(g.unit)}`;
}

export function render(root, ctx) {
  const { state } = ctx;
  const t = today();
  root.innerHTML = `
    <div class="row">
      <div>
        <h2>Goals</h2>
        <p class="muted">Track a target, a deadline, and whether you are on pace.</p>
      </div>
      <button type="button" class="btn primary" data-act="goals.add">Add goal</button>
    </div>
    ${
      state.goals.length
        ? `<div class="grid grid-2" id="goal-cards"></div>`
        : emptyState("No goals yet", "Set a target and a date you actually care about.", "Add first goal", "goals.add")
    }
  `;
  const wrap = root.querySelector("#goal-cards");
  if (!wrap) return;
  state.goals.forEach((g, i) => {
    const p = goalProgress(g);
    const status = goalStatus(g, t);
    const tone = status === "done" ? "green" : status === "at-risk" ? "red" : "";
    const el = document.createElement("article");
    el.className = "card";
    el.innerHTML = `
      <div class="habit-head">
        <div>
          <div class="habit-name">${esc(g.title)}</div>
          <div class="habit-meta">${esc(g.category)} · due ${formatShort(g.deadline)}</div>
        </div>
        <span class="badge ${status}">${status.replace("-", " ")}</span>
      </div>
      <p class="stat-value" style="font-size:1.2rem;margin:0.6rem 0 0.35rem">${fmtValue(g, g.current)} <span class="muted" style="font-size:0.85rem">/ ${fmtValue(g, g.target)}</span></p>
      <div class="progress ${tone}"><span style="width:${Math.round(p * 100)}%"></span></div>
      <p class="habit-meta" style="margin:0.45rem 0 0.8rem">${pct(p * 100)} complete</p>
      <div class="chart-box" style="height:160px"><canvas id="goal-chart-${i}"></canvas></div>
      <div class="row" style="margin:0.8rem 0 0">
        <button type="button" class="btn tiny" data-act="goals.update" data-id="${g.id}">Update progress</button>
        <button type="button" class="btn tiny ghost" data-act="goals.remove" data-id="${g.id}">Remove</button>
      </div>
    `;
    wrap.appendChild(el);
    const hist = g.history?.length ? g.history : [{ date: t, value: g.current }];
    drawChart(el.querySelector("canvas"), {
      type: "area",
      labels: hist.map((h) => h.date.slice(5)),
      series: [{ name: g.title, data: hist.map((h) => h.value), color: status === "at-risk" ? "#e06c75" : "#f7931a" }],
      format: (v) => (g.unit === "AUD" ? money(v) : String(Math.round(v))),
    });
  });
}

export const actions = {
  add(_el, ctx) {
    openForm({
      title: "Add goal",
      submit: "Add goal",
      fields: [
        { name: "title", label: "Title", required: true, placeholder: "e.g. Emergency savings" },
        { name: "category", label: "Category", type: "select", options: CATS, value: "Personal" },
        { name: "target", label: "Target", type: "number", required: true, min: 0, step: "any" },
        { name: "unit", label: "Unit", value: "AUD", placeholder: "AUD, classes, cigs / week" },
        { name: "current", label: "Current progress", type: "number", required: true, min: 0, step: "any", value: 0 },
        { name: "deadline", label: "Deadline", type: "date", required: true },
        { name: "invert", label: "Lower is better (e.g. cut cigarettes)", type: "checkbox" },
        { name: "baseline", label: "Starting baseline (if lower is better)", type: "number", min: 0, step: "any" },
      ],
      onSubmit(data) {
        const t = today();
        ctx.mutate((s) => {
          s.goals.push({
            id: uid(),
            title: data.title.trim(),
            category: data.category,
            target: Number(data.target),
            unit: data.unit || "",
            deadline: data.deadline,
            current: Number(data.current),
            baseline: data.baseline ? Number(data.baseline) : Number(data.current),
            invert: !!data.invert,
            history: [{ date: t, value: Number(data.current) }],
          });
        });
        ctx.redraw();
      },
    });
  },
  update(el, ctx) {
    const g = ctx.state.goals.find((x) => x.id === el.dataset.id);
    if (!g) return;
    openForm({
      title: "Update progress",
      submit: "Save",
      fields: [
        { name: "current", label: `Current (${g.unit})`, type: "number", required: true, step: "any", value: g.current },
      ],
      onSubmit(data) {
        ctx.mutate((s) => {
          const goal = s.goals.find((x) => x.id === g.id);
          goal.current = Number(data.current);
          goal.history = goal.history || [];
          goal.history.push({ date: today(), value: goal.current });
        });
        ctx.redraw();
      },
    });
  },
  remove(el, ctx) {
    if (!confirm("Remove this goal?")) return;
    ctx.mutate((s) => {
      s.goals = s.goals.filter((g) => g.id !== el.dataset.id);
    });
    ctx.redraw();
  },
};
