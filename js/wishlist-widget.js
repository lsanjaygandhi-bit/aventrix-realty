/*
 * AVENTRIX REALTY — NAV WISHLIST + SHORTLIST WIDGET
 * ----------------------------------------------------
 * Injects a Wishlist heart icon and a Shortlist/Compare icon, each
 * with a live count badge, into the header's `.nav-right` (next to
 * the phone number) on every page that loads this script. Purely
 * additive — no existing header markup is changed, this only
 * inserts two new elements. Requires js/aventrix-storage.js first.
 *
 * Relies on `.nav-right{ display:flex; align-items:center; gap:14px; }`
 * in style.css for alignment/spacing — that rule is what keeps these
 * icons and the phone link on one clean row without growing the
 * header's height.
 */

(function () {
    function init() {
        const navRight = document.querySelector(".nav-right");
        if (!navRight || !window.AventrixStorage) return;

        const shortlistLink = document.createElement("a");
        shortlistLink.href = "shortlist.html";
        shortlistLink.className = "nav-wishlist-link nav-shortlist-link";
        shortlistLink.setAttribute("aria-label", "My Shortlist & Compare");
        // Regular (outline) style instead of solid -- per request, this
        // header icon should read as a clean thin-line bookmark outline
        // with a white/transparent interior, not a solid filled green
        // shape. Same existing brand green (.nav-wishlist-link's color)
        // is still used for the outline itself -- no new colour
        // introduced. Heart/Profile/Phone icons are untouched.
        shortlistLink.innerHTML = `<i class="far fa-bookmark" aria-hidden="true"></i><span class="nav-wishlist-count" hidden>0</span>`;

        const wishlistLink = document.createElement("a");
        wishlistLink.href = "wishlist.html";
        wishlistLink.className = "nav-wishlist-link";
        wishlistLink.setAttribute("aria-label", "My Saved Properties");
        wishlistLink.innerHTML = `<i class="fas fa-heart" aria-hidden="true"></i><span class="nav-wishlist-count" hidden>0</span>`;

        navRight.insertBefore(shortlistLink, navRight.firstChild);
        navRight.insertBefore(wishlistLink, navRight.firstChild);

        function refreshBadge(link, count) {
            const badge = link.querySelector(".nav-wishlist-count");
            if (count > 0) {
                badge.hidden = false;
                badge.textContent = count > 99 ? "99+" : String(count);
            } else {
                badge.hidden = true;
            }
        }

        function refreshWishlistCount() { refreshBadge(wishlistLink, window.AventrixStorage.wishlist.count()); }
        function refreshShortlistCount() { refreshBadge(shortlistLink, window.AventrixStorage.shortlist.count()); }

        refreshWishlistCount();
        refreshShortlistCount();
        window.addEventListener("aventrix:wishlist-changed", refreshWishlistCount);
        window.addEventListener("aventrix:shortlist-changed", refreshShortlistCount);
        // Keeps badges correct if either list was changed in another tab.
        window.addEventListener("storage", (e) => {
            if (e.key === "aventrix:wishlist") refreshWishlistCount();
            if (e.key === "aventrix:shortlist") refreshShortlistCount();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
