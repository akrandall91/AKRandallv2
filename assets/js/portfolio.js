document.addEventListener("DOMContentLoaded", () => {
  const grid = document.querySelector(".portfolio-grid");
  const buttons = [...document.querySelectorAll("[data-portfolio-filter]")];
  if (!grid || !buttons.length) return;

  const categoryFor = (card) => {
    const label = card.querySelector(".media-status")?.textContent.toLowerCase() || "";
    if (label.includes("website")) return "website";
    if (label.includes("government")) return "government";
    if (label.includes("infrastructure")) return "infrastructure";
    return "systems";
  };

  grid.querySelectorAll(".portfolio-card").forEach((card) => {
    card.dataset.portfolioCategory = categoryFor(card);
  });

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((item) => item.classList.toggle("active", item === button));
      const filter = button.dataset.portfolioFilter;
      const update = () => {
        grid.querySelectorAll(".portfolio-card").forEach((card) => {
          card.hidden = filter !== "all" && card.dataset.portfolioCategory !== filter;
        });
      };
      if (window.akrdFlipFilter) window.akrdFlipFilter(grid, update);
      else update();
    });
  });
});
