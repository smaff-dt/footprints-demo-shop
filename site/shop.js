// Behaviour shared by every page of the demo shop. The friction built in on
// purpose is marked FRICTION: it is what Footprints should find.
(function () {
  var BASE = document.documentElement.getAttribute("data-base") || "./";

  // Busy wait: keeps the page from reacting, like heavy code on a real site.
  function busy(ms) {
    var end = performance.now() + ms;
    while (performance.now() < end) {
      /* nothing */
    }
  }

  // Cart, kept in the browser.
  function readCart() {
    try {
      return JSON.parse(localStorage.getItem("demo-cart") || "[]");
    } catch (e) {
      return [];
    }
  }
  function writeCart(lines) {
    try {
      localStorage.setItem("demo-cart", JSON.stringify(lines));
    } catch (e) {
      /* private mode */
    }
  }
  function cartCount() {
    return readCart().reduce(function (n, l) { return n + l.qty; }, 0);
  }
  function showCount() {
    var el = document.getElementById("cart-count");
    if (el) el.textContent = String(cartCount());
  }

  // Cookie banner, fixed at the bottom until answered.
  function cookies() {
    var banner = document.getElementById("cookie-banner");
    if (!banner) return;
    var answered = null;
    try {
      answered = localStorage.getItem("demo-cookies");
    } catch (e) {
      /* ignore */
    }
    if (!answered) banner.classList.add("show");
    banner.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        try {
          localStorage.setItem("demo-cookies", b.getAttribute("data-answer"));
        } catch (e) {
          /* ignore */
        }
        banner.classList.remove("show");
      });
    });
  }

  // Pictures shown late by a script, as many shops do (lazy loading by hand).
  function latePictures() {
    var boxes = document.querySelectorAll("[data-picture]");
    boxes.forEach(function (box, i) {
      var url = box.getAttribute("data-picture");
      var show = function () {
        box.style.backgroundImage = 'url("' + url + '")';
      };
      var delay = 200 + (i % 5) * 250;
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          if (entries.some(function (e) { return e.isIntersecting; })) {
            io.disconnect();
            setTimeout(show, delay);
          }
        }, { rootMargin: "200px" });
        io.observe(box);
      } else {
        setTimeout(show, delay);
      }
    });
  }

  // Newsletter: a confirmation, nothing is sent.
  function newsletter() {
    var form = document.getElementById("newsletter-form");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.style.display = "none";
      document.getElementById("newsletter-thanks").style.display = "block";
    });
  }

  // Product page.
  function productPage() {
    var add = document.getElementById("add-to-cart");
    if (!add) return;
    // FRICTION (slow response): choosing an aperture recalculates everything, 450 ms.
    document.querySelectorAll(".variant").forEach(function (b) {
      b.addEventListener("click", function () {
        busy(450);
        document.querySelectorAll(".variant").forEach(function (o) { o.classList.toggle("selected", o === b); });
        document.getElementById("variant-note").textContent = "Selected: " + b.textContent;
      });
    });
    // FRICTION (dead click): looks like a link, does nothing.
    document.getElementById("size-guide").addEventListener("click", function (e) {
      e.preventDefault();
    });
    add.addEventListener("click", function () {
      var lines = readCart();
      var id = add.getAttribute("data-id");
      var line = lines.find(function (l) { return l.id === id; });
      var qty = parseInt(document.getElementById("qty").value, 10) || 1;
      if (line) line.qty += qty;
      else lines.push({ id: id, name: add.getAttribute("data-name"), price: Number(add.getAttribute("data-price")), qty: qty });
      writeCart(lines);
      location.href = BASE + "cart";
    });
  }

  // Cart page.
  function cartPage() {
    var body = document.getElementById("cart-body");
    if (!body) return;
    var lines = readCart();
    var total = 0;
    body.innerHTML = "";
    if (lines.length === 0) {
      body.innerHTML = '<tr><td colspan="4">Your cart is empty.</td></tr>';
    }
    lines.forEach(function (l) {
      total += l.price * l.qty;
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + l.name + "</td><td>" + l.qty + "</td><td>$" + l.price + "</td><td>$" + l.price * l.qty + "</td>";
      body.appendChild(tr);
    });
    document.getElementById("cart-total").textContent = "$" + total;
    // FRICTION (error after click): the coupon service is missing, so the
    // request fails (404) and the page throws an error.
    document.getElementById("apply-coupon").addEventListener("click", function () {
      var msg = document.getElementById("coupon-message");
      var code = document.getElementById("coupon-code").value || "WINTER";
      fetch(BASE + "api/coupon?code=" + encodeURIComponent(code))
        .then(function (r) {
          if (!r.ok) throw new Error("Coupon service failed: HTTP " + r.status);
          return r.json();
        })
        .catch(function (err) {
          msg.textContent = "Sorry, we could not check this coupon.";
          setTimeout(function () {
            throw err;
          });
        });
    });
  }

  // Checkout page.
  function checkoutPage() {
    var form = document.getElementById("checkout-form");
    if (!form) return;
    // FRICTION (slow response): checking the zip code on every key, 300 ms.
    document.getElementById("zip").addEventListener("input", function () {
      busy(300);
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      writeCart([]);
      location.href = BASE + "order-confirmed";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    showCount();
    cookies();
    latePictures();
    newsletter();
    productPage();
    cartPage();
    checkoutPage();
  });
})();
