(function () {
  var input = document.getElementById("site-search");
  var box = document.getElementById("search-results");
  if (!input || !box || typeof SEARCH_DATA === "undefined") return;

  var prefix = "../".repeat(window.SITE_DEPTH || 0);
  var activeIndex = -1;
  var currentMatches = [];

  // Transcript paragraphs are numerous, short, and full of generic spoken
  // phrasing -- without a penalty they drown out slide/flashcard matches on
  // common words. This keeps them rankable but not dominant.
  var KIND_WEIGHT = { transcript: 0.4 };

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Whole-word counting so a search for "art" doesn't get inflated by
  // "chart"/"party" etc, plus a bonus for the exact phrase (not just the
  // individual words) and an extra bonus when it's in the title -- the
  // combination is what makes "hardy weinberg" rank the actual HWE slide
  // above scattered single-word hits elsewhere.
  function scoreChunk(chunk, terms, phrase) {
    var titleLower = chunk.title.toLowerCase();
    var textLower = chunk.text.toLowerCase();
    var haystack = titleLower + " " + textLower;
    var total = 0;

    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      if (!term) continue;
      var re = new RegExp("\\b" + escapeRegex(term) + "\\w*", "g");
      var count = (haystack.match(re) || []).length;
      if (titleLower.indexOf(term) !== -1) count += 3;
      total += count;
    }

    if (terms.length > 1 && haystack.indexOf(phrase) !== -1) total += 6;
    return total * (KIND_WEIGHT[chunk.kind] || 1);
  }

  function findAnchorTerm(text, terms) {
    var lower = text.toLowerCase();
    for (var i = 0; i < terms.length; i++) {
      if (terms[i] && lower.indexOf(terms[i]) !== -1) return terms[i];
    }
    return null;
  }

  // Builds the snippet as DOM nodes (not innerHTML) so highlighting can't
  // introduce any markup injection, even though this content is all our
  // own trusted course data.
  function appendHighlightedSnippet(container, text, terms) {
    var anchor = findAnchorTerm(text, terms);
    var snippet, offset;
    if (!anchor) {
      snippet = text.length > 140 ? text.slice(0, 140) + "…" : text;
      offset = 0;
    } else {
      var lower = text.toLowerCase();
      var idx = lower.indexOf(anchor);
      var start = Math.max(0, idx - 45);
      var end = Math.min(text.length, idx + anchor.length + 95);
      snippet = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
      offset = start > 0 ? 1 : 0; // account for the leading "…" we prepended
    }

    var validTerms = terms.filter(Boolean).sort(function (a, b) { return b.length - a.length; });
    if (!validTerms.length) {
      container.appendChild(document.createTextNode(snippet));
      return;
    }
    var re = new RegExp("(" + validTerms.map(escapeRegex).join("|") + ")", "gi");
    var lastEnd = 0;
    var match;
    while ((match = re.exec(snippet)) !== null) {
      if (match.index > lastEnd) {
        container.appendChild(document.createTextNode(snippet.slice(lastEnd, match.index)));
      }
      var mark = document.createElement("mark");
      mark.className = "search-highlight";
      mark.textContent = match[0];
      container.appendChild(mark);
      lastEnd = match.index + match[0].length;
      if (match[0].length === 0) re.lastIndex++; // guard against zero-width loops
    }
    if (lastEnd < snippet.length) {
      container.appendChild(document.createTextNode(snippet.slice(lastEnd)));
    }
  }

  function clearResults() {
    box.innerHTML = "";
    box.classList.remove("open");
    currentMatches = [];
    activeIndex = -1;
  }

  function setActive(idx) {
    var rows = box.querySelectorAll(".search-result");
    if (!rows.length) return;
    idx = ((idx % rows.length) + rows.length) % rows.length;
    rows.forEach(function (row, i) { row.classList.toggle("active", i === idx); });
    rows[idx].scrollIntoView({ block: "nearest" });
    activeIndex = idx;
  }

  function renderResults(matches, terms) {
    box.innerHTML = "";
    currentMatches = matches;
    activeIndex = -1;

    if (!matches.length) {
      var empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "No matches";
      box.appendChild(empty);
      box.classList.add("open");
      return;
    }

    matches.forEach(function (item) {
      var chunk = item.chunk;
      var a = document.createElement("a");
      a.className = "search-result";

      var codeSpan = document.createElement("span");
      codeSpan.className = "search-result-code";

      if (chunk.kind === "flashcard") {
        a.href = prefix + "flashcards/index.html#card-" + chunk.card_num;
        codeSpan.textContent = "Flashcard #" + chunk.card_num;
      } else if (chunk.kind === "transcript") {
        a.href = prefix + "lectures/" + chunk.slug + "/index.html#transcript-p" + (chunk.para + 1);
        codeSpan.textContent = chunk.code + " · Transcript";
      } else {
        a.href = prefix + "lectures/" + chunk.slug + "/index.html#slide-" + chunk.slide;
        codeSpan.textContent = chunk.code + " · Slide " + chunk.slide;
      }

      var titleSpan = document.createElement("span");
      titleSpan.className = "search-result-title";
      titleSpan.textContent = chunk.title;

      var snippetSpan = document.createElement("span");
      snippetSpan.className = "search-result-snippet";
      appendHighlightedSnippet(snippetSpan, chunk.text, terms);

      a.appendChild(codeSpan);
      a.appendChild(titleSpan);
      a.appendChild(snippetSpan);
      box.appendChild(a);
    });
    box.classList.add("open");
  }

  var debounceTimer = null;
  input.addEventListener("input", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      var query = input.value.trim().toLowerCase();
      if (query.length < 2) {
        clearResults();
        return;
      }
      var terms = query.split(/\s+/).filter(Boolean);
      var matches = SEARCH_DATA
        .map(function (chunk) { return { chunk: chunk, score: scoreChunk(chunk, terms, query) }; })
        .filter(function (item) { return item.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .slice(0, 12);
      renderResults(matches, terms);
    }, 80);
  });

  document.addEventListener("click", function (e) {
    if (e.target !== input && !box.contains(e.target)) clearResults();
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      clearResults();
      input.blur();
    } else if (e.key === "ArrowDown" && currentMatches.length) {
      e.preventDefault();
      setActive(activeIndex + 1);
    } else if (e.key === "ArrowUp" && currentMatches.length) {
      e.preventDefault();
      setActive(activeIndex - 1);
    } else if (e.key === "Enter" && currentMatches.length) {
      e.preventDefault();
      var rows = box.querySelectorAll(".search-result");
      var target = activeIndex >= 0 ? rows[activeIndex] : rows[0];
      if (target) window.location.href = target.href;
    }
  });
})();
