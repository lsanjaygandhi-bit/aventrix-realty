/* =====================================================================
   AVENTRIX REALTY — SHARED SITE FOOTER (partials/footer.html)
   The footer is static HTML on every page; this file only keeps the
   copyright and designer credit on two lines.
   Admin → Site Settings stores the copyright as one string, e.g.
     "© 2026 Aventrix Realty. All Rights Reserved. | Designed with ❤️ by L. Sanjay Gandhi"
   js/public-site-settings.js writes that string into
   [data-site="copyright-text"]. When it contains " | ", the part after
   the bar goes into .ft-designer and the first part stays in place.
   If the stored value has no bar, both lines are left as they are.
   ===================================================================== */
(function () {
    "use strict";
    var footer = document.querySelector(".site-footer");
    if (!footer) return;
    var copy = footer.querySelector('[data-site="copyright-text"]');
    var designer = footer.querySelector(".ft-designer");
    if (!copy || !designer) return;

    function split() {
        var text = copy.textContent || "";
        var at = text.indexOf("|");
        if (at === -1) return;
        var first = text.slice(0, at).trim();
        var second = text.slice(at + 1).trim();
        if (first) copy.textContent = first;          // no "|" left, so no loop
        if (second && second !== designer.textContent.trim()) designer.textContent = second;
    }

    split();
    if ("MutationObserver" in window) {
        new MutationObserver(split).observe(copy, { childList: true, characterData: true, subtree: true });
    }
})();
