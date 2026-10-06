/* Dunder Mifflin order slip (cart).
   Plain script, no build step. The cart is kept in this browser's localStorage,
   so it survives a page reload. No payment is taken.

   ---- Settings: edit these two lines ---------------------------------------
   salesPhone: shown in the header, hero, footer and order slip. Leave "" to hide it.
   orderEmail: if set, "Submit order request" opens the customer's email app with
               the order filled in, addressed here. Leave "" and the customer gets a
               printable order slip and is asked to call or bring it to sales.     */
var SITE_CONFIG = {
  salesPhone: "800-252-5547",
  orderEmail: ""
};
/* --------------------------------------------------------------------------- */

(function () {
  "use strict";

  var STORE_KEY = "dm-cart-v1";
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var money = function (n) { return "$" + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); };

  // Product catalog, read from the data-* attributes the page already carries.
  var products = {};
  $$(".item[data-id]").forEach(function (el) {
    products[el.dataset.id] = {
      id: el.dataset.id,
      name: el.dataset.name,
      unit: el.dataset.unit,
      price: parseFloat(el.dataset.price),
      stock: parseInt(el.dataset.stock, 10) || 999,
      img: el.dataset.img || ""
    };
  });

  // ---- storage (wrapped: private windows can throw) ----
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      var out = {};
      Object.keys(raw).forEach(function (id) {
        var q = parseInt(raw[id], 10);
        if (products[id] && q > 0) out[id] = Math.min(q, products[id].stock);
      });
      return out;
    } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  var cart = load();

  // ---- cart operations ----
  function setQty(id, q) {
    var p = products[id];
    if (!p) return;
    q = Math.max(0, Math.min(parseInt(q, 10) || 0, p.stock));
    if (q === 0) delete cart[id]; else cart[id] = q;
    save();
    render();
  }
  function add(id) {
    var p = products[id];
    var have = cart[id] || 0;
    if (have >= p.stock) { toast("Only " + p.stock + " in stock"); return; }
    setQty(id, have + 1);
    toast("Added to your slip: " + p.name);
  }
  function count() { return Object.keys(cart).reduce(function (s, id) { return s + cart[id]; }, 0); }
  function subtotal() { return Object.keys(cart).reduce(function (s, id) { return s + cart[id] * products[id].price; }, 0); }

  // ---- rendering ----
  var linesEl = $("[data-cart-lines]");
  function render() {
    var ids = Object.keys(cart).sort();
    $$("[data-cart-count]").forEach(function (el) { el.textContent = count(); });
    $(".cart-btn").classList.toggle("has-items", ids.length > 0);
    $("[data-cart-empty]").hidden = ids.length > 0;
    $("[data-cart-foot]").hidden = ids.length === 0;
    $("[data-cart-subtotal]").textContent = money(subtotal());

    linesEl.innerHTML = "";
    ids.forEach(function (id) {
      var p = products[id], q = cart[id];
      var li = document.createElement("li");
      li.className = "line";
      li.dataset.id = id;
      li.innerHTML =
        '<div class="line-thumb">' + (p.img ? '<img alt="" src="' + p.img + '">' : '<span>' + p.id.slice(1) + '</span>') + '</div>' +
        '<div class="line-main">' +
          '<p class="line-name"></p>' +
          '<p class="line-meta"></p>' +
          '<div class="qty">' +
            '<button type="button" data-dec aria-label="One fewer">&minus;</button>' +
            '<input type="number" inputmode="numeric" min="0" max="' + p.stock + '" value="' + q + '" aria-label="Quantity">' +
            '<button type="button" data-inc aria-label="One more">+</button>' +
          '</div>' +
        '</div>' +
        '<div class="line-end">' +
          '<b class="line-total">' + money(q * p.price) + '</b>' +
          '<button type="button" class="line-remove" data-remove>Remove</button>' +
        '</div>';
      $(".line-name", li).textContent = p.name;
      $(".line-meta", li).textContent = money(p.price) + " each" + (q >= p.stock ? " · max in stock" : "");
      linesEl.appendChild(li);
    });

    // reflect cart state on each catalog button
    $$(".item[data-id]").forEach(function (el) {
      var q = cart[el.dataset.id] || 0;
      var btn = $(".add-btn", el);
      btn.classList.toggle("in-cart", q > 0);
      btn.textContent = q > 0 ? "Add more \u00b7 " + q + " in slip" : "Add to cart";
    });
  }

  linesEl.addEventListener("click", function (e) {
    var li = e.target.closest(".line"); if (!li) return;
    var id = li.dataset.id;
    if (e.target.closest("[data-inc]")) {
      if ((cart[id] || 0) >= products[id].stock) toast("Only " + products[id].stock + " in stock");
      setQty(id, (cart[id] || 0) + 1);
    }
    else if (e.target.closest("[data-dec]")) setQty(id, (cart[id] || 0) - 1);
    else if (e.target.closest("[data-remove]")) setQty(id, 0);
  });
  linesEl.addEventListener("change", function (e) {
    var li = e.target.closest(".line");
    if (li && e.target.matches("input")) setQty(li.dataset.id, e.target.value);
  });

  $$(".add-btn").forEach(function (btn) {
    btn.addEventListener("click", function () { add(btn.closest(".item").dataset.id); });
  });

  // ---- drawer open/close and views ----
  var drawer = $("#cart"), scrim = $(".cart-scrim"), lastFocus = null;
  function show(view) {
    $$(".cart-view", drawer).forEach(function (v) { v.hidden = v.dataset.view !== view; });
    if (view === "details") {
      $("[data-cart-summary]").textContent = count() + (count() === 1 ? " item" : " items") + " · subtotal " + money(subtotal());
    }
  }
  function open() {
    lastFocus = document.activeElement;
    show("items");
    drawer.hidden = false; scrim.hidden = false;
    requestAnimationFrame(function () { drawer.classList.add("open"); scrim.classList.add("open"); });
    document.body.classList.add("cart-locked");
    $(".cart-x").focus();
  }
  function close() {
    drawer.classList.remove("open"); scrim.classList.remove("open");
    document.body.classList.remove("cart-locked");
    setTimeout(function () { drawer.hidden = true; scrim.hidden = true; }, 220);
    if (lastFocus) lastFocus.focus();
  }
  $$("[data-cart-open]").forEach(function (b) { b.addEventListener("click", open); });
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-cart-close]")) close();
    var go = e.target.closest("[data-go]");
    if (go) {
      show(go.dataset.go);
      if (go.dataset.go === "details") { var f = $("input[name=name]", drawer); if (f) f.focus(); }
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !drawer.hidden) close();
    if (e.key === "Tab" && !drawer.hidden) { // keep focus inside the drawer
      var f = $$("button, input, textarea, a[href]", drawer).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  $("[data-cart-clear]").addEventListener("click", function () { cart = {}; save(); render(); });

  // ---- order request ----
  function slipNo() { return "DM-" + Date.now().toString().slice(-6); }
  $("[data-slip-no]").textContent = "No. 1725";

  $(".cart-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var form = e.target, data = {};
    ["name", "company", "email", "phone", "notes"].forEach(function (k) { data[k] = form.elements[k].value.trim(); });
    var err = $("[data-form-error]");
    if (!data.name || !/^\S+@\S+\.\S+$/.test(data.email)) {
      err.textContent = "Please add your name and a valid email so we can confirm the order.";
      err.hidden = false;
      return;
    }
    err.hidden = true;

    var no = slipNo(), total = subtotal();
    var lines = Object.keys(cart).sort().map(function (id) {
      var p = products[id];
      return cart[id] + " x " + p.name + " @ " + money(p.price) + " = " + money(cart[id] * p.price);
    });
    var body = [
      "Order request " + no,
      "",
      lines.join("\n"),
      "",
      "Subtotal: " + money(total),
      "",
      "Name: " + data.name,
      data.company ? "Company: " + data.company : "",
      "Email: " + data.email,
      data.phone ? "Phone: " + data.phone : "",
      data.notes ? "Notes: " + data.notes : ""
    ].filter(function (l, i, a) { return l !== "" || (a[i - 1] !== ""); }).join("\n");

    // printable copy of the slip
    buildPrint(no, data, total);

    var msg = $("[data-done-msg]");
    if (SITE_CONFIG.orderEmail) {
      window.location.href = "mailto:" + SITE_CONFIG.orderEmail +
        "?subject=" + encodeURIComponent("Order request " + no) +
        "&body=" + encodeURIComponent(body);
      msg.innerHTML = "Your email app should open with order request <b></b> filled in. Send it and a salesperson will confirm delivery and billing.";
    } else {
      msg.innerHTML = "Your order request <b></b> for <b></b> is ready. Print the slip and give it to your salesperson" +
        (SITE_CONFIG.salesPhone ? ", or call sales to place it." : ".");
      $$("b", msg)[1].textContent = money(total);
    }
    $$("b", msg)[0].textContent = no;
    $("[data-done-name]").textContent = data.name.split(" ")[0];

    cart = {}; save(); render(); form.reset();
    show("done");
  });

  function buildPrint(no, data, total) {
    var old = $(".print-slip"); if (old) old.remove();
    var el = document.createElement("section");
    el.className = "print-slip";
    var rows = Object.keys(cart).sort().map(function (id) {
      var p = products[id];
      return "<tr><td>" + cart[id] + "</td><td></td><td>" + money(p.price) + "</td><td>" + money(cart[id] * p.price) + "</td></tr>";
    }).join("");
    el.innerHTML = "<h1>Dunder Mifflin Paper Company, Inc.</h1><p>Order request <b></b> &middot; " + new Date().toLocaleDateString() + "</p>" +
      "<p class='ps-who'></p><table><thead><tr><th>Qty</th><th>Product</th><th>Each</th><th>Total</th></tr></thead><tbody>" + rows +
      "</tbody><tfoot><tr><td colspan='3'>Subtotal</td><td>" + money(total) + "</td></tr></tfoot></table>" +
      "<p>No payment taken. Your salesperson confirms pricing, delivery and billing.</p>";
    $("b", el).textContent = no;
    $(".ps-who", el).textContent = [data.name, data.company, data.email, data.phone].filter(Boolean).join(" · ");
    var names = Object.keys(cart).sort();
    $$("tbody tr", el).forEach(function (tr, i) { tr.children[1].textContent = products[names[i]].name; });
    document.body.appendChild(el);
  }
  $("[data-print]").addEventListener("click", function () { window.print(); });

  // ---- optional sales phone ----
  if (SITE_CONFIG.salesPhone) {
    var tel = "tel:" + SITE_CONFIG.salesPhone.replace(/[^\d+]/g, "");
    $$("[data-sales-phone-text]").forEach(function (el) { el.textContent = SITE_CONFIG.salesPhone; });
    $$("[data-sales-phone-link]").forEach(function (el) { el.href = tel; el.hidden = false; });
    $$("[data-sales-phone-block]").forEach(function (el) { el.hidden = false; });
  }

  // ---- toast ----
  var toastEl = $("[data-toast]"), toastTimer;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  render();
})();
