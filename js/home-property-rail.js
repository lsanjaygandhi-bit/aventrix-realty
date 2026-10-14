/* =====================================================================
   AVENTRIX REALTY — HOMEPAGE "FUTURE PROPERTIES" RAIL CONTROLS
   The rail itself is pure CSS (css/home-hero.css, "FUTURE PROPERTIES
   RAIL") on the existing #futurePropertiesGrid, so swipe / trackpad /
   keyboard scrolling work even if this file never loads. This adds:
     - desktop / tablet: Previous / Next in the section heading
       (#hpRailPrev / #hpRailNext), moving one visible "page" of cards
     - phones: Previous / Next + "2 / 20" under the single card
       (#hpRailPrevM / #hpRailNextM / #hpRailCount), moving one card
   Controls are shown only when the cards overflow the row and are
   hidden in Map View; buttons are disabled at the first / last card.
   It never changes the cards, their data or js/home-app-experience.js.
   ===================================================================== */
(function () {
    "use strict";
    var grid = document.getElementById("futurePropertiesGrid");
    if (!grid) return;

    var desk = {
        wrap: document.getElementById("hpRailControls"),
        prev: document.getElementById("hpRailPrev"),
        next: document.getElementById("hpRailNext")
    };
    var mob = {
        wrap: document.getElementById("hpRailMobileNav"),
        prev: document.getElementById("hpRailPrevM"),
        next: document.getElementById("hpRailNextM"),
        count: document.getElementById("hpRailCount")
    };

    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ticking = false;

    function cards() { return grid.querySelectorAll(".home-app-property-card"); }
    function stride() {
        var card = cards()[0];
        if (!card) return 0;
        var gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
        return card.getBoundingClientRect().width + gap;
    }
    function pageStep() {
        var w = stride();
        if (!w) return grid.clientWidth;
        // One full "page" of whole cards, at least one card.
        return Math.max(w, Math.floor((grid.clientWidth + 1) / w) * w);
    }

    function update() {
        ticking = false;
        var n = cards().length;
        var maxLeft = grid.scrollWidth - grid.clientWidth;
        var overflow = maxLeft > 2;
        var show = !grid.hidden && overflow && n > 1;
        var atStart = grid.scrollLeft <= 2;
        var atEnd = grid.scrollLeft >= maxLeft - 2;

        [desk, mob].forEach(function (c) {
            if (!c.wrap) return;
            c.wrap.hidden = !show;
            if (c.prev) c.prev.disabled = !show || atStart;
            if (c.next) c.next.disabled = !show || atEnd;
        });

        if (mob.count && show) {
            var w = stride();
            var idx = w ? Math.round(grid.scrollLeft / w) + 1 : 1;
            if (atEnd) idx = n;
            idx = Math.min(n, Math.max(1, idx));
            var text = idx + " / " + n;
            if (mob.count.textContent !== text) mob.count.textContent = text;
        }
    }
    function schedule() {
        if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    function go(step) {
        grid.scrollBy({ left: step, behavior: reduceMotion ? "auto" : "smooth" });
    }

    if (desk.prev) desk.prev.addEventListener("click", function () { go(-pageStep()); });
    if (desk.next) desk.next.addEventListener("click", function () { go(pageStep()); });
    if (mob.prev) mob.prev.addEventListener("click", function () { go(-stride()); });
    if (mob.next) mob.next.addEventListener("click", function () { go(stride()); });

    grid.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // Cards arrive asynchronously (Supabase), and the List / Map toggle
    // flips grid.hidden — re-check on both.
    if ("MutationObserver" in window) {
        new MutationObserver(schedule).observe(grid, { childList: true, attributes: true, attributeFilter: ["hidden"] });
    }
    document.addEventListener("aventrix:home-properties", schedule);
    window.addEventListener("load", schedule);
    setTimeout(schedule, 1200);
    update();
})();
