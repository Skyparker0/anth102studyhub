(function () {
  var textarea = document.getElementById("notes-textarea");
  var status = document.getElementById("notes-status");
  if (!textarea) return;

  var slug = textarea.getAttribute("data-lecture-slug");
  var key = "anth102-notes:" + slug;

  function formatTime(date) {
    var h = date.getHours();
    var m = date.getMinutes();
    var ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    if (m < 10) m = "0" + m;
    return h + ":" + m + ampm;
  }

  var saved;
  try {
    saved = window.localStorage.getItem(key);
  } catch (e) {
    // localStorage unavailable (private browsing, disabled storage, etc.)
    // -- degrade to a plain, non-persistent textarea rather than breaking.
    if (status) status.textContent = "(notes won't be saved -- storage is unavailable in this browser)";
    return;
  }
  if (saved) textarea.value = saved;

  var debounceTimer = null;
  textarea.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    if (status) status.textContent = "saving…";
    debounceTimer = setTimeout(function () {
      try {
        window.localStorage.setItem(key, textarea.value);
        if (status) status.textContent = "saved " + formatTime(new Date());
      } catch (e) {
        if (status) status.textContent = "(couldn't save -- storage may be full)";
      }
    }, 400);
  });

  var copyBtn = document.getElementById("notes-copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var restore = copyBtn.textContent;
      function done(ok) {
        copyBtn.textContent = ok ? "Copied!" : "Copy failed";
        setTimeout(function () { copyBtn.textContent = restore; }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textarea.value).then(function () {
          done(true);
        }, function () {
          done(false);
        });
      } else {
        try {
          textarea.select();
          document.execCommand("copy");
          window.getSelection().removeAllRanges();
          done(true);
        } catch (e) {
          done(false);
        }
      }
    });
  }
})();
