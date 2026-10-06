/* ==========================================================================
   SourceBD, the second landing page: interactions.
   Depends on GSAP 3 + ScrollTrigger (loaded from cdnjs before this file).
   Everything degrades: without JS or GSAP the pages render fully, every loop
   shows its poster, and under reduced motion or Save-Data nothing plays.
   ========================================================================== */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reduceMotion = motionQuery.matches;
  var hasGSAP = typeof window.gsap !== "undefined";
  if (hasGSAP && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

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
      var setOpen = function (open) {
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        nav.classList.toggle("is-open", open);
        doc.body.style.overflow = open && window.innerWidth < 960 ? "hidden" : "";
      };
      on(toggle, "click", function () { setOpen(toggle.getAttribute("aria-expanded") !== "true"); });
      on(doc, "keydown", function (e) { if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { setOpen(false); toggle.focus(); } });
      on(window, "resize", function () { if (window.innerWidth >= 960) setOpen(false); });
      $$("a", nav).forEach(function (a) { on(a, "click", function () { setOpen(false); }); });
    }

    // Mark the current page in the nav.
    var path = location.pathname.split("/").pop() || "index.html";
    $$(".nav__link").forEach(function (a) {
      if (a.getAttribute("href") === path) a.setAttribute("aria-current", "page");
    });
  })();

  /* ---------- hero: split words + rise ---------- */
  (function heroSplit() {
    var targets = $$(".split-words");
    if (!targets.length) return;
    targets.forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.textContent = "";
      words.forEach(function (w, i) {
        if (i) el.appendChild(doc.createTextNode(" "));
        var span = doc.createElement("span");
        span.className = "word";
        span.setAttribute("aria-hidden", "true");
        span.textContent = w;
        el.appendChild(span);
      });
      var label = doc.createElement("span");
      label.className = "sr-only";
      label.textContent = words.join(" ");
      el.appendChild(label);
    });
    if (!hasGSAP || reduceMotion) return;
    targets.forEach(function (el) {
      el.classList.add("is-ready");
      window.gsap.to(el.querySelectorAll(".word"), {
        opacity: 1, y: 0, duration: 0.8, ease: "expo.out", stagger: 0.05, delay: 0.05,
        onComplete: function () { el.classList.remove("is-ready"); window.gsap.set(el.querySelectorAll(".word"), { clearProps: "all" }); }
      });
    });
    var hero = $(".hero");
    if (hero) {
      window.gsap.from($$(".hero__copy, .hero__fact, .hero__actions, .hero-stage", hero), {
        opacity: 0, y: 16, duration: 0.8, ease: "expo.out", stagger: 0.08, delay: 0.3, clearProps: "all"
      });
    }
  })();

  /* ---------- scroll reveals: one entrance, opacity-led ---------- */
  (function reveals() {
    var items = $$("[data-reveal]");
    if (!items.length) return;
    if (!hasGSAP || reduceMotion || !window.ScrollTrigger) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var groups = new Map();
    items.forEach(function (el) {
      var key = el.parentNode;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });
    groups.forEach(function (els) {
      window.gsap.to(els, {
        opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.06, overwrite: true,
        scrollTrigger: { trigger: els[0], start: "top 90%", once: true },
        onComplete: function () { els.forEach(function (el) { el.classList.add("is-in"); window.gsap.set(el, { clearProps: "transform,opacity" }); }); }
      });
    });
  })();

  /* ---------- stage parallax (the hero's backdrop only) ---------- */
  (function parallax() {
    if (!hasGSAP || reduceMotion || !window.ScrollTrigger) return;
    $$("[data-parallax]").forEach(function (bg) {
      var stage = bg.closest(".stage");
      if (!stage) return;
      window.gsap.fromTo(bg, { yPercent: -4 }, {
        yPercent: 4, ease: "none",
        scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  })();

  /* ---------- loops: one on screen at a time; posters only under reduced motion or Save-Data ---------- */
  (function loops() {
    var vids = $$("video[data-loop]");
    if (!vids.length || !("IntersectionObserver" in window)) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    function allowed() { return !motionQuery.matches && !(conn && conn.saveData); }

    var ratio = new Map();
    function load(v) {
      if (v.getAttribute("data-loaded")) return;
      $$("source", v).forEach(function (s) { s.src = s.getAttribute("data-src"); });
      v.setAttribute("data-loaded", "1");
      v.setAttribute("autoplay", "");
      v.load();
      on(v, "playing", function () { v.classList.add("is-playing"); });
    }
    function pick() {
      var best = null, r = 0;
      ratio.forEach(function (value, v) { if (value > r) { r = value; best = v; } });
      vids.forEach(function (v) { if (v !== best || !allowed() || doc.hidden) v.pause(); });
      if (best && r > 0.2 && allowed() && !doc.hidden) {
        load(best);
        var p = best.play();
        if (p && p.catch) p.catch(function () { /* a blocked play keeps the poster */ });
      }
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { ratio.set(e.target, e.isIntersecting ? e.intersectionRatio : 0); });
      pick();
    }, { threshold: [0, 0.2, 0.5, 0.8, 1] });
    vids.forEach(function (v) { io.observe(v); });
    on(doc, "visibilitychange", pick);
    if (motionQuery.addEventListener) motionQuery.addEventListener("change", function () {
      if (motionQuery.matches) vids.forEach(function (v) { v.pause(); v.classList.remove("is-playing"); });
      pick();
    });
  })();

  /* ---------- carousels (track-based, snapping; never autoplay) ---------- */
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
        items.forEach(function (it, i) {
          var b = doc.createElement("button");
          b.type = "button";
          b.className = "carousel__dot";
          var title = $("strong", it);
          b.setAttribute("aria-label", "Show " + (title ? title.textContent : "item " + (i + 1)));
          on(b, "click", function () { go(i); });
          dotsWrap.appendChild(b);
          dots.push(b);
        });
      }

      function step() {
        var gap = parseFloat(getComputedStyle(track).gap) || 0;
        return items[0].getBoundingClientRect().width + gap;
      }
      function maxIndex() {
        var gap = parseFloat(getComputedStyle(track).gap) || 0;
        var visible = Math.max(1, Math.floor((viewport.clientWidth + gap) / step()));
        return Math.max(0, items.length - visible);
      }
      function go(i, instant) {
        index = clamp(i, 0, maxIndex());
        var x = -step() * index;
        if (hasGSAP && !reduceMotion && !instant) window.gsap.to(track, { x: x, duration: 0.6, ease: "expo.out" });
        else track.style.transform = "translateX(" + x + "px)";
        items.forEach(function (it, k) { it.classList.toggle("is-active", k === index); });
        dots.forEach(function (d, k) { d.setAttribute("aria-current", String(k === index)); d.setAttribute("aria-selected", String(k === index)); });
        if (prev) prev.disabled = index === 0;
        if (next) next.disabled = index >= maxIndex();
      }
      on(prev, "click", function () { go(index - 1); });
      on(next, "click", function () { go(index + 1); });
      on(root, "keydown", function (e) {
        if (e.key === "ArrowRight") { go(index + 1); e.preventDefault(); }
        if (e.key === "ArrowLeft") { go(index - 1); e.preventDefault(); }
      });
      var startX = null;
      on(viewport, "pointerdown", function (e) { startX = e.clientX; });
      on(viewport, "pointerup", function (e) {
        if (startX === null) return;
        var dx = e.clientX - startX; startX = null;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
      });
      on(window, "resize", function () { go(index, true); });
      go(0, true);
    });
  })();

  /* ---------- slides (the people it is for: dots switch slides; never autoplay) ---------- */
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
            window.gsap.fromTo(s.children, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out", stagger: 0.06, clearProps: "all" });
          }
        });
        dots.forEach(function (d, k) { d.setAttribute("aria-selected", String(k === index)); d.tabIndex = k === index ? 0 : -1; });
      }
      // The names in each slide's list switch slides too, for a pointer (the dots are the keyboard's way).
      slides.forEach(function (s) {
        $$(".industry__list li", s).forEach(function (li, k) {
          if (k < slides.length) on(li, "click", function () { go(k); });
        });
      });
      on(dotsWrap, "keydown", function (e) {
        if (e.key === "ArrowRight") { go(index + 1); dots[index].focus(); }
        if (e.key === "ArrowLeft") { go(index - 1); dots[index].focus(); }
      });
      go(0);
    });
  })();

  /* ---------- accordion (height tween) ---------- */
  (function accordion() {
    $$(".accordion").forEach(function (acc) {
      var triggers = $$(".accordion__trigger", acc);
      function setState(btn, panel, open) {
        btn.setAttribute("aria-expanded", String(open));
        if (hasGSAP && !reduceMotion) {
          if (open) window.gsap.fromTo(panel, { height: 0 }, { height: "auto", duration: 0.32, ease: "expo.out" });
          else window.gsap.to(panel, { height: 0, duration: 0.2, ease: "power2.out" });
        } else {
          panel.style.height = open ? "auto" : "0px";
        }
      }
      triggers.forEach(function (btn) {
        var panel = doc.getElementById(btn.getAttribute("aria-controls"));
        if (!panel) return;
        panel.style.height = btn.getAttribute("aria-expanded") === "true" ? "auto" : "0px";
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
    });
  })();

  /* ---------- filterable list (the sources page) ---------- */
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
          var ok = (active === "all" || cat === active) && (!q || it.textContent.toLowerCase().indexOf(q) > -1);
          it.hidden = !ok;
          if (ok) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
        if (countEl) countEl.textContent = shown === 1 ? "1 source" : shown + " sources";
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

  /* ---------- map pins ---------- */
  (function pins() {
    var pins = $$(".map__pin");
    if (!pins.length || !hasGSAP || reduceMotion || !window.ScrollTrigger) return;
    window.gsap.from(pins, {
      opacity: 0, duration: 0.5, ease: "power2.out", stagger: 0.1,
      scrollTrigger: { trigger: pins[0].parentNode, start: "top 85%", once: true }
    });
  })();

  /* ---------- the big figure: one still shader frame in the palette, masked by the digits ---------- */
  (function bigNumber() {
    var el = $(".bignum");
    if (!el) return;
    var canvas = $(".bignum__canvas", el);
    var textEl = $(".bignum__text", el);
    var text = textEl.textContent.trim(); // arrives whole, never counts up

    var gl = null;
    try { gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return;

    var vsSrc = "attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }";
    var fsSrc = [
      "precision mediump float; varying vec2 v; uniform sampler2D m; uniform vec2 r; uniform vec3 cInk; uniform vec3 cBrand; uniform vec3 cLight;",
      "float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }",
      "float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x), mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x), f.y); }",
      "float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }",
      "void main(){",
      "  float a = texture2D(m, v).a; if (a < 0.004) discard;",
      "  vec2 uv = vec2(v.x * r.x / r.y, v.y);",
      "  float n = fbm(uv*1.4 + vec2(0.4, -0.24));",
      "  float n2 = fbm(uv*2.6 - vec2(0.16, 0.36) + n*1.6);",
      "  vec3 c = mix(cInk, cBrand, smoothstep(0.35, 0.75, v.y + (n-0.5)*0.5));",
      "  c = mix(c, cLight, smoothstep(0.62, 0.95, n2) * smoothstep(0.35, 1.0, v.y) * 0.8);",
      "  gl_FragColor = vec4(c*a, a);",
      "}"
    ].join("\n");

    function compile(type, src) {
      var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    }
    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    } catch (e) { return; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(prog, "r"), uM = gl.getUniformLocation(prog, "m");
    var uInk = gl.getUniformLocation(prog, "cInk"), uBrand = gl.getUniformLocation(prog, "cBrand"), uLight = gl.getUniformLocation(prog, "cLight");
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(uM, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // The palette, read from the page's tokens so the frame follows the theme.
    function rgb(name) {
      var probe = doc.createElement("span");
      probe.style.color = "var(" + name + ")";
      el.appendChild(probe);
      var m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g) || ["0", "0", "0"];
      el.removeChild(probe);
      return [m[0] / 255, m[1] / 255, m[2] / 255];
    }

    var mask = doc.createElement("canvas");
    var mctx = mask.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    function draw() {
      var rect = el.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width * dpr)); H = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = mask.width = W; canvas.height = mask.height = H;
      gl.viewport(0, 0, W, H);
      var size = Math.floor(H * 0.86);
      var font = function (s) { return "600 " + s + "px 'IBM Plex Sans', system-ui, sans-serif"; };
      mctx.clearRect(0, 0, W, H);
      mctx.font = font(size);
      try { mctx.letterSpacing = (-size * 0.04) + "px"; } catch (e) { /* older browsers */ }
      mctx.textAlign = "center"; mctx.textBaseline = "middle"; mctx.fillStyle = "#000";
      var w = mctx.measureText(text).width;
      if (w > W * 0.96) { size = Math.floor(size * (W * 0.96) / w); mctx.font = font(size); try { mctx.letterSpacing = (-size * 0.04) + "px"; } catch (e) { /* noop */ } }
      mctx.fillText(text, W / 2, H / 2 + size * 0.04);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
      gl.uniform2f(uR, W, H);
      gl.uniform3fv(uInk, rgb("--ink"));
      gl.uniform3fv(uBrand, rgb("--brand"));
      gl.uniform3fv(uLight, rgb("--brand-ink"));
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    el.classList.add("is-gl");
    draw();
    var t;
    on(window, "resize", function () { clearTimeout(t); t = setTimeout(draw, 120); });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(draw);
    var scheme = window.matchMedia("(prefers-color-scheme: dark)");
    if (scheme.addEventListener) scheme.addEventListener("change", draw);
  })();

  /* ---------- footer year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
