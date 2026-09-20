import {
  addDays,
  dayOfWeek,
  daysBetween,
  eachDay,
  endOfMonth,
  endOfWeek,
  inRange,
  iso,
  lastNDays,
  mondayIndex,
  parseISO,
  sameMonth,
  startOfMonth,
  startOfWeek,
  today,
  weekStarts,
} from "./dates.js";
import { uid } from "./ui.js";

export const KEY = "pulseboard-v1";
export const EXPENSE_CATS = [
  "Food",
  "Fuel",
  "Rent",
  "Training",
  "Trading costs",
  "Cigarettes",
  "Alcohol",
  "Other",
];
export const HABIT_CATS = ["Health", "Training", "Work", "Money", "Personal"];
export const CAT_COLORS = {
  Food: "#e8b86d",
  Fuel: "#7eb8d4",
  Rent: "#8b93a7",
  Training: "#f7931a",
  "Trading costs": "#c084fc",
  Cigarettes: "#e06c75",
  Alcohol: "#d4a574",
  Other: "#5dcaa5",
  Health: "#5dcaa5",
  Work: "#c084fc",
  Money: "#ffb347",
  Personal: "#e8b86d",
  Trading: "#f7931a",
};

let state = null;

function mulberry32(a) {
  return function rng() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickAmt(rng, min, max) {
  return Math.round((min + rng() * (max - min)) * 100) / 100;
}

export function buildSeed(now = new Date()) {
  const t = today(now);
  const rng = mulberry32(20260920);
  const habits = [
    { id: "h-stretch", name: "Morning stretch", category: "Health", frequency: "daily", color: "#5dcaa5", target: null },
    { id: "h-water", name: "Drink 2L water", category: "Health", frequency: "daily", color: "#7eb8d4", target: 1 },
    { id: "h-karate", name: "Karate / movement", category: "Training", frequency: "daily", color: "#f7931a", target: null },
    { id: "h-cigs", name: "No cigs before noon", category: "Health", frequency: "daily", color: "#e06c75", target: null },
    { id: "h-ig", name: "Study IG / markets", category: "Work", frequency: "daily", color: "#c084fc", target: null },
    { id: "h-save", name: "Park $50 in savings", category: "Money", frequency: "weekly", color: "#ffb347", target: null },
    { id: "h-journal", name: "Journal 5 minutes", category: "Personal", frequency: "daily", color: "#e8b86d", target: null },
  ];

  const habitLogs = Object.fromEntries(habits.map((h) => [h.id, {}]));
  const days = lastNDays(t, 90);
  const karateDays = new Set([1, 3, 5]); // Mon Wed Fri

  days.forEach((d, idx) => {
    const fromEnd = days.length - 1 - idx;
    const dow = dayOfWeek(d);
    const weekend = dow === 0 || dow === 6;
    if (fromEnd < 12 || rng() < (weekend ? 0.7 : 0.9)) habitLogs["h-stretch"][d] = 1;
    if (fromEnd < 4 || rng() < 0.78) habitLogs["h-water"][d] = 1;
    if (karateDays.has(dow) && rng() < 0.88) habitLogs["h-karate"][d] = 1;
    else if (!karateDays.has(dow) && rng() < 0.08) habitLogs["h-karate"][d] = 1;
    if (fromEnd < 3 || rng() < 0.58) habitLogs["h-cigs"][d] = 1;
    const igP = weekend ? 0.35 : 0.82;
    if (fromEnd < 6 || rng() < igP) habitLogs["h-ig"][d] = 1;
    if (fromEnd < 2 || rng() < 0.62) habitLogs["h-journal"][d] = 1;
  });
  weekStarts(t, 14).forEach((w, i) => {
    if (i >= 2 || rng() < 0.85) {
      const day = addDays(w, 4); // Friday
      habitLogs["h-save"][day] = 1;
    }
  });

  const goals = [
    {
      id: "g-ig",
      title: "Start IG Trading",
      category: "Trading",
      target: 6,
      unit: "checklist items",
      deadline: addDays(t, 28),
      current: 4,
      baseline: 0,
      invert: false,
      history: [],
    },
    {
      id: "g-cigs",
      title: "Cut cigarettes",
      category: "Health",
      target: 70,
      unit: "cigs / week",
      deadline: addDays(t, 56),
      current: 108,
      baseline: 140,
      invert: true,
      history: [],
    },
    {
      id: "g-karate",
      title: "3 karate classes / week",
      category: "Training",
      target: 3,
      unit: "classes",
      deadline: addDays(t, 7),
      current: 3,
      baseline: 0,
      invert: false,
      history: [],
    },
    {
      id: "g-save",
      title: "Emergency savings",
      category: "Money",
      target: 3000,
      unit: "AUD",
      deadline: addDays(t, 180),
      current: 1240,
      baseline: 380,
      invert: false,
      history: [],
    },
  ];
  goals.forEach((g) => {
    for (let i = 8; i >= 0; i--) {
      const d = addDays(t, -i * 7);
      const p = (8 - i) / 8;
      let v;
      if (g.invert) v = Math.round(g.baseline - (g.baseline - g.current) * p);
      else v = Math.round((g.baseline || 0) + (g.current - (g.baseline || 0)) * p);
      g.history.push({ date: d, value: v });
    }
  });

  const budgets = {
    Food: 300,
    Fuel: 520,
    Rent: 1235,
    Training: 60,
    "Trading costs": 40,
    Cigarettes: 520,
    Alcohol: 80,
    Other: 120,
  };

  const expenses = [];
  const incomes = [];
  const deposits = [];
  const openingDate = addDays(startOfMonth(t), -150);
  let savings = 380;
  const openBal = { date: openingDate, amount: 380 };

  eachDay(openingDate, t).forEach((d) => {
    const dow = dayOfWeek(d);
    if (dow === 5) {
      const amt = 50;
      savings += amt;
      deposits.push({
        id: uid(),
        amount: amt,
        date: d,
        note: "Weekly park",
      });
    }
    if (dow === 3 && rng() < 0.15) {
      const extra = Math.round(20 + rng() * 40);
      savings += extra;
      deposits.push({ id: uid(), amount: extra, date: d, note: "OT leftover" });
    }
  });
  const drift = 1240 - savings;
  openBal.amount += drift;
  savings = 1240;
  goals.find((g) => g.id === "g-save").current = savings;

  eachDay(addDays(t, -45), t).forEach((d) => {
    const dow = dayOfWeek(d);
    if (dow === 1) {
      expenses.push({ id: uid(), amount: 285, category: "Rent", date: d, note: "Weekly rent" });
    }
    if (dow === 2 && rng() < 0.55) {
      expenses.push({ id: uid(), amount: pickAmt(rng, 55, 95), category: "Fuel", date: d, note: "Shell / 7-Eleven" });
    }
    if (rng() < 0.72) {
      expenses.push({
        id: uid(),
        amount: pickAmt(rng, 9, 32),
        category: "Food",
        date: d,
        note: rng() < 0.4 ? "Woolies" : "Lunch",
      });
    }
    if (dow === 4 && rng() < 0.35) {
      expenses.push({ id: uid(), amount: 15, category: "Training", date: d, note: "Dojo" });
    }
    if (rng() < 0.12) {
      expenses.push({ id: uid(), amount: pickAmt(rng, 6, 28), category: "Other", date: d, note: "Bits" });
    }
    if (dow === 5 && sameMonth(d, t) && rng() < 0.4) {
      expenses.push({ id: uid(), amount: 14.99, category: "Trading costs", date: d, note: "Data / IG bits" });
    }
    if (dow === 3 && parseISO(d).getDate() <= 7) {
      incomes.push({ id: uid(), amount: 1302.4, date: d, note: "Bevchain take-home (est.)" });
    }
  });

  const cigs = {};
  const drinks = [];
  const cigNote = {};
  lastNDays(t, 84).forEach((d) => {
    const fromEnd = daysBetween(d, t);
    const dow = dayOfWeek(d);
    let n;
    if (fromEnd === 12) n = 0;
    else if (fromEnd === 4) n = 32;
    else {
      n = Math.round(9 + rng() * 10);
      if (dow === 0 || dow === 6) n += Math.round(rng() * 5);
      if (fromEnd > 40) n += 3;
    }
    cigs[d] = n;
    const cigCost = (n / 20) * 40;
    if (n > 0) {
      expenses.push({
        id: uid(),
        amount: Math.round(cigCost * 100) / 100,
        category: "Cigarettes",
        date: d,
        note: `${n} cigs`,
      });
    }
    let std = 0;
    let type = "beer";
    if (fromEnd === 12) {
      std = 0;
    } else if (dow === 5 || dow === 6) {
      std = fromEnd === 2 ? 6 : Math.round(1 + rng() * 3);
      type = rng() < 0.5 ? "beer" : rng() < 0.5 ? "mixed" : "spirits";
    } else if (rng() < 0.1) {
      std = 1;
      type = "wine";
    }
    if (std) {
      const note = fromEnd === 2 ? "Long Friday — overdid it" : "";
      drinks.push({ id: uid(), date: d, type, drinks: std, note });
      expenses.push({
        id: uid(),
        amount: std * 8,
        category: "Alcohol",
        date: d,
        note: `${std} ${type}`,
      });
    }
  });
  cigs[t] = cigs[t] ?? 8;
  cigNote[addDays(t, -4)] = "Stress after a long shift";
  cigNote[addDays(t, -12)] = "Clean day — karate night";

  const trades = [
    { market: "AUDUSD", dir: "Buy", entry: 0.6624, stop: 0.6598, target: 0.667, size: 10, result: "Win", r: 1.2, notes: "Asia session fade" },
    { market: "XAUUSD", dir: "Sell", entry: 3682, stop: 3695, target: 3650, size: 10, result: "Loss", r: 1, notes: "News spike" },
    { market: "AU200", dir: "Buy", entry: 8820, stop: 8788, target: 8890, size: 10, result: "Win", r: 2.0, notes: "Open drive" },
    { market: "BTC", dir: "Sell", entry: 108400, stop: 109200, target: 106800, size: 10, result: "Win", r: 0.8, notes: "Range fade" },
    { market: "AUDUSD", dir: "Sell", entry: 0.6641, stop: 0.6662, target: 0.66, size: 10, result: "Loss", r: 1, notes: "Cut at rule" },
    { market: "XAUUSD", dir: "Buy", entry: 3648, stop: 3632, target: 3688, size: 10, result: "Win", r: 1.5, notes: "London dip" },
    { market: "AU200", dir: "Sell", entry: 8864, stop: 8890, target: 8800, size: 10, result: "BE", r: 0, notes: "Scratched" },
    { market: "AUDUSD", dir: "Buy", entry: 0.6611, stop: 0.6589, target: 0.6655, size: 10, result: "Win", r: 1.0, notes: "Session high break" },
    { market: "BTC", dir: "Buy", entry: 107200, stop: 106400, target: 109000, size: 10, result: "Loss", r: 1, notes: "Weekend chop" },
    { market: "XAUUSD", dir: "Buy", entry: 3660, stop: 3644, target: 3702, size: 10, result: "Open", r: 0, notes: "Working — trail if +1R" },
  ].map((tr, i) => {
    const date = addDays(t, -(18 - i * 2));
    const pnl =
      tr.result === "Win" ? tr.r * tr.size : tr.result === "Loss" ? -tr.r * tr.size : 0;
    return {
      id: uid(),
      datetime: date + "T10:30",
      date,
      ...tr,
      pnl,
    };
  });

  const sessions = [];
  weekStarts(t, 10).forEach((w, wi) => {
    [0, 2, 4].forEach((off, j) => {
      const d = addDays(w, off);
      if (d > t) return;
      const attended = !(wi === 3 && j === 2) && rng() > 0.08;
      sessions.push({
        id: uid(),
        date: d,
        type: "class",
        minutes: 75,
        attended,
        notes: attended ? "" : "Rostered extra shift",
      });
    });
  });
  // Ensure this week has 3 classes ready: Mon/Wed attended, Fri attended if <= today
  const ws = startOfWeek(t);
  ["class", "class", "class"].forEach((_, i) => {
    const d = addDays(ws, i * 2);
    if (d > t) return;
    const existing = sessions.find((s) => s.date === d);
    if (existing) {
      existing.attended = true;
      existing.notes = "";
    } else {
      sessions.push({ id: uid(), date: d, type: "class", minutes: 75, attended: true, notes: "" });
    }
  });

  goals.find((g) => g.id === "g-karate").current = sessions.filter(
    (s) => s.attended && inRange(s.date, ws, endOfWeek(t))
  ).length;

  return {
    version: 1,
    habits,
    habitLogs,
    goals,
    expenses,
    incomes,
    deposits,
    openingSavings: openBal,
    budgets,
    weeklySaveRate: 50,
    trading: {
      startingCapital: 1000,
      status: "paper",
      readiness: {
        account: true,
        id: true,
        demo: true,
        rules: true,
        maxLoss: false,
        journal: false,
      },
      risk: { maxRiskPct: 1, maxDailyLoss: 50, maxOpen: 2 },
      trades,
      weeklyReview: {
        worked: "Cutting losers at the stop without moving it. Gold dip buys were clean.",
        fix: "No trades into local news. Size is fine — stop chasing the second entry.",
      },
    },
    intake: {
      cigCap: 140,
      packCost: 40,
      cigsPerPack: 20,
      drinkCap: 10,
      drinkCost: 8,
      cigs,
      cigNotes: cigNote,
      drinks,
    },
    karate: {
      usualDays: [1, 3, 5],
      targetPerWeek: 3,
      sessions,
    },
  };
}

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw);
      if (state?.version === 1 && Array.isArray(state.habits)) return state;
    }
  } catch {
    /* ignore */
  }
  state = buildSeed();
  persist();
  return state;
}

