/** Local calendar helpers. Weeks start Monday. */

export function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISO(s) {
  const [y, m, d] = String(s).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function today(now = new Date()) {
  return iso(now);
}

export function addDays(isoDate, n) {
  const d = parseISO(isoDate);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function dayOfWeek(isoDate) {
  return parseISO(isoDate).getDay(); // 0 Sun … 6 Sat
}

/** Monday-start offset: Mon=0 … Sun=6 */
export function mondayIndex(isoDate) {
  return (dayOfWeek(isoDate) + 6) % 7;
}

export function startOfWeek(isoDate) {
  return addDays(isoDate, -mondayIndex(isoDate));
}

export function endOfWeek(isoDate) {
  return addDays(startOfWeek(isoDate), 6);
}

export function startOfMonth(isoDate) {
  const d = parseISO(isoDate);
  d.setDate(1);
  return iso(d);
}

export function endOfMonth(isoDate) {
  const d = parseISO(isoDate);
  d.setMonth(d.getMonth() + 1, 0);
  return iso(d);
}

export function lastNDays(isoDate, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(isoDate, -i));
  return out;
}

export function eachDay(fromIso, toIso) {
  const out = [];
  let d = fromIso;
  while (d <= toIso) {
    out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function weekStarts(isoDate, n) {
  const end = startOfWeek(isoDate);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i * 7));
  return out;
}

export function inRange(isoDate, from, to) {
  return isoDate >= from && isoDate <= to;
}

export function sameMonth(a, b) {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function formatLong(isoDate) {
  return parseISO(isoDate).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShort(isoDate) {
  return parseISO(isoDate).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

export function formatWeekday(isoDate) {
  return parseISO(isoDate).toLocaleDateString("en-AU", { weekday: "short" });
}

export function formatMonthYear(isoDate) {
  return parseISO(isoDate).toLocaleDateString("en-AU", {
    month: "long",
    year: "numeric",
  });
}

export function monthLabel(isoDate) {
  return parseISO(isoDate).toLocaleDateString("en-AU", { month: "short" });
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
