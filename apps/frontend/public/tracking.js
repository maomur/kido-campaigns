(function () {
  'use strict';

  var STORAGE_KEY = 'abitare_tracking';
  var TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
  var CHECKOUT_FORM_SELECTOR = 'form[action*="checkout"], form.o_wsale_checkout, #checkout_form';

  function captureTrackingParams() {
    var params = new URLSearchParams(window.location.search);
    var tracking = {};
    TRACKING_KEYS.forEach(function (key) {
      if (params.has(key)) tracking[key] = params.get(key);
    });
    if (Object.keys(tracking).length > 0) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tracking));
    }
  }

  function getStoredTracking() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  // En el checkout de Odoo se inyectan como inputs ocultos para que viajen con
  // el POST del formulario de pedido (sale.order), sin depender de una llamada
  // a la API por separado.
  function injectHiddenTrackingFields() {
    var tracking = getStoredTracking();
    if (Object.keys(tracking).length === 0) return;

    var form = document.querySelector(CHECKOUT_FORM_SELECTOR);
    if (!form) return;

    Object.keys(tracking).forEach(function (key) {
      if (form.querySelector('input[name="' + key + '"]')) return;
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = tracking[key];
      form.appendChild(input);
    });
  }

  captureTrackingParams();
  injectHiddenTrackingFields();
})();
