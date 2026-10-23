/* Aventrix Realty Free Property Search Assistant.
 * The launcher remains disabled until the Supabase Edge Function is
 * deployed, its secrets are configured, and data-enabled is set to true.
 */
(function () {
  const root = document.getElementById("avxAiAssistant");
  if (!root || root.dataset.enabled !== "true") return;

  const endpoint = root.dataset.endpoint || "https://gkrtjeygrqkglsadskcg.supabase.co/functions/v1/free-property-search";
  // Touch devices: don't pop the keyboard automatically (it pushes the panel off-screen on iOS).
  const isTouch = document.documentElement.classList.contains("is-mobile");
  const launcher = root.querySelector(".avx-ai-launcher");
  const panel = root.querySelector(".avx-ai-panel");
  const close = root.querySelector(".avx-ai-close");
  const form = root.querySelector(".avx-ai-form");
  const input = root.querySelector(".avx-ai-input");
  const send = root.querySelector(".avx-ai-send");
  const messages = root.querySelector(".avx-ai-messages");
  const status = root.querySelector(".avx-ai-status");
  const suggestions = root.querySelector(".avx-ai-suggestions");

  if (!endpoint || !launcher || !panel || !close || !form || !input || !send || !messages || !status || !suggestions) return;
  launcher.hidden = false;
  // Enables the floating-button group layout in css/ai-property-assistant.css.
  document.documentElement.classList.add("avx-ai-on");
  let busy = false;

  function translateI18n(element) {
    if (window.avxI18n && typeof window.avxI18n.translate === "function") {
      window.avxI18n.translate(element);
    }
  }

  function addMessage(text, role, properties, i18nKey) {
    const bubble = document.createElement("div");
    bubble.className = "avx-ai-message " + role;
    bubble.textContent = text;
    if (i18nKey) bubble.setAttribute("data-i18n", i18nKey);
    messages.appendChild(bubble);
    if (i18nKey) translateI18n(bubble);
    if (Array.isArray(properties) && properties.length) {
      const results = document.createElement("div");
      results.className = "avx-ai-results";
      properties.forEach((p) => {
        if (!p || typeof p.title !== "string" || typeof p.slug !== "string") return;
        const link = document.createElement("a");
        link.className = "avx-ai-result";
        // property.html reads the slug from ?id= (see js/public-properties.js)
        link.href = "property.html?id=" + encodeURIComponent(p.slug);
        const title = document.createElement("div");
        title.className = "avx-ai-result-title";
        title.textContent = p.title;
        const meta = document.createElement("div");
        meta.className = "avx-ai-result-meta";
        meta.textContent = [p.price_display, p.location, p.bedrooms ? p.bedrooms + " BHK" : ""].filter(Boolean).join(" · ");
        link.append(title, meta);
        results.appendChild(link);
      });
      if (results.childElementCount) {
        const wrap = document.createElement("div");
        wrap.className = "avx-ai-message assistant";
        wrap.appendChild(results);
        messages.appendChild(wrap);
      }
    }
    messages.scrollTop = messages.scrollHeight;
  }

  function setBusy(value) {
    busy = value;
    send.disabled = value;
    input.disabled = value;
    status.textContent = value ? "Checking Aventrix website…" : "";
    if (value) {
      status.setAttribute("data-i18n", "Checking Aventrix website…");
      translateI18n(status);
    } else {
      status.removeAttribute("data-i18n");
    }
  }

  function openPanel() {
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    if (!isTouch) input.focus();
  }
  function closePanel() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  launcher.addEventListener("click", openPanel);
  close.addEventListener("click", closePanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) closePanel();
  });
  suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-query]");
    if (!button || busy) return;
    input.value = button.dataset.query || "";
    form.requestSubmit();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || busy) return;
    if (message.length > 1200) {
      addMessage("Please keep your question under 1,200 characters.", "assistant", null, "Please keep your question under 1,200 characters.");
      return;
    }
    addMessage(message, "user");
    input.value = "";
    setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, language: /[\u0B80-\u0BFF]/.test(message) ? "ta" : "auto" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The assistant is temporarily unavailable.");
      if (data.answer) {
        addMessage(String(data.answer), "assistant", data.properties);
      } else {
        const fallback = "I could not find a suitable answer. Please try another question.";
        addMessage(fallback, "assistant", data.properties, fallback);
      }
    } catch {
      const unavailable = "Sorry, free property search is temporarily unavailable. Please try again shortly or contact Aventrix Realty directly.";
      addMessage(unavailable, "assistant", null, unavailable);
    } finally {
      setBusy(false);
      if (!panel.hidden && !isTouch) input.focus();
    }
  });
})();