/*
 * AVENTRIX REALTY — property card image fallback (2026-09-26)
 * If a card image URL from the CMS fails to load (deleted file, bad URL),
 * swap it once for the site's existing fallback image, the same one the
 * card templates already use when a property has no image at all. If
 * the fallback fails too, the <img> is hidden and the card keeps its
 * neutral placeholder background — never a broken-image icon.
 * One capture-phase listener covers every card grid, including cards
 * rendered later by JS. No markup or template changes.
 */
(function () {
    var FALLBACK = "images/property1.jpg";
    var SELECTOR = ".property-card img, .home-app-property-card img";

    function handle(img) {
        if (!img || !img.matches || !img.matches(SELECTOR)) return;
        if (img.getAttribute("data-img-fallback") === "1") {
            img.style.visibility = "hidden";   // fallback also failed
            return;
        }
        img.setAttribute("data-img-fallback", "1");
        img.src = FALLBACK;
    }

    document.addEventListener("error", function (e) { handle(e.target); }, true);

    // Images that already failed before this script ran
    function sweep() {
        document.querySelectorAll(SELECTOR).forEach(function (img) {
            if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) handle(img);
        });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sweep);
    else sweep();
})();
