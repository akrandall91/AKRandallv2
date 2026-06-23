(function () {
  "use strict";

  const CDN = "https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/";
  const needs = {
    ScrollTrigger: Boolean(document.querySelector(
      ".proof-stats, [data-values-pin], [data-service-steps], [data-draw-border], .pipeline-section, .day-night-section"
    )),
    SplitText: Boolean(document.querySelector("[data-split-heading]")),
    DrawSVGPlugin: Boolean(document.querySelector("[data-draw-border], #map")),
    Flip: Boolean(document.querySelector("#gallery-grid, .portfolio-grid, #map"))
  };

  function load(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  async function boot() {
    try {
      await load(`${CDN}gsap.min.js`);
      const plugins = Object.entries(needs).filter(([, required]) => required);
      await Promise.all(plugins.map(([name]) => load(`${CDN}${name}.min.js`)));
      const loaded = plugins.map(([name]) => window[name]).filter(Boolean);
      if (loaded.length) window.gsap.registerPlugin(...loaded);
      initialize();
      window.dispatchEvent(new CustomEvent("akrd-motion-ready"));
    } catch (error) {
      console.warn("[motion] GSAP could not load; keeping the existing reveal system.", error);
    }
  }

  function initialize() {
    const mm = window.gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const animateNumberedSequence = ({
        section,
        items,
        from,
        end
      }) => {
        if (!section || !items.length || !window.ScrollTrigger) return;
        window.gsap.fromTo(items, from, {
          x: 0,
          xPercent: 0,
          y: 0,
          stagger: 0.8,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top+=90",
            end,
            pin: true,
            scrub: true
          }
        });
      };

      document.querySelectorAll("[data-split-heading]").forEach((heading) => {
        if (!window.SplitText) return;
        const split = new window.SplitText(heading, { type: "words" });
        window.gsap.from(split.words, {
          yPercent: 110,
          opacity: 0,
          duration: 0.75,
          stagger: 0.045,
          ease: "power3.out"
        });
      });

      const proofBar = document.querySelector(".proof-stats");
      if (proofBar && window.ScrollTrigger) {
        proofBar.querySelectorAll(".stat strong").forEach((number) => {
          const target = Number.parseInt(number.textContent, 10);
          if (!Number.isFinite(target)) return;
          const value = { current: 0 };
          window.gsap.to(value, {
            current: target,
            ease: "none",
            scrollTrigger: { trigger: proofBar, start: "top 85%", end: "bottom 55%", scrub: true },
            onUpdate: () => { number.textContent = String(Math.round(value.current)); }
          });
        });
      }

      const values = document.querySelector("[data-values-pin]");
      if (values && window.ScrollTrigger) {
        window.gsap.from(values.children, {
          opacity: 0.15,
          x: 48,
          stagger: 0.7,
          ease: "none",
          scrollTrigger: {
            trigger: values.closest(".page-section"),
            start: "top top+=90",
            end: "+=1100",
            pin: true,
            scrub: true
          }
        });
      }

      document.querySelectorAll("[data-service-steps]").forEach((section) => {
        const steps = section.querySelectorAll(".system-row");
        animateNumberedSequence({
          section,
          items: steps,
          from: { y: 64 },
          end: "+=1200"
        });
      });

      document.querySelectorAll("[data-draw-border]").forEach((callout) => {
        if (!window.DrawSVGPlugin) return;
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        const rect = document.createElementNS(ns, "rect");
        svg.setAttribute("class", "draw-border");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.setAttribute("preserveAspectRatio", "none");
        rect.setAttribute("x", "1");
        rect.setAttribute("y", "1");
        rect.setAttribute("width", "98");
        rect.setAttribute("height", "98");
        svg.append(rect);
        callout.append(svg);
        window.gsap.from(rect, {
          drawSVG: 0,
          duration: 1.25,
          ease: "power2.out",
          scrollTrigger: { trigger: callout, start: "top 80%" }
        });
      });

      const pipeline = document.querySelector(".pipeline-section");
      if (pipeline) {
        animateNumberedSequence({
          section: pipeline,
          items: pipeline.querySelectorAll(".pipeline-card"),
          from: { xPercent: 35 },
          end: "+=1400"
        });
      }

      const dayNight = document.querySelector(".day-night-section");
      if (dayNight) {
        const night = dayNight.querySelector(".comparison-card--night");
        window.gsap.fromTo(night, { opacity: 0 }, {
          opacity: 1,
          ease: "none",
          scrollTrigger: { trigger: dayNight, start: "top 70%", end: "bottom 35%", scrub: true }
        });
      }

      document.querySelectorAll("#gallery-grid .gallery-card, .portfolio-grid .portfolio-card").forEach((card) => {
        card.classList.add("is-magnetic");
        card.addEventListener("pointermove", (event) => {
          const box = card.getBoundingClientRect();
          window.gsap.to(card, {
            x: (event.clientX - box.left - box.width / 2) * 0.035,
            y: (event.clientY - box.top - box.height / 2) * 0.035,
            duration: 0.25
          });
        });
        card.addEventListener("pointerleave", () => window.gsap.to(card, { x: 0, y: 0, duration: 0.45 }));
      });

    });

    if (window.Flip) {
      window.akrdFlipFilter = (container, mutate) => {
        const items = [...container.children];
        const state = window.Flip.getState(items);
        mutate();
        window.Flip.from(state, {
          duration: 0.55,
          ease: "power2.inOut",
          absolute: true,
          onEnter: (elements) => window.gsap.fromTo(elements, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
          onLeave: (elements) => window.gsap.to(elements, { opacity: 0, duration: 0.2 })
        });
      };
    }
  }

  boot();
})();
