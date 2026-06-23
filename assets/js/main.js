document.addEventListener("DOMContentLoaded", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobileViewport = window.matchMedia("(max-width: 767px)").matches;
  const introSplash = document.querySelector("#intro-splash");
  const introStorageKey = "akrd_intro_seen";

  if (introSplash) {
    const introVideo = introSplash.querySelector("video");
    const introSkip = introSplash.querySelector(".intro-skip");
    let introFinished = false;
    let introFailsafe = 0;
    let introRemovalFallback = 0;

    const rememberIntro = () => {
      try {
        localStorage.setItem(introStorageKey, "1");
      } catch (error) {
        console.warn("[intro splash] Could not persist the seen state.", error);
      }
    };

    const removeIntro = () => {
      window.clearTimeout(introRemovalFallback);
      introVideo?.pause();
      introSplash.hidden = true;
      introSplash.remove();
      document.documentElement.classList.remove("intro-pending");
      document.documentElement.classList.add("skip-intro");
    };

    const finishIntro = (immediate = false) => {
      if (introFinished) return;
      introFinished = true;
      window.clearTimeout(introFailsafe);
      rememberIntro();

      if (immediate) {
        removeIntro();
        return;
      }

      introSplash.classList.add("is-hiding");
      introSplash.addEventListener("transitionend", removeIntro, { once: true });
      introRemovalFallback = window.setTimeout(removeIntro, 500);
    };

    let introSeen = false;
    try {
      introSeen = localStorage.getItem(introStorageKey) === "1";
    } catch (error) {
      console.warn("[intro splash] Could not read the seen state.", error);
    }

    if (introSeen || reduceMotion || document.documentElement.classList.contains("skip-intro")) {
      if (reduceMotion) rememberIntro();
      finishIntro(true);
    } else if (introVideo) {
      const sourceNames = mobileViewport
        ? ["mobileWebm", "mobileMp4"]
        : ["desktopWebm", "desktopMp4"];
      const sourceTypes = ["video/webm", "video/mp4"];

      sourceNames.forEach((sourceName, index) => {
        const source = document.createElement("source");
        source.src = introVideo.dataset[sourceName];
        source.type = sourceTypes[index];
        introVideo.append(source);
      });

      introSkip?.addEventListener("click", () => finishIntro());
      introVideo.addEventListener("ended", () => finishIntro(), { once: true });
      introVideo.addEventListener("error", () => finishIntro(), { once: true });
      introFailsafe = window.setTimeout(() => finishIntro(), 4500);
      introVideo.load();
      introVideo.play().catch(() => finishIntro());
    } else {
      finishIntro(true);
    }
  }

  const nav = document.querySelector("#nav");
  const hamburger = document.querySelector("#hamburger");
  const menuOverlay = document.querySelector("#menuOverlay");
  const menuPanel = menuOverlay?.querySelector(".menu-panel") || null;

  const scrollSubscribers = new Set();
  const scrollState = {
    y: 0,
    max: 0,
    progress: 0,
    viewportHeight: window.innerHeight
  };
  let scrollTicking = false;

  const updateScrollState = () => {
    scrollState.y = window.scrollY;
    scrollState.max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    scrollState.progress = scrollState.max === 0
      ? 1
      : Math.min(1, Math.max(0, scrollState.y / scrollState.max));
    scrollState.viewportHeight = window.innerHeight;
    nav?.classList.toggle("scrolled", scrollState.y > 32);
    scrollSubscribers.forEach((subscriber) => subscriber(scrollState));
    scrollTicking = false;
  };

  const requestScrollUpdate = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateScrollState);
  };

  const subscribeToScroll = (subscriber) => {
    scrollSubscribers.add(subscriber);
    subscriber(scrollState);
    return () => scrollSubscribers.delete(subscriber);
  };

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });

  if (document.querySelector(".field-sequence-section")) {
    document.querySelectorAll(
      ".media-card, .infrastructure-proof-primary, .case-study-card, .comparison-card, .proof-photo"
    ).forEach((card) => card.setAttribute("data-reveal-3d", ""));
  }

  const revealItems = [...document.querySelectorAll("[data-reveal]")];
  revealItems.forEach((element) => {
    const delay = Math.max(0, Number.parseInt(element.dataset.delay || "0", 10) || 0);
    element.style.transitionDelay = reduceMotion ? "0ms" : `${delay}ms`;
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((element) => element.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    revealItems.forEach((element) => revealObserver.observe(element));
  }

  const pipeline = document.createElement("div");
  const pipelineFill = document.createElement("div");
  pipeline.className = "pipeline-progress";
  pipeline.setAttribute("aria-hidden", "true");
  pipelineFill.className = "pipeline-progress__fill";
  pipeline.append(pipelineFill);
  document.body.append(pipeline);
  subscribeToScroll(({ progress }) => {
    pipeline.style.setProperty("--pipeline-progress", progress.toFixed(4));
  });

  if (hamburger && menuOverlay && menuPanel) {
    let lastFocusedElement = null;
    menuOverlay.setAttribute("aria-hidden", "true");
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");
    const isMenuOpen = () => hamburger.getAttribute("aria-expanded") === "true";

    const closeMenu = (returnFocus = true) => {
      if (!isMenuOpen()) return;
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.setAttribute("aria-label", "Open menu");
      hamburger.classList.remove("is-open", "active");
      menuOverlay.classList.remove("is-active", "active", "open");
      menuOverlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("menu-open");
      if (returnFocus) (lastFocusedElement || hamburger).focus();
    };

    const openMenu = () => {
      lastFocusedElement = document.activeElement;
      hamburger.setAttribute("aria-expanded", "true");
      hamburger.setAttribute("aria-label", "Close menu");
      hamburger.classList.add("is-open", "active");
      menuOverlay.classList.add("is-active", "active", "open");
      menuOverlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("menu-open");
      window.requestAnimationFrame(() => menuPanel.querySelector(focusableSelector)?.focus());
    };

    hamburger.addEventListener("click", () => {
      if (isMenuOpen()) closeMenu();
      else openMenu();
    });

    menuOverlay.addEventListener("click", (event) => {
      if (event.target === menuOverlay) closeMenu();
    });

    menuPanel.querySelectorAll("a[href]").forEach((link) => {
      link.addEventListener("click", () => closeMenu(false));
    });

    document.addEventListener("keydown", (event) => {
      if (!isMenuOpen()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...menuPanel.querySelectorAll(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    window.matchMedia("(min-width: 54rem)").addEventListener?.("change", (event) => {
      if (event.matches) closeMenu(false);
    });
  }

  document.querySelectorAll(".compare-pair").forEach((pair) => {
    const panels = [...pair.querySelectorAll(".compare-panel")];
    const setActive = (activePanel) => {
      pair.classList.toggle("is-comparing", Boolean(activePanel));
      panels.forEach((panel) => panel.classList.toggle("is-active", panel === activePanel));
    };
    panels.forEach((panel) => {
      panel.addEventListener("pointerenter", () => setActive(panel));
      panel.addEventListener("pointerleave", () => setActive(null));
      panel.addEventListener("focus", () => setActive(panel));
      panel.addEventListener("blur", () => setActive(null));
    });
  });

  document.querySelectorAll("img, video").forEach((media) => {
    const container = media.closest(
      ".photo-frame, .proof-photo, .comparison-card, .community-photo, .system-panel-dark, .video-frame, .media-card"
    );
    if (!container) return;
    const markLoaded = () => {
      container.classList.add("media-loaded");
      container.classList.remove("media-failed", "video-frame--empty");
      if (media.tagName === "VIDEO") container.classList.add("video-ready");
    };
    const markFailed = () => {
      container.classList.add("media-failed");
      container.classList.remove("media-loaded", "video-ready");
      if (container.classList.contains("video-frame")) container.classList.add("video-frame--empty");
    };
    if (media.tagName === "IMG" && media.complete) {
      if (media.naturalWidth > 0) markLoaded();
      else markFailed();
    } else if (media.tagName === "VIDEO" && media.readyState >= 2) {
      markLoaded();
    }
    media.addEventListener(media.tagName === "VIDEO" ? "loadeddata" : "load", markLoaded, { once: true });
    media.addEventListener("error", markFailed, { once: true });
  });

  const hero = document.querySelector("[data-hero-webgl]");
  if (hero) {
    const heroSection = hero.closest(".hero");
    const canvasHost = hero.querySelector("[data-hero-canvas]");

    if (mobileViewport && heroSection) {
      heroSection.classList.add("is-mobile-static");
      if (!reduceMotion) {
        subscribeToScroll(({ y, viewportHeight }) => {
          const localProgress = Math.min(1, Math.max(0, y / Math.max(1, viewportHeight)));
          heroSection.style.setProperty("--hero-mobile-shift", `${localProgress * 1.25}rem`);
        });
      }
    }

    if (!mobileViewport && !reduceMotion && canvasHost) {
      let initialized = false;

      const initializeWebGLHero = () => {
        if (initialized || !window.THREE) return;
        initialized = true;

        try {
          const THREE = window.THREE;
          const renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: true,
            powerPreference: "high-performance"
          });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          canvasHost.append(renderer.domElement);

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20);
          camera.position.z = 2.5;
          const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
          const video = document.createElement("video");
          video.src = hero.dataset.videoSrc;
          video.poster = hero.dataset.posterSrc;
          video.muted = true;
          video.defaultMuted = true;
          video.autoplay = true;
          video.loop = true;
          video.playsInline = true;
          video.preload = "auto";
          video.setAttribute("autoplay", "");
          video.setAttribute("muted", "");
          video.setAttribute("loop", "");
          video.setAttribute("playsinline", "");
          video.setAttribute("aria-hidden", "true");

          let mesh = null;
          let renderFrame = 0;
          let inHeroRange = true;
          let latestLocalProgress = 0;

          const sizePlaneToCover = () => {
            if (!mesh) return;
            const width = canvasHost.clientWidth || window.innerWidth;
            const height = canvasHost.clientHeight || window.innerHeight;
            renderer.setSize(width, height, false);
            camera.aspect = width / Math.max(1, height);
            camera.updateProjectionMatrix();

            const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
            const visibleWidth = visibleHeight * camera.aspect;
            const videoAspect = 16 / 9;
            const planeWidth = camera.aspect > videoAspect ? visibleWidth : visibleHeight * videoAspect;
            const planeHeight = camera.aspect > videoAspect ? visibleWidth / videoAspect : visibleHeight;
            mesh.scale.set(planeWidth * 1.04, planeHeight * 1.04, 1);
          };

          const applyScrollTransform = () => {
            if (!mesh) return;
            mesh.rotation.x = -0.11 * latestLocalProgress;
            mesh.rotation.z = 0.012 * latestLocalProgress;
            mesh.position.z = -0.38 * latestLocalProgress;
            mesh.position.y = 0.08 * latestLocalProgress;
            const scale = 1 - 0.075 * latestLocalProgress;
            mesh.scale.multiplyScalar(scale / (mesh.userData.scrollScale || 1));
            mesh.userData.scrollScale = scale;
          };

          const render = () => {
            renderFrame = 0;
            if (!inHeroRange || !mesh) return;
            applyScrollTransform();
            renderer.render(scene, camera);
            renderFrame = window.requestAnimationFrame(render);
          };

          const ensureRendering = () => {
            if (inHeroRange && mesh && !renderFrame) renderFrame = window.requestAnimationFrame(render);
            if (!inHeroRange && renderFrame) {
              window.cancelAnimationFrame(renderFrame);
              renderFrame = 0;
            }
          };

          const unsubscribe = subscribeToScroll(({ y, viewportHeight }) => {
            const heroHeight = Math.max(heroSection?.offsetHeight || viewportHeight, 1);
            latestLocalProgress = Math.min(1, Math.max(0, y / heroHeight));
            inHeroRange = y <= heroHeight;
            if (!inHeroRange && !video.paused) {
              video.pause();
            } else if (inHeroRange && mesh && video.paused) {
              video.play().catch((error) => {
                console.warn("[hero WebGL] Video could not resume; keeping the last rendered frame.", error);
              });
            }
            ensureRendering();
          });

          const handleResize = () => {
            if (!mesh) return;
            sizePlaneToCover();
            mesh.userData.scrollScale = 1;
            applyScrollTransform();
            if (inHeroRange) renderer.render(scene, camera);
          };
          window.addEventListener("resize", handleResize, { passive: true });

          const activateTexture = async () => {
            const texture = new THREE.VideoTexture(video);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            const material = new THREE.MeshBasicMaterial({ map: texture });
            mesh = new THREE.Mesh(geometry, material);
            mesh.userData.scrollScale = 1;
            scene.add(mesh);
            sizePlaneToCover();
            applyScrollTransform();

            try {
              await video.play();
              renderer.render(scene, camera);
              heroSection?.classList.add("is-webgl-ready");
              ensureRendering();
            } catch (error) {
              console.warn("[hero WebGL] Video autoplay was blocked; using the static poster fallback.", error);
              unsubscribe();
              texture.dispose();
              material.dispose();
              geometry.dispose();
              renderer.dispose();
              renderer.domElement.remove();
            }
          };

          video.addEventListener("loadeddata", activateTexture, { once: true });
          video.addEventListener("error", () => {
            console.warn("[hero WebGL] Hero video failed to load; using the static poster fallback.");
            unsubscribe();
            geometry.dispose();
            renderer.dispose();
            renderer.domElement.remove();
          }, { once: true });
          video.load();
        } catch (error) {
          console.warn("[hero WebGL] WebGL initialization failed; using the static poster fallback.", error);
        }
      };

      if (window.THREE) initializeWebGLHero();
      else window.addEventListener("three-ready", initializeWebGLHero, { once: true });
    }
  }

  requestScrollUpdate();

  const threadTree = document.getElementById("threadTree");
  if (threadTree) {
    const reduceMotionThread = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mainNodes = [...threadTree.querySelectorAll("[data-thread-main]")];
    const branches = [...threadTree.querySelectorAll("[data-thread-branch]")];

    if (reduceMotionThread) {
      mainNodes.forEach((node) => node.classList.add("is-lit"));
      branches.forEach((branch) => {
        branch.querySelectorAll("[data-thread-leaf]").forEach((leaf) => leaf.classList.add("is-lit"));
        const fill = branch.querySelector(".thread-branch-fill");
        if (fill) fill.style.height = "100%";
      });
    } else {
      const updateThread = () => {
        const viewportThreshold = window.innerHeight * 0.72;

        mainNodes.forEach((node) => {
          const rect = node.getBoundingClientRect();
          node.classList.toggle("is-lit", rect.top < viewportThreshold);
        });

        branches.forEach((branch) => {
          const leaves = [...branch.querySelectorAll("[data-thread-leaf]")];
          leaves.forEach((leaf) => {
            const rect = leaf.getBoundingClientRect();
            leaf.classList.toggle("is-lit", rect.top < viewportThreshold);
          });

          const line = branch.querySelector(".thread-branch-line");
          const fill = branch.querySelector(".thread-branch-fill");
          if (line && fill) {
            const lineRect = line.getBoundingClientRect();
            const visible = viewportThreshold - lineRect.top;
            const pct = Math.max(0, Math.min(1, visible / lineRect.height));
            fill.style.height = `${pct * 100}%`;
          }
        });
      };

      let threadFrame = null;
      const requestThreadUpdate = () => {
        if (threadFrame) return;
        threadFrame = requestAnimationFrame(() => {
          threadFrame = null;
          updateThread();
        });
      };

      window.addEventListener("scroll", requestThreadUpdate, { passive: true });
      window.addEventListener("resize", requestThreadUpdate, { passive: true });
      requestThreadUpdate();
    }
  }

  const motionTargets = document.querySelector(
    "[data-split-heading], .proof-stats, [data-values-pin], " +
    "[data-service-steps], [data-draw-border], .pipeline-section, .day-night-section, " +
    "#gallery-grid, .portfolio-grid, #map"
  );
  if (motionTargets) {
    const motionScript = document.createElement("script");
    motionScript.src = "assets/js/motion.js";
    motionScript.defer = true;
    document.body.append(motionScript);
  }
});
