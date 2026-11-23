// Simulated visitors for the demo shop. Each visit is a fresh browser (a new
// Dynatrace session) that behaves by the probabilities in sim/config.json:
// window size, how far it scrolls, what it clicks (at a random spot inside the
// element, like a person), and whether it buys. Everything it really did is
// appended to a log, one JSON line per visit: the ground truth sim/report.mjs
// compares with Footprints.
//
// Usage: node sim/visit.mjs --site https://<owner>.github.io/footprints-demo-shop/ [--visits 25] [--log logs/visits.jsonl]
import { chromium } from "playwright";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const config = JSON.parse(readFileSync(new URL("./config.json", import.meta.url), "utf8"));
const SITE = (args.site || "http://localhost:8300/").replace(/\/?$/, "/");
const VISITS = Number(args.visits || config.visitsPerRun);
const PARALLEL = Number(args.parallel || config.parallel);
const LOG = args.log || "logs/visits.jsonl";
const QUIET = !!process.env.QUIET;

const UA = {
  desktop: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  ],
  iphone: ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1"],
  android: ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"],
};

const rnd = Math.random;
const chance = (p) => rnd() < p;
const between = (a, b) => a + rnd() * (b - a);
const pick = (list) => list[Math.floor(rnd() * list.length)];
function weighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = rnd() * total;
  for (const i of items) if ((r -= i.weight) <= 0) return i;
  return items[items.length - 1];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = () => sleep(between(config.pause.minMs, config.pause.maxMs));

/** What the page keeps track of: how far down the visitor saw. */
const TRACK_SCRIPT = `
  window.__fpMax = 0;
  const seen = () => { window.__fpMax = Math.max(window.__fpMax, window.scrollY + window.innerHeight); };
  addEventListener("scroll", seen, { passive: true });
  addEventListener("load", seen);
`;

/** Where every element the report cares about is, keyed by a stable name. */
function boxesInPage() {
  const out = {};
  const add = (key, el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    out[key] = [Math.round(r.left + scrollX), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)];
  };
  const productOf = (a) => (a.getAttribute("href") || "").split("/").pop();
  document.querySelectorAll("[id]").forEach((el) => {
    if (["cart-count", "variant-note", "cookie-banner", "newsletter-thanks", "coupon-message", "cart-body", "cart-total"].includes(el.id)) return;
    add(el.id, el);
  });
  document.querySelectorAll(".main-nav a").forEach((a) => add("nav:" + a.textContent.trim(), a));
  document.querySelectorAll(".category").forEach((a) => add("category:" + a.textContent.trim(), a));
  document.querySelectorAll(".grid .card").forEach((a) => add("card:" + productOf(a), a));
  document.querySelectorAll(".site-footer a").forEach((a) => add("footer:" + a.textContent.trim(), a));
  return out;
}

