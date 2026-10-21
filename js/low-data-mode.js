/* Aventrix Realty adaptive low-data enhancements.
 * Progressive enhancement only: preserve existing content and functionality.
 */
(function () {
  "use strict";
  var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var root = document.documentElement;
  function apply() {
    var slow = !!(connection && (
      connection.saveData ||
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g" ||
      (typeof connection.downlink === "number" && connection.downlink > 0 && connection.downlink < 0.8)
    ));
    root.classList.toggle("avx-low-data", slow);
    if (!slow) return;
    document.querySelectorAll("img").forEach(function (img) {
      if (!img.hasAttribute("loading") && !img.closest("header, .hero, .hero-section, .ac-hero")) {
        img.loading = "lazy";
      }
      if (!img.hasAttribute("decoding")) img.decoding = "async";
    });
    document.querySelectorAll("video").forEach(function (video) {
      video.preload = "none";
      video.removeAttribute("autoplay");
      video.pause();
    });
  }
  apply();
  if (connection && connection.addEventListener) connection.addEventListener("change", apply);
})();
