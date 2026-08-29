// ===========================
// HERO VIDEO: ROBUST AUTOPLAY
// Browsers can silently block autoplay in edge cases even when
// muted+playsinline are set (slow connections, first paint timing,
// some in-app browsers). This forces play() at every relevant
// lifecycle point and retries if it's ever paused unexpectedly.
// ===========================
const heroVideo = document.getElementById("heroVideo");

if (heroVideo) {
    const attemptPlay = () => {
        const playPromise = heroVideo.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // Autoplay blocked — retry shortly, and also retry on
                // the next user interaction (tap/scroll), which most
                // browsers will honor even under strict autoplay policies.
                setTimeout(attemptPlay, 300);
            });
        }
    };

    heroVideo.addEventListener("loadedmetadata", attemptPlay);
    heroVideo.addEventListener("canplay", attemptPlay);
    heroVideo.addEventListener("canplaythrough", attemptPlay);

    // In case the video ever pauses unexpectedly (tab throttling, etc.)
    heroVideo.addEventListener("pause", () => {
        if (!document.hidden) attemptPlay();
    });

    document.addEventListener("DOMContentLoaded", attemptPlay);
    window.addEventListener("load", attemptPlay);

    // Last-resort: resume on first user interaction
    ["touchstart", "click", "scroll"].forEach(evt => {
        window.addEventListener(evt, attemptPlay, { once: true, passive: true });
    });

    attemptPlay();
}

// ===========================
// ENQUIRY / OWNER FORM SUBMIT
// Moved to js/enquiry-supabase.js (submits to Supabase instead of
// Formspree). Kept out of this file so this file never needs to
// change again when the backend changes.
// ===========================

// ===========================
// BACK TO TOP
// ===========================
const backToTopBtn = document.getElementById("backToTop");

if (backToTopBtn) {
    const BACK_TO_TOP_SHOW_AFTER = 400; // px scrolled before the button appears

    function updateBackToTopVisibility() {
        if (window.scrollY > BACK_TO_TOP_SHOW_AFTER) {
            backToTopBtn.classList.add("show");
        } else {
            backToTopBtn.classList.remove("show");
        }
    }

    let backToTopTicking = false;
    window.addEventListener("scroll", () => {
        if (!backToTopTicking) {
            window.requestAnimationFrame(() => {
                updateBackToTopVisibility();
                backToTopTicking = false;
            });
            backToTopTicking = true;
        }
    }, { passive: true });

    updateBackToTopVisibility();

    backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// ===========================
// SECTION SCROLL INDICATOR
// Small right-side dashes that track which major section is
// currently in view, using the page's existing section ids.
// Mobile only — the indicator element itself is hidden on desktop
// via CSS (html.is-mobile), so this just wires up behaviour.
// ===========================
(function () {
    const indicator = document.getElementById("sectionScrollIndicator");
    if (!indicator) return;

    const segments = Array.from(indicator.querySelectorAll(".ssi-segment"));
    if (!segments.length) return;

    const sections = segments
        .map((seg) => ({ seg, el: document.getElementById(seg.dataset.target) }))
        .filter((s) => s.el);

    if (!sections.length) return;

    function setActive(id) {
        segments.forEach((seg) => seg.classList.toggle("active", seg.dataset.target === id));
    }

    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
            (entries) => {
                // Pick the entry closest to the vertical centre of the
                // viewport among those currently intersecting, so the
                // active dash tracks scroll position smoothly instead of
                // flickering between adjacent sections.
                let best = null;
                let bestDistance = Infinity;
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const distance = Math.abs(entry.boundingClientRect.top);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        best = entry.target.id;
                    }
                });
                if (best) setActive(best);
            },
            { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
        );

        sections.forEach((s) => observer.observe(s.el));
    }

    // Click/tap a dash -> smooth-scroll to its section (uses existing
    // ids, no new navigation logic beyond a standard smooth scroll).
    // On touch devices there's no hover, so briefly reveal the tooltip
    // on tap too, then auto-hide it — never left permanently visible.
    segments.forEach((seg) => {
        seg.addEventListener("click", (e) => {
            e.preventDefault();
            const target = document.getElementById(seg.dataset.target);
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });

            seg.classList.add("show-tooltip");
            clearTimeout(seg._ssiTooltipTimer);
            seg._ssiTooltipTimer = setTimeout(() => {
                seg.classList.remove("show-tooltip");
            }, 1400);
        });
    });

    setActive("hero");
})();

