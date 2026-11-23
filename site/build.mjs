// Builds the demo shop into docs/ (served by GitHub Pages).
// Usage: node site/build.mjs
// The Dynatrace RUM JavaScript tag, if site/rum-tag.html exists, goes first in
// every page's <head>.
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS, productSvg } from "./products.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "docs");
const rumFile = join(here, "rum-tag.html");
const rumTag = existsSync(rumFile) ? readFileSync(rumFile, "utf8").trim() : "<!-- Dynatrace RUM tag: add site/rum-tag.html and build again -->";

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "product"), { recursive: true });
mkdirSync(join(out, "img"), { recursive: true });
copyFileSync(join(here, "shop.css"), join(out, "shop.css"));
copyFileSync(join(here, "shop.js"), join(out, "shop.js"));
writeFileSync(join(out, ".nojekyll"), "");
for (const p of PRODUCTS) writeFileSync(join(out, "img", `${p.id}.svg`), productSvg(p));
writeFileSync(
  join(out, "img", "hero.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><radialGradient id="g" cx="60%" cy="35%"><stop offset="0" stop-color="#2b4a7a"/><stop offset="1" stop-color="#0b1622"/></radialGradient></defs><rect width="800" height="600" fill="url(#g)"/>${Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 137) % 800}" cy="${(i * 89) % 420}" r="${1 + (i % 3)}" fill="#fff" opacity="${0.4 + (i % 5) / 10}"/>`).join("")}<circle cx="560" cy="170" r="70" fill="#e8d9a8"/><path d="M0 520 L160 430 L300 500 L470 400 L640 480 L800 420 L800 600 L0 600Z" fill="#06101a"/></svg>`,
);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const money = (n) => `$${n.toLocaleString("en-US")}`;

function page({ title, base, body, bodyClass = "" }) {
  return `<!doctype html>
<html lang="en" data-base="${base}">
<head>
${rumTag}
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Skyward Optics (demo)</title>
<link rel="stylesheet" href="${base}shop.css">
<script src="${base}shop.js" defer></script>
</head>
<body class="${bodyClass}">
<div class="demo-note">Demo store for testing Footprints. Nothing here is for sale.</div>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="${base}">Skyward <span>Optics</span></a>
    <nav class="main-nav">
      <a href="${base}product/SKY-130">Telescopes</a>
      <a href="${base}product/BIN-1050">Binoculars</a>
      <a href="${base}product/EYE-KIT">Accessories</a>
      <a href="${base}product/BK-ATLAS">Books</a>
    </nav>
    <form class="search" role="search" onsubmit="return false"><input id="search" type="search" placeholder="Search telescopes, binoculars…" aria-label="Search"></form>
    <a class="cart-link" href="${base}cart">Cart (<span id="cart-count">0</span>)</a>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap cols">
    <div><h4>Shop</h4><a href="${base}product/SKY-100">Refractors</a><a href="${base}product/DOB-200">Dobsonians</a><a href="${base}product/BIN-842">Binoculars</a><a href="${base}product/MNT-EQ3">Mounts</a></div>
    <div><h4>Help</h4><a href="${base}#delivery">Delivery</a><a href="${base}#returns">Returns</a><a href="${base}#contact">Contact us</a></div>
    <div><h4>Learn</h4><a href="${base}product/BK-ATLAS">Night Sky Atlas</a><a href="${base}#guides">Buying guides</a></div>
    <div><h4>Skyward Optics</h4><a href="${base}#about">About</a><a href="${base}#careers">Careers</a></div>
  </div>
</footer>
<div class="cookie" id="cookie-banner" role="dialog" aria-label="Cookies">
  <span>We use cookies to improve your visit.</span>
  <button data-answer="accepted" id="cookie-accept">Accept all</button>
  <button data-answer="rejected" id="cookie-reject">Only necessary</button>
</div>
</body>
</html>
`;
}

function card(p, base) {
  return `<a class="card" href="${base}product/${p.id}"><div class="pic" data-picture="${base}img/${p.id}.svg" role="img" aria-label="${esc(p.name)}"></div><div class="info"><p class="name">${esc(p.name)}</p><div class="price">${money(p.price)}</div></div></a>`;
}

// Home
writeFileSync(
  join(out, "index.html"),
  page({
    title: "Telescopes and binoculars",
    base: "./",
    body: `<section class="hero" style="background:#0f1e2e">
  <div class="wrap">
    <div>
      <h1>Winter sky sale: up to 30% off telescopes</h1>
      <p>Long nights, clear skies. Everything you need to see Saturn's rings this season.</p>
      <a class="btn btn-primary" id="hero-cta" href="./product/DOB-200">Shop the sale</a>
      <a class="btn btn-ghost" id="hero-secondary" href="#best-sellers" style="margin-left:12px">See best sellers</a>
    </div>
    <div class="hero-art" style="background-image:url('./img/hero.svg')" role="img" aria-label="Night sky"></div>
  </div>
</section>
<section class="block">
  <div class="wrap">
    <h2>Shop by category</h2>
    <div class="categories">
      <a class="category" href="./product/SKY-130">Telescopes</a>
      <a class="category" href="./product/BIN-1050">Binoculars</a>
      <a class="category" href="./product/EYE-KIT">Accessories</a>
      <a class="category" href="./product/BK-ATLAS">Books</a>
    </div>
  </div>
</section>
<section class="block" id="best-sellers">
  <div class="wrap">
    <h2>Best sellers</h2>
    <div class="grid">${PRODUCTS.map((p) => card(p, "./")).join("")}</div>
  </div>
</section>
<section class="block">
  <div class="wrap">
    <h2>Why Skyward</h2>
    <div class="benefits">
      <div class="benefit"><h3>Free delivery</h3><p>On every order over $99, in 2 to 4 days.</p></div>
      <div class="benefit"><h3>60-day returns</h3><p>Not the right fit? Send it back, no questions asked.</p></div>
      <div class="benefit"><h3>Expert advice</h3><p>Our astronomers answer within a day.</p></div>
    </div>
  </div>
</section>
<section class="block">
  <div class="wrap">
    <div class="newsletter">
      <div><h2 style="margin:0 0 6px">Clear-sky alerts</h2><p style="margin:0">A short email when the sky is clear where you live.</p></div>
      <form id="newsletter-form"><input id="newsletter-email" type="email" placeholder="you@example.com" aria-label="Email" required><button class="btn btn-primary" id="newsletter-submit" type="submit">Sign up</button></form>
      <div class="newsletter-thanks" id="newsletter-thanks">Thanks, you are on the list.</div>
    </div>
  </div>
</section>`,
  }),
);

// Products
for (const p of PRODUCTS) {
  const related = PRODUCTS.filter((q) => q.id !== p.id && q.category === p.category).concat(PRODUCTS.filter((q) => q.category !== p.category)).slice(0, 5);
  writeFileSync(
    join(out, "product", `${p.id}.html`),
    page({
      title: p.name,
      base: "../",
      body: `<div class="wrap">
  <div class="product">
    <div class="pic" data-picture="../img/${p.id}.svg" role="img" aria-label="${esc(p.name)}"></div>
    <div>
      <h1>${esc(p.name)}</h1>
      <div class="price">${money(p.price)}</div>
      <div class="field"><label>Aperture</label>
        <div class="variants" id="variants"><button type="button" class="variant selected" id="variant-standard">Standard</button><button type="button" class="variant" id="variant-large">Large +$120</button><button type="button" class="variant" id="variant-pro">Pro +$260</button></div>
        <div id="variant-note" style="font-size:13px;color:#555;margin-top:4px"></div></div>
      <div class="field"><label for="qty">Quantity</label><input id="qty" type="number" min="1" value="1" style="max-width:100px"></div>
      <a class="size-guide" id="size-guide" href="#">Which size is right for me?</a>
      <div class="buy-row">
        <button class="btn btn-dark" id="add-to-cart" data-id="${p.id}" data-name="${esc(p.name)}" data-price="${p.price}">Add to cart</button>
        <span style="font-size:14px;color:#0f5c3a">In stock, ships tomorrow</span>
      </div>
      <table class="specs"><tr><td>Category</td><td>${p.category}</td></tr><tr><td>Product code</td><td>${p.id}</td></tr><tr><td>Warranty</td><td>2 years</td></tr></table>
    </div>
  </div>
  <section class="block reviews">
    <h2>Reviews</h2>
    <div class="review"><strong>Great first scope.</strong> Easy to set up, sharp views of the Moon.</div>
    <div class="review"><strong>Solid build.</strong> Heavier than I expected, but very stable.</div>
    <div class="review"><strong>Good value.</strong> The included eyepiece is fine to start with.</div>
  </section>
  <section class="block">
    <h2>You may also like</h2>
    <div class="grid">${related.map((q) => card(q, "../")).join("")}</div>
  </section>
</div>`,
    }),
  );
}

// Cart
writeFileSync(
  join(out, "cart.html"),
  page({
    title: "Your cart",
    base: "./",
    body: `<div class="wrap" style="padding-top:32px">
  <h1>Your cart</h1>
  <table class="cart-lines"><thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody id="cart-body"></tbody></table>
  <p style="font-size:20px">Total: <strong id="cart-total">$0</strong></p>
  <div class="coupon"><input id="coupon-code" placeholder="Coupon code" aria-label="Coupon code"><button class="btn btn-ghost" id="apply-coupon" type="button">Apply</button></div>
  <div class="message" id="coupon-message"></div>
  <div class="buy-row"><a class="btn btn-primary" id="go-checkout" href="./checkout">Checkout</a><a class="btn btn-ghost" id="continue-shopping" href="./">Continue shopping</a></div>
</div>`,
  }),
);

// Checkout
writeFileSync(
  join(out, "checkout.html"),
  page({
    title: "Checkout",
    base: "./",
    body: `<div class="wrap" style="padding-top:32px">
  <h1>Checkout</h1>
  <form class="checkout-form" id="checkout-form">
    <div class="field wide"><label for="email">Email</label><input id="email" type="email" required></div>
    <div class="field"><label for="first-name">First name</label><input id="first-name" required></div>
    <div class="field"><label for="last-name">Last name</label><input id="last-name" required></div>
    <div class="field wide"><label for="address">Address</label><input id="address" required></div>
    <div class="field"><label for="city">City</label><input id="city" required></div>
    <div class="field"><label for="zip">Zip code</label><input id="zip" required></div>
    <div class="field wide"><label for="card">Card number</label><input id="card" inputmode="numeric" required></div>
    <div class="field wide"><button class="btn btn-primary" id="place-order" type="submit">Place order</button></div>
  </form>
</div>`,
  }),
);

// Order confirmed (the conversion goal)
writeFileSync(
  join(out, "order-confirmed.html"),
  page({
    title: "Order confirmed",
    base: "./",
    body: `<div class="wrap" style="padding:48px 24px">
  <h1>Thank you, your order is confirmed</h1>
  <p>This is a demo store: nothing will be shipped.</p>
  <a class="btn btn-dark" id="back-to-shop" href="./">Back to the shop</a>
</div>`,
  }),
);

console.log(`Built ${PRODUCTS.length + 4} pages into docs/ (RUM tag: ${existsSync(rumFile) ? "yes" : "not yet"})`);
