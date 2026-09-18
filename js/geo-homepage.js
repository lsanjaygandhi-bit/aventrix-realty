/*
 * AVENTRIX REALTY — HOMEPAGE LOCATION REQUEST
 * ---------------------------------------------------
 * Fires the browser's native Geolocation permission prompt as soon as
 * index.html loads, using js/geo-bridge.js so the result (granted,
 * denied, or unavailable) is available to properties.html later
 * without asking again. No custom UI here — nothing on the homepage
 * needs to know the outcome, this only exists to trigger the request
 * and let the bridge store it for the next page.
 */
if (window.AventrixGeoBridge) {
    window.AventrixGeoBridge.request({
        onGranted: function () { /* stored by the bridge; homepage has no location UI of its own */ },
        onUnavailable: function () { /* denied/unavailable — site continues normally either way */ }
    });
}
