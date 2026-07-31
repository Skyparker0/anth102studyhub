(function () {
  var app = document.getElementById("flashcard-app");
  if (!app || typeof FLASHCARDS === "undefined" || !FLASHCARDS.length) return;

  var order = FLASHCARDS.map(function (_, i) { return i; });
  var pos = 0;
  var flipped = false;

  var flashcard = document.getElementById("flashcard");
  var countEl = document.getElementById("fc-count");
  var qEl = document.getElementById("fc-question");
  var aEl = document.getElementById("fc-answer");

  function render() {
    var card = FLASHCARDS[order[pos]];
    countEl.textContent = "Card " + (pos + 1) + " of " + order.length + " · #" + card.num;
    qEl.textContent = card.q || "(no question text)";
    aEl.textContent = card.a || "(no answer in the source set)";
    flashcard.classList.toggle("flipped", flipped);
  }

  function goTo(newPos) {
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

  var hashMatch = location.hash.match(/^#card-(\d+)$/);
  if (hashMatch) jumpToCardNum(parseInt(hashMatch[1], 10));
  render();
})();
