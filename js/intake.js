import { drawChart } from "./charts.js";
import { emptyState, esc, money, money2, openForm, statCard, uid } from "./ui.js";
import { cigCostPer, weekCigs, weekDrinks } from "./store.js";
import {
  addDays,
  eachDay,
  endOfMonth,
  endOfWeek,
  inRange,
  lastNDays,
  startOfMonth,
  startOfWeek,
  today,
  weekStarts,
} from "./dates.js";

const TYPES = ["beer", "wine", "spirits", "mixed"];

export function render(root, ctx) {
  const { state } = ctx;
  const t = today();
  const I = state.intake;
  const cost = cigCostPer(state);
  const cigToday = Number(I.cigs[t] || 0);
  const cigWeek = weekCigs(state, t);
  const drinkWeek = weekDrinks(state, t);
  const last7 = lastNDays(t, 7);
  const cig7 = last7.reduce((a, d) => a + Number(I.cigs[d] || 0), 0);
  const drink7 = I.drinks.filter((d) => last7.includes(d.date)).reduce((a, d) => a + Number(d.drinks || 0), 0);
  const drinkToday = I.drinks.filter((d) => d.date === t).reduce((a, d) => a + Number(d.drinks || 0), 0);

  const days28 = lastNDays(t, 28);
  const cig28 = days28.map((d) => Number(I.cigs[d] || 0));
  const drink28 = days28.map((d) =>
    I.drinks.filter((x) => x.date === d).reduce((a, x) => a + Number(x.drinks || 0), 0)
  );

  const weeks = weekStarts(t, 12);
  const cigW = weeks.map((w) =>
    eachDay(w, addDays(w, 6)).reduce((a, d) => a + Number(I.cigs[d] || 0), 0)
  );
  const drinkW = weeks.map((w) =>
    I.drinks.filter((x) => inRange(x.date, w, addDays(w, 6))).reduce((a, x) => a + Number(x.drinks || 0), 0)
  );

  const thisMonth = eachDay(startOfMonth(t), t);
  const lastMStart = startOfMonth(addDays(startOfMonth(t), -1));
  const lastMEnd = endOfMonth(lastMStart);
  const spendCigs = (from, to) =>
    eachDay(from, to).reduce((a, d) => a + Number(I.cigs[d] || 0) * cost, 0);
  const spendDrinks = (from, to) =>
    I.drinks.filter((d) => inRange(d.date, from, to)).reduce((a, d) => a + Number(d.drinks || 0) * Number(I.drinkCost || 0), 0);
  const spendThis = spendCigs(thisMonth[0], t) + spendDrinks(thisMonth[0], t);
  const spendLast = spendCigs(lastMStart, lastMEnd) + spendDrinks(lastMStart, lastMEnd);

  const zeroStreak = streak(days28.slice().reverse(), (d) => Number(I.cigs[d] || 0) === 0);
  const underCig = streak(days28.slice().reverse(), (d) => Number(I.cigs[d] || 0) <= I.cigCap / 7);
  const underDrinkWeek = drinkWeek <= Number(I.drinkCap || 0);

  root.innerHTML = `
    <div class="row">
      <div>
        <h2>Intake</h2>
        <p class="muted">Honest counts and the dollar cost. Caps are yours to move.</p>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3>Cigarettes</h3>
        <div class="intake-hero">
          <span class="n">${cigToday}</span>
          <span class="u">today · ${money2(cigToday * cost)}</span>
        </div>
        <div class="quick-add" style="margin:0.8rem 0">
          <button type="button" class="btn" data-act="intake.cigs" data-n="1">+1</button>
          <button type="button" class="btn" data-act="intake.cigs" data-n="5">+5</button>
          <button type="button" class="btn" data-act="intake.cigs-custom">Custom</button>
          <button type="button" class="btn ghost" data-act="intake.cigs" data-n="-1">−1</button>
        </div>
        <div class="grid grid-3" style="margin:0.6rem 0 1rem">
          ${statCard("This week", String(cigWeek), `cap ${I.cigCap}`, cigWeek > I.cigCap ? "warn" : "good")}
          ${statCard("Last 7 days", String(cig7), money2(cig7 * cost))}
          ${statCard("Pack math", money2(I.packCost) + " / " + I.cigsPerPack, money2(cost) + " each")}
        </div>
        <div class="inline-fields">
          <div class="field"><label>Weekly cap</label><input type="number" min="0" value="${I.cigCap}" data-act-input="intake.set" data-path="cigCap"></div>
          <div class="field"><label>Cost / pack</label><input type="number" min="0" step="0.5" value="${I.packCost}" data-act-input="intake.set" data-path="packCost"></div>
          <div class="field"><label>Cigs / pack</label><input type="number" min="1" value="${I.cigsPerPack}" data-act-input="intake.set" data-path="cigsPerPack"></div>
        </div>
        <p class="dim" style="margin-top:0.7rem">Days at zero: ${zeroStreak} · Days under daily share of cap: ${underCig}</p>
      </div>
      <div class="card">
        <h3>Alcohol</h3>
        <div class="intake-hero">
          <span class="n">${drinkToday}</span>
          <span class="u">std drinks today · ${money2(drinkToday * I.drinkCost)}</span>
        </div>
        <div class="quick-add" style="margin:0.8rem 0">
          <button type="button" class="btn primary" data-act="intake.drink">Log drinks</button>
        </div>
        <div class="grid grid-3" style="margin:0.6rem 0 1rem">
          ${statCard("This week", String(drinkWeek), `cap ${I.drinkCap}`, drinkWeek > I.drinkCap ? "warn" : "good")}
          ${statCard("Last 7 days", String(drink7), money2(drink7 * I.drinkCost))}
          ${statCard("Week vs cap", underDrinkWeek ? "Under" : "Over", underDrinkWeek ? "on track" : "over the line", underDrinkWeek ? "good" : "warn")}
        </div>
        <div class="inline-fields">
          <div class="field"><label>Weekly drink cap</label><input type="number" min="0" value="${I.drinkCap}" data-act-input="intake.set" data-path="drinkCap"></div>
          <div class="field"><label>$ per drink</label><input type="number" min="0" step="0.5" value="${I.drinkCost}" data-act-input="intake.set" data-path="drinkCost"></div>
        </div>
      </div>
    </div>
    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card">
        <h3>Cigs per day · last 28 days</h3>
        <div class="chart-box"><canvas id="cigs-bar"></canvas></div>
      </div>
      <div class="card">
        <h3>Drinks per day · last 28 days</h3>
        <div class="chart-box"><canvas id="drinks-bar"></canvas></div>
      </div>
      <div class="card">
        <h3>Weekly trend · last 12 weeks</h3>
        <div class="chart-box"><canvas id="combo"></canvas></div>
      </div>
      <div class="card">
        <h3>Money this month vs last</h3>
        <div class="chart-box"><canvas id="spend"></canvas></div>
        <p class="muted" style="margin-top:0.6rem">Cigs + alcohol only · this month ${money(spendThis)} · last month ${money(spendLast)}</p>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>Recent logs</h3>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Date</th><th>Cigs</th><th>Drinks</th><th>Note</th></tr></thead>
          <tbody>
            ${lastNDays(t, 10)
              .slice()
              .reverse()
              .map((d) => {
                const c = Number(I.cigs[d] || 0);
                const dr = I.drinks.filter((x) => x.date === d);
                const ds = dr.reduce((a, x) => a + Number(x.drinks || 0), 0);
                const note = I.cigNotes?.[d] || dr.map((x) => x.note).filter(Boolean).join(" · ");
                return `<tr><td>${d}</td><td>${c}</td><td>${ds ? ds + " (" + dr.map((x) => x.type).join(", ") + ")" : "0"}</td><td class="muted">${esc(note || "")}</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  drawChart(root.querySelector("#cigs-bar"), {
    type: "bar",
    labels: days28.map((d) => d.slice(8)),
    series: [{ name: "Cigs", data: cig28, color: "#e06c75" }],
    format: (v) => Math.round(v) + " cigs",
  });
  drawChart(root.querySelector("#drinks-bar"), {
    type: "bar",
    labels: days28.map((d) => d.slice(8)),
    series: [{ name: "Drinks", data: drink28, color: "#e8b86d" }],
    format: (v) => v + " std",
  });
  drawChart(root.querySelector("#combo"), {
    type: "line",
    labels: weeks.map((w) => w.slice(5)),
    series: [
      { name: "Cigs", data: cigW, color: "#e06c75" },
      { name: "Drinks", data: drinkW, color: "#e8b86d" },
    ],
    format: (v) => String(Math.round(v)),
  });
  drawChart(root.querySelector("#spend"), {
    type: "bar",
    labels: ["Last month", "This month"],
    series: [
      { name: "Cigs", data: [spendCigs(lastMStart, lastMEnd), spendCigs(thisMonth[0], t)], color: "#e06c75" },
      { name: "Alcohol", data: [spendDrinks(lastMStart, lastMEnd), spendDrinks(thisMonth[0], t)], color: "#e8b86d" },
    ],
    format: (v) => money(v),
  });
}

