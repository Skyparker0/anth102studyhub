(function () {
  var app = document.getElementById("flashcard-app");
  if (!app || typeof FLASHCARDS === "undefined" || !FLASHCARDS.length) return;

  var reviewMode = false;
  var order = FLASHCARDS.map(function (_, i) { return i; });
  var pos = 0;
  var flipped = false;
  var reviewTotal = 0;
  var reviewedCount = 0;

  var flashcard = document.getElementById("flashcard");
  var countEl = document.getElementById("fc-count");
  var qEl = document.getElementById("fc-question");
  var aEl = document.getElementById("fc-answer");
  var reviewToggleBtn = document.getElementById("fc-review-toggle");
  var browseControls = document.getElementById("fc-browse-controls");
  var ratingControls = document.getElementById("fc-rating-controls");
  var reviewEmpty = document.getElementById("fc-review-empty");
  var hasReview = typeof window.FCReview !== "undefined";

  function reviewOrder() {
    var due = [];
    var fresh = [];
    FLASHCARDS.forEach(function (card, i) {
      if (!window.FCReview.isDue(card.num)) return;
      if (window.FCReview.isNew(card.num)) fresh.push(i);
      else due.push(i);
    });
    due.sort(function (a, b) {
      return window.FCReview.getState(FLASHCARDS[a].num).dueISO.localeCompare(
        window.FCReview.getState(FLASHCARDS[b].num).dueISO
      );
    });
    return due.concat(fresh);
  }

  function render() {
    if (reviewMode && order.length === 0) {
      flashcard.style.display = "none";
      ratingControls.style.display = "none";
      reviewEmpty.style.display = "block";
      countEl.textContent = "";
      return;
    }
    flashcard.style.display = "";
    reviewEmpty.style.display = "none";

    var card = FLASHCARDS[order[pos]];
    if (reviewMode) {
      countEl.textContent = "Reviewed " + reviewedCount + " of " + reviewTotal + " due · #" + card.num;
    } else {
      countEl.textContent = "Card " + (pos + 1) + " of " + order.length + " · #" + card.num;
    }
    qEl.textContent = card.q || "(no question text)";
    aEl.textContent = card.a || "(no answer in the source set)";
    flashcard.classList.toggle("flipped", flipped);

    if (reviewMode) {
      ratingControls.style.display = flipped ? "flex" : "none";
    }
  }

  function goTo(newPos) {
    if (order.length === 0) return;
    pos = ((newPos % order.length) + order.length) % order.length;
    flipped = false;
    render();
  }

  function flip() {
    flipped = !flipped;
    render();
  }

  function jumpToCardNum(num) {
    var idx = order.findIndex(function (i) { return FLASHCARDS[i].num === num; });
    if (idx !== -1) goTo(idx);
  }

  document.getElementById("fc-prev").addEventListener("click", function () { goTo(pos - 1); });
  document.getElementById("fc-next").addEventListener("click", function () { goTo(pos + 1); });
  document.getElementById("fc-flip").addEventListener("click", flip);
  flashcard.addEventListener("click", flip);

  document.getElementById("fc-shuffle").addEventListener("click", function () {
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    goTo(0);
  });

  document.addEventListener("keydown", function (e) {
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    if (e.key === "ArrowRight") goTo(pos + 1);
    else if (e.key === "ArrowLeft") goTo(pos - 1);
    else if (e.key === " ") { e.preventDefault(); flip(); }
  });

  if (hasReview && window.FCReview.storageOk()) {
    reviewToggleBtn.addEventListener("click", function () {
      reviewMode = !reviewMode;
      reviewToggleBtn.textContent = reviewMode ? "Exit Review" : "Review";
      browseControls.style.display = reviewMode ? "none" : "flex";
      order = reviewMode ? reviewOrder() : FLASHCARDS.map(function (_, i) { return i; });
      reviewTotal = order.length;
      reviewedCount = 0;
      pos = 0;
      flipped = false;
      render();
    });

    ["again", "good", "easy"].forEach(function (label, i) {
      var quality = [2, 4, 5][i];
      document.getElementById("fc-" + label).addEventListener("click", function () {
        var card = FLASHCARDS[order[pos]];
        window.FCReview.rate(card.num, quality);
        // Any rating pushes the due date to tomorrow or later, so the card
        // leaves today's review queue regardless of how it was rated.
        order.splice(pos, 1);
        reviewedCount++;
        flipped = false;
        if (order.length > 0) pos = pos % order.length;
        render();
      });
    });
  } else if (reviewToggleBtn) {
    reviewToggleBtn.style.display = "none";
  }

  var hashMatch = location.hash.match(/^#card-(\d+)$/);
  if (hashMatch) jumpToCardNum(parseInt(hashMatch[1], 10));
  render();
})();
