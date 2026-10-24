/* Aventrix Realty multilingual UI layer.
 * Translates only exact, inventoried UI strings. Does not rewrite page markup,
 * layout, property data, prices, business rules, or event handlers.
 */
(function () {
  "use strict";
  if (window.avxI18nInitialized) return;
  window.avxI18nInitialized = true;

  var supported = ["en", "ta", "hi", "te", "kn", "ml"];
  var names = {
    en: "English", ta: "தமிழ்", hi: "हिन्दी",
    te: "తెలుగు", kn: "ಕನ್ನಡ", ml: "മലയാളം"
  };
  var translations = null;
  var locale = "en";
  var languageStorageKey = "avx-language";
  var missingKeys = {};

  function localeFromPath(pathname) {
    var match = pathname.match(/^\/(ta|hi|te|kn|ml)(?=\/|$)/);
    return match ? match[1] : "en";
  }

  function basePath(pathname) {
    return pathname.replace(/^\/(ta|hi|te|kn|ml)(?=\/|$)/, "") || "/";
  }

  // Static local servers do not share the worker's locale-prefix rewrites.
  // Use a query parameter on every localhost port to avoid /ta/index.html 404s.
  function isLocalPreview() {
    return location.hostname === "127.0.0.1" || location.hostname === "localhost";
  }

  function getLocale() {
    var pathLocale = localeFromPath(location.pathname);
    if (pathLocale !== "en") return pathLocale;

    var query = new URLSearchParams(location.search).get("lang");
    if (supported.indexOf(query) >= 0) return query;

    if (isLocalPreview()) {
      try {
        var stored = localStorage.getItem(languageStorageKey);
        if (supported.indexOf(stored) >= 0) return stored;
      } catch (error) {
        console.warn("Could not restore the saved website language.", error);
      }
    }
    return "en";
  }

  function targetUrl(code) {
    if (isLocalPreview()) {
      var localUrl = new URL(location.href);
      if (code === "en") localUrl.searchParams.delete("lang");
      else localUrl.searchParams.set("lang", code);
      return localUrl.pathname + localUrl.search + localUrl.hash;
    }
    var localized = new URL(location.href);
    localized.pathname = basePath(localized.pathname);
    if (code !== "en") localized.pathname = "/" + code + localized.pathname;
    localized.searchParams.delete("lang");
    return localized.pathname + localized.search + localized.hash;
  }

  function saveLocalLocale(code) {
    if (!isLocalPreview()) return;
    try {
      localStorage.setItem(languageStorageKey, code);
    } catch (error) {
      console.warn("Could not save the selected website language.", error);
    }
  }

  function mapFor(code) {
    return translations && translations[code] ? translations[code] : {};
  }

  function sourceFor(key) {
    if (translations && translations.ui_keys && typeof translations.ui_keys[key] === "string") {
      return translations.ui_keys[key];
    }
    if (translations && translations.home_ui_keys && typeof translations.home_ui_keys[key] === "string") {
      return translations.home_ui_keys[key];
    }
    return null;
  }

  function translationFor(key) {
    if (!translations) return null;
    var overrides = translations.ui && translations.ui[key]
      || translations.home_ui && translations.home_ui[key];
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, locale)) return overrides[locale];

    var source = sourceFor(key);
    if (source === null) source = key;

    var localized = mapFor(locale);
    if (Object.prototype.hasOwnProperty.call(localized, source)) return localized[source];
    var english = mapFor("en");
    if (Object.prototype.hasOwnProperty.call(english, source)) {
      reportFallback(key);
      return english[source];
    }
    if (source !== key) {
      reportFallback(key);
      return source;
    }
    return null;
  }

  function reportFallback(key) {
    if (locale === "en" || missingKeys[key]) return;
    missingKeys[key] = true;
    document.documentElement.setAttribute("data-avx-translation-fallbacks", String(Object.keys(missingKeys).length));
    console.warn("Missing " + locale + " translation for UI key: " + key);
  }

  function normalizeText(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function translateExplicit(root) {
    if (!root || !translations) return;
    var selectors = [
      ["data-i18n", null],
      ["data-i18n-placeholder", "placeholder"],
      ["data-i18n-aria-label", "aria-label"],
      ["data-i18n-title", "title"],
      ["data-i18n-value", "value"],
      ["data-i18n-alt", "alt"]
    ];
    selectors.forEach(function (entry) {
      var selector = "[" + entry[0] + "]";
      var elements = [];
      if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) elements.push(root);
      if (root.querySelectorAll) {
        Array.prototype.push.apply(elements, root.querySelectorAll(selector));
      }
      elements.forEach(function (el) {
        var key = el.getAttribute(entry[0]);
        var translated = translationFor(key);
        var count = el.getAttribute("data-i18n-count");
        if (count !== null && translated !== null) {
          translated = translated.replace(/\{count\}/g, count);
        }
        if (!entry[1] && translated !== null) {
          var source = sourceFor(key) || key;
          if (count !== null) source = source.replace(/\{count\}/g, count);
          var currentText = normalizeText(el.querySelector("br") ? el.innerText : el.textContent);
          if (currentText === normalizeText(translated || "")) return;
          if (currentText !== normalizeText(source)) return;
        }
        if (translated == null) {
          reportFallback(key);
          el.setAttribute("data-avx-i18n-fallback", "true");
          return;
        }
        el.removeAttribute("data-avx-i18n-fallback");
        if (entry[1]) el.setAttribute(entry[1], translated);
        else el.textContent = translated;
      });
    });
  }

  function localizedInternalUrl(value) {
    var url = new URL(value, location.href);
    if (url.origin !== location.origin || locale === "en" || localeFromPath(url.pathname) !== "en") {
      return url.href;
    }
    url.pathname = "/" + locale + (url.pathname.charAt(0) === "/" ? url.pathname : "/" + url.pathname);
    return url.href;
  }

  function preserveProductionLocaleOnLink(event) {
    if (isLocalPreview() || locale === "en") return;
    var target = event.target.nodeType === Node.ELEMENT_NODE ? event.target : event.target.parentElement;
    var link = target && target.closest("a[href]");
    if (!link || link.hasAttribute("download") || link.target === "_blank") return;
    link.href = localizedInternalUrl(link.href);
  }

  function preserveProductionLocaleOnForm(event) {
    var form = event.target;
    if (!form || form.tagName !== "FORM") return;
    if (isLocalPreview()) {
      saveLocalLocale(locale);
      return;
    }
    if (locale !== "en") form.action = localizedInternalUrl(form.action || location.href);
  }

  function addSelector() {
    if (document.getElementById("avxLanguageSelect")) return;

    // Keep the control in a fixed, high-contrast position so it cannot be
    // hidden behind the hero, header icons, or the Post Property button.
    var slot = document.createElement("div");
    slot.id = "avxLanguageSlot";
    slot.className = "avx-language-slot";
    slot.setAttribute("data-i18n-skip", "");
    slot.setAttribute("role", "group");
    slot.setAttribute("aria-label", "Website language");
    slot.setAttribute("data-i18n-aria-label", "shared.language.websiteLanguage");

    var select = document.createElement("select");
    select.id = "avxLanguageSelect";
    select.className = "avx-language-select";
    select.setAttribute("aria-label", "Select website language");
    select.setAttribute("data-i18n-aria-label", "shared.language.selectLanguage");
    select.setAttribute("data-i18n-skip", "");
    supported.forEach(function (code) {
      var option = document.createElement("option");
      option.value = code;
      option.textContent = names[code];
      if (code === locale) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      saveLocalLocale(select.value);
      location.assign(targetUrl(select.value));
    });
    slot.appendChild(select);

    function mount() {
      if (!document.body) return;
      var existing = document.getElementById("avxLanguageSelect");
      if (existing) return;
      // Mount the selector INSIDE the actual header so its absolute
      // position is anchored to the header on every page. As a sibling,
      // top:100% was relative to unrelated page ancestors and drifted.
      var header = document.querySelector("header.header, header.site-header, header, .site-header");
      if (header) {
        if (window.getComputedStyle(header).position === "static") header.style.position = "relative";
        header.appendChild(slot);
      } else {
        document.body.insertBefore(slot, document.body.firstChild);
      }
      slot.classList.add("avx-language-row");
      // Mark successful mount for easy local DevTools verification.
      document.documentElement.setAttribute("data-avx-language-selector", "mounted");
    }
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
  }

  function setLanguageMetadata() {
    var langTags = { en: "en", ta: "ta", hi: "hi", te: "te", kn: "kn", ml: "ml" };
    document.documentElement.setAttribute("lang", langTags[locale] || "en");
    document.documentElement.setAttribute("data-avx-locale", locale);
  }

  function loadTranslations() {
    return fetch("/locales/ui-translations.json?v=20261022-emi-4", { credentials: "same-origin", cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Translation dictionary unavailable");
        return response.json();
      })
      .then(function (data) { translations = data; })
      .catch(function (error) {
        translations = null;
        console.error("Could not load website translations; English text will be shown.", error);
      });
  }

  function init() {
    locale = getLocale();
    saveLocalLocale(locale);
    setLanguageMetadata();
    addSelector();
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/css/language-switcher.css";
    document.head.appendChild(css);

    document.addEventListener("click", preserveProductionLocaleOnLink, true);
    document.addEventListener("submit", preserveProductionLocaleOnForm, true);
    window.avxI18n.ready = loadTranslations().then(function () {
      if (locale !== "en") translateExplicit(document.body);
      if (window.MutationObserver) {
        var observer = new MutationObserver(function (records) {
          records.forEach(function (record) {
            record.addedNodes.forEach(function (node) {
              if (node.nodeType === Node.ELEMENT_NODE) translateExplicit(node);
            });
            if (record.type === "characterData" && record.target.parentElement) {
              translateExplicit(record.target.parentElement);
            }
            if (record.type === "childList" && record.target.nodeType === Node.ELEMENT_NODE
                && record.target.hasAttribute("data-i18n")) {
              translateExplicit(record.target);
            }
            if (record.type === "attributes" && record.target.nodeType === Node.ELEMENT_NODE) {
              translateExplicit(record.target);
            }
          });
        });
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: [
            "data-i18n",
            "data-i18n-placeholder",
            "data-i18n-aria-label",
            "data-i18n-title",
            "data-i18n-value",
            "data-i18n-alt",
            "data-i18n-count"
          ]
        });
      }
      document.documentElement.setAttribute("data-avx-translations-loaded", "true");
      document.documentElement.setAttribute("data-avx-translation-fallbacks", String(Object.keys(missingKeys).length));
      document.dispatchEvent(new CustomEvent("avx:i18n-ready", { detail: { locale: locale } }));
    });
  }

  window.avxI18n = {
    t: function (key) {
      var value = translationFor(key);
      if (value == null) {
        reportFallback(key);
        return sourceFor(key) || key;
      }
      return value;
    },
    url: localizedInternalUrl,
    translate: translateExplicit,
    getLocale: function () { return locale; },
    getMissingKeys: function () { return Object.keys(missingKeys); },
    ready: null
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();