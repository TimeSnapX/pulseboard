import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(path.join("C:\\Users\\kenny\\bitmail", "package.json"));
const { chromium } = require("playwright");

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, "test-results");
await mkdir(out, { recursive: true });

const url = "http://127.0.0.1:4176";
const errors = [];
const browser = await chromium.launch({ headless: true });

function listen(page) {
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
}

async function run(label, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  listen(page);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  const title = await page.locator("h1").innerText();
  if (!/PulseBoard/i.test(title)) errors.push(label + " title: " + title);

  const summary = await page.locator("#summary").innerText();
  if (!/Habits today/i.test(summary)) errors.push(label + " missing habits chip");
  if (!/Next karate/i.test(summary)) errors.push(label + " missing karate chip");

  const habits = await page.locator("#main").innerText();
  if (!/Morning stretch/i.test(habits)) errors.push(label + " missing seeded habit");
  if (!(await page.locator(".heat-cell.on").count())) errors.push(label + " heatmap empty");
  await shot(page, `${label}-01-habits`);

  await page.click('[data-tab="goals"]');
  await page.waitForTimeout(200);
  const goals = await page.locator("#main").innerText();
  for (const g of ["Start IG Trading", "Cut cigarettes", "3 karate classes", "Emergency savings"]) {
    if (!goals.includes(g.split(" /")[0]) && !goals.includes(g)) errors.push(label + " missing goal " + g);
  }
  await shot(page, `${label}-02-goals`);

  await page.click('[data-tab="money"]');
  await page.waitForTimeout(250);
  const money = await page.locator("#main").innerText();
  if (!/Spent this week/i.test(money)) errors.push(label + " money missing week spend");
  if (!/Projected 12-month/i.test(money)) errors.push(label + " money missing projection");
  await shot(page, `${label}-03-money`);

  await page.click('[data-tab="trading"]');
  await page.waitForTimeout(250);
  const trading = await page.locator("#main").innerText();
  if (!/Paper trading/i.test(trading) && !/paper/i.test(trading)) errors.push(label + " trading status");
  if (!/AUDUSD/i.test(trading) || !/XAUUSD/i.test(trading)) errors.push(label + " missing sample trades");
  if (!/Equity curve/i.test(trading)) errors.push(label + " missing equity curve");
  await shot(page, `${label}-04-trading`);

  await page.locator('[data-act="trading.add"]').click();
  await page.waitForSelector("#modal[open]");
  await page.fill('[name="entry"]', "0.66");
  await page.fill('[name="stop"]', "0.658");
  await page.fill('[name="target"]', "0.67");
  await page.selectOption('[name="result"]', "Win");
  await page.fill('[name="r"]', "1.2");
  await page.click('#modal button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector("#modal")?.open);
  await page.waitForTimeout(200);
  await shot(page, `${label}-05-trading-after-add`);

  await page.click('[data-tab="intake"]');
  await page.waitForTimeout(250);
  const intake = await page.locator("#main").innerText();
  if (!/Cigarettes/i.test(intake) || !/Alcohol/i.test(intake)) errors.push(label + " intake sections");
  const before = await page.locator(".intake-hero .n").first().innerText();
  await page.click('[data-act="intake.cigs"][data-n="1"]');
  await page.waitForTimeout(150);
  const after = await page.locator(".intake-hero .n").first().innerText();
  if (Number(after) !== Number(before) + 1) errors.push(label + " cig +1 " + before + " -> " + after);
  await shot(page, `${label}-06-intake`);

  await page.click('[data-tab="karate"]');
  await page.waitForTimeout(250);
  const karate = await page.locator("#main").innerText();
  if (!/This week/i.test(karate)) errors.push(label + " karate week");
  if (!(await page.locator(".week-grid .day-cell").count())) errors.push(label + " karate week empty");
  await page.click('[data-act="karate.tonight"]');
  await page.waitForTimeout(200);
  const afterK = await page.locator("#main").innerText();
  if (!/Marked tonight|In/i.test(afterK)) errors.push(label + " mark tonight did not stick");
  await shot(page, `${label}-07-karate`);

  await page.click('[data-tab="habits"]');
  await page.click('[data-act="habits.add"]');
  await page.waitForSelector("#modal[open]");
  await page.fill('[name="name"]', "Breathing reset");
  await page.click('#modal button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector("#modal")?.open);
  const afterH = await page.locator("#main").innerText();
  if (!/Breathing reset/i.test(afterH)) errors.push(label + " add habit failed");
  await shot(page, `${label}-08-habits-added`);

  await context.close();
}

await run("desktop", { width: 1440, height: 900 });
await run("mobile", { width: 390, height: 844 });

await browser.close();
if (errors.length) {
  console.error("FAIL\n" + errors.join("\n"));
  process.exit(1);
}
console.log("OK — screenshots in test-results/");
