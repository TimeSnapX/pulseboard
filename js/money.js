import {
  CAT_COLORS,
  EXPENSE_CATS,
  monthSpend,
  monthlyBudgetTotal,
  savingsSeries,
  savingsTotal,
  spendByCategory,
  sum,
  weekSpend,
  weeklyBudgetTotal,
} from "./store.js";
import { eachDay, formatShort, monthLabel, startOfMonth, today } from "./dates.js";
import { drawChart } from "./charts.js";
import { emptyState, esc, money, money2, openForm, statCard, uid } from "./ui.js";

export function render(root, ctx) {
  const { state } = ctx;
  const t = today();
  const month = monthSpend(state, t);
  const week = weekSpend(state, t);
  const byCat = spendByCategory(month);
  const spentMonth = sum(month);
  const spentWeek = sum(week);
  const weekBudget = weeklyBudgetTotal(state);
  const monthBudget = monthlyBudgetTotal(state);
  const remaining = monthBudget - spentMonth;
  const savings = savingsTotal(state);
  const rate = Number(state.weeklySaveRate || 0);
  const proj = (weeks) => savings + rate * weeks;

  const days = eachDay(startOfMonth(t), t);
  const daily = days.map((d) => ({
    d,
    v: sum(state.expenses.filter((e) => e.date === d)),
  }));
  const sav = savingsSeries(state, t);

  const recent = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  root.innerHTML = `
    <div class="row">
      <div>
        <h2>Money</h2>
        <p class="muted">Spending, savings, and a live projection from this week's save rate.</p>
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
        <button type="button" class="btn" data-act="money.income">Add income / savings</button>
        <button type="button" class="btn" data-act="money.budget">Monthly budgets</button>
        <button type="button" class="btn primary" data-act="money.expense">Add expense</button>
      </div>
    </div>
    <div class="grid grid-4" style="margin-bottom:1rem">
      ${statCard("Spent this week", money(spentWeek), `${money(weekBudget)} weekly budget`, spentWeek > weekBudget ? "warn" : "")}
      ${statCard("Remaining budget", money(remaining), `${money(spentMonth)} of ${money(monthBudget)} this month`, remaining < 0 ? "warn" : "good")}
      ${statCard("Savings total", money(savings), "Opening + deposits", "accent")}
      ${statCard("Projected 12-month savings", money(proj(52)), `${money(rate)} / week`)}
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3>Spend by category · this month</h3>
        ${
          spentMonth
            ? `<div class="chart-box"><canvas id="m-donut"></canvas></div>`
            : emptyState("No spend this month", "Add an expense to fill the donut.", "Add first expense", "money.expense")
        }
      </div>
      <div class="card">
        <h3>Spend vs budget</h3>
        <div class="chart-box"><canvas id="m-bar"></canvas></div>
      </div>
      <div class="card">
        <h3>Daily spend · this month</h3>
        <div class="chart-box"><canvas id="m-line"></canvas></div>
      </div>
      <div class="card">
        <h3>Savings balance · last 6 months</h3>
        <div class="chart-box"><canvas id="m-save"></canvas></div>
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>Live projection</h3>
      <p class="muted" style="margin-bottom:0.8rem">Edit the weekly save rate. Balances assume that rate holds from today.</p>
      <div class="inline-fields" style="max-width:420px;margin-bottom:1rem">
        <div class="field">
          <label for="save-rate">Weekly save rate (AUD)</label>
          <input id="save-rate" type="number" min="0" step="5" value="${rate}" data-act-input="money.rate">
        </div>
      </div>
      <div class="grid grid-3">
        ${statCard("In 3 months", money(proj(13)), "13 weeks")}
        ${statCard("In 6 months", money(proj(26)), "26 weeks")}
        ${statCard("In 12 months", money(proj(52)), "52 weeks", "accent")}
      </div>
    </div>
    <div class="card" style="margin-top:1rem">
      <h3>Recent expenses</h3>
      ${
        recent.length
          ? `<div class="table-wrap"><table class="data">
              <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                ${recent
                  .map(
                    (e) => `<tr>
                      <td>${formatShort(e.date)}</td>
                      <td>${esc(e.category)}</td>
                      <td class="muted">${esc(e.note || "")}</td>
                      <td class="mono">${money2(e.amount)}</td>
                      <td><button type="button" class="btn tiny ghost" data-act="money.del-exp" data-id="${e.id}">×</button></td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table></div>`
          : emptyState("No expenses", "Log food, fuel, rent, smokes — whatever left the account.", "Add first expense", "money.expense")
      }
    </div>
  `;

  const slices = EXPENSE_CATS.filter((c) => byCat[c] > 0).map((c) => ({
    label: c,
    value: byCat[c],
    color: CAT_COLORS[c],
  }));
  if (slices.length) {
    drawChart(root.querySelector("#m-donut"), {
      type: "donut",
      slices,
      format: (v) => money(v),
      center: money(spentMonth),
      centerSub: "this month",
    });
  }
  const shortCat = {
    "Trading costs": "Trading",
    Cigarettes: "Cigs",
    Alcohol: "Drinks",
  };
  drawChart(root.querySelector("#m-bar"), {
    type: "bar",
    labels: EXPENSE_CATS.map((c) => shortCat[c] || c),
    series: [
      { name: "Spent", data: EXPENSE_CATS.map((c) => byCat[c] || 0), color: "#f7931a" },
      { name: "Budget", data: EXPENSE_CATS.map((c) => Number(state.budgets[c] || 0)), color: "#5dcaa5" },
    ],
    format: (v) => money(v),
  });
  drawChart(root.querySelector("#m-line"), {
    type: "line",
    labels: daily.map((x) => x.d.slice(8)),
    series: [{ name: "Spend", data: daily.map((x) => x.v), color: "#e8b86d" }],
    format: (v) => money(v, 0),
  });
  drawChart(root.querySelector("#m-save"), {
    type: "area",
    labels: sav.map((x) => monthLabel(x.date)),
    series: [{ name: "Savings", data: sav.map((x) => x.value), color: "#5dcaa5" }],
    format: (v) => money(v),
  });
}

export const actions = {
  expense(_el, ctx) {
    openForm({
      title: "Add expense",
      submit: "Add expense",
      fields: [
        { name: "amount", label: "Amount (AUD)", type: "number", required: true, min: 0, step: "0.01" },
        { name: "category", label: "Category", type: "select", options: EXPENSE_CATS, value: "Food" },
        { name: "date", label: "Date", type: "date", required: true, value: today() },
        { name: "note", label: "Note", placeholder: "optional" },
      ],
      onSubmit(data) {
        ctx.mutate((s) => {
          s.expenses.push({
            id: uid(),
            amount: Number(data.amount),
            category: data.category,
            date: data.date,
            note: (data.note || "").trim(),
          });
        });
        ctx.redraw();
      },
    });
  },
  income(_el, ctx) {
    openForm({
      title: "Add income or savings deposit",
      submit: "Add",
      fields: [
        { name: "kind", label: "Type", type: "select", options: ["income", "savings"], value: "savings" },
        { name: "amount", label: "Amount (AUD)", type: "number", required: true, min: 0, step: "0.01" },
        { name: "date", label: "Date", type: "date", required: true, value: today() },
        { name: "note", label: "Note", placeholder: "Pay, OT leftover, transfer…" },
      ],
      onSubmit(data) {
        ctx.mutate((s) => {
          const row = { id: uid(), amount: Number(data.amount), date: data.date, note: (data.note || "").trim() };
          if (data.kind === "savings") s.deposits.push(row);
          else s.incomes.push(row);
        });
        ctx.redraw();
      },
    });
  },
  budget(_el, ctx) {
    openForm({
      title: "Monthly budgets",
      submit: "Save budgets",
      fields: EXPENSE_CATS.map((c) => ({
        name: c,
        label: c,
        type: "number",
        min: 0,
        step: "1",
        value: ctx.state.budgets[c] || 0,
      })),
      onSubmit(data) {
        ctx.mutate((s) => {
          EXPENSE_CATS.forEach((c) => {
            s.budgets[c] = Number(data[c] || 0);
          });
        });
        ctx.redraw();
      },
    });
  },
  "del-exp"(el, ctx) {
    ctx.mutate((s) => {
      s.expenses = s.expenses.filter((e) => e.id !== el.dataset.id);
    });
    ctx.redraw();
  },
};

export const inputs = {
  rate(el, ctx) {
    ctx.mutate((s) => {
      s.weeklySaveRate = Number(el.value || 0);
    });
    ctx.redraw();
  },
};
