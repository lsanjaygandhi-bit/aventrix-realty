/* =====================================================================
   AVENTRIX REALTY — HOMEPAGE "FUTURE PROPERTIES" RAIL ARROWS
   The rail itself is pure CSS (css/home-hero.css, "FUTURE PROPERTIES
   RAIL") on the existing #futurePropertiesGrid, so swipe / trackpad /
   keyboard scrolling work even if this file never loads. This only
   adds the Previous / Next buttons in the section heading:
     - shown only when the cards overflow the row, and not in Map View
     - disabled at the start / end of the row
     - each press moves by one visible "page" of cards
   It never changes the cards, their data or js/home-app-experience.js.
   ===================================================================== */
(function () {
    "use strict";
    var grid = document.getElementById("futurePropertiesGrid");
    var controls = document.getElementById("hpRailControls");
    var prev = document.getElementById("hpRailPrev");
    var next = document.getElementById("hpRailNext");
    if (!grid || !controls || !prev || !next) return;

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ticking = false;

    function cardStep() {
        var card = grid.querySelector(".home-app-property-card");
        if (!card) return grid.clientWidth;
        var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
        var w = card.getBoundingClientRect().width + gap;
        // One full "page" of whole cards, at least one card.
        return Math.max(w, Math.floor(grid.clientWidth / w) * w);
    }

    function update() {
        ticking = false;
        var overflow = grid.scrollWidth - grid.clientWidth > 2;
        controls.hidden = grid.hidden || !overflow;
        if (controls.hidden) return;
        prev.disabled = grid.scrollLeft <= 2;
        next.disabled = grid.scrollLeft >= grid.scrollWidth - grid.clientWidth - 2;
    }
    function schedule() {
        if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    function go(dir) {
        grid.scrollBy({ left: dir * cardStep(), behavior: reduceMotion ? "auto" : "smooth" });
    }

    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    grid.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // Cards arrive asynchronously (Supabase), and the List / Map toggle
    // flips grid.hidden — re-check on both.
    if ("MutationObserver" in window) {
        new MutationObserver(schedule).observe(grid, { childList: true, attributes: true, attributeFilter: ["hidden"] });
    }
    document.addEventListener("aventrix:home-properties", schedule);
    window.addEventListener("load", schedule);
    // Lazy images can change card heights but not widths; one late check is enough.
    setTimeout(schedule, 1200);
    update();
})();