export function persist() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function mutate(fn) {
  load();
  fn(state);
  persist();
  return state;
}

export function resetDemo() {
  state = buildSeed();
  persist();
  return state;
}

export function clearAll() {
  state = {
    version: 1,
    habits: [],
    habitLogs: {},
    goals: [],
    expenses: [],
    incomes: [],
    deposits: [],
    openingSavings: { date: today(), amount: 0 },
    budgets: Object.fromEntries(EXPENSE_CATS.map((c) => [c, 0])),
    weeklySaveRate: 50,
    trading: {
      startingCapital: 1000,
      status: "preparing",
      readiness: { account: false, id: false, demo: false, rules: false, maxLoss: false, journal: false },
      risk: { maxRiskPct: 1, maxDailyLoss: 50, maxOpen: 2 },
      trades: [],
      weeklyReview: { worked: "", fix: "" },
    },
    intake: {
      cigCap: 140,
      packCost: 40,
      cigsPerPack: 20,
      drinkCap: 10,
      drinkCost: 8,
      cigs: {},
      cigNotes: {},
      drinks: [],
    },
    karate: { usualDays: [1, 3, 5], targetPerWeek: 3, sessions: [] },
  };
  persist();
  return state;
}

/* ---------- derived ---------- */

export function habitStats(habit, logs, t = today()) {
  const map = logs[habit.id] || {};
  const daily = habit.frequency === "daily";
  let current = 0;
  let best = 0;
  let run = 0;
  if (daily) {
    const days = lastNDays(t, 180);
    for (let i = days.length - 1; i >= 0; i--) {
      if (map[days[i]]) {
        run++;
        best = Math.max(best, run);
      } else {
        if (i === days.length - 1) {
          /* today not done yet — streak can still count through yesterday */
          continue;
        }
        if (current === 0) current = run;
        run = 0;
      }
    }
    if (current === 0) current = run;
    const last30 = lastNDays(t, 30);
    const hit = last30.filter((d) => map[d]).length;
    return { current, best, pct30: (hit / 30) * 100, doneToday: !!map[t] };
  }
  const weeks = weekStarts(t, 26);
  weeks.forEach((w, i) => {
    const done = eachDay(w, addDays(w, 6)).some((d) => map[d]);
    if (done) {
      run++;
      best = Math.max(best, run);
    } else {
      if (i === weeks.length - 1) return;
      if (current === 0) current = run;
      run = 0;
    }
  });
  if (current === 0) current = run;
  const last4 = weeks.slice(-4);
  const hit = last4.filter((w) => eachDay(w, addDays(w, 6)).some((d) => map[d])).length;
  return { current, best, pct30: (hit / 4) * 100, doneToday: !!map[t] };
}

