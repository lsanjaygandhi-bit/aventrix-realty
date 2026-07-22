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
// ===========================
const form = document.getElementById("propertyForm");
if (form) {
    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        try {
            const data = new FormData(form);

            const response = await fetch(form.action, {
                method: form.method,
                body: data,
                headers: {
                    Accept: "application/json"
                }
            });

            if (response.ok) {
                alert("SUCCESS");
                form.style.display = "none";
                const successEl = document.getElementById("success-message");
                if (successEl) successEl.style.display = "block";
                form.reset();
            } else {
                alert("Response Failed");
            }
        } catch (err) {
            console.log(err);
            alert(err);
        }
    });
}

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
// PROPERTY DATA (used on property.html)
// ===========================
const propertyData = {
    "luxury-apartments": {
        title: "Luxury Apartments",
        price: "Starting from ₹1.14 Crore",
        location: "Chennai",
        image: "images/property1.jpg",
        description: "Premium 3 BHK apartments in Chennai's fastest-growing locations, designed for modern family living with high-quality finishes and thoughtful layouts.",
        features: ["3 Bedrooms", "3 Bathrooms", "Covered Car Parking", "Lift Available", "24×7 Security", "CMDA Approved"]
    },
    "premium-villas": {
        title: "Premium Villas",
        price: "Starting from ₹1.45 Crore",
        location: "Chennai",
        image: "images/property2.jpg",
        description: "Luxury independent villas with modern amenities, private outdoor space and premium specifications throughout.",
        features: ["Independent Villa", "Private Garden", "Covered Car Parking", "24×7 Security", "CMDA Approved", "Modern Amenities"]
    },
    "residential-plots": {
        title: "Residential Plots",
        price: "Starting from ₹1.00 Crore",
        location: "Chennai",
        image: "images/property3.jpg",
        description: "DTCP & CMDA approved premium investment plots in high-growth residential corridors, ideal for building your dream home or long-term investment.",
        features: ["DTCP Approved", "CMDA Approved", "Clear Title", "Gated Layout", "Wide Roads", "Investment Ready"]
    },
    "crown-leaf": {
        title: "Crown Leaf",
        price: "Starting from ₹1.10 Crore",
        location: "Old Pallavaram",
        image: "images/crownleaf.jpg",
        description: "Premium 3 BHK apartments in Old Pallavaram, combining a prime location with quality construction and everyday convenience.",
        features: ["3 BHK Apartments", "Covered Car Parking", "Lift Available", "24×7 Security", "Close to Schools & Hospitals", "CMDA Approved"]
    },
    "commercial-rent": {
        title: "Commercial for Rent",
        price: "₹2.50 Lakhs / Month",
        location: "Lakshmipuram, Chromepet",
        image: "images/commercial-rental.jpg",
        description: "Approx. 6,500 Sq.Ft. built-up commercial building available for rent in Lakshmipuram, Chromepet — well suited for retail, office or business use.",
        features: ["Approx. 6,500 Sq.Ft. Built-up Area", "Prime Chromepet Location", "Ample Parking", "Ready to Occupy"]
    },
    "plot-sale": {
        title: "Plot for Sale",
        price: "Contact for Price",
        location: "ECR, Devaneri",
        image: "images/ecr-devaneri.jpg",
        description: "5,520 Sq.Ft. residential plot on ECR, Devaneri, near East Bay Resort — an excellent opportunity for a beachside home or investment.",
        features: ["5,520 Sq.Ft.", "60 Ft Frontage", "92 Ft Depth", "Near East Bay Resort", "Clear Title"]
    }
};

// ===========================
// PROPERTY DETAIL PAGE RENDER (property.html)
// ===========================
const propertyTitleEl = document.getElementById("property-title");

if (propertyTitleEl) {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const property = propertyData[id] || propertyData["luxury-apartments"];

    propertyTitleEl.textContent = property.title;

    const priceEl = document.getElementById("property-price");
    if (priceEl) priceEl.textContent = property.price;

    const locationEl = document.getElementById("property-location");
    if (locationEl) locationEl.textContent = "📍 " + property.location;

    const imageEl = document.getElementById("property-image");
    if (imageEl) {
        imageEl.style.backgroundImage =
            `linear-gradient(rgba(0,0,0,.55),rgba(0,0,0,.55)), url("${property.image}")`;
    }

    const descriptionEl = document.getElementById("property-description");
    if (descriptionEl) descriptionEl.textContent = property.description;

    const featuresEl = document.getElementById("property-features");
    if (featuresEl) {
        featuresEl.innerHTML = "";
        property.features.forEach(feature => {
            const li = document.createElement("li");
            li.textContent = feature;
            featuresEl.appendChild(li);
        });
    }
}

// ===========================
// MOBILE MENU: OPEN / CLOSE
// ===========================
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.querySelector(".main-nav");
const menuOverlay = document.getElementById("menuOverlay");

if (menuToggle && mainNav && menuOverlay) {

    function closeMenu() {
        menuToggle.classList.remove("active");
        mainNav.classList.remove("active");
        menuOverlay.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");

        const dropdown = document.querySelector(".dropdown");
        if (dropdown) {
            dropdown.classList.remove("open");
        }

        document.body.style.overflow = "";
    }

    function openMenu() {
        menuToggle.classList.add("active");
        mainNav.classList.add("active");
        menuOverlay.classList.add("active");
        menuToggle.setAttribute("aria-expanded", "true");
        document.body.style.overflow = "hidden";
    }

    menuToggle.addEventListener("click", () => {
        if (mainNav.classList.contains("active")) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Clicking outside (the overlay) closes the menu
    menuOverlay.addEventListener("click", closeMenu);

    // Clicking a menu item (not the dropdown parent link) closes the menu
    mainNav.querySelectorAll("a:not(.dropdown-toggle)").forEach(link => {
        link.addEventListener("click", closeMenu);
    });

    // Auto-close if the viewport is resized back to desktop width
    // Auto-close only when we're truly on a non-mobile device
    // (checked via the is-mobile class, not viewport width, so
    // rotating a phone to landscape never force-closes the menu)
    window.addEventListener("resize", () => {
        if (!document.documentElement.classList.contains("is-mobile")) {
            closeMenu();
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
(function renderRealtorsGrid() {
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
})();

// ===========================
// REALTOR PROFILE PAGE: RENDER FROM ?id=
// Only runs if this page has a #realtorProfileContent element.
// ===========================
(function renderRealtorProfile() {
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
})();

// ===========================
// FAQ ACCORDION
// ===========================
(function () {
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
})();

// ===========================
// LATEST LISTINGS CAROUSEL
// ===========================
(function () {
    const track = document.getElementById("carouselTrack");
    const prevBtn = document.getElementById("carouselPrev");
    const nextBtn = document.getElementById("carouselNext");
    if (!track || !prevBtn || !nextBtn) return;

    const scrollAmount = () => {
        const card = track.querySelector(".carousel-card");
        return card ? card.offsetWidth + 26 : 300;
    };

    prevBtn.addEventListener("click", () => {
        track.scrollBy({ left: -scrollAmount(), behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
        track.scrollBy({ left: scrollAmount(), behavior: "smooth" });
    });
})();

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