// ===========================
// PROPERTY DATA + DETAIL PAGE RENDER (property.html)
// Moved to js/public-properties.js (loads from Supabase instead of
// this static object) so new properties never require a code change.
// ===========================

// ===========================
// MOBILE MENU: OPEN / CLOSE
// ===========================
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.querySelector(".main-nav");
const menuOverlay = document.getElementById("menuOverlay");

if (menuToggle && mainNav && menuOverlay) {

    var menuScrollY = 0;
    var menuHistoryPushed = false;

    // Robust scroll lock: fixing the body at its current scroll offset
    // (instead of just overflow:hidden) prevents iOS Safari from
    // silently shifting/rubber-banding the page behind the drawer, and
    // lets us restore the exact scroll position on close.
    function lockBodyScroll() {
        menuScrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.position = "fixed";
        document.body.style.top = "-" + menuScrollY + "px";
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
    }

    function unlockBodyScroll() {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        window.scrollTo(0, menuScrollY);
    }

    // consumeHistory: true when the menu is being closed by an explicit
    // "close" action (toggle button / overlay tap) so we pop the history
    // entry we pushed on open. Left false when closing because the user
    // already pressed Back (fromPopState) or is navigating to a new page
    // via a menu link, since in both of those cases the history stack
    // is already moving on its own.
    function closeMenu(fromPopState, consumeHistory) {
        if (!mainNav.classList.contains("active")) return;

        menuToggle.classList.remove("active");
        mainNav.classList.remove("active");
        menuOverlay.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("mobile-menu-open");

        const dropdown = document.querySelector(".dropdown");
        if (dropdown) {
            dropdown.classList.remove("open");
        }

        unlockBodyScroll();

        if (menuHistoryPushed && consumeHistory && !fromPopState) {
            menuHistoryPushed = false;
            history.back();
        } else {
            menuHistoryPushed = false;
        }
    }

    function openMenu() {
        menuToggle.classList.add("active");
        mainNav.classList.add("active");
        menuOverlay.classList.add("active");
        menuToggle.setAttribute("aria-expanded", "true");
        document.body.classList.add("mobile-menu-open");
        lockBodyScroll();

        // Pressing the device/browser Back button while the drawer is
        // open should close the drawer first, not navigate away.
        history.pushState({ mobileMenuOpen: true }, "");
        menuHistoryPushed = true;
    }

    menuToggle.addEventListener("click", () => {
        if (mainNav.classList.contains("active")) {
            closeMenu(false, true);
        } else {
            openMenu();
        }
    });

    window.addEventListener("popstate", () => {
        if (mainNav.classList.contains("active")) {
            closeMenu(true, false);
        }
    });

    // Clicking outside (the overlay) closes the menu
    menuOverlay.addEventListener("click", () => closeMenu(false, true));

    // Clicking a menu item (not the dropdown parent link) closes the
    // menu visually but leaves the pushed history entry alone — the
    // link's own navigation is about to move the history stack anyway.
    mainNav.querySelectorAll("a:not(.dropdown-toggle)").forEach(link => {
        link.addEventListener("click", () => closeMenu(false, false));
    });

    // Auto-close if the viewport is resized back to desktop width
    // Auto-close only when we're truly on a non-mobile device
    // (checked via the is-mobile class, not viewport width, so
    // rotating a phone to landscape never force-closes the menu)
    window.addEventListener("resize", () => {
        if (!document.documentElement.classList.contains("is-mobile")) {
            closeMenu(false, false);
        }
    });
}

// ===========================
// MOBILE DROPDOWN (Properties submenu)
// ===========================
const dropdownToggle = document.querySelector(".dropdown-toggle");

