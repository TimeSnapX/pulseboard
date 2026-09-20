import { addDays, eachDay, startOfWeek, today, WEEKDAYS } from "./dates.js";
import { drawChart } from "./charts.js";
import { emptyState, esc, openForm, pct, uid } from "./ui.js";
import { completionsByWeek, HABIT_CATS, habitStats } from "./store.js";

let filter = "All";

function heatmapDays(t) {
  const end = t;
  const start = addDays(end, -89);
  const gridStart = startOfWeek(start);
  return eachDay(gridStart, end);
}

export function render(root, ctx) {
  const { state } = ctx;
  const t = today();
  const habits = state.habits.filter((h) => filter === "All" || h.category === filter);
  const cats = ["All", ...HABIT_CATS];

  root.innerHTML = `
    <div class="row">
      <div>
        <h2>Habits</h2>
        <p class="muted">Last 90 days · click a cell to toggle · hover for the date</p>
      </div>
      <div class="filters">
        ${cats
          .map(
            (c) =>
              `<button type="button" class="chip ${filter === c ? "active" : ""}" data-act="habits.filter" data-cat="${esc(c)}">${esc(c)}</button>`
          )
          .join("")}
      </div>
      <button type="button" class="btn primary" data-act="habits.add">Add habit</button>
    </div>
    ${
      habits.length
        ? `<div class="grid grid-2">${habits.map((h) => card(h, state, t)).join("")}</div>
           <div class="card" style="margin-top:1rem">
             <h3>Completions per week · last 12 weeks</h3>
             <div class="chart-box"><canvas id="habit-weeks"></canvas></div>
           </div>`
        : emptyState("No habits yet", "Add one to start a 90-day heatmap.", "Add first habit", "habits.add")
    }
  `;

  if (!habits.length) return;
  const series = completionsByWeek(habits, state.habitLogs, t, 12);
  drawChart(root.querySelector("#habit-weeks"), {
    type: "area",
    labels: series.map((s) => s.week.slice(5)),
    series: [{ name: "Completions", data: series.map((s) => s.value), color: "#f7931a" }],
    format: (v) => Math.round(v) + " done",
  });
}

function card(h, state, t) {
  const stats = habitStats(h, state.habitLogs, t);
  const days = heatmapDays(t);
  const map = state.habitLogs[h.id] || {};
  const cells = days
    .map((d) => {
      const on = !!map[d];
      const future = d > t;
      return `<div class="heat-cell ${on ? "on" : ""}" style="${on ? `--hc:${h.color}` : ""}" title="${d}${on ? " · done" : ""}" data-act="habits.toggle" data-id="${h.id}" data-date="${d}" ${future ? "data-future=1" : ""}></div>`;
    })
    .join("");
  return `
    <article class="card habit-card">
      <div class="habit-head">
        <div>
          <div class="habit-name">${esc(h.name)}</div>
          <div class="habit-meta">${esc(h.category)} · ${esc(h.frequency)}${h.target ? " · target " + h.target : ""}</div>
        </div>
        <button type="button" class="btn tiny ghost" data-act="habits.remove" data-id="${h.id}">Remove</button>
      </div>
      <div class="heatmap-wrap">
        <div class="heatmap" aria-label="90 day heatmap">${cells}</div>
      </div>
      <div class="heat-legend">
        ${WEEKDAYS.map((d, i) => (i % 2 === 0 ? `<span>${d}</span>` : "")).join("")}
        <span style="margin-left:auto">90 days</span>
      </div>
      <div class="habit-stats">
        <span>Streak <b>${stats.current}</b></span>
        <span>Best <b>${stats.best}</b></span>
        <span>30-day <b>${pct(stats.pct30)}</b></span>
        <span>${stats.doneToday ? "Done today" : "Not yet today"}</span>
      </div>
    </article>
  `;
}

export const actions = {
  filter(el, ctx) {
    filter = el.dataset.cat;
    ctx.redraw();
  },
  toggle(el, ctx) {
    const { id, date } = el.dataset;
    ctx.mutate((s) => {
      s.habitLogs[id] ||= {};
      if (s.habitLogs[id][date]) delete s.habitLogs[id][date];
      else s.habitLogs[id][date] = 1;
    });
    ctx.redraw();
  },
  remove(el, ctx) {
    if (!confirm("Remove this habit and its history?")) return;
    ctx.mutate((s) => {
      s.habits = s.habits.filter((h) => h.id !== el.dataset.id);
      delete s.habitLogs[el.dataset.id];
    });
    ctx.redraw();
  },
  add(_el, ctx) {
    openForm({
      title: "Add habit",
      submit: "Add habit",
      fields: [
        { name: "name", label: "Name", required: true, placeholder: "e.g. Morning stretch" },
        { name: "category", label: "Category", type: "select", options: HABIT_CATS, value: "Health" },
        { name: "frequency", label: "Frequency", type: "select", options: ["daily", "weekly"], value: "daily" },
        { name: "color", label: "Colour", type: "color", value: "#f7931a" },
        { name: "target", label: "Daily target (optional)", type: "number", min: 0, step: 1, placeholder: "Leave blank" },
      ],
      onSubmit(data) {
        const id = uid();
        ctx.mutate((s) => {
          s.habits.push({
            id,
            name: data.name.trim(),
            category: data.category,
            frequency: data.frequency,
            color: data.color || "#f7931a",
            target: data.target ? Number(data.target) : null,
          });
          s.habitLogs[id] = {};
        });
        ctx.redraw();
      },
    });
  },
};