export function completionsByWeek(habits, logs, t = today(), n = 12) {
  const weeks = weekStarts(t, n);
  return weeks.map((w) => {
    const days = eachDay(w, addDays(w, 6));
    let nDone = 0;
    habits.forEach((h) => {
      const map = logs[h.id] || {};
      days.forEach((d) => {
        if (map[d]) nDone++;
      });
    });
    return { week: w, label: iso(parseISO(w)).slice(5), value: nDone };
  });
}

export function goalProgress(g) {
  if (g.invert) {
    const span = (g.baseline ?? 0) - g.target;
    if (span <= 0) return g.current <= g.target ? 1 : 0;
    return Math.max(0, Math.min(1, ((g.baseline ?? 0) - g.current) / span));
  }
  if (!g.target) return 0;
  return Math.max(0, Math.min(1, g.current / g.target));
}

export function goalStatus(g, t = today()) {
  const p = goalProgress(g);
  if (p >= 1) return "done";
  const left = Math.max(1, daysBetween(t, g.deadline));
  const total = Math.max(1, daysBetween(g.history?.[0]?.date || t, g.deadline));
  const expected = 1 - left / total;
  if (p + 0.05 >= expected) return "on-track";
  return "at-risk";
}

export function monthSpend(state, t = today()) {
  const from = startOfMonth(t);
  const to = endOfMonth(t);
  return state.expenses.filter((e) => inRange(e.date, from, to));
}

