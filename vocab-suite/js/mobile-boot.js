/**
 * Vocab Suite — deployment bootstrap (ours, not upstream)
 * ---------------------------------------------------------------------------
 * Loaded before ./js/main.js. Two jobs:
 *
 *  1. Old-registration cleanup. The suite shipped without a service worker,
 *     but any browser that visited an earlier copy of /vocab-suite/ may still
 *     have one registered for this path; unregister it so a stale cached shell
 *     can never shadow a new deploy.
 *
 *  2. Abort any in-flight fetch quickly. The Krillion game pulls a ~330 MB
 *     ONNX model from the Hugging Face CDN. On a phone, a stalled connection
 *     used to sit on "Pressurizing Submarine AI Sonar…" for minutes; fetch now
 *     gives up after 25s so the UI surfaces a real error the player can act on.
 *     (Feature-detected and idempotent; loops can't happen because we only
 *     re-enter via the original fetch, which we no longer wrap.)
 */
(function () {
  'use strict';

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) { reg.unregister().catch(function () {}); });
      }).catch(function () {});
    }
  } catch (e) { /* file:// and locked-down contexts */ }

  try {
    var nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function' && !nativeFetch.__vsTimeoutWrapped) {
      var FETCH_TIMEOUT_MS = 25000;
      var wrapped = function (input, init) {
        var opts = init ? Object.assign({}, init) : {};
        if (opts.signal) return nativeFetch(input, opts);   // caller owns the abort
        var ctrl = new AbortController();
        opts.signal = ctrl.signal;
        var timer = setTimeout(function () {
          ctrl.abort(new DOMException('Request timed out after 25s', 'TimeoutError'));
        }, FETCH_TIMEOUT_MS);
        return nativeFetch(input, opts).finally(function () { clearTimeout(timer); });
      };
      wrapped.__vsTimeoutWrapped = true;
      window.fetch = wrapped;
    }
  } catch (e) { /* keep native fetch */ }
})();