function streak(daysNewestFirst, pred) {
  let n = 0;
  for (const d of daysNewestFirst) {
    if (pred(d)) n++;
    else break;
  }
  return n;
}

export const actions = {
  cigs(el, ctx) {
    const n = Number(el.dataset.n);
    const t = today();
    ctx.mutate((s) => {
      const cur = Number(s.intake.cigs[t] || 0);
      s.intake.cigs[t] = Math.max(0, cur + n);
    });
    ctx.redraw();
  },
  "cigs-custom"(_el, ctx) {
    openForm({
      title: "Log cigarettes",
      submit: "Save",
      fields: [
        { name: "date", label: "Date", type: "date", required: true, value: today() },
        { name: "count", label: "Count", type: "number", required: true, min: 0, value: ctx.state.intake.cigs[today()] || 0 },
        { name: "note", label: "Craving note (optional)", type: "textarea", placeholder: "What was going on?" },
      ],
      onSubmit(data) {
        ctx.mutate((s) => {
          s.intake.cigs[data.date] = Number(data.count);
          if (data.note) {
            s.intake.cigNotes ||= {};
            s.intake.cigNotes[data.date] = data.note;
          }
        });
        ctx.redraw();
      },
    });
  },
  drink(_el, ctx) {
    openForm({
      title: "Log drinks",
      submit: "Save",
      fields: [
        { name: "date", label: "Date", type: "date", required: true, value: today() },
        { name: "type", label: "Type", type: "select", options: TYPES, value: "beer" },
        { name: "drinks", label: "Standard drinks", type: "number", required: true, min: 0, step: "0.5", value: 1 },
        { name: "note", label: "Craving note (optional)", type: "textarea" },
      ],
      onSubmit(data) {
        ctx.mutate((s) => {
          s.intake.drinks.push({
            id: uid(),
            date: data.date,
            type: data.type,
            drinks: Number(data.drinks),
            note: data.note || "",
          });
        });
        ctx.redraw();
      },
    });
  },
};

export const inputs = {
  set(el, ctx) {
    ctx.mutate((s) => {
      s.intake[el.dataset.path] = Number(el.value || 0);
    });
  },
};