export function weekSpend(state, t = today()) {
  const from = startOfWeek(t);
  const to = endOfWeek(t);
  return state.expenses.filter((e) => inRange(e.date, from, to));
}

export function sum(arr, key = "amount") {
  return arr.reduce((a, x) => a + Number(x[key] || 0), 0);
}

export function spendByCategory(list) {
  const map = Object.fromEntries(EXPENSE_CATS.map((c) => [c, 0]));
  list.forEach((e) => {
    map[e.category] = (map[e.category] || 0) + Number(e.amount);
  });
  return map;
}

export function monthlyBudgetTotal(state) {
  return Object.values(state.budgets).reduce((a, b) => a + Number(b || 0), 0);
}

export function weeklyBudgetTotal(state) {
  return (monthlyBudgetTotal(state) * 12) / 52;
}

export function savingsTotal(state) {
  return Number(state.openingSavings?.amount || 0) + sum(state.deposits);
}

export function savingsSeries(state, t = today()) {
  const start = addDays(startOfMonth(t), -150);
  const events = [
    { date: state.openingSavings?.date || start, amount: Number(state.openingSavings?.amount || 0) },
    ...state.deposits.map((d) => ({ date: d.date, amount: Number(d.amount) })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const months = [];
  const cursor = startOfMonth(start);
  let d = cursor;
  while (d <= startOfMonth(t)) {
    months.push(d);
    const dt = parseISO(d);
    dt.setMonth(dt.getMonth() + 1);
    d = iso(dt);
  }
  return months.map((m) => {
    const end = endOfMonth(m) < t ? endOfMonth(m) : t;
    const bal = events.filter((e) => e.date <= end).reduce((a, e) => a + e.amount, 0);
    return { date: m, value: bal };
  });
}

export function tradePnl(tr) {
  if (tr.result === "Win") return Math.abs(Number(tr.r) || 0) * Number(tr.size || 0);
  if (tr.result === "Loss") return -Math.abs(Number(tr.r) || 0) * Number(tr.size || 0);
  return 0;
}

export function tradingStats(state) {
  const trades = state.trading.trades || [];
  const closed = trades.filter((t) => t.result && t.result !== "Open");
  const wins = closed.filter((t) => t.result === "Win");
  const losses = closed.filter((t) => t.result === "Loss");
  const closedPnl = closed.reduce((a, t) => a + tradePnl(t), 0);
  const openPnl = trades.filter((t) => t.result === "Open").reduce((a, t) => a + Number(t.pnl || 0), 0);
  const equity = Number(state.trading.startingCapital || 0) + closedPnl + openPnl;
  const decided = wins.length + losses.length;
  return {
    trades,
    closed,
    wins: wins.length,
    losses: losses.length,
    be: closed.filter((t) => t.result === "BE").length,
    open: trades.filter((t) => t.result === "Open").length,
    closedPnl,
    openPnl,
    equity,
    winRate: decided ? (wins.length / decided) * 100 : 0,
    started: trades.length > 0,
  };
}

export function equityCurve(state) {
  const start = Number(state.trading.startingCapital || 0);
  const trades = [...(state.trading.trades || [])].sort((a, b) =>
    (a.datetime || a.date).localeCompare(b.datetime || b.date)
  );
  const points = [{ label: "Start", value: start }];
  let eq = start;
  trades.forEach((tr, i) => {
    if (tr.result === "Open") return;
    eq += tradePnl(tr);
    points.push({ label: `${i + 1}`, value: Math.round(eq * 100) / 100, date: tr.date });
  });
  return points;
}

export function cigCostPer(state) {
  const pack = Number(state.intake.cigsPerPack || 20);
  const cost = Number(state.intake.packCost || 40);
  return pack ? cost / pack : 0;
}

export function weekCigs(state, t = today()) {
  const from = startOfWeek(t);
  return eachDay(from, endOfWeek(t)).reduce((a, d) => a + Number(state.intake.cigs[d] || 0), 0);
}

export function weekDrinks(state, t = today()) {
  const from = startOfWeek(t);
  const to = endOfWeek(t);
  return state.intake.drinks
    .filter((d) => inRange(d.date, from, to))
    .reduce((a, d) => a + Number(d.drinks || 0), 0);
}

export function nextKarate(state, t = today()) {
  const usual = state.karate.usualDays || [1, 3, 5];
  const attended = new Set(
    (state.karate.sessions || []).filter((s) => s.attended).map((s) => s.date)
  );
  for (let i = 0; i < 14; i++) {
    const d = addDays(t, i);
    const dow = dayOfWeek(d);
    if (usual.includes(dow) && !attended.has(d)) return d;
  }
  const planned = (state.karate.sessions || [])
    .filter((s) => s.date >= t && !s.attended)
    .sort((a, b) => a.date.localeCompare(b.date));
  return planned[0]?.date || addDays(startOfWeek(t), 7);
}

export function summary(state, t = today()) {
  const daily = state.habits.filter((h) => h.frequency === "daily");
  const done = daily.filter((h) => state.habitLogs[h.id]?.[t]).length;
  const streaks = state.habits.map((h) => habitStats(h, state.habitLogs, t).current);
  const ts = tradingStats(state);
  return {
    habitsDone: done,
    habitsTotal: daily.length,
    streak: streaks.length ? Math.max(...streaks) : 0,
    weekSpend: sum(weekSpend(state, t)),
    weekBudget: weeklyBudgetTotal(state),
    savings: savingsTotal(state),
    tradingPnl: ts.closedPnl,
    tradingStarted: ts.started || state.trading.status !== "preparing",
    tradingStatus: state.trading.status,
    cigsToday: Number(state.intake.cigs[t] || 0),
    drinksWeek: weekDrinks(state, t),
    nextKarate: nextKarate(state, t),
  };
}