async function visit(browser, n) {
  const mobile = chance(1 - config.devices.desktopShare);
  const size = weighted(mobile ? config.devices.mobile : config.devices.desktop);
  const ua = pick(UA[mobile ? size.ua : "desktop"]);
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 3 : 1,
    userAgent: ua,
    locale: "en-US",
  });
  await ctx.addInitScript(TRACK_SCRIPT);
  const page = await ctx.newPage();
  const log = { id: randomUUID(), at: new Date().toISOString(), mobile, width: size.width, height: size.height, views: [], converted: false };
  let view = null;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const pathOf = (url) => {
    const p = url.startsWith(SITE) ? "/" + url.slice(SITE.length) : new URL(url).pathname;
    return p.split("#")[0].split("?")[0] || "/";
  };
  async function enter() {
    await page.waitForLoadState("load");
    await sleep(between(700, 1400)); // pictures arrive, the visitor looks
    view = { path: pathOf(page.url()), at: Date.now(), events: [], maxBottom: 0, boxes: {} };
    log.views.push(view);
  }
  async function record() {
    // Before leaving a page: how far it was seen, and where things were.
    try {
      const r = await page.evaluate(`({ max: window.__fpMax || 0, boxes: (${boxesInPage.toString()})() })`);
      view.maxBottom = Math.max(view.maxBottom, Math.round(r.max));
      view.boxes = r.boxes;
    } catch {
      // the page is already gone
    }
  }
  async function scrollTo(y) {
    const target = Math.max(0, y - size.height * between(0.3, 0.6));
    for (let guard = 0; guard < 60; guard++) {
      const now = await page.evaluate("scrollY");
      if (Math.abs(now - target) < 80) break;
      const step = Math.sign(target - now) * Math.min(Math.abs(target - now), between(250, 500));
      await page.mouse.wheel(0, step);
      await sleep(between(120, 320));
      if ((await page.evaluate("scrollY")) === now) break; // bottom of the page
    }
    await sleep(between(300, 900));
  }
  /** Where a section starts on the page (waits for it to be there). */
  async function topOf(selector, offset) {
    await page.locator(selector).first().waitFor({ state: "attached", timeout: 4000 }).catch(() => {});
    return page.evaluate(([sel, off]) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().top + scrollY + off : scrollY;
    }, [selector, offset]);
  }
  async function scrollToBottom() {
    await scrollTo(await page.evaluate("document.documentElement.scrollHeight"));
  }
  /** Clicks a random spot inside the element (5–95% of its box), as a person would. */
  async function click(selector, key, { times = 1, gapMs = [120, 300], kind = "click" } = {}) {
    const el = page.locator(selector).first();
    if (!(await el.isVisible().catch(() => false))) return false;
    const box0 = await el.boundingBox();
    await scrollTo((await page.evaluate("scrollY")) + box0.y);
    // The spot must be on the element itself, not on something over it (the
    // sticky header, the cookie bar): else the log would say a click happened
    // where it did not.
    let x, y;
    for (let attempt = 0; ; attempt++) {
      const box = await el.boundingBox();
      if (!box) return false;
      x = box.x + box.width * between(0.05, 0.95);
      y = box.y + box.height * between(0.05, 0.95);
      const onIt = await el.evaluate((node, [px, py]) => {
        const hit = document.elementFromPoint(px, py);
        return !!hit && (node === hit || node.contains(hit));
      }, [x, y]);
      if (onIt) break;
      if (attempt === 4) return false;
      await el.evaluate((node) => node.scrollIntoView({ block: "center" }));
      await sleep(between(200, 400));
    }
    await page.mouse.move(x, y, { steps: 5 });
    for (let i = 0; i < times; i++) {
      await page.mouse.click(x + between(-2, 2), y + between(-2, 2));
      if (i < times - 1) await sleep(between(gapMs[0], gapMs[1]));
    }
    const sy = await page.evaluate("scrollY").catch(() => 0);
    view.events.push({ kind, key, times, x: Math.round(x), y: Math.round(y + sy), t: Date.now() - view.at });
    return true;
  }
  async function type(selector, key, text) {
    if (!(await click(selector, key, { kind: "type" }))) return false;
    await page.keyboard.type(text, { delay: between(60, 140) });
    return true;
  }
  /** Clicks something that loads another page. */
  async function go(selector, key) {
    await record();
    const ok = await click(selector, key);
    if (!ok) return false;
    await page.waitForURL((u) => pathOf(u.toString()) !== view.path || u.toString().includes("#"), { timeout: 8000 }).catch(() => {});
    if (pathOf(page.url()) !== view.path) await enter();
    return true;
  }

  async function home() {
    const H = config.home;
    // How far this visitor will get on the home page.
    const reach = { hero: true };
    for (const s of ["categories", "bestSellers", "benefits", "newsletter", "footer"]) {
      if (!chance(H.reach[s])) break;
      reach[s] = true;
    }
    await pause();
    if (chance(H.click.heroCta)) return go("#hero-cta", "hero-cta");
    if (chance(H.click.heroSecondary)) {
      await click("#hero-secondary", "hero-secondary");
      reach.bestSellers = true;
      await pause();
    }
    if (chance(H.click.nav)) {
      const i = Math.floor(rnd() * 4);
      if (await page.locator(".main-nav a").nth(i).isVisible()) return go(`.main-nav a >> nth=${i}`, "nav:" + (await page.locator(".main-nav a").nth(i).textContent({ timeout: 3000 })).trim());
    }
    if (chance(H.click.search)) {
      if (await type("#search", "search", pick(["dobsonian", "binoculars", "moon filter", "eyepiece"]))) {
        await page.keyboard.press("Enter");
        await pause();
      }
    }
    if (reach.categories) {
      await scrollTo(await topOf(".categories", 0));
      if (chance(H.click.category)) {
        const i = Math.floor(rnd() * 4);
        return go(`.category >> nth=${i}`, "category:" + (await page.locator(".category").nth(i).textContent({ timeout: 3000 })).trim());
      }
    }
    if (reach.bestSellers) {
      await scrollTo(await topOf("#best-sellers", 200));
      if (chance(H.click.product)) {
        // Earlier cards are clicked more, as on real shops.
        const k = weighted(H.click.productWeights.map((w, idx) => ({ weight: w, idx }))).idx;
        const href = await page.locator("#best-sellers .card").nth(k).getAttribute("href");
        return go(`#best-sellers .card >> nth=${k}`, "card:" + href.split("/").pop());
      }
    }
    if (reach.benefits) await scrollTo(await topOf(".benefits", 100));
    if (reach.newsletter) {
      await scrollTo(await topOf(".newsletter", 100));
      if (chance(H.click.newsletter)) {
        await type("#newsletter-email", "newsletter-email", `visitor${Math.floor(rnd() * 1e6)}@example.com`);
        await click("#newsletter-submit", "newsletter-submit");
        await pause();
      }
    }
    if (reach.footer) {
      await scrollToBottom();
      if (chance(H.click.footer)) {
        const links = page.locator(".site-footer a");
        const i = Math.floor(rnd() * (await links.count()));
        return go(`.site-footer a >> nth=${i}`, "footer:" + (await links.nth(i).textContent({ timeout: 3000 })).trim());
      }
    }
    await pause();
    return false;
  }

  let productPages = 0;
  async function product() {
    const P = config.product;
    productPages++;
    await pause();
    if (chance(P.variant)) {
      // The page takes 450 ms to react to this click.
      const id = pick(["variant-large", "variant-pro"]);
      if (await click("#" + id, id)) await pause();
    }
    if (chance(P.sizeGuide)) {
      const rage = chance(P.sizeGuideRage);
      await click("#size-guide", "size-guide", rage ? { times: 4, gapMs: [150, 300], kind: "rage" } : {});
      await pause();
    }
    if (chance(P.reviews)) await scrollTo(await topOf(".reviews", 200));
    if (chance(P.addToCart)) return go("#add-to-cart", "add-to-cart");
    if (productPages < P.maxProductPages && chance(P.related)) {
      const k = Math.floor(rnd() * 5);
      const href = await page.locator(".grid .card").nth(k).getAttribute("href");
      return go(`.grid .card >> nth=${k}`, "card:" + href.split("/").pop());
    }
    await pause();
    return false;
  }

  async function cart() {
    const C = config.cart;
    await pause();
    if (chance(C.coupon)) {
      await type("#coupon-code", "coupon-code", pick(["WINTER10", "SKY20", "FREESHIP"]));
      await click("#apply-coupon", "apply-coupon");
      await sleep(1500);
    }
    if (chance(C.checkout)) return go("#go-checkout", "go-checkout");
    if (chance(C.continue)) return go("#continue-shopping", "continue-shopping");
    return false;
  }

  async function checkout() {
    await pause();
    const fields = [
      ["#email", "email", `visitor${Math.floor(rnd() * 1e6)}@example.com`],
      ["#first-name", "first-name", pick(["Anna", "Luca", "Maria", "Tom", "Sofia"])],
      ["#last-name", "last-name", pick(["Rossi", "Smith", "Meyer", "Garcia"])],
      ["#address", "address", `${Math.floor(between(1, 200))} Orion Street`],
      ["#city", "city", pick(["Milan", "Vienna", "Boston", "Madrid"])],
      ["#zip", "zip", String(Math.floor(between(10000, 99999)))],
      ["#card", "card", "4111111111111111"],
    ];
    const order = chance(config.checkout.placeOrder);
    const stopAt = order ? fields.length : Math.floor(between(1, fields.length));
    for (const [sel, key, text] of fields.slice(0, stopAt)) {
      await type(sel, key, text);
      await sleep(between(200, 600));
    }
    if (order) {
      const ok = await go("#place-order", "place-order");
      if (ok && view.path.startsWith("/order-confirmed")) log.converted = true;
      return ok;
    }
    return false;
  }

  try {
    const fromNewsletter = chance(config.entry.homeFromNewsletter);
    const startUrl = chance(config.entry.home)
      ? SITE + (fromNewsletter ? "?utm_source=newsletter&utm_medium=email" : "")
      : SITE + "product/" + pick(["SKY-100", "SKY-130", "DOB-200", "BIN-1050", "EYE-KIT"]);
    log.entry = pathOf(startUrl) + (fromNewsletter ? "?utm_source=newsletter" : "");
    await page.goto(startUrl, { waitUntil: "load" });
    await enter();
    // The cookie banner: accept, reject, or leave it there.
    const c = rnd();
    if (c < config.cookies.accept) await click("#cookie-accept", "cookie-accept");
    else if (c < config.cookies.accept + config.cookies.reject) await click("#cookie-reject", "cookie-reject");

    for (let steps = 0; steps < 12; steps++) {
      const p = view.path;
      let moved;
      if (p === "/" || p === "/index.html") moved = await home();
      else if (p.startsWith("/product/")) moved = await product();
      else if (p.startsWith("/cart")) moved = await cart();
      else if (p.startsWith("/checkout")) moved = await checkout();
      else if (p.startsWith("/order-confirmed")) {
        log.converted = true;
        moved = chance(config.confirmed.backToShop) ? await go("#back-to-shop", "back-to-shop") : false;
      } else moved = false;
      if (!moved) break;
    }
    await record();
    // Leaving lets the RUM tag send what it still holds.
    await page.goto("about:blank").catch(() => {});
    await sleep(1500);
  } catch (err) {
    log.failed = String(err && err.message ? err.message : err).slice(0, 300);
  } finally {
    log.pageErrors = errors.length;
    await ctx.close();
  }
  mkdirSync(dirname(LOG), { recursive: true });
  appendFileSync(LOG, JSON.stringify(log) + "\n");
  if (!QUIET) {
    const path = log.views.map((v) => v.path + (v.events.length ? `[${v.events.map((e) => e.key + (e.times > 1 ? "×" + e.times : "")).join(",")}]` : "")).join(" → ");
    console.log(`#${n} ${log.mobile ? "mobile" : "desktop"} ${log.width}x${log.height}${log.converted ? " BUY" : ""}${log.failed ? " FAILED " + log.failed : ""}: ${path}`);
  }
  return log;
}

const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });
let next = 0;
const workers = Array.from({ length: Math.min(PARALLEL, VISITS) }, async () => {
  while (next < VISITS) {
    const n = ++next;
    // Spread the visits out a little.
    await sleep(between(0, 3000));
    await visit(browser, n);
  }
});
await Promise.all(workers);
await browser.close();
console.log(`${VISITS} visits to ${SITE} logged in ${LOG}`);
