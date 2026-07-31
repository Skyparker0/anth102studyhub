(function () {
  var section = document.querySelector(".study-guide");
  if (!section) return;

  var slug = section.getAttribute("data-lecture-slug");
  var inputs = section.querySelectorAll(".sg-input");
  var storageOk = true;

  function keyFor(el) {
    return "anth102-studyguide:" + slug + ":" + el.getAttribute("data-sg-key");
  }

  inputs.forEach(function (el) {
    try {
      var saved = window.localStorage.getItem(keyFor(el));
      if (saved) el.value = saved;
    } catch (e) {
      storageOk = false;
    }
  });

  if (!storageOk) {
    var hint = section.querySelector(".study-guide-hint");
    if (hint) hint.textContent = "(answers won't be saved -- storage is unavailable in this browser)";
    return;
  }

  var debounceTimers = {};
  inputs.forEach(function (el) {
    el.addEventListener("input", function () {
      var key = keyFor(el);
      clearTimeout(debounceTimers[key]);
      debounceTimers[key] = setTimeout(function () {
        try {
          window.localStorage.setItem(key, el.value);
        } catch (e) {
          // storage full -- silently skip, per-field status isn't worth the clutter
        }
      }, 400);
    });
  });
})();
