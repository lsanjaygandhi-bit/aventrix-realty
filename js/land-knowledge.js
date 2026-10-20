/* Interactions for Aventrix Realty Land Knowledge Centre. No dependencies. */
(function () {
  'use strict';
  var page = document.querySelector('.lk-page');
  if (!page) return;

  var filterButtons = Array.prototype.slice.call(page.querySelectorAll('[data-class-filter]'));
  var classCards = Array.prototype.slice.call(page.querySelectorAll('.lk-class-card'));
  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var selected = button.getAttribute('data-class-filter');
      filterButtons.forEach(function (candidate) {
        var active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      classCards.forEach(function (card) {
        card.hidden = selected !== 'all' && card.getAttribute('data-class') !== selected;
      });
    });
  });

  var checklist = Array.prototype.slice.call(page.querySelectorAll('#lk-check-items input[type="checkbox"]'));
  var progress = page.querySelector('#lk-progress');
  var progressText = page.querySelector('#lk-progress-text');
  var progressBar = progress ? progress.querySelector('span') : null;
  function updateProgress() {
    var completed = checklist.filter(function (input) { return input.checked; }).length;
    var total = checklist.length;
    if (progressText) progressText.textContent = completed + ' of ' + total;
    if (progress) progress.setAttribute('aria-valuenow', String(completed));
    if (progressBar) progressBar.style.width = (total ? completed / total * 100 : 0) + '%';
  }
  checklist.forEach(function (input) { input.addEventListener('change', updateProgress); });
  var reset = page.querySelector('#lk-reset-checklist');
  if (reset) reset.addEventListener('click', function () {
    checklist.forEach(function (input) { input.checked = false; });
    updateProgress();
  });
  updateProgress();
})();
