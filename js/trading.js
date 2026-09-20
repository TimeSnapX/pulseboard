import { drawChart } from "./charts.js";
import { emptyState, esc, money, openForm, pct, signedMoney, statCard, uid } from "./ui.js";
import { equityCurve, tradePnl, tradingStats } from "./store.js";
import { formatShort, today } from "./dates.js";

const MARKETS = ["AUDUSD", "XAUUSD", "AU200", "BTC", "Other"];
const READINESS = [
  ["account", "IG account created"],
  ["id", "ID verified"],
  ["demo", "Demo funded"],
  ["rules", "Risk rules written"],
  ["maxLoss", "Max loss per trade set"],
  ["journal", "Journal habit started"],
];
const STATUS = [
  ["preparing", "Preparing"],
  ["paper", "Paper trading"],
  ["live", "Live on IG"],
];

export function render(root, ctx) {
  const { state } = ctx;
  const tr = state.trading;
  const st = tradingStats(state);
  const curve = equityCurve(state);
  const byMkt = {};
  st.closed.forEach((t) => {
    byMkt[t.market] = (byMkt[t.market] || 0) + tradePnl(t);
  });
  const markets = Object.keys(byMkt);
  const rolling = rollingWin(st.closed);

  root.innerHTML = `
    <div class="row">
      <div>
        <h2>Trading</h2>
        <p class="muted">IG prep and a paper-trade log until you go live. Numbers stay on this device.</p>
      </div>
      <div class="status-toggle">
        ${STATUS.map(
          ([k, lab]) =>
            `<button type="button" class="${tr.status === k ? "active" : ""}" data-act="trading.status" data-status="${k}">${lab}</button>`
        ).join("")}
      </div>
    </div>
    <div class="grid grid-4" style="margin-bottom:1rem">
      <article class="stat">
        <p class="stat-label">Starting capital</p>
        <p class="stat-value">
          <input id="trade-capital" type="number" min="0" step="50" value="${tr.startingCapital}" data-act-input="trading.capital" style="width:100%;font-size:1.15rem;font-weight:650;background:transparent;border:none;padding:0">
        </p>
        <p class="stat-sub">Editable demo default $1,000</p>
      </article>
      ${statCard("Current equity", money(st.equity, 2), tr.status === "live" ? "Live on IG" : "Paper")}
      ${statCard("Open P&L", signedMoney(st.openPnl, 2), `${st.open} open`, st.openPnl < 0 ? "warn" : "good")}
      ${statCard("Win rate", st.closed.length ? pct(st.winRate) : "—", `${st.wins}W / ${st.losses}L · ${st.trades.length} trades`, "accent")}
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3>Readiness checklist</h3>
        ${READINESS.map(([k, lab]) => {
          const on = !!tr.readiness[k];
          return `<label class="check-row ${on ? "done" : ""}"><input type="checkbox" data-act="trading.ready" data-key="${k}" ${on ? "checked" : ""}> ${esc(lab)}</label>`;
        }).join("")}
      </div>
      <div class="card">
        <h3>Risk rules</h3>
        <div class="inline-fields">
          <div class="field">
            <label>Max % risk / trade</label>
            <input type="number" min="0" step="0.1" value="${tr.risk.maxRiskPct}" data-act-input="trading.risk" data-key="maxRiskPct">
          </div>
          <div class="field">
            <label>Max daily loss (AUD)</label>
            <input type="number" min="0" step="5" value="${tr.risk.maxDailyLoss}" data-act-input="trading.risk" data-key="maxDailyLoss">
          </div>
          <div class="field">
            <label>Max open positions</label>
            <input type="number" min="1" step="1" value="${tr.risk.maxOpen}" data-act-input="trading.risk" data-key="maxOpen">
          </div>
        </div>
        <p class="dim" style="margin-top:0.8rem">Risk $ per trade at current equity: ${money((st.equity * Number(tr.risk.maxRiskPct || 0)) / 100, 2)}</p>
      </div>
    </div>
    <div class="row" style="margin-top:1.2rem">
      <h3 style="font-size:1.05rem">Trade log</h3>
      <button type="button" class="btn primary" data-act="trading.add">Add trade</button>
    </div>
    ${
      st.trades.length
        ? `<div class="card table-wrap" style="margin-bottom:1rem"><table class="data">
            <thead><tr><th>Date</th><th>Market</th><th>Dir</th><th>Entry</th><th>Stop</th><th>Target</th><th>Size</th><th>R</th><th>Result</th><th>P&L</th><th></th></tr></thead>
            <tbody>
              ${[...st.trades]
                .sort((a, b) => (b.datetime || b.date).localeCompare(a.datetime || a.date))
                .map((t) => {
                  const pnl = t.result === "Open" ? Number(t.pnl || 0) : tradePnl(t);
                  const cls = t.result === "Win" ? "win" : t.result === "Loss" ? "loss" : t.result === "Open" ? "open" : "";
                  return `<tr>
                    <td>${formatShort(t.date)}</td>
                    <td>${esc(t.market)}</td>
                    <td>${esc(t.dir)}</td>
                    <td class="mono">${t.entry}</td>
                    <td class="mono">${t.stop}</td>
                    <td class="mono">${t.target}</td>
                    <td class="mono">${t.size}</td>
                    <td class="mono">${t.r}</td>
                    <td class="${cls}">${esc(t.result)}</td>
                    <td class="mono ${cls}">${signedMoney(pnl, 2)}</td>
                    <td><button type="button" class="btn tiny ghost" data-act="trading.del" data-id="${t.id}">×</button></td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table></div>`
        : emptyState("No trades yet", "Log paper trades until you flip the status to live.", "Add first trade", "trading.add")
    }
    <div class="grid grid-2">
      <div class="card">
        <h3>Equity curve</h3>
        <div class="chart-box"><canvas id="eq"></canvas></div>
      </div>
      <div class="card">
        <h3>Win / loss</h3>
        ${
          st.wins + st.losses
            ? `<div class="chart-box"><canvas id="wl"></canvas></div>`
            : `<p class="muted">No closed wins or losses yet.</p>`
        }
      </div>
      <div class="card">
        <h3>P&L by market</h3>
        ${
          markets.length
            ? `<div class="chart-box"><canvas id="mkt"></canvas></div>`
            : `<p class="muted">Close a trade to see this.</p>`
        }
      </div>
      <div class="card">
        <h3>Rolling 20-trade win rate</h3>
        <div class="chart-box"><canvas id="roll"></canvas></div>
      </div>
    </div>
    <div class="grid grid-2" style="margin-top:1rem">
      <div class="card note-box">
        <h3>Weekly review · what worked</h3>
        <textarea data-act-input="trading.review" data-key="worked">${esc(tr.weeklyReview.worked || "")}</textarea>
      </div>
      <div class="card note-box">
        <h3>Weekly review · what to fix</h3>
        <textarea data-act-input="trading.review" data-key="fix">${esc(tr.weeklyReview.fix || "")}</textarea>
      </div>
    </div>
  `;

  if (curve.length) {
    const eqVals = curve.map((p) => p.value);
    const lo = Math.min(...eqVals);
    const hi = Math.max(...eqVals);
    const pad = Math.max(20, (hi - lo) * 0.15);
    drawChart(root.querySelector("#eq"), {
      type: "area",
      labels: curve.map((p) => p.label),
      series: [{ name: "Equity", data: eqVals, color: "#f7931a" }],
      format: (v) => money(v, 0),
      yMin: lo - pad,
      yMax: hi + pad,
    });
  }
  if (st.wins + st.losses) {
    drawChart(root.querySelector("#wl"), {
      type: "pie",
      slices: [
        { label: "Win", value: st.wins, color: "#5dcaa5" },
        { label: "Loss", value: st.losses, color: "#e06c75" },
        ...(st.be ? [{ label: "BE", value: st.be, color: "#8b93a7" }] : []),
      ],
      format: (v) => v + " trades",
    });
  }
  if (markets.length) {
    drawChart(root.querySelector("#mkt"), {
      type: "bar",
      labels: markets,
      series: [{ name: "P&L", data: markets.map((m) => byMkt[m]), color: "#7eb8d4" }],
      format: (v) => signedMoney(v, 0),
    });
  }
  if (rolling.length) {
    drawChart(root.querySelector("#roll"), {
      type: "line",
      labels: rolling.map((r) => r.label),
      series: [{ name: "Win %", data: rolling.map((r) => r.v), color: "#c084fc" }],
      format: (v) => pct(v),
      yMin: 0,
      yMax: 100,
    });
  }
}

function rollingWin(closed) {
  const decided = closed.filter((t) => t.result === "Win" || t.result === "Loss");
  const out = [];
  decided.forEach((_, i) => {
    const slice = decided.slice(Math.max(0, i - 19), i + 1);
    const w = slice.filter((t) => t.result === "Win").length;
    out.push({ label: String(i + 1), v: (w / slice.length) * 100 });
  });
  return out;
}

export const actions = {
  status(el, ctx) {
    ctx.mutate((s) => {
      s.trading.status = el.dataset.status;
    });
    ctx.redraw();
  },
  ready(el, ctx) {
    ctx.mutate((s) => {
      s.trading.readiness[el.dataset.key] = el.checked;
    });
    ctx.redraw();
  },
  del(el, ctx) {
    ctx.mutate((s) => {
      s.trading.trades = s.trading.trades.filter((t) => t.id !== el.dataset.id);
    });
    ctx.redraw();
  },
  add(_el, ctx) {
    const t = today();
    openForm({
      title: "Add trade",
      submit: "Save trade",
      fields: [
        { name: "datetime", label: "Date / time", type: "datetime-local", required: true, value: t + "T10:30" },
        { name: "market", label: "Market", type: "select", options: MARKETS, value: "AUDUSD" },
        { name: "marketOther", label: "If Other, specify", placeholder: "NAS100…" },
        { name: "dir", label: "Direction", type: "select", options: ["Buy", "Sell"], value: "Buy" },
        { name: "entry", label: "Entry", type: "number", required: true, step: "any" },
        { name: "stop", label: "Stop", type: "number", required: true, step: "any" },
        { name: "target", label: "Target", type: "number", step: "any" },
        { name: "size", label: "Size (AUD risked)", type: "number", required: true, min: 0, step: "0.01", value: 10 },
        { name: "result", label: "Result", type: "select", options: ["Open", "Win", "Loss", "BE"], value: "Open" },
        { name: "r", label: "R-multiple", type: "number", step: "0.1", value: 0 },
        { name: "notes", label: "Notes", type: "textarea", placeholder: "Setup, mistake, management…" },
      ],
      onSubmit(data) {
        const market = data.market === "Other" && data.marketOther ? data.marketOther : data.market;
        const date = String(data.datetime).slice(0, 10);
        const row = {
          id: uid(),
          datetime: data.datetime,
          date,
          market,
          dir: data.dir,
          entry: Number(data.entry),
          stop: Number(data.stop),
          target: Number(data.target || 0),
          size: Number(data.size),
          result: data.result,
          r: Number(data.r || 0),
          notes: data.notes || "",
          pnl: 0,
        };
        row.pnl = tradePnl(row);
        ctx.mutate((s) => s.trading.trades.push(row));
        ctx.redraw();
      },
    });
  },
};

export const inputs = {
  capital(el, ctx) {
    ctx.mutate((s) => {
      s.trading.startingCapital = Number(el.value || 0);
    });
    ctx.redraw();
  },
  risk(el, ctx) {
    ctx.mutate((s) => {
      s.trading.risk[el.dataset.key] = Number(el.value || 0);
    });
  },
  review(el, ctx) {
    ctx.mutate((s) => {
      s.trading.weeklyReview[el.dataset.key] = el.value;
    });
  },
};
