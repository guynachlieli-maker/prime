(function () {
  "use strict";
  var C = window.STORE_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ils = function (n) { return "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: 0 }); };
  var esc = function (s) { var d = document.createElement("div"); d.textContent = String(s); return d.innerHTML; };

  /* ---------- טקסטים מהקונפיג ---------- */
  $$(".gDays").forEach(function (e) { e.textContent = C.guaranteeDays; });
  ["#gDays", "#gDays2", "#gDays3"].forEach(function (s) { $(s).textContent = C.guaranteeDays; });
  $("#shipDays").textContent = C.shippingDays;
  $$(".shipDays").forEach(function (e) { e.textContent = C.shippingDays; });

  var c = C.contact;
  var biz = [c.businessName, c.businessId && ("ע.מ./ח.פ. " + c.businessId), c.address, c.email].filter(Boolean).join(" · ");
  $("#bizLine").textContent = biz;
  if (c.email) { var fm = $("#footMail"); fm.href = "mailto:" + c.email; fm.hidden = false; }
  if (c.whatsapp) {
    var wa = $("#wa");
    wa.href = "https://wa.me/" + c.whatsapp.replace(/\D/g, "") + "?text=" + encodeURIComponent("היי, יש לי שאלה על " + C.brand);
    wa.hidden = false;
  }

  /* ---------- חבילות ---------- */
  var box = $("#bundles");
  var selected = C.bundles.filter(function (b) { return b.default; })[0] || C.bundles[0];
  C.bundles.forEach(function (b) {
    var each = Math.round(b.price / b.qty);
    var save = b.compareAt - b.price;
    var lab = document.createElement("label");
    lab.className = "bundle";
    lab.innerHTML =
      (b.badge ? '<span class="b-badge">' + esc(b.badge) + "</span>" : "") +
      '<input type="radio" name="bundle" value="' + esc(b.key) + '"' + (b === selected ? " checked" : "") + ">" +
      '<span class="b-txt"><span class="b-title">' + esc(b.title) + "</span>" +
      '<span class="b-each">' + (b.qty > 1 ? ils(each) + " ליחידה" : "משלוח חינם") + "</span><br>" +
      (save > 0 ? '<span class="b-save">חוסכים ' + ils(save) + "</span>" : "") + "</span>" +
      '<span class="b-price"><b>' + ils(b.price) + "</b><s>" + ils(b.compareAt) + "</s></span>";
    box.appendChild(lab);
  });
  function refresh() {
    $("#buySub").textContent = selected.title + " · " + ils(selected.price) + " · משלוח חינם";
    $("#stickyPrice").textContent = ils(selected.price);
    $("#stickyCompare").textContent = ils(selected.compareAt);
  }
  box.addEventListener("change", function (e) {
    selected = C.bundles.filter(function (b) { return b.key === e.target.value; })[0];
    refresh();
    track("ViewContent", selected);
  });
  refresh();

  /* ---------- ספירה לאחור (אמיתית, לפי מועד משלוח) ---------- */
  var end = new Date(C.giftDeadline).getTime();
  if (end && end > Date.now()) {
    $("#deadline").hidden = false;
    $("#deadlineLabel").textContent = C.giftDeadlineLabel;
    var pad = function (n) { return n < 10 ? "0" + n : n; };
    var tick = function () {
      var ms = end - Date.now();
      if (ms <= 0) { $("#deadline").hidden = true; return; }
      var d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      $("#clock").textContent = (d ? d + (d === 1 ? " יום, " : " ימים, ") : "") + pad(h) + ":" + pad(m) + ":" + pad(s);
    };
    tick(); setInterval(tick, 1000);
  }

  /* ---------- ביקורות אמיתיות בלבד ---------- */
  if (C.reviews && C.reviews.length) {
    var avg = C.reviews.reduce(function (a, r) { return a + r.rating; }, 0) / C.reviews.length;
    $("#ratingSum").textContent = "★ " + avg.toFixed(1) + " מתוך 5, לפי " + C.reviews.length + " ביקורות";
    $("#reviewList").innerHTML = C.reviews.map(function (r) {
      return '<article class="review"><div class="stars" aria-label="' + r.rating + ' כוכבים">' +
        "★★★★★".slice(0, r.rating) + "</div><p>" + esc(r.text) + "</p><b>" + esc(r.name) + "</b> " +
        (r.verified ? '<span class="verified">✔ רכישה מאומתת</span>' : "") + "</article>";
    }).join("");
    $("#reviews").hidden = false;
  }

  /* ---------- סרגל דביק ---------- */
  var sticky = $("#sticky"), buy = $("#buyBtn");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      var show = !en[0].isIntersecting && en[0].boundingClientRect.top < 0;
      sticky.classList.toggle("show", show);
      sticky.setAttribute("aria-hidden", show ? "false" : "true");
      $("#stickyBtn").tabIndex = show ? 0 : -1;
    }).observe(buy);
  }
  $("#stickyBtn").addEventListener("click", function () { checkout(); });

  /* ---------- קנייה: Shopify Storefront API → קופה מאובטחת ---------- */
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 6000);
  }
  function checkout() {
    var S = C.shopify;
    if (!S.domain || !S.storefrontToken || !selected.variantId) {
      toast("החנות עוד לא מחוברת לשופיפיי. ממלאים domain, storefrontToken ו-variantId בקובץ config.js.");
      return;
    }
    track("InitiateCheckout", selected);
    buy.disabled = true;
    var input = { lines: [{ merchandiseId: selected.variantId, quantity: 1 }] };
    if (S.autoDiscountCode) input.discountCodes = [S.autoDiscountCode];
    var utm = location.search.slice(1);
    if (utm) input.attributes = [{ key: "landing_params", value: utm.slice(0, 250) }];

    fetch("https://" + S.domain + "/api/" + S.apiVersion + "/graphql.json", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Storefront-Access-Token": S.storefrontToken },
      body: JSON.stringify({
        query: "mutation($input: CartInput!){cartCreate(input:$input){cart{checkoutUrl} userErrors{message}}}",
        variables: { input: input }
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var res = j.data && j.data.cartCreate;
      if (res && res.cart && res.cart.checkoutUrl) {
        var url = res.cart.checkoutUrl;
        url += (url.indexOf("?") > -1 ? "&" : "?") + "locale=he";
        location.href = url;
      } else {
        throw new Error((res && res.userErrors && res.userErrors[0] && res.userErrors[0].message) || (j.errors && j.errors[0].message) || "cart");
      }
    }).catch(function (err) {
      buy.disabled = false;
      console.error(err);
      toast("משהו השתבש במעבר לקופה. נסו שוב בעוד רגע, או כתבו לנו בוואטסאפ.");
    });
  }
  buy.addEventListener("click", checkout);

  /* ---------- פיקסלים (נטענים רק אם הוגדר מזהה) ---------- */
  var T = C.tracking;
  function load(src) { var s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s); }
  if (T.metaPixelId) {
    !function (f, b, e, v, n) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; }(window, document);
    load("https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", T.metaPixelId); fbq("track", "PageView");
  }
  if (T.ga4Id) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    load("https://www.googletagmanager.com/gtag/js?id=" + T.ga4Id);
    gtag("js", new Date()); gtag("config", T.ga4Id);
  }
  if (T.tiktokPixelId) {
    !function (w, t) { w.TiktokAnalyticsObject = t; var tt = w[t] = w[t] || []; tt.methods = ["page", "track", "identify"]; tt.setAndDefer = function (o, m) { o[m] = function () { o.push([m].concat([].slice.call(arguments))); }; }; tt.methods.forEach(function (m) { tt.setAndDefer(tt, m); }); }(window, "ttq");
    load("https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + T.tiktokPixelId + "&lib=ttq");
    ttq.page();
  }
  function track(ev, b) {
    var val = { value: b.price, currency: "ILS", content_name: C.brandLatin + " x" + b.qty };
    try {
      if (window.fbq) fbq("track", ev, val);
      if (window.gtag) gtag("event", ev === "InitiateCheckout" ? "begin_checkout" : "view_item", { value: b.price, currency: "ILS" });
      if (window.ttq) ttq.track(ev, val);
    } catch (e) { /* לא מפילים את הדף בגלל פיקסל */ }
  }
})();
