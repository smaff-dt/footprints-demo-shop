// What Footprints should show, worked out from what the simulated visitors
// really did (the logs written by sim/visit.mjs), with Footprints' own
// definitions:
// - Visits: visits that saw the page.
// - Clicks, Visits clicking, Click share: clicks on the element (typing in a
//   field starts with a click), visits with at least one, share of the page's
//   clicks. The cookie banner is left out (not in Footprints' pictures).
// - Exposure: visits that saw at least half of the element (scrolled far
//   enough), or clicked it, over the page's visits.
// - Click rate: visits clicking over visits that saw it.
// - Conversion: of the visits clicking, the share that reached the order
//   confirmation afterwards.
// - Rage clicks: visits that clicked it 3+ times in 2 s, over visits clicking.
// - Errors after click: visits with an error within 3 s of clicking, over
//   visits clicking (only Apply coupon fails, every time).
// - Slow response: visits whose slowest moment, over 0.2 s, was on it, over
//   the page's visits (the aperture buttons take 450 ms, each key in the zip
//   code 300 ms; nothing else is slow).
//
// Usage: node sim/report.mjs [logs folder or files…] [--since 2026-11-24] [--out report.md]
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const since = opt("since");
const outFile = opt("out") || "report.md";
const inputs = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const files = (inputs.length ? inputs : ["logs"]).flatMap((p) =>
  statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".jsonl")).map((f) => join(p, f)) : [p],
);
const visits = files
  .flatMap((f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)))
  .filter((v) => !v.failed && (!since || v.at >= since));

const SLOW = { "variant-large": 450, "variant-pro": 450, zip: 300 };
const ERRORS = new Set(["apply-coupon"]);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "–");

function analyse(pageKey) {
  // Every visit that saw the page; its views of it, merged.
  const seen = [];
  for (const v of visits) {
    const views = v.views.filter((w) => pageKey(w.path));
    if (views.length) seen.push({ v, views });
  }
  const els = new Map();
  let totalClicks = 0;
  const slowestOn = new Map();
  for (const { v, views } of seen) {
    const confirmedAt = v.views.findIndex((w) => w.path.startsWith("/order-confirmed"));
    const perVisit = new Map();
    let slowest = null;
    for (const w of views) {
      const viewIndex = v.views.indexOf(w);
      for (const e of w.events) {
        const r = perVisit.get(e.key) || { clicks: 0, rage: false, converted: false };
        r.clicks += e.times || 1;
        if (e.kind === "rage") r.rage = true;
        if (confirmedAt > viewIndex) r.converted = true;
        perVisit.set(e.key, r);
        if (!e.key.startsWith("cookie-")) totalClicks += e.times || 1;
        if (SLOW[e.key] && (!slowest || SLOW[e.key] > SLOW[slowest])) slowest = e.key;
      }
      for (const [key, box] of Object.entries(w.boxes || {})) {
        const r = perVisit.get(key) || { clicks: 0, rage: false, converted: false };
        if (w.maxBottom >= box[1] + box[3] / 2) r.saw = true;
        perVisit.set(key, r);
      }
    }
    if (slowest) slowestOn.set(slowest, (slowestOn.get(slowest) || 0) + 1);
    for (const [key, r] of perVisit) {
      const t = els.get(key) || { clicks: 0, clicking: 0, saw: 0, converted: 0, rage: 0, errors: 0 };
      t.clicks += r.clicks;
      if (r.clicks) t.clicking++;
      if (r.saw || r.clicks) t.saw++;
      if (r.clicks && r.converted) t.converted++;
      if (r.rage) t.rage++;
      if (r.clicks && ERRORS.has(key)) t.errors++;
      els.set(key, t);
    }
  }
  return { visits: seen.length, totalClicks, els, slowestOn };
}

function table(name, pageKey) {
  const a = analyse(pageKey);
  if (!a.visits) return "";
  // The cookie banner is left out: Footprints hides bars fixed to the bottom in its pictures.
  const rows = [...a.els.entries()].filter(([key, t]) => t.clicks > 0 && !key.startsWith("cookie-")).sort((x, y) => y[1].clicks - x[1].clicks);
  let md = `## ${name}\n\n${a.visits} visits, ${a.totalClicks} clicks.\n\n`;
  md += "| Element | Clicks | Visits clicking | Click share | Exposure | Click rate | Conversion | Rage clicks | Errors after click | Slow response |\n";
  md += "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n";
  for (const [key, t] of rows) {
    md += `| ${key} | ${t.clicks} | ${t.clicking} | ${pct(t.clicks, a.totalClicks)} | ${pct(t.saw, a.visits)} | ${pct(t.clicking, t.saw)} | ${pct(t.converted, t.clicking)} | ${pct(t.rage, t.clicking)} | ${pct(t.errors, t.clicking)} | ${a.slowestOn.has(key) ? pct(a.slowestOn.get(key), a.visits) : "–"} |\n`;
  }
  return md + "\n";
}

function scrollReach(path) {
  // Desktop visits by window width: how far down 75%, 50% and 25% of them saw.
  const byWidth = new Map();
  for (const v of visits) {
    if (v.mobile) continue;
    const ws = v.views.filter((w) => w.path === path);
    if (!ws.length) continue;
    const list = byWidth.get(v.width) || [];
    list.push(Math.max(...ws.map((w) => w.maxBottom)));
    byWidth.set(v.width, list);
  }
  let md = `## Scroll reach on ${path} (desktop)\n\n| Window width | Visits | 75% see down to | 50% see down to | 25% see down to |\n| ---: | ---: | ---: | ---: | ---: |\n`;
  for (const [w, list] of [...byWidth.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const s = list.sort((a, b) => b - a);
    const at = (q) => s[Math.max(0, Math.ceil(q * s.length) - 1)];
    md += `| ${w} px | ${s.length} | ${at(0.75)} px | ${at(0.5)} px | ${at(0.25)} px |\n`;
  }
  return md + "\n";
}

const total = visits.length;
const converted = visits.filter((v) => v.converted).length;
const mobile = visits.filter((v) => v.mobile).length;
const first = visits.map((v) => v.at).sort()[0];
const last = visits.map((v) => v.at).sort().at(-1);
let md = `# What Footprints should show\n\nFrom ${total} simulated visits, ${first ? first.slice(0, 16).replace("T", " ") : "–"} to ${last ? last.slice(0, 16).replace("T", " ") : "–"} UTC. ${pct(mobile, total)} on phones; ${converted} orders (${pct(converted, total)} of visits).\n\n`;
md += "Dynatrace may count a few visits less (sessions it drops or has not closed yet): compare shares, not exact counts.\n\n";
md += table("Home page (/)", (p) => p === "/");
md += scrollReach("/");
md += table("Product pages (path starts with /product/)", (p) => p.startsWith("/product/"));
md += table("Cart (/cart)", (p) => p.startsWith("/cart"));
md += table("Checkout (/checkout)", (p) => p.startsWith("/checkout"));
writeFileSync(outFile, md);
console.log(`${total} visits → ${outFile}`);
