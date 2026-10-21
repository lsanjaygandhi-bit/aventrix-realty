/* About Chennai page interactions. No dependencies; all selectors are scoped to .ac-page. */
(function () {
  'use strict';
  var page = document.querySelector('.ac-page');
  if (!page) return;

  var timelineButtons = Array.prototype.slice.call(page.querySelectorAll('[data-period-filter]'));
  var timelineItems = Array.prototype.slice.call(page.querySelectorAll('.ac-era'));
  timelineButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var filter = button.getAttribute('data-period-filter');
      timelineButtons.forEach(function (candidate) {
        var active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      timelineItems.forEach(function (item) {
        item.hidden = filter !== 'all' && item.getAttribute('data-period') !== filter;
      });
    });
  });

  var regionButtons = Array.prototype.slice.call(page.querySelectorAll('[data-region-filter]'));
  var areaCards = Array.prototype.slice.call(page.querySelectorAll('.ac-area-card'));
  var search = page.querySelector('#ac-area-search');
  var clear = page.querySelector('#ac-clear-search');
  var empty = page.querySelector('#ac-area-empty');
  var currentRegion = 'all';

  function filterAreas() {
    var term = search ? search.value.trim().toLowerCase() : '';
    var visible = 0;
    areaCards.forEach(function (card) {
      var regionMatches = currentRegion === 'all' || card.getAttribute('data-region') === currentRegion;
      var haystack = (card.getAttribute('data-search') + ' ' + card.textContent).toLowerCase();
      var textMatches = !term || haystack.indexOf(term) !== -1;
      var show = regionMatches && textMatches;
      card.hidden = !show;
      if (show) visible += 1;
    });
    if (empty) empty.hidden = visible !== 0;
  }

  regionButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      currentRegion = button.getAttribute('data-region-filter');
      regionButtons.forEach(function (candidate) {
        var active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      filterAreas();
    });
  });
  if (search) search.addEventListener('input', filterAreas);
  if (clear) clear.addEventListener('click', function () {
    if (search) {
      search.value = '';
      search.focus();
    }
    currentRegion = 'all';
    regionButtons.forEach(function (button) {
      var active = button.getAttribute('data-region-filter') === 'all';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    filterAreas();
  });
})();