if (dropdownToggle) {
    dropdownToggle.addEventListener("click", function (e) {
        if (document.documentElement.classList.contains("is-mobile")) {
            e.preventDefault();
            e.stopPropagation();
            this.parentElement.classList.toggle("open");
        }
    });
}
// ===========================
// OUR REALTORS: RENDER CARD GRID
// Reads from REALTORS_DATA (realtors-data.js). Only runs if this
// page has a #realtorsGrid element, so it's a no-op elsewhere.
// Adding a new realtor to the data file is all that's needed —
// this renders any number of cards automatically.
// ===========================
function renderRealtorsGrid() {
    const grid = document.getElementById("realtorsGrid");
    if (!grid || typeof REALTORS_DATA === "undefined") return;

    grid.innerHTML = REALTORS_DATA.map(realtor => {
        const profileUrl = realtor.profileLink || `realtor-profile.html?id=${encodeURIComponent(realtor.id)}`;
        return `
            <div class="realtor-card">
                <img src="${realtor.photo}" alt="${realtor.name}" class="realtor-photo" loading="lazy">
                <h3>${realtor.name}</h3>
                <span class="realtor-designation">${realtor.designation}</span>
                <p class="realtor-intro">${realtor.shortIntro}</p>
                <a href="${profileUrl}" class="realtor-view-btn">View Profile</a>
            </div>
        `;
    }).join("");
}
renderRealtorsGrid();
window.renderRealtorsGrid = renderRealtorsGrid;

// ===========================
// REALTOR PROFILE PAGE: RENDER FROM ?id=
// Only runs if this page has a #realtorProfileContent element.
// ===========================
function renderRealtorProfile() {
    const container = document.getElementById("realtorProfileContent");
    if (!container || typeof REALTORS_DATA === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const realtor = REALTORS_DATA.find(r => r.id === id);

    if (!realtor) {
        container.innerHTML = `
            <div class="realtor-not-found">
                <p>Sorry, we couldn't find that profile.</p>
                <p><a href="our-realtors.html">← Back to Our Realtors</a></p>
            </div>
        `;
        return;
    }

    document.title = `${realtor.name} | Aventrix Realty`;

    const expertiseTags = (realtor.expertise || []).map(x => `<span class="rp-tag">${x}</span>`).join("");
    const specializationTags = (realtor.specializations || []).map(x => `<span class="rp-tag">${x}</span>`).join("");
    const languages = (realtor.languages || []).join(", ");
    const whatsappLink = `https://wa.me/${realtor.whatsapp}`;

    container.innerHTML = `
        <div class="realtor-profile-grid">
            <div class="realtor-profile-photo-wrap">
                <img src="${realtor.photo}" alt="${realtor.name}" class="realtor-profile-photo">
            </div>
            <div class="realtor-profile-info">
                <span class="section-eyebrow">OUR TEAM</span>
                <h1>${realtor.name}</h1>
                <span class="realtor-profile-designation">${realtor.designation}</span>
                <p class="realtor-profile-about">${realtor.about}</p>

                <div class="rp-detail-grid">
                    <div class="rp-detail-block">
                        <h4>Years of Experience</h4>
                        <p>${realtor.experience}</p>
                    </div>
                    <div class="rp-detail-block">
                        <h4>Languages Spoken</h4>
                        <p>${languages}</p>
                    </div>
                    <div class="rp-detail-block">
                        <h4>Areas of Expertise</h4>
                        <div class="rp-tag-list">${expertiseTags}</div>
                    </div>
                    <div class="rp-detail-block">
                        <h4>Specializations</h4>
                        <div class="rp-tag-list">${specializationTags}</div>
                    </div>
                </div>

                <div class="rp-contact-row">
                    <a href="tel:${realtor.phone}"><i class="fas fa-phone-alt" aria-hidden="true"></i> ${realtor.phone}</a>
                    <a href="${whatsappLink}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp</a>
                    <a href="mailto:${realtor.email}"><i class="fas fa-envelope" aria-hidden="true"></i> ${realtor.email}</a>
                </div>
            </div>
        </div>
    `;
}
renderRealtorProfile();
window.renderRealtorProfile = renderRealtorProfile;

// ===========================
// FAQ ACCORDION
// Exposed as window.initFaqAccordion so it can be re-run after the
// FAQ section is populated dynamically from the CMS (see
// js/public-page-content.js) — harmless no-op otherwise.
// ===========================
function initFaqAccordion() {
    const faqItems = document.querySelectorAll(".faq-item");
    if (!faqItems.length) return;

    faqItems.forEach(item => {
        const question = item.querySelector(".faq-question");
        const answer = item.querySelector(".faq-answer");
        if (!question || !answer) return;

        question.addEventListener("click", () => {
            const isOpen = item.classList.contains("open");

            // Close all others (single-open accordion)
            faqItems.forEach(other => {
                if (other !== item) {
                    other.classList.remove("open");
                    other.querySelector(".faq-question").setAttribute("aria-expanded", "false");
                    other.querySelector(".faq-answer").style.maxHeight = null;
                }
            });

            if (isOpen) {
                item.classList.remove("open");
                question.setAttribute("aria-expanded", "false");
                answer.style.maxHeight = null;
            } else {
                item.classList.add("open");
                question.setAttribute("aria-expanded", "true");
                answer.style.maxHeight = answer.scrollHeight + 40 + "px";
            }
        });
    });
}
initFaqAccordion();
window.initFaqAccordion = initFaqAccordion;

// ===========================
// PROPERTY SHARE BUTTON
// Uses native Web Share API where available; falls back to
// copying the property URL to the clipboard with a toast.
// ===========================
(function () {
    const shareButtons = document.querySelectorAll(".property-share-btn");
    if (!shareButtons.length) return;

    let toastEl = document.querySelector(".share-toast");
    if (!toastEl) {
        toastEl = document.createElement("div");
        toastEl.className = "share-toast";
        document.body.appendChild(toastEl);
    }

    function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.add("show");
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
    }

    shareButtons.forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const card = btn.closest(".property-card");
            const link = card ? card.querySelector(".view-details-btn") : null;
            const titleEl = card ? card.querySelector("h3") : null;

            const shareUrl = link ? new URL(link.getAttribute("href"), window.location.href).href : window.location.href;
            const shareTitle = titleEl ? titleEl.textContent.trim() : "Aventrix Realty Property";

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: shareTitle,
                        text: `Check out ${shareTitle} on Aventrix Realty`,
                        url: shareUrl
                    });
                } catch (err) {
                    // User cancelled the share sheet — no action needed
                }
            } else if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(shareUrl);
                    showToast("Link copied to clipboard");
                } catch (err) {
                    showToast("Unable to copy link");
                }
            } else {
                showToast("Unable to share on this browser");
            }
        });
    });
})();

