import { drawChart } from "./charts.js";
import { emptyState, esc, openForm, pct, statCard, uid } from "./ui.js";
import {
  addDays,
  dayOfWeek,
  eachDay,
  endOfMonth,
  formatMonthYear,
  formatShort,
  inRange,
  mondayIndex,
  startOfMonth,
  startOfWeek,
  today,
  WEEKDAYS,
  weekStarts,
} from "./dates.js";

export function render(root, ctx) {
  const { state } = ctx;
  const t = today();
  const k = state.karate;
  const ws = startOfWeek(t);
  const weekDays = eachDay(ws, addDays(ws, 6));
  const weekSessions = (d) => k.sessions.filter((s) => s.date === d);
  const attendedWeek = weekDays.filter((d) => weekSessions(d).some((s) => s.attended)).length;
  const onTrack = attendedWeek >= (k.targetPerWeek || 3);

  const monthFrom = startOfMonth(t);
  const monthTo = endOfMonth(t);
  const monthSess = k.sessions.filter((s) => inRange(s.date, monthFrom, monthTo) && s.attended);
  const monthPossible = k.sessions.filter((s) => inRange(s.date, monthFrom, monthTo));
  const attPct = monthPossible.length ? (monthSess.length / monthPossible.length) * 100 : attendedWeek ? 100 : 0;
  const streak = trainingStreak(k.sessions, t);

  const weeks = weekStarts(t, 8);
  const perWeek = weeks.map(
    (w) => k.sessions.filter((s) => s.attended && inRange(s.date, w, addDays(w, 6))).length
  );

  const calStart = startOfWeek(monthFrom);
  const calEnd = addDays(startOfWeek(monthTo), 6);
  const calDays = eachDay(calStart, calEnd);
  const attendedDates = new Set(k.sessions.filter((s) => s.attended).map((s) => s.date));

  root.innerHTML = `
    <div class="row">
      <div>
        <h2>Karate</h2>
        <p class="muted">Weeks start Monday. Target ${k.targetPerWeek} classes / week.</p>
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
        <button type="button" class="btn" data-act="karate.session">Add session</button>
        <button type="button" class="btn primary" data-act="karate.tonight">Mark tonight attended</button>
      </div>
    </div>
    <div class="grid grid-4" style="margin-bottom:1rem">
      ${statCard("Classes this month", String(monthSess.length), formatMonthYear(t))}
      ${statCard("Attendance %", pct(attPct), `${monthSess.length} of ${monthPossible.length || monthSess.length} logged`)}
      ${statCard("Training streak", streak + (streak === 1 ? " week" : " weeks"), "consecutive weeks with a class")}
      ${statCard("This week", `${attendedWeek} / ${k.targetPerWeek}`, onTrack ? "On track" : "Need another class", onTrack ? "good" : "warn")}
    </div>
    <div class="card" style="margin-bottom:1rem">
      <h3>This week</h3>
      <div class="week-grid">
        ${weekDays
          .map((d) => {
            const sess = weekSessions(d);
            const att = sess.some((s) => s.attended);
            const isToday = d === t;
            const future = d > t;
            return `<button type="button" class="day-cell ${att ? "attended" : ""} ${isToday ? "today" : ""} ${!att && !future && sess.length ? "missed" : ""}" data-act="karate.toggle-day" data-date="${d}">
              <div class="dow">${WEEKDAYS[mondayIndex(d)]}</div>
              <div class="dn">${d.slice(8)}</div>
              <div class="dim">${att ? "In" : isToday ? "Tonight?" : future ? "—" : "—"}</div>
            </button>`;
          })
          .join("")}
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3>${formatMonthYear(t)}</h3>
        <div class="month-cal">
          ${WEEKDAYS.map((d) => `<div class="hd">${d}</div>`).join("")}
          ${calDays
            .map((d) => {
              const inM = inRange(d, monthFrom, monthTo);
              if (!inM) return `<div class="cell" style="opacity:.25"></div>`;
              const on = attendedDates.has(d);
              return `<div class="cell ${on ? "on" : ""} ${d === t ? "today" : ""}">${Number(d.slice(8))}</div>`;
            })
            .join("")}
        </div>
      </div>
      <div class="card">
        <h3>Sessions per week · last 8 weeks</h3>
        <div class="chart-box"><canvas id="k-bar"></canvas></div>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>Session log</h3>
      ${
        k.sessions.length
          ? `<div class="table-wrap"><table class="data">
              <thead><tr><th>Date</th><th>Type</th><th>Minutes</th><th>Attended</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                ${[...k.sessions]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 16)
                  .map(
                    (s) => `<tr>
                      <td>${formatShort(s.date)}</td>
                      <td>${esc(s.type)}</td>
                      <td>${s.minutes}</td>
                      <td>${s.attended ? "Yes" : "No"}</td>
                      <td class="muted">${esc(s.notes || "")}</td>
                      <td><button type="button" class="btn tiny ghost" data-act="karate.del" data-id="${s.id}">×</button></td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table></div>`
          : emptyState("No sessions logged", "Mark tonight or add a class, grading, or extra.", "Add first session", "karate.session")
      }
    </div>
  `;

  drawChart(root.querySelector("#k-bar"), {
    type: "bar",
    labels: weeks.map((w) => w.slice(5)),
    series: [{ name: "Sessions", data: perWeek, color: "#f7931a" }],
    format: (v) => v + " class",
    yMax: Math.max(4, ...perWeek),
  });
}

function trainingStreak(sessions, t) {
  const weeks = weekStarts(t, 26).slice().reverse();
  let n = 0;
  for (const w of weeks) {
    const hit = sessions.some((s) => s.attended && inRange(s.date, w, addDays(w, 6)));
    if (hit) n++;
    else if (w === startOfWeek(t)) continue;
    else break;
  }
  return n;
}

function upsertDay(state, date, attended, notes = "") {
  const existing = state.karate.sessions.find((s) => s.date === date && s.type === "class");
  if (existing) {
    existing.attended = attended;
    if (notes) existing.notes = notes;
  } else {
    state.karate.sessions.push({
      id: uid(),
      date,
      type: "class",
      minutes: 75,
      attended,
      notes,
    });
  }
}

export const actions = {
  tonight(_el, ctx) {
    ctx.mutate((s) => upsertDay(s, today(), true, "Marked tonight"));
    ctx.redraw();
  },
  "toggle-day"(el, ctx) {
    const d = el.dataset.date;
    ctx.mutate((s) => {
      const had = s.karate.sessions.some((x) => x.date === d && x.attended);
      upsertDay(s, d, !had);
    });
    ctx.redraw();
  },
  session(_el, ctx) {
    openForm({
      title: "Add session",
      submit: "Save session",
      fields: [
        { name: "date", label: "Date", type: "date", required: true, value: today() },
        { name: "type", label: "Type", type: "select", options: ["class", "grading", "extra"], value: "class" },
        { name: "minutes", label: "Minutes", type: "number", min: 0, value: 75 },
        { name: "attended", label: "Attended", type: "select", options: ["yes", "no"], value: "yes" },
        { name: "notes", label: "Notes", type: "textarea" },
      ],
      onSubmit(data) {
        ctx.mutate((s) => {
          s.karate.sessions.push({
            id: uid(),
            date: data.date,
            type: data.type,
            minutes: Number(data.minutes || 0),
            attended: data.attended === "yes",
            notes: data.notes || "",
          });
        });
        ctx.redraw();
      },
    });
  },
  del(el, ctx) {
    ctx.mutate((s) => {
      s.karate.sessions = s.karate.sessions.filter((x) => x.id !== el.dataset.id);
    });
    ctx.redraw();
  },
};
