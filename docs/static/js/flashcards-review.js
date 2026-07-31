(function () {
  var STORAGE_KEY = "anth102-flashcards-review";
  var state = {};
  var storageOk = true;

  try {
    var saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) state = JSON.parse(saved);
  } catch (e) {
    storageOk = false;
  }

  var saveTimer = null;
  function persist() {
    if (!storageOk) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        // storage full -- silently skip, same as study-guide.js
      }
    }, 400);
  }

  function getState(num) {
    return state[num] || { repetitions: 0, easeFactor: 2.5, intervalDays: 0, dueISO: null };
  }

  function isNew(num) {
    return !state[num];
  }

  function isDue(num) {
    var s = getState(num);
    return !s.dueISO || s.dueISO <= new Date().toISOString();
  }

  // quality: 2 = Again, 4 = Good, 5 = Easy -- classic SM-2
  function rate(num, quality) {
    var s = getState(num);
    if (quality < 3) {
      s.repetitions = 0;
      s.intervalDays = 1;
    } else {
      s.repetitions += 1;
      if (s.repetitions === 1) s.intervalDays = 1;
      else if (s.repetitions === 2) s.intervalDays = 6;
      else s.intervalDays = Math.round(s.intervalDays * s.easeFactor);
      s.easeFactor = Math.max(1.3, s.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    }
    var due = new Date();
    due.setDate(due.getDate() + s.intervalDays);
    s.dueISO = due.toISOString();
    state[num] = s;
    persist();
    return s;
  }

  window.FCReview = {
    getState: getState,
    isNew: isNew,
    isDue: isDue,
    rate: rate,
    storageOk: function () { return storageOk; },
  };
})();
