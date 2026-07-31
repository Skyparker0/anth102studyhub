# ANTH 102 Study Site

A static study site generated from a Canvas course export (Biological
Anthropology 102) — 20 lectures with real slide images + extracted text side
by side, a native flashcard viewer, full-text search across lectures and
flashcards, and per-lecture notes that autosave in your browser. All plain
static HTML/CSS/JS for GitHub Pages, styled as a deliberate 1996-web pastiche.

## Layout

- `Course content/` — the raw Canvas export (lecture decks, `course-data.js`,
  `ExternalLinks.txt`, `Flashcards.pdf`). Not tracked in git (see
  `.gitignore`) — it's private source material, not the published site.
- `site/` — the generator:
  - `generate.py` — parses `course-data.js`, extracts slide text from each
    `.pptx` (`python-pptx`), renders every slide to a real JPG via
    PowerPoint COM automation (`pywin32` — **requires PowerPoint installed
    on Windows**; falls back to text-only if unavailable), parses the
    combined Quizlet flashcard PDF (`pdfplumber`, column-aware since it's a
    two-column export), and builds a client-side search index covering both
    slides and flashcards.
  - `templates/` — Jinja2 HTML templates (base, index, lecture, flashcards,
    resources).
  - `static/` — hand-written CSS/JS (`style.css`, `search.js`, `notes.js`,
    `flashcards.js`) plus generated assets (slide images, search index) that
    get swept into `docs/` on build.
- `docs/` — the generated static site, what GitHub Pages serves (configure
  Pages to build from `main` branch, `/docs` folder). Regenerated in full
  every run — don't hand-edit files in here. Currently ~110MB, almost all
  slide images.

## Rebuilding the site

After changing course content, templates, or CSS:

```
pip install -r site/requirements.txt   # first time only
python site/generate.py
```

Full rebuild takes ~80 seconds (PowerPoint COM export dominates that). If
you only touched CSS/JS in `site/static/`, it's faster to just copy the
changed file directly into `docs/static/...` instead of a full rebuild.

Then check it locally:

```
cd docs
python -m http.server 8000
```

and open `http://localhost:8000`.

## Features

- **Slide images + text, side by side** on every lecture page, plus a
  slide-1 thumbnail on each lecture card.
- **Flashcards** (`/flashcards/`): all cards from the combined Quizlet PDF
  export, flip/prev/next/shuffle, keyboard nav, deep-linkable via `#card-N`.
- **Search**: every slide and flashcard is indexed at build time
  (`static/js/search-data.js`). Client-side only, no server — word-boundary
  matching, phrase-match bonus, highlighted snippets, arrow-key/Enter
  navigation, jumps straight to the matching slide or card.
- **Notes**: a textarea on each lecture page, autosaves to
  `localStorage` (keyed per lecture, this-browser-only, nothing leaves your
  machine).

## Deliberately out of scope

- Quiz/exam *content* — quiz items show as title-only references back to
  Canvas, never scraped.
- The old Canvas-export viewer as a "classic view" subpage.
- git init / GitHub push / turning on Pages — all explicitly deferred until
  asked for.

A few items reference files that were renamed or never uploaded by the
professor and aren't present in the export — those are just omitted rather
than showing a broken link.
