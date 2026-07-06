/* ==========================================================================
   LYNX STUDIO — interakce a scroll animace (Lenis + GSAP ScrollTrigger)
   ========================================================================== */

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* screenshot helper: /?y=4000 skočí po načtení na danou pozici (bez Lenis) */
  const qs = new URLSearchParams(location.search);
  const jumpY = parseInt(qs.get("y") || "0", 10);
  const shotMode = qs.has("y") || qs.has("noanim");
  if (shotMode) {
    history.scrollRestoration = "manual";
    /* headless nerasteruje odscrollovaný obsah → posun přes transform */
    const jump = () => { document.body.style.transform = "translateY(-" + jumpY + "px)"; };
    document.addEventListener("DOMContentLoaded", jump);
    window.addEventListener("load", jump);
  }

  /* ---------- Lenis smooth scroll ---------- */
  let lenis = null;
  if (!reduceMotion && !shotMode && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
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
  exclusive(".plan");
  exclusive(".qa");

  /* ---------- GSAP ---------- */
  if (!window.gsap || reduceMotion || shotMode) {
    /* bez animací zviditelni slova sekvence */
    document.querySelectorAll(".words__word").forEach((w, i) => {
      if (i === 2) w.style.opacity = 1;
    });
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  if (lenis) lenis.on("scroll", ScrollTrigger.update);

  /* nadpisy — reveal po řádcích */
  document.querySelectorAll(".anim-lines").forEach((el) => {
    const html = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = html
      .map((line) => `<span class="line-mask" style="display:block;overflow:hidden"><span class="line-in" style="display:block">${line}</span></span>`)
      .join("");
    gsap.from(el.querySelectorAll(".line-in"), {
      yPercent: 110,
      duration: 1.1,
      ease: "power4.out",
      stagger: 0.09,
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  /* hero — nástup */
  gsap.from(".hero__wordmark span", {
    yPercent: 60, opacity: 0, duration: 1.2, ease: "power4.out", stagger: 0.08, delay: 0.15,
  });
  gsap.from(".hero__intro > *, .hero__showreel > *", {
    y: 26, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.07, delay: 0.5,
  });
  gsap.from(".hero__stat > *", {
    y: 20, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.08, delay: 0.4,
  });

  /* pinned sekvence slov (nasloucháme / vymýšlíme / tvoříme / krásné věci) */
  const words = gsap.utils.toArray(".words__word");
  if (words.length) {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ".words",
        start: "top top",
        end: "+=" + words.length * 90 + "%",
        pin: ".words__pin",
        scrub: 0.6,
      },
    });
    words.forEach((w, i) => {
      tl.fromTo(w, { opacity: 0, scale: 0.92, yPercent: 12 }, { opacity: 1, scale: 1, yPercent: 0, duration: 1 });
      if (i < words.length - 1) tl.to(w, { opacity: 0, scale: 1.04, yPercent: -12, duration: 1 }, "+=0.4");
    });
  }

  /* projekty — jemný parallax obrázků při stackování */
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

  /* countery */
  document.querySelectorAll(".count").forEach((el) => {
    const target = +el.dataset.count;
    gsap.fromTo(el, { innerText: 0 }, {
      innerText: target,
      duration: 2, ease: "power2.out", snap: { innerText: 1 },
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });

  /* scramble text u služeb a procesních karet */
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/\\";
  function scramble(el) {
    const original = el.dataset.text || (el.dataset.text = el.textContent);
    let frame = 0;
    const total = Math.max(14, original.length * 2.2);
    const timer = setInterval(() => {
      frame++;
      el.textContent = original
        .split("")
        .map((ch, i) => {
          if (ch === " ") return " ";
          return i < (frame / total) * original.length
            ? ch
            : CHARS[Math.floor(Math.random() * CHARS.length)];
        })
        .join("");
      if (frame >= total) { el.textContent = original; clearInterval(timer); }
    }, 30);
  }
  document.querySelectorAll(".scramble, .scramble-title").forEach((el) => {
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: () => scramble(el),
    });
  });

  /* obecný fade-up pro karty a bloky */
  const fadeUps = [
    ".service", ".process-card", ".why__grid > .card", ".plan", ".member",
    ".qa", ".quote-card", ".blog-card", ".testi__intro", ".testi__spotlight",
    ".expert > *", ".impact__quote", ".projects__more", ".team__foot > *",
  ];
  fadeUps.forEach((sel) => {
    gsap.utils.toArray(sel).forEach((el, i) => {
      gsap.from(el, {
        y: 44, opacity: 0, duration: 1, ease: "power3.out", delay: (i % 4) * 0.07,
        scrollTrigger: { trigger: el, start: "top 92%" },
      });
    });
  });

  /* giant "služby" — horizontální posun při scrollu */
  const giant = document.querySelector(".services__giant");
  if (giant) {
    gsap.fromTo(giant, { xPercent: 4 }, {
      xPercent: -4, ease: "none",
      scrollTrigger: { trigger: giant, start: "top bottom", end: "bottom top", scrub: true },
    });
  }

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

  /* nav — schování při scrollu dolů */
  let lastY = 0;
  ScrollTrigger.create({
    onUpdate: (self) => {
      const y = self.scroll();
      const nav = document.getElementById("nav");
      if (!nav) return;
      nav.style.transform = y > lastY && y > 300 ? "translateY(-100%)" : "translateY(0)";
      nav.style.transition = "transform .45s";
      lastY = y;
    },
  });
})();