// ===========================
// ACTIVE NAV LINK HIGHLIGHT
// Compares the current page's filename to each nav link's href
// and marks the matching one active — works identically across
// every page without needing per-page manual edits.
//
// Links containing a "#" (About Us, Properties) point to anchors
// WITHIN the homepage rather than a separate page, so they're
// intentionally excluded here — only genuinely distinct pages
// (Home, List With Us, Free Valuation, etc.) get the active state.
// ===========================
(function () {
    const navLinks = document.querySelectorAll(".main-nav > a, .main-nav .dropdown-toggle");
    if (!navLinks.length) return;

    let currentPage = window.location.pathname.split("/").pop();
    if (currentPage === "" || currentPage === "/") currentPage = "index.html";

    navLinks.forEach(link => {
        // The Admin link is a utility link, not a "which page am I on"
        // nav item — always skip it here. Without this, its href
        // ("admin/index.html") collides with Home's ("index.html") on
        // the homepage, since both end in the same filename, and both
        // would otherwise get wrongly marked active together.
        if (link.classList.contains("main-nav-admin")) return;

        const href = link.getAttribute("href");
        if (!href || href.includes("#")) return;
        const linkPage = href.split("/").pop();

        if (linkPage === currentPage && linkPage !== "") {
            link.classList.add("active");
        }
    });
})();

// ===========================
// FEATURED LOCATIONS: EXPANDABLE AREA CHIPS
// Clicking a category card expands a horizontal-scroll row of
// specific areas beneath it. Only one category open at a time.
// ===========================
(function () {
    const categories = document.querySelectorAll(".location-category");
    if (!categories.length) return;

    function setIcon(button, expanded) {
        const icon = button.querySelector(".location-toggle-btn i");
        if (!icon) return;
        icon.classList.toggle("fa-plus", !expanded);
        icon.classList.toggle("fa-minus", expanded);
    }

    categories.forEach(category => {
        const btn = category.querySelector(".location-card-btn");
        if (!btn) return;

        btn.addEventListener("click", () => {
            const isOpen = category.classList.contains("open");

            categories.forEach(other => {
                if (other !== category) {
                    other.classList.remove("open");
                    const otherBtn = other.querySelector(".location-card-btn");
                    if (otherBtn) {
                        otherBtn.setAttribute("aria-expanded", "false");
                        setIcon(otherBtn, false);
                    }
                }
            });

            if (isOpen) {
                category.classList.remove("open");
                btn.setAttribute("aria-expanded", "false");
                setIcon(btn, false);
            } else {
                category.classList.add("open");
                btn.setAttribute("aria-expanded", "true");
                setIcon(btn, true);
            }
        });
    });
})();
