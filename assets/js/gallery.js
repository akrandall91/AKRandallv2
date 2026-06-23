(function () {
  "use strict";

  const projects = Array.isArray(window.PROJECTS_DATA) ? window.PROJECTS_DATA : [];
  const grid = document.getElementById("gallery-grid");
  const count = document.getElementById("gallery-count");
  const stateSelect = document.getElementById("gallery-state");
  const modal = document.getElementById("gallery-modal");
  const modalContent = document.getElementById("gallery-modal-content");
  let activeCategory = "all";
  let activeState = "all";

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function stateOf(project) {
    const parts = String(project.city_state || "").split(",");
    return parts.length > 1 ? parts.pop().trim() : "";
  }

  function cardHtml(project) {
    const images = Array.isArray(project.gallery_images) ? project.gallery_images : [];
    const documented = project.documentation_status === "documented" && images.length;
    const coldBadge = project.cold_rfp_win
      ? '<span class="gallery-badge gallery-badge--cold">Cold RFP Win</span>'
      : "";
    const media = documented
      ? `<img src="${esc(images[0])}" alt="${esc(project.name)} project documentation" loading="lazy" width="800" height="600">`
      : '<div class="gallery-placeholder" aria-hidden="true"><span>Documentation<br>in progress</span></div>';
    const body = `
      <div class="gallery-card-media">${media}</div>
      <div class="gallery-card-copy">
        <span class="gallery-card-category">${esc(project.category)}</span>
        <h3>${esc(project.name || project.id)}</h3>
        <p>${esc(project.city_state)}</p>
        <div class="gallery-card-meta">${coldBadge}<span>${esc(project.deal_type || "Project record")}</span></div>
      </div>`;
    return documented
      ? `<article class="gallery-card" data-project-id="${esc(project.id)}" data-category="${esc(project.category)}" data-state="${esc(stateOf(project))}"><button type="button" class="gallery-card-button" aria-label="Open details for ${esc(project.name)}">${body}</button></article>`
      : `<article class="gallery-card gallery-card--pending" data-project-id="${esc(project.id)}" data-category="${esc(project.category)}" data-state="${esc(stateOf(project))}">${body}</article>`;
  }

  function buildGallery() {
    if (!grid) return;
    grid.innerHTML = projects.map(cardHtml).join("");
    const states = [...new Set(projects.map(stateOf).filter(Boolean))].sort();
    states.forEach(state => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      stateSelect.appendChild(option);
    });
    grid.querySelectorAll(".gallery-card-button").forEach(button => {
      button.addEventListener("click", () => {
        const card = button.closest(".gallery-card");
        openProject(card.dataset.projectId);
      });
    });
    applyFilters();
  }

  function applyFilters() {
    let visible = 0;
    const update = () => {
      grid.querySelectorAll(".gallery-card").forEach(card => {
        const show = (activeCategory === "all" || card.dataset.category === activeCategory)
          && (activeState === "all" || card.dataset.state === activeState);
        card.hidden = !show;
        if (show) visible += 1;
      });
    };
    if (window.akrdFlipFilter) window.akrdFlipFilter(grid, update);
    else update();
    count.textContent = `${visible} of ${projects.length} projects`;
  }

  function openProject(id) {
    const project = projects.find(item => item.id === id);
    if (!project || !project.gallery_images || !project.gallery_images.length) return;
    const paragraphs = String(project.backstory || project.description || "Project documentation is being assembled.")
      .split(/\n\s*\n/).filter(Boolean).map(text => `<p>${esc(text)}</p>`).join("");
    const maps = project.google_maps_url
      ? `<a class="btn btn-secondary" href="${esc(project.google_maps_url)}" target="_blank" rel="noopener">View on Maps</a>`
      : "";
    modalContent.innerHTML = `
      <div class="gallery-modal-images">
        ${project.gallery_images.map((src, index) => `<img src="${esc(src)}" alt="${esc(project.name)} field view ${index + 1}" loading="${index ? "lazy" : "eager"}">`).join("")}
      </div>
      <div class="gallery-modal-copy">
        <span class="label">${esc(project.category)}</span>
        <h2 id="gallery-modal-title">${esc(project.name)}</h2>
        <p class="gallery-modal-location">${esc(project.city_state)}</p>
        <div class="gallery-modal-story">${paragraphs}</div>
        ${maps}
      </div>`;
    modal.showModal();
  }

  function handleHash() {
    if (!location.hash) return;
    let id = "";
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    const card = [...grid.querySelectorAll(".gallery-card")].find(item => item.dataset.projectId === id);
    if (!card) return;
    activeCategory = "all";
    activeState = "all";
    stateSelect.value = "all";
    document.querySelectorAll("[data-gallery-category]").forEach(button => {
      button.classList.toggle("active", button.dataset.galleryCategory === "all");
    });
    applyFilters();
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("is-highlighted");
    window.setTimeout(() => card.classList.remove("is-highlighted"), 2400);
    openProject(id);
  }

  document.querySelectorAll("[data-gallery-category]").forEach(button => {
    button.addEventListener("click", () => {
      activeCategory = button.dataset.galleryCategory;
      document.querySelectorAll("[data-gallery-category]").forEach(item => item.classList.toggle("active", item === button));
      applyFilters();
    });
  });
  stateSelect.addEventListener("change", () => {
    activeState = stateSelect.value;
    applyFilters();
  });
  document.querySelector(".gallery-modal-close").addEventListener("click", () => modal.close());
  modal.addEventListener("click", event => {
    if (event.target === modal) modal.close();
  });
  window.addEventListener("hashchange", handleHash);

  buildGallery();
  handleHash();
})();
