/* ==========================================================================
   LYNX STUDIO — interakce a scroll animace (Lenis + GSAP ScrollTrigger)
   Motion engine řízený sdíleně napříč všemi stránkami.
   Vše degraduje: bez JS / reduced-motion / shot-mode zůstává obsah viditelný.
   ========================================================================== */

(function () {
  "use strict";

  const root = document.documentElement;
  /* Na výslovné přání: animace, efekty a přechody běží na VŠECH zařízeních
     bez výjimky — ignorujeme prefers-reduced-motion i typ ukazatele (dotyk). */
  const reduceMotion = false;
  const canHover = true;

  /* screenshot helper: /?y=4000 skočí po načtení na danou pozici (bez Lenis/anim) */
  const qs = new URLSearchParams(location.search);
  const jumpY = parseInt(qs.get("y") || "0", 10);
  const shotMode = qs.has("y") || qs.has("noanim");
  if (shotMode) {
    history.scrollRestoration = "manual";
    const jump = () => { document.body.style.transform = "translateY(-" + jumpY + "px)"; };
    document.addEventListener("DOMContentLoaded", jump);
    window.addEventListener("load", jump);
  }

  /* ---------- Lenis smooth scroll ---------- */
  let lenis = null;
  if (!reduceMotion && !shotMode && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* plynulý skok na kotvy (#...) přes Lenis */
  const navOffset = -72;
  document.querySelectorAll('a[href^="#"], a[href*="/#"]').forEach((a) => {
    const raw = a.getAttribute("href");
    const hash = raw.includes("#") ? "#" + raw.split("#")[1] : "";
    if (!hash || hash.length < 2) return;
    a.addEventListener("click", (e) => {
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: navOffset, duration: 1.2 });
      else target.scrollIntoView({ behavior: "smooth" });
    });
  });
  const topBtn = document.querySelector(".footer__top-btn");
  if (topBtn) {
    topBtn.onclick = () => { if (lenis) lenis.scrollTo(0, { duration: 1.2 }); else window.scrollTo({ top: 0, behavior: "smooth" }); };
  }

  /* ---------- živé hodiny (Praha) ---------- */
  const clock = document.getElementById("live-clock");
  if (clock) {
    const tick = () => {
      clock.textContent = new Date().toLocaleTimeString("cs-CZ", {
        timeZone: "Europe/Prague", hour12: false,
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- akordeony: vždy jen jeden otevřený ---------- */
  const exclusive = (selector) => {
    const items = Array.from(document.querySelectorAll(selector));
    items.forEach((d) =>
      d.addEventListener("toggle", () => {
        if (d.open) items.forEach((o) => { if (o !== d) o.open = false; });
        if (window.ScrollTrigger) ScrollTrigger.refresh();
      })
    );
  };
  /* akordeony: bez GSAP instantně (fallback níže), s GSAP plynule (smoothAccordion) */

  /* ---------- carousel (funguje i bez GSAP) ---------- */
  function setupCarousel(track) {
    const slides = Array.from(track.children);
    if (slides.length < 2) return;
    track.classList.add("is-carousel");

    const ctrl = document.createElement("div");
    ctrl.className = "carousel-ctrl";
    const dots = document.createElement("div");
    dots.className = "carousel-dots";
    const prev = document.createElement("button");
    prev.className = "carousel-arrow"; prev.type = "button";
    prev.innerHTML = "&#8592;"; prev.setAttribute("aria-label", "Předchozí");
    const next = document.createElement("button");
    next.className = "carousel-arrow"; next.type = "button";
    next.innerHTML = "&#8594;"; next.setAttribute("aria-label", "Další");

    let index = 0;
    slides.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Recenze " + (i + 1));
      if (i === 0) b.className = "is-active";
      b.addEventListener("click", () => goTo(i));
      dots.append(b);
    });
    ctrl.append(dots, prev, next);
    track.after(ctrl);

    const step = () => slides[0].getBoundingClientRect().width + 26;
    const perView = () => Math.max(1, Math.round(track.clientWidth / step()));
    const maxIndex = () => Math.max(0, slides.length - perView());
    function updateUI() {
      Array.from(dots.children).forEach((d, i) => d.classList.toggle("is-active", i === index));
      prev.disabled = index <= 0;
      next.disabled = index >= maxIndex();
    }
    function goTo(i, smooth) {
      index = Math.min(Math.max(0, i), maxIndex());
      track.scrollTo({ left: index * step(), behavior: smooth === false ? "auto" : "smooth" });
      updateUI();
    }
    prev.addEventListener("click", () => goTo(index - 1));
    next.addEventListener("click", () => goTo(index + 1));

    let scrollT;
    track.addEventListener("scroll", () => {
      clearTimeout(scrollT);
      scrollT = setTimeout(() => { index = Math.round(track.scrollLeft / step()); updateUI(); }, 90);
    });

    /* drag / swipe */
    let down = false, startX = 0, startL = 0, moved = false;
    track.addEventListener("pointerdown", (e) => {
      down = true; moved = false; startX = e.clientX; startL = track.scrollLeft;
      track.classList.add("is-dragging");
      try { track.setPointerCapture(e.pointerId); } catch (_) {}
    });
    track.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      track.scrollLeft = startL - dx;
    });
    const endDrag = () => {
      if (!down) return;
      down = false; track.classList.remove("is-dragging");
      goTo(Math.round(track.scrollLeft / step()));
    };
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    track.addEventListener("click", (e) => { if (moved) e.preventDefault(); }, true);

    /* autoplay (pauza při interakci) */
    let timer = null;
    const play = () => { if (reduceMotion) return; stop(); timer = setInterval(() => {
      if (document.hidden) return;
      index = index >= maxIndex() ? 0 : index + 1;
      goTo(index);
    }, 4800); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    track.addEventListener("pointerenter", stop);
    track.addEventListener("pointerleave", play);
    window.addEventListener("resize", () => { updateUI(); });
    updateUI(); play();
  }
  const testiTrack = document.querySelector(".testi__cards");
  if (testiTrack && !shotMode) setupCarousel(testiTrack);

  /* ---------- GSAP ---------- */
  if (!window.gsap || reduceMotion || shotMode) {
    /* bez animací zviditelni slova sekvence a nech vše viditelné */
    document.querySelectorAll(".words__word").forEach((w, i) => {
      if (i === 2) w.style.opacity = 1;
    });
    exclusive(".plan");
    exclusive(".qa");
    document.documentElement.classList.remove("is-entering");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  if (lenis) lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);
  root.classList.add("has-anim");

  /* ---------- helpery ---------- */

  /* rozdělení nadpisu na řádky (a plain řádky na slova) pro reveal */
  function splitHeading(el) {
    const lines = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = lines.map((line) => {
      const hasTag = /<[a-z]/i.test(line);
      if (hasTag) {
        return '<span class="line-mask"><span class="line-in">' + line + "</span></span>";
      }
      const words = line.trim().split(/\s+/)
        .map((w) => '<span class="word-mask"><span class="word-in">' + w + "</span></span>")
        .join(" ");
      return '<span class="line-mask"><span class="line-in">' + words + "</span></span>";
    }).join("");
    const words = el.querySelectorAll(".word-in");
    return words.length ? words : el.querySelectorAll(".line-in");
  }

  /* skupinový reveal se staggerem (fade + posun) */
  function revealBatch(sel, opt) {
    opt = opt || {};
    const els = gsap.utils.toArray(sel);
    if (!els.length) return;
    const y = opt.y == null ? 44 : opt.y;
    gsap.set(els, { opacity: 0, y: y, x: opt.x || 0 });
    ScrollTrigger.batch(els, {
      start: opt.start || "top 88%",
      once: true,
      onEnter: (batch) => gsap.to(batch, {
        opacity: 1, y: 0, x: 0,
        duration: opt.dur || 0.9, ease: "power3.out",
        stagger: opt.stagger == null ? 0.08 : opt.stagger, overwrite: true,
      }),
    });
  }

  /* parallax obrázků (bezpečné — jen posun/scale) */
  function parallax(sel, amt, scale) {
    scale = scale || 1;
    gsap.utils.toArray(sel).forEach((img) => {
      const trig = img.closest("section, article, figure") || img.parentElement || img;
      gsap.fromTo(img, { yPercent: -amt, scale: scale }, {
        yPercent: amt, scale: scale, ease: "none",
        scrollTrigger: { trigger: trig, start: "top bottom", end: "bottom top", scrub: true },
      });
    });
  }

  /* reveal jednotlivých obrázků (scale + fade) */
  function imageReveal(sel) {
    gsap.utils.toArray(sel).forEach((img) => {
      gsap.from(img, {
        scale: 1.14, opacity: 0, duration: 1.1, ease: "power3.out",
        scrollTrigger: { trigger: img, start: "top 90%", once: true },
      });
    });
  }

  /* ---------- nadpisy — reveal po řádcích / slovech ---------- */
  document.querySelectorAll(".anim-lines").forEach((el) => {
    const targets = splitHeading(el);
    gsap.from(targets, {
      yPercent: 115, duration: 1.05, ease: "power4.out", stagger: 0.055,
      scrollTrigger: { trigger: el, start: "top 90%", once: true },
    });
  });

  /* ---------- hero — nástup ---------- */
  gsap.from(".hero__wordmark span", {
    yPercent: 60, opacity: 0, duration: 1.2, ease: "power4.out", stagger: 0.08, delay: 0.15,
  });
  gsap.from(".hero__intro > *, .hero__showreel > *", {
    y: 26, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.07, delay: 0.5,
  });
  gsap.from(".hero__stat > *", {
    y: 20, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, delay: 0.4,
  });
  gsap.from(".hero__markers .deg-marker", {
    x: -20, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.12, delay: 0.7,
  });

  /* nástup horní části podstránek (phero) */
  gsap.from(".phero .crumb, .phero__eyebrow", {
    y: 18, opacity: 0, duration: 0.8, ease: "power3.out", stagger: 0.1, delay: 0.1,
  });

  /* ---------- pinned sekvence slov ---------- */
  const words = gsap.utils.toArray(".words__word");
  if (words.length) {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".words", start: "top top",
        end: "+=" + words.length * 90 + "%", pin: ".words__pin", scrub: 0.6,
      },
    });
    words.forEach((w, i) => {
      tl.fromTo(w, { opacity: 0, scale: 0.92, yPercent: 12 }, { opacity: 1, scale: 1, yPercent: 0, duration: 1 });
      if (i < words.length - 1) tl.to(w, { opacity: 0, scale: 1.04, yPercent: -12, duration: 1 }, "+=0.4");
    });
  }

  /* ---------- projekty — parallax + reveal ---------- */
  gsap.utils.toArray(".project").forEach((card) => {
    const img = card.querySelector(".project__img");
    gsap.fromTo(img, { yPercent: -8 }, {
      yPercent: 8, ease: "none",
      scrollTrigger: { trigger: card, start: "top bottom", end: "bottom top", scrub: true },
    });
    gsap.from(card.querySelector(".project__center"), {
      opacity: 0, y: 40, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: card, start: "top 60%" },
    });
  });

  /* ---------- countery ---------- */
  document.querySelectorAll(".count").forEach((el) => {
    const target = +el.dataset.count;
    gsap.fromTo(el, { innerText: 0 }, {
      innerText: target, duration: 2, ease: "power2.out", snap: { innerText: 1 },
      scrollTrigger: { trigger: el, start: "top 85%", once: true },
    });
  });

  /* ---------- scramble text ---------- */
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/\\";
  function scramble(el) {
    const original = el.dataset.text || (el.dataset.text = el.textContent);
    let frame = 0;
    const total = Math.max(14, original.length * 2.2);
    const timer = setInterval(() => {
      frame++;
      el.textContent = original.split("").map((ch, i) => {
        if (ch === " ") return " ";
        return i < (frame / total) * original.length ? ch : CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join("");
      if (frame >= total) { el.textContent = original; clearInterval(timer); }
    }, 30);
  }
  document.querySelectorAll(".scramble, .scramble-title").forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () => scramble(el) });
  });

  /* ---------- site-wide reveal (fade + slide, staggered) ---------- */
  revealBatch(".section-sub", { y: 28 });
  revealBatch(".phero__lead, .phero__meta", { y: 24, stagger: 0.1 });
  revealBatch(".why__grid > .card", { y: 46, stagger: 0.08 });
  revealBatch(".plan", { y: 30, stagger: 0.06 });
  revealBatch(".team__grid > .member", { y: 52, stagger: 0.08 });
  revealBatch(".qa", { y: 22, stagger: 0.05 });
  revealBatch(".testi__intro, .testi__spotlight", { y: 46, stagger: 0.1 });
  revealBatch(".quote-card", { y: 42, stagger: 0.09 });
  revealBatch(".blog-card", { y: 50, stagger: 0.08 });
  revealBatch(".worktile", { y: 56, stagger: 0.1 });
  revealBatch(".value-card", { y: 46, stagger: 0.09 });
  revealBatch(".studio__figures .stat, .perf__stats .stat, .case__stats > *", { y: 34, stagger: 0.08 });
  revealBatch(".expert > *", { y: 30, stagger: 0.08 });
  revealBatch(".impact__quote, .impact__years-note", { y: 40, stagger: 0.1 });
  revealBatch(".impact__stats li", { y: 20, stagger: 0.08 });
  revealBatch(".projects__more", { y: 24 });
  revealBatch(".team__foot > *", { y: 34, stagger: 0.08 });
  revealBatch(".case__lead, .case__lead-desc, .case__facts", { y: 34, stagger: 0.1 });
  revealBatch(".case__section", { y: 46, stagger: 0.1 });
  revealBatch(".case__quote", { y: 30 });
  revealBatch(".nextcase", { y: 24 });
  revealBatch(".cinfo__card", { y: 34, stagger: 0.09 });
  revealBatch(".cform .field, .cform__budget, .cform > .btn, .cform__note", { y: 24, stagger: 0.06 });
  revealBatch(".prose > *", { y: 26, stagger: 0.05, start: "top 92%" });
  revealBatch(".legal__toc a", { y: 14, stagger: 0.04 });
  revealBatch(".logos", { y: 20 });
  revealBatch(".footer__top > *", { y: 30, stagger: 0.08 });
  revealBatch(".footer__brand > div > *", { y: 20, stagger: 0.05 });

  /* ---------- parallax pozadí a obrázků ---------- */
  parallax(".phero__bg, .perf__bg, .impact__bg", 9);
  parallax(".case__hero img", 6);
  parallax(".article__cover img", 6, 1.08);
  parallax(".worktile img", 5, 1.12);
  parallax(".blog-card img", 5, 1.12);

  /* reveal jednotlivých obrázků řeší blur-up (viz motion v2 níže) */

  /* ---------- giant „služby" — horizontální posun ---------- */
  const giant = document.querySelector(".services__giant");
  if (giant) {
    gsap.fromTo(giant, { xPercent: 4 }, {
      xPercent: -4, ease: "none",
      scrollTrigger: { trigger: giant, start: "top bottom", end: "bottom top", scrub: true },
    });
  }
  /* studio / whispers obří slova pokud existují */
  gsap.utils.toArray(".services__giant, .why__watermark").forEach(() => {});

  /* watermark lynx v why sekci */
  const wm = document.querySelector(".why__watermark");
  if (wm) {
    gsap.fromTo(wm, { y: 120 }, {
      y: -120, ease: "none",
      scrollTrigger: { trigger: ".why", start: "top bottom", end: "bottom top", scrub: true },
    });
  }

  /* impact roky — roztažení čáry */
  const yearsLine = document.querySelector(".impact__years span");
  if (yearsLine) {
    gsap.from(yearsLine, {
      scaleX: 0, transformOrigin: "left center", duration: 1.6, ease: "power3.inOut",
      scrollTrigger: { trigger: ".impact__years", start: "top 85%" },
    });
  }

  /* ---------- scroll progress bar ---------- */
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  gsap.fromTo(bar, { scaleX: 0 }, {
    scaleX: 1, ease: "none",
    scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.3 },
  });

  /* ---------- nav — skrytí + scrolled stav ---------- */
  let lastY = 0;
  ScrollTrigger.create({
    onUpdate: (self) => {
      const y = self.scroll();
      const nav = document.getElementById("nav");
      if (!nav) return;
      nav.classList.toggle("nav--scrolled", y > 40);
      nav.style.transform = y > lastY && y > 320 ? "translateY(-100%)" : "translateY(0)";
      lastY = y;
    },
  });

  /* ---------- magnetická tlačítka ---------- */
  if (canHover) {
    document.querySelectorAll(".btn, .icon-btn, .footer__top-btn, .carousel-arrow").forEach((btn) => {
      const strength = btn.classList.contains("icon-btn") ? 0.45 : 0.28;
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: (e.clientX - (r.left + r.width / 2)) * strength,
          y: (e.clientY - (r.top + r.height / 2)) * strength,
          duration: 0.4, ease: "power3.out",
        });
      });
      btn.addEventListener("pointerleave", () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  /* ---------- custom cursor (ring + dot + kontextový label) ---------- */
  if (canHover) {
    root.classList.add("has-cursor");
    const dot = document.createElement("div");
    dot.className = "cursor-dot cursor-hidden";
    const ring = document.createElement("div");
    ring.className = "cursor-ring cursor-hidden";
    const label = document.createElement("div");
    label.className = "cursor-label";
    document.body.append(dot, ring, label);
    const dx = gsap.quickTo(dot, "x", { duration: 0.12, ease: "power3" });
    const dy = gsap.quickTo(dot, "y", { duration: 0.12, ease: "power3" });
    const rx = gsap.quickTo(ring, "x", { duration: 0.42, ease: "power3" });
    const ry = gsap.quickTo(ring, "y", { duration: 0.42, ease: "power3" });
    const lx = gsap.quickTo(label, "x", { duration: 0.3, ease: "power3" });
    const ly = gsap.quickTo(label, "y", { duration: 0.3, ease: "power3" });
    const hoverSel = "a, button, summary, .btn, [role=button], .plan__summary, .quote-card";
    /* kontextové popisky kurzoru */
    const labelMap = [
      { sel: ".worktile, .process__case-card, .blog-card:not(.blog-card--intro), .nextcase", txt: "Zobrazit" },
      { sel: ".testi__cards.is-carousel", txt: "Táhni" },
      { sel: ".hero__showreel-video", txt: "Přehrát" },
    ];
    window.addEventListener("pointermove", (e) => {
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
      lx(e.clientX); ly(e.clientY + 26);
      dot.classList.remove("cursor-hidden"); ring.classList.remove("cursor-hidden");
    });
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest ? e.target : null;
      if (!t) return;
      if (t.closest(hoverSel)) ring.classList.add("is-hover");
      for (const m of labelMap) {
        if (t.closest(m.sel)) { label.textContent = m.txt; label.classList.add("is-on"); ring.classList.add("is-label"); break; }
      }
    });
    document.addEventListener("pointerout", (e) => {
      const t = e.target.closest ? e.target : null;
      if (!t) return;
      if (t.closest(hoverSel)) ring.classList.remove("is-hover");
      if (labelMap.some((m) => t.closest(m.sel))) { label.classList.remove("is-on"); ring.classList.remove("is-label"); }
    });
    document.addEventListener("mouseleave", () => {
      dot.classList.add("cursor-hidden"); ring.classList.add("cursor-hidden"); label.classList.remove("is-on");
    });
  }

  /* ======================================================================
     MOTION LAYER v2 — A + B
     ====================================================================== */

  /* ---------- B3: plynulý accordion (exkluzivní) ---------- */
  function smoothAccordion(sel) {
    const items = gsap.utils.toArray(sel);
    const panelOf = (d) => d.classList.contains("plan") ? d.querySelector(".plan__body") : d.querySelector("p");
    function open(d) {
      const p = panelOf(d); if (!p) return;
      d.open = true;
      p.style.height = "auto";
      const h = p.offsetHeight;
      gsap.fromTo(p, { height: 0, opacity: 0 }, { height: h, opacity: 1, duration: 0.5, ease: "power3.out",
        onComplete: () => { p.style.height = "auto"; ScrollTrigger.refresh(); } });
      gsap.from(p.children, { y: 14, opacity: 0, duration: 0.5, stagger: 0.05, ease: "power3.out", delay: 0.05 });
    }
    function close(d) {
      const p = panelOf(d); if (!p) return;
      gsap.to(p, { height: 0, opacity: 0, duration: 0.4, ease: "power3.in",
        onComplete: () => { d.open = false; p.style.height = ""; gsap.set(p, { clearProps: "opacity" }); ScrollTrigger.refresh(); } });
    }
    items.forEach((d) => {
      const summary = d.querySelector("summary"); if (!summary) return;
      d.classList.add("js-acc");
      summary.addEventListener("click", (e) => {
        e.preventDefault();
        if (d.open) close(d);
        else { items.forEach((o) => { if (o !== d && o.open) close(o); }); open(d); }
      });
    });
  }
  smoothAccordion(".qa");
  smoothAccordion(".plan");

  /* ---------- A4: bohaté sekvence Služby / Proces ---------- */
  gsap.utils.toArray(".service").forEach((svc) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: svc, start: "top 80%", once: true } });
    tl.from(svc.querySelector(".service__head"), { yPercent: 30, opacity: 0, duration: 0.6, ease: "power3.out" })
      .from(svc.querySelector(".service__title"), { y: 40, opacity: 0, duration: 0.9, ease: "power4.out" }, "-=0.3")
      .from(svc.querySelectorAll(".service__desc, .service__thumb"), { y: 24, opacity: 0, duration: 0.7, stagger: 0.12, ease: "power3.out" }, "-=0.5")
      .from(svc.querySelectorAll(".service__list li"), { x: 26, opacity: 0, duration: 0.5, stagger: 0.06, ease: "power3.out" }, "-=0.5");
  });
  gsap.utils.toArray(".process-card").forEach((card) => {
    gsap.from(card, { y: 60, opacity: 0, scale: 0.96, duration: 0.85, ease: "power3.out",
      scrollTrigger: { trigger: card, start: "top 86%", once: true } });
  });
  if (document.querySelector(".process__side")) {
    gsap.from(".process__side > *", { y: 30, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out",
      scrollTrigger: { trigger: ".process__side", start: "top 82%", once: true } });
  }

  /* ---------- A5: scrub reveal klíčových vět ---------- */
  function scrubText(sel) {
    gsap.utils.toArray(sel).forEach((el) => {
      if (el.dataset.scrubbed) return;
      if ([...el.children].some((c) => c.tagName !== "BR")) return; // zachovej vnitřní markup
      el.dataset.scrubbed = "1";
      el.innerHTML = el.innerHTML.split(/(<br\s*\/?>)/i).map((seg) => {
        if (/<br/i.test(seg)) return seg;
        return seg.split(/(\s+)/).map((t) => (/^\s*$/.test(t) ? t : '<span class="scrub-word">' + t + "</span>")).join("");
      }).join("");
      const wordsEl = el.querySelectorAll(".scrub-word");
      const target = el.closest(".section-dark") ? "#f2f2f2" : "#16181b";
      gsap.to(wordsEl, { color: target, stagger: 0.4, ease: "none",
        scrollTrigger: { trigger: el, start: "top 78%", end: "bottom 58%", scrub: true } });
    });
  }
  scrubText(".process__side-title, .testi__intro h2");

  /* ---------- A2: skew podle rychlosti scrollu + rychlost marquee ---------- */
  if (lenis) {
    const skewEls = gsap.utils.toArray(".worktile img, .blog-card img, .project__img, .service__thumb");
    const skewSet = skewEls.map((el) => { el.classList.add("skewable"); return gsap.quickTo(el, "skewY", { duration: 0.5, ease: "power3" }); });
    const tracks = gsap.utils.toArray(".marquee__track");
    lenis.on("scroll", ({ velocity }) => {
      const v = velocity || 0;
      const sk = gsap.utils.clamp(-5, 5, v * 0.22);
      skewSet.forEach((s) => s(sk));
      const dur = 28 / (1 + Math.min(Math.abs(v) / 26, 2.4));
      tracks.forEach((t) => { t.style.animationDuration = dur.toFixed(2) + "s"; });
    });
  }

  /* ---------- B2: náklon členů týmu za kurzorem ---------- */
  if (canHover) {
    gsap.utils.toArray(".member").forEach((m) => {
      const base = parseFloat(getComputedStyle(m).getPropertyValue("--tilt")) || 0;
      m.addEventListener("pointermove", (e) => {
        const r = m.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -9;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 9;
        gsap.to(m, { rotate: 0, rotationX: rx, rotationY: ry, y: -8, duration: 0.4, ease: "power3.out", transformPerspective: 800 });
      });
      m.addEventListener("pointerleave", () => {
        gsap.to(m, { rotationX: 0, rotationY: 0, rotate: base, y: 0, duration: 0.6, ease: "power3.out" });
      });
    });
  }

  /* ---------- B4: bar fill pod procentními statistikami ---------- */
  gsap.utils.toArray(".stat, .case__stats > *, .why__satisfaction").forEach((box) => {
    if (box.dataset.bar || !box.textContent.includes("%")) return;
    const num = box.querySelector(".count");
    let val = num ? +num.dataset.count : parseFloat(((box.textContent.match(/([\d.,]+)\s*%/) || [])[1] || "").replace(",", "."));
    if (!val) return; val = Math.min(val, 100);
    box.dataset.bar = "1";
    const bar = document.createElement("span"); bar.className = "statbar"; bar.setAttribute("aria-hidden", "true"); bar.innerHTML = "<i></i>";
    (box.querySelector(".stat__label, .case__stat-label") || box).appendChild(bar);
    gsap.to(bar.firstChild, { width: val + "%", duration: 1.4, ease: "power3.out",
      scrollTrigger: { trigger: box, start: "top 85%", once: true } });
  });

  /* ---------- B7: aktivní kapitola v legal TOC ---------- */
  const tocLinks = gsap.utils.toArray(".legal__toc a");
  if (tocLinks.length) {
    tocLinks.forEach((a) => {
      const sec = document.querySelector(a.getAttribute("href"));
      if (!sec) return;
      ScrollTrigger.create({ trigger: sec, start: "top 32%", end: "bottom 32%",
        onToggle: (self) => { if (self.isActive) { tocLinks.forEach((l) => l.classList.remove("is-active")); a.classList.add("is-active"); } } });
    });
  }

  /* ---------- B8: dividers draw ---------- */
  gsap.utils.toArray(".ruler, .projects__more-line").forEach((r) => {
    gsap.from(r, { scaleX: 0, transformOrigin: "left center", duration: 1.1, ease: "power3.inOut",
      scrollTrigger: { trigger: r, start: "top 92%", once: true } });
  });
  const barcode = document.querySelector(".barcode");
  if (barcode) {
    gsap.to(barcode, { backgroundPositionX: "90px", ease: "none",
      scrollTrigger: { trigger: barcode, start: "top bottom", end: "bottom top", scrub: true } });
  }

  /* ---------- B9: blur-up načítání obrázků ---------- */
  document.querySelectorAll(".worktile img, .blog-card img, .service__thumb, .plan__img, .why__card-pricing img, .case__gallery img, .article__cover img, .testi__spot-body img, .impact__quote img, .cinfo__person img, .quote-card__person img, .case__hero img").forEach((img) => {
    img.classList.add("img-blur");
    const done = () => img.classList.add("is-loaded");
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener("load", done, { once: true }); img.addEventListener("error", done, { once: true }); }
  });

  /* ---------- A1: page transitions + intro ---------- */
  (function pageTransitions() {
    const first = root.classList.contains("is-first");
    const fx = document.createElement("div");
    fx.className = "pagefx"; fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = '<div><div class="pagefx__mark"><span class="a">Lynx</span><span class="slash">\\</span><span>Studio</span></div><div class="pagefx__bar"><i></i></div><div class="pagefx__pct">0%</div></div>';
    document.body.appendChild(fx);
    const mark = fx.querySelector(".pagefx__mark");
    const barI = fx.querySelector(".pagefx__bar i");
    const pct = fx.querySelector(".pagefx__pct");
    const bar = fx.querySelector(".pagefx__bar");

    /* vstup: pagefx převezme zakrytí od ::before, pak odhalí obsah */
    gsap.set(fx, { scaleY: 1, transformOrigin: "top" });
    root.classList.remove("is-entering");
    if (first) {
      const tl = gsap.timeline();
      tl.fromTo(mark, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 0)
        .fromTo(barI, { width: "0%" }, { width: "100%", duration: 1.0, ease: "power1.inOut",
          onUpdate: function () { pct.textContent = Math.round(this.progress() * 100) + "%"; } }, 0.15)
        .to([mark, bar], { opacity: 0, duration: 0.3, ease: "power2.in" }, "+=0.15")
        .to(fx, { scaleY: 0, transformOrigin: "top", duration: 0.75, ease: "power4.inOut" }, "-=0.1")
        .set(fx, { scaleY: 0 });
    } else {
      bar.style.display = "none"; mark.style.display = "none";
      gsap.to(fx, { scaleY: 0, transformOrigin: "top", duration: 0.6, ease: "power4.inOut", delay: 0.05 });
    }

    /* odchod: zakrytí a navigace */
    const isInternal = (a) => {
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return false;
      if (/^(mailto:|tel:|#)/i.test(href)) return false;
      if (/^https?:/i.test(href)) { try { return new URL(href).origin === location.origin; } catch (e) { return false; } }
      return true;
    };
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      const a = e.target.closest && e.target.closest("a");
      if (!a || !isInternal(a) || a.href === location.href) return;
      e.preventDefault();
      const url = a.href;
      try { sessionStorage.setItem("lynx-seen", "1"); } catch (_) {}
      bar.style.display = "none"; mark.style.display = "none";
      gsap.set(fx, { transformOrigin: "bottom" });
      gsap.to(fx, { scaleY: 1, duration: 0.5, ease: "power4.inOut", onComplete: () => { window.location = url; } });
    });
    /* bfcache návrat: zajisti odkryté plátno */
    window.addEventListener("pageshow", (e) => { if (e.persisted) gsap.set(fx, { scaleY: 0 }); });
  })();

  /* refresh po načtení obrázků/fontů */
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
