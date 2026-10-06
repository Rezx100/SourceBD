/* ==========================================================================
   circle0 — front-end interactions
   Depends on GSAP 3 + ScrollTrigger (loaded from cdnjs before this file).
   Everything degrades: without JS or GSAP the pages render fully.
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = typeof window.gsap !== "undefined";
  if (hasGSAP && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  /* ---------- helpers ---------- */
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = doc.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      doc.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("is-visible");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove("is-visible"); }, 3200);
  }
  window.circle0 = { toast: toast };

  /* ---------- header: scrolled state + mobile nav ---------- */
  (function header() {
    var header = $(".site-header");
    if (!header) return;
    var toggle = $(".nav-toggle", header);
    var nav = $("#primary-nav", header);

    function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
    onScroll();
    on(window, "scroll", onScroll, { passive: true });

    if (toggle && nav) {
      function setOpen(open) {
        toggle.setAttribute("aria-expanded", String(open));
        nav.classList.toggle("is-open", open);
        doc.body.style.overflow = open && window.innerWidth < 960 ? "hidden" : "";
      }
      on(toggle, "click", function () { setOpen(toggle.getAttribute("aria-expanded") !== "true"); });
      on(doc, "keydown", function (e) { if (e.key === "Escape") setOpen(false); });
      on(window, "resize", function () { if (window.innerWidth >= 960) setOpen(false); });
      $$("a", nav).forEach(function (a) { on(a, "click", function () { setOpen(false); }); });
    }

    // mark the current page in the nav
    var path = location.pathname.split("/").pop() || "index.html";
    $$(".nav__link").forEach(function (a) {
      var href = a.getAttribute("href");
      if (href === path || (path === "" && href === "index.html")) a.setAttribute("aria-current", "page");
    });
  })();

  /* ---------- hero: split words + rise ---------- */
  (function heroSplit() {
    var targets = $$(".split-words");
    if (!targets.length) return;
    targets.forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.textContent = "";
      words.forEach(function (w) {
        var span = doc.createElement("span");
        span.className = "word";
        span.textContent = w;
        el.appendChild(span);
      });
      el.setAttribute("aria-label", words.join(" "));
    });
    if (!hasGSAP || reduceMotion) return;
    targets.forEach(function (el) {
      el.classList.add("is-ready");
      window.gsap.to(el.querySelectorAll(".word"), {
        opacity: 1, y: 0, rotate: 0, duration: 0.9, ease: "power3.out", stagger: 0.05, delay: 0.1,
        onComplete: function () { el.classList.remove("is-ready"); window.gsap.set(el.querySelectorAll(".word"), { clearProps: "all" }); }
      });
    });
    var hero = $(".hero");
    if (hero) {
      window.gsap.from($$(".hero__copy, .hero__actions, .hero-panel", hero), {
        opacity: 0, y: 24, duration: 0.9, ease: "power3.out", stagger: 0.12, delay: 0.45, clearProps: "all"
      });
    }
  })();

  /* ---------- scroll reveals ---------- */
  (function reveals() {
    var items = $$("[data-reveal]");
    if (!items.length) return;
    if (!hasGSAP || reduceMotion || !window.ScrollTrigger) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    // group siblings that share a parent so they stagger together
    var groups = new Map();
    items.forEach(function (el) {
      var key = el.getAttribute("data-reveal-group") || el.parentNode;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });
    groups.forEach(function (els) {
      window.gsap.to(els, {
        opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1, overwrite: true,
        scrollTrigger: { trigger: els[0], start: "top 88%", once: true },
        onComplete: function () { els.forEach(function (el) { el.classList.add("is-in"); window.gsap.set(el, { clearProps: "transform,opacity" }); }); }
      });
    });
  })();

  /* ---------- panel parallax ---------- */
  (function parallax() {
    if (!hasGSAP || reduceMotion || !window.ScrollTrigger) return;
    $$(".panel[data-parallax]").forEach(function (panel) {
      var bg = $(".panel__bg", panel);
      if (!bg) return;
      window.gsap.fromTo(bg, { yPercent: -6 }, {
        yPercent: 6, ease: "none",
        scrollTrigger: { trigger: panel, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  })();

  /* ---------- counters ---------- */
  (function counters() {
    var els = $$("[data-count]");
    if (!els.length) return;
    function format(n, decimals) {
      return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    els.forEach(function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var decimals = (el.getAttribute("data-count").split(".")[1] || "").length;
      var prefix = el.getAttribute("data-prefix") || "";
      var suffix = el.getAttribute("data-suffix") || "";
      el.textContent = prefix + format(target, decimals) + suffix;
      if (!hasGSAP || reduceMotion || !window.ScrollTrigger) return;
      var obj = { v: 0 };
      window.gsap.to(obj, {
        v: target, duration: 1.6, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%", once: true },
        onUpdate: function () { el.textContent = prefix + format(obj.v, decimals) + suffix; }
      });
    });
  })();

  /* ---------- carousels (track-based, snapping) ---------- */
  (function carousels() {
    $$("[data-carousel]").forEach(function (root) {
      var viewport = $(".carousel__viewport", root);
      var track = $(".carousel__track", root);
      if (!viewport || !track) return;
      var items = Array.prototype.slice.call(track.children);
      var prev = $("[data-carousel-prev]", root);
      var next = $("[data-carousel-next]", root);
      var dotsWrap = $(".carousel__dots", root);
      var index = 0;
      var dots = [];

      if (dotsWrap) {
        dotsWrap.setAttribute("role", "tablist");
        items.forEach(function (_, i) {
          var b = doc.createElement("button");
          b.type = "button";
          b.className = "carousel__dot";
          b.setAttribute("role", "tab");
          b.setAttribute("aria-label", "Go to item " + (i + 1));
          on(b, "click", function () { go(i); });
          dotsWrap.appendChild(b);
          dots.push(b);
        });
      }

      function maxIndex() {
        var gap = parseFloat(getComputedStyle(track).gap) || 0;
        var itemW = items[0].getBoundingClientRect().width + gap;
        var visible = Math.max(1, Math.floor((viewport.clientWidth + gap) / itemW));
        return Math.max(0, items.length - visible);
      }
      function go(i, instant) {
        index = clamp(i, 0, maxIndex());
        var gap = parseFloat(getComputedStyle(track).gap) || 0;
        var x = -(items[0].getBoundingClientRect().width + gap) * index;
        if (hasGSAP && !reduceMotion && !instant) {
          window.gsap.to(track, { x: x, duration: 0.7, ease: "power3.out" });
        } else {
          track.style.transform = "translateX(" + x + "px)";
        }
        items.forEach(function (it, k) { it.classList.toggle("is-active", k === index); });
        dots.forEach(function (d, k) { d.setAttribute("aria-selected", String(k === index)); d.tabIndex = k === index ? 0 : -1; });
        if (prev) prev.disabled = index === 0;
        if (next) next.disabled = index >= maxIndex();
      }
      on(prev, "click", function () { go(index - 1); });
      on(next, "click", function () { go(index + 1); });
      on(root, "keydown", function (e) {
        if (e.key === "ArrowRight") { go(index + 1); e.preventDefault(); }
        if (e.key === "ArrowLeft") { go(index - 1); e.preventDefault(); }
      });
      // touch / drag
      var startX = null;
      on(viewport, "pointerdown", function (e) { startX = e.clientX; });
      on(viewport, "pointerup", function (e) {
        if (startX === null) return;
        var dx = e.clientX - startX; startX = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      });
      on(window, "resize", function () { go(index, true); });
      go(0, true);

      var auto = root.getAttribute("data-autoplay");
      if (auto && !reduceMotion) {
        var timer = setInterval(function () { go(index >= maxIndex() ? 0 : index + 1); }, parseInt(auto, 10) || 6000);
        on(root, "pointerenter", function () { clearInterval(timer); });
        on(root, "focusin", function () { clearInterval(timer); });
      }
    });
  })();

  /* ---------- slide carousel (industries: dots switch slides) ---------- */
  (function slides() {
    $$("[data-slides]").forEach(function (root) {
      var slides = $$(".slide", root);
      var dotsWrap = $(".carousel__dots", root);
      if (!slides.length || !dotsWrap) return;
      var dots = [];
      var index = 0;
      dotsWrap.setAttribute("role", "tablist");
      slides.forEach(function (s, i) {
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "carousel__dot";
        b.setAttribute("role", "tab");
        b.setAttribute("aria-label", s.getAttribute("data-label") || "Slide " + (i + 1));
        b.setAttribute("aria-controls", s.id);
        on(b, "click", function () { go(i); });
        dotsWrap.appendChild(b);
        dots.push(b);
      });
      function go(i) {
        index = (i + slides.length) % slides.length;
        slides.forEach(function (s, k) {
          var active = k === index;
          s.classList.toggle("is-active", active);
          s.setAttribute("aria-hidden", String(!active));
          if (active && hasGSAP && !reduceMotion) {
            window.gsap.fromTo(s.children, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.08, clearProps: "all" });
          }
        });
        dots.forEach(function (d, k) { d.setAttribute("aria-selected", String(k === index)); d.tabIndex = k === index ? 0 : -1; });
      }
      on(root, "keydown", function (e) {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      });
      go(0);
      if (!reduceMotion) {
        var timer = setInterval(function () { go(index + 1); }, 7000);
        on(root, "pointerenter", function () { clearInterval(timer); });
        on(root, "focusin", function () { clearInterval(timer); });
      }
    });
  })();

  /* ---------- accordion (height tween) ---------- */
  (function accordion() {
    $$(".accordion").forEach(function (acc) {
      var triggers = $$(".accordion__trigger", acc);
      triggers.forEach(function (btn) {
        var panel = doc.getElementById(btn.getAttribute("aria-controls"));
        if (!panel) return;
        var open = btn.getAttribute("aria-expanded") === "true";
        panel.style.height = open ? "auto" : "0px";
        panel.hidden = false;
        on(btn, "click", function () {
          var isOpen = btn.getAttribute("aria-expanded") === "true";
          if (acc.hasAttribute("data-single")) {
            triggers.forEach(function (other) {
              if (other !== btn && other.getAttribute("aria-expanded") === "true") setState(other, doc.getElementById(other.getAttribute("aria-controls")), false);
            });
          }
          setState(btn, panel, !isOpen);
        });
      });
      function setState(btn, panel, open) {
        btn.setAttribute("aria-expanded", String(open));
        if (hasGSAP && !reduceMotion) {
          if (open) {
            window.gsap.fromTo(panel, { height: 0 }, { height: "auto", duration: 0.35, ease: "power2.out" });
          } else {
            window.gsap.to(panel, { height: 0, duration: 0.3, ease: "power2.inOut" });
          }
        } else {
          panel.style.height = open ? "auto" : "0px";
        }
      }
    });
  })();

  /* ---------- pricing toggle ---------- */
  (function billing() {
    var toggle = $("[data-billing]");
    if (!toggle) return;
    var buttons = $$("button", toggle);
    var prices = $$("[data-monthly]");
    function set(mode) {
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode)); });
      prices.forEach(function (p) {
        var v = p.getAttribute(mode === "yearly" ? "data-yearly" : "data-monthly");
        if (hasGSAP && !reduceMotion) {
          window.gsap.fromTo(p, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out", clearProps: "all" });
        }
        p.textContent = v;
      });
      $$("[data-period]").forEach(function (el) { el.textContent = mode === "yearly" ? "/month, billed yearly" : "/month"; });
      try { localStorage.setItem("c0-billing", mode); } catch (e) { /* ignore */ }
    }
    buttons.forEach(function (b) { on(b, "click", function () { set(b.getAttribute("data-mode")); }); });
    var saved = null;
    try { saved = localStorage.getItem("c0-billing"); } catch (e) { /* ignore */ }
    set(saved === "yearly" ? "yearly" : "monthly");
  })();

  /* ---------- filterable lists (jobs, integrations) ---------- */
  (function filters() {
    $$("[data-filter-root]").forEach(function (root) {
      var chips = $$("[data-filter]", root);
      var search = $("[data-filter-search]", root);
      var items = $$("[data-item]", root);
      var empty = $("[data-filter-empty]", root);
      var countEl = $("[data-filter-count]", root);
      var active = "all";
      function apply() {
        var q = search ? search.value.trim().toLowerCase() : "";
        var shown = 0;
        items.forEach(function (it) {
          var cat = it.getAttribute("data-category") || "";
          var text = it.textContent.toLowerCase();
          var ok = (active === "all" || cat === active) && (!q || text.indexOf(q) > -1);
          it.hidden = !ok;
          if (ok) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
        if (countEl) countEl.textContent = shown;
        if (hasGSAP && !reduceMotion) {
          window.gsap.fromTo(items.filter(function (i) { return !i.hidden; }), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.03, ease: "power2.out", clearProps: "all" });
        }
      }
      chips.forEach(function (c) {
        on(c, "click", function () {
          active = c.getAttribute("data-filter");
          chips.forEach(function (o) { o.setAttribute("aria-pressed", String(o === c)); });
          apply();
        });
      });
      on(search, "input", apply);
      apply();
    });
  })();

  /* ---------- integration connect buttons ---------- */
  (function integrations() {
    $$("[data-connect]").forEach(function (btn) {
      on(btn, "click", function () {
        var card = btn.closest(".int-card");
        var name = card ? card.getAttribute("data-name") : "Integration";
        var connected = card && card.getAttribute("data-status") === "connected";
        if (connected) {
          card.setAttribute("data-status", "available");
          btn.textContent = "Connect";
          toast(name + " disconnected.");
        } else {
          btn.classList.add("is-loading");
          setTimeout(function () {
            btn.classList.remove("is-loading");
            if (card) card.setAttribute("data-status", "connected");
            btn.textContent = "Connected";
            toast(name + " connected. Sign in to finish setup.");
          }, 700);
        }
      });
    });
  })();

  /* ---------- forms: validation + fake submit ---------- */
  (function forms() {
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function fieldOf(input) { return input.closest(".field"); }
    function setError(input, msg) {
      var f = fieldOf(input);
      if (!f) return;
      var err = $(".field__error", f);
      f.classList.toggle("is-invalid", !!msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) err.textContent = msg || "";
    }
    function validate(input) {
      var v = input.value.trim();
      var label = (fieldOf(input) && $("label", fieldOf(input)) ? $("label", fieldOf(input)).textContent.replace("*", "").trim() : "This field");
      if (input.required && !v) return label + " is required.";
      if (input.type === "email" && v && !emailRe.test(v)) return "Enter a valid email address, like name@company.com.";
      if (input.type === "password" && v && input.minLength > 0 && v.length < input.minLength) return "Use at least " + input.minLength + " characters.";
      if (input.getAttribute("data-match")) {
        var other = $(input.getAttribute("data-match"));
        if (other && v !== other.value) return "Passwords don't match.";
      }
      if (input.type === "checkbox" && input.required && !input.checked) return "Please accept the terms to continue.";
      return "";
    }

    $$("form[data-validate]").forEach(function (form) {
      var inputs = $$("input, select, textarea", form).filter(function (i) { return i.type !== "hidden" && i.type !== "submit"; });
      var status = $(".form-status", form);
      inputs.forEach(function (input) {
        on(input, "blur", function () { setError(input, validate(input)); });
        on(input, "input", function () { if (fieldOf(input) && fieldOf(input).classList.contains("is-invalid")) setError(input, validate(input)); });
      });
      on(form, "submit", function (e) {
        e.preventDefault();
        var firstBad = null;
        inputs.forEach(function (input) {
          var msg = validate(input);
          setError(input, msg);
          if (msg && !firstBad) firstBad = input;
        });
        if (firstBad) {
          firstBad.focus();
          if (status) { status.className = "form-status is-error"; status.textContent = "Please fix the highlighted fields."; }
          return;
        }
        var btn = $("button[type=submit]", form);
        if (btn) btn.classList.add("is-loading");
        if (status) { status.className = "form-status"; status.textContent = ""; }
        // Backend hook: POST to form.dataset.endpoint when wired. For now, simulate.
        setTimeout(function () {
          if (btn) btn.classList.remove("is-loading");
          var ok = form.getAttribute("data-success") || "Thanks, we received your message.";
          var redirect = form.getAttribute("data-redirect");
          var doneTarget = form.getAttribute("data-done");
          if (doneTarget && $(doneTarget)) {
            var card = form.closest(".auth__card");
            if (card) card.classList.add("is-done");
            $(doneTarget).classList.add("is-visible");
            var emailOut = $("[data-email-out]", $(doneTarget));
            var emailIn = $("input[type=email]", form);
            if (emailOut && emailIn) emailOut.textContent = emailIn.value.trim();
            return;
          }
          if (status) { status.className = "form-status is-ok"; status.textContent = ok; }
          toast(ok);
          if (redirect) setTimeout(function () { location.href = redirect; }, 900);
          else form.reset();
        }, 800);
      });
    });

    // password visibility + strength
    $$("[data-toggle-password]").forEach(function (btn) {
      var input = $(btn.getAttribute("data-toggle-password"));
      if (!input) return;
      on(btn, "click", function () {
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
        btn.setAttribute("aria-pressed", String(show));
      });
    });
    $$("[data-strength]").forEach(function (meter) {
      var input = $(meter.getAttribute("data-strength"));
      if (!input) return;
      on(input, "input", function () {
        var v = input.value, s = 0;
        if (v.length >= 8) s++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
        if (/\d/.test(v)) s++;
        if (/[^A-Za-z0-9]/.test(v)) s++;
        meter.setAttribute("data-level", String(v ? s : 0));
        var label = $("[data-strength-label]", meter.parentNode);
        if (label) label.textContent = !v ? "" : ["Weak", "Weak", "Fair", "Good", "Strong"][s] + " password";
      });
    });

    // newsletter forms (inline message instead of toast)
    $$("form[data-newsletter]").forEach(function (form) {
      var input = $("input[type=email]", form);
      var msg = $(".form-msg", form.parentNode);
      on(form, "submit", function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!emailRe.test(v)) {
          if (msg) { msg.className = "form-msg is-error"; msg.textContent = "Enter a valid email address."; }
          input.focus();
          return;
        }
        var btn = $("button", form);
        btn.classList.add("is-loading");
        setTimeout(function () {
          btn.classList.remove("is-loading");
          if (msg) { msg.className = "form-msg is-ok"; msg.textContent = "You're on the list. Check " + v + " for a confirmation."; }
          form.reset();
        }, 700);
      });
    });
  })();

  /* ---------- hover lift via GSAP on tiles (fallback CSS already applies) ---------- */
  (function lifts() {
    if (!hasGSAP || reduceMotion || !window.matchMedia("(hover: hover)").matches) return;
    $$("[data-lift]").forEach(function (el) {
      on(el, "pointerenter", function () { window.gsap.to(el, { scale: 1.03, duration: 0.2, ease: "power2.out" }); });
      on(el, "pointerleave", function () { window.gsap.to(el, { scale: 1, duration: 0.2, ease: "power2.out" }); });
    });
  })();

  /* ---------- map pins reveal ---------- */
  (function pins() {
    var pins = $$(".map__pin");
    if (!pins.length) return;
    if (!hasGSAP || reduceMotion || !window.ScrollTrigger) { pins.forEach(function (p) { p.classList.add("is-ping"); }); return; }
    window.gsap.from(pins, {
      opacity: 0, y: -12, scale: 0.8, duration: 0.6, ease: "back.out(2)", stagger: 0.15,
      scrollTrigger: { trigger: pins[0].parentNode, start: "top 80%", once: true },
      onComplete: function () { pins.forEach(function (p) { p.classList.add("is-ping"); }); }
    });
  })();

  /* ---------- big number: WebGL liquid shader masked by the digits ---------- */
  (function bigNumber() {
    var el = $(".bignum");
    if (!el) return;
    var canvas = $(".bignum__canvas", el);
    var textEl = $(".bignum__text", el);
    var target = parseInt(el.getAttribute("data-bignum"), 10) || 0;
    var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };
    var state = { v: 0 };

    // count-up shared by both renderers
    function startCount(onUpdate) {
      if (!hasGSAP || reduceMotion || !window.ScrollTrigger) { state.v = target; onUpdate(); return; }
      window.gsap.to(state, {
        v: target, duration: 2.4, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
        onUpdate: onUpdate
      });
    }

    var gl = null;
    try { gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true }); } catch (e) { gl = null; }
    if (!gl || reduceMotion) {
      startCount(function () { textEl.textContent = fmt(state.v); });
      return;
    }

    var vsSrc = "attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }";
    var fsSrc = [
      "precision mediump float; varying vec2 v; uniform sampler2D m; uniform float t; uniform vec2 r;",
      "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }",
      "float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x), f.y); }",
      "float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }",
      "void main(){",
      "  float a = texture2D(m, v).a; if (a < 0.004) discard;",
      "  vec2 uv = vec2(v.x * r.x / r.y, v.y);",
      "  float n = fbm(uv*1.4 + vec2(t*0.10, -t*0.06));",
      "  float n2 = fbm(uv*2.6 - vec2(t*0.04, t*0.09) + n*1.6);",
      "  vec3 ink = vec3(0.043,0.047,0.039), forest = vec3(0.090,0.227,0.078), green = vec3(0.247,0.478,0.071), lime = vec3(0.678,0.969,0.298), mint = vec3(0.86,0.98,0.78);",
      "  vec3 c = mix(forest, green, smoothstep(0.30,0.62,n));",
      "  c = mix(c, lime, smoothstep(0.52,0.86,n2));",
      "  c = mix(c, mint, smoothstep(0.84,1.0,n2)*0.55);",
      "  c = mix(ink, c, smoothstep(0.05,0.95,v.y + (n-0.5)*0.35));",
      "  gl_FragColor = vec4(c*a, a);",
      "}"
    ].join("\n");

    function compile(type, src) {
      var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(sh)); }
      return sh;
    }
    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    } catch (e) {
      startCount(function () { textEl.textContent = fmt(state.v); });
      return;
    }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uT = gl.getUniformLocation(prog, "t"), uR = gl.getUniformLocation(prog, "r"), uM = gl.getUniformLocation(prog, "m");
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uM, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var mask = doc.createElement("canvas");
    var mctx = mask.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, dirty = true;

    function resize() {
      var rect = el.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width * dpr)); H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = mask.width = W; canvas.height = mask.height = H;
      gl.viewport(0, 0, W, H);
      dirty = true;
    }
    function drawMask() {
      mctx.clearRect(0, 0, W, H);
      var size = Math.floor(H * 0.86);
      var text = fmt(state.v);
      mctx.font = "500 " + size + "px Figtree, 'Instrument Sans', system-ui, sans-serif";
      try { mctx.letterSpacing = (-size * 0.04) + "px"; } catch (e) { /* older browsers */ }
      mctx.textAlign = "center"; mctx.textBaseline = "middle"; mctx.fillStyle = "#000";
      // shrink to fit
      var w = mctx.measureText(text).width;
      if (w > W * 0.96) { size = Math.floor(size * (W * 0.96) / w); mctx.font = "500 " + size + "px Figtree, 'Instrument Sans', system-ui, sans-serif"; try { mctx.letterSpacing = (-size * 0.04) + "px"; } catch (e) { /* noop */ } }
      mctx.fillText(text, W / 2, H / 2 + size * 0.04);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
      dirty = false;
    }

    var running = false, start = performance.now();
    function frame(now) {
      if (!running) return;
      if (dirty) drawMask();
      gl.uniform1f(uT, (now - start) / 1000);
      gl.uniform2f(uR, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(frame);
    }
    function setRunning(on) {
      if (on && !running) { running = true; requestAnimationFrame(frame); }
      if (!on) running = false;
    }

    el.classList.add("is-gl");
    resize();
    on(window, "resize", resize);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { dirty = true; });
    startCount(function () { textEl.textContent = fmt(state.v); dirty = true; });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) { setRunning(entries[0].isIntersecting); }, { rootMargin: "120px" }).observe(el);
    } else {
      setRunning(true);
    }
  })();

  /* ---------- query-string prefill (plan, topic, role) ---------- */
  (function prefill() {
    var params = new URLSearchParams(location.search);
    var topic = params.get("topic");
    var topicSel = $("#topic");
    if (topic && topicSel && $$("option", topicSel).some(function (o) { return o.value === topic; })) topicSel.value = topic;
    var role = params.get("role");
    var msg = $("#message");
    if (role && msg && !msg.value) msg.value = "Hi, I'd like to apply for the " + decodeURIComponent(role).replace(/\+/g, " ") + " role.";
    var plan = params.get("plan");
    var planOut = $("[data-plan-out]");
    if (plan && planOut) {
      var names = { basic: "Basic", premium: "Premium", pro: "Pro" };
      if (names[plan]) { planOut.textContent = "Starting on " + names[plan] + " · 14-day free trial"; planOut.hidden = false; }
    }
  })();

  /* ---------- footer year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
