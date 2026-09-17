# Evermore — Our Wedding Planner

A calm, self-contained wedding planning app: a marketing landing page plus a
full planner (budget, guests, timeline, vendors, a private diary, and a vows
assistant), all saved locally in the visitor's browser — no backend required.

## Files

- `index.html` — redirects to the landing page (useful for static hosts that
  look for `index.html` by default).
- `Wedding Planner Landing.dc.html` — the marketing/landing page. Its
  "Start Planning" button links to the planner app.
- `Our Wedding Planner.dc.html` — the planner app itself (Home, Budget,
  Guests, Timeline, Vendors, Diary, Vows tabs). On a first visit it asks for
  both names and a wedding date before it opens (or you can load the example
  plan). State is persisted to `localStorage` and can be exported/imported as
  a JSON backup; an incomplete or corrupt backup is rejected and leaves the
  current plan untouched. If the browser refuses to save (storage full, or
  private browsing) the planner keeps the change on screen and says plainly
  that it is unsaved rather than pretending it was stored.
- `support.js` — the runtime that powers both `.dc.html` pages (parses the
  `<x-dc>` template, evaluates `{{ }}` bindings, and drives the `DCLogic`
  component defined in each page's `<script data-dc-script>` block).
- `assets/thumbnail.webp` — a preview image of the design.

## How it works

The `.dc.html` pages are **not** plain static HTML — they're a small
component format (custom `<x-dc>`, `<sc-if>`, `<sc-for>` tags plus a
JS/JSX-flavored `DCLogic` class) that `support.js` boots at runtime. On load,
`support.js` fetches React, ReactDOM, and Babel from unpkg.com, parses the
page's template and script, and renders the app client-side.

Because of that:

- **Serve these files over HTTP** — they use `fetch()` internally, so
  opening a `.dc.html` file directly via `file://` will not work.
- **Internet access is required** at runtime to load React/ReactDOM/Babel
  from `unpkg.com`.
- `support.js` must sit next to each `.dc.html` page (same relative path,
  `./support.js`), and `Our Wedding Planner.dc.html` must keep that exact
  filename, since the landing page links to it by name.

## Running locally

From the repo root, serve the directory with any static file server, e.g.:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Then open `http://localhost:8080/`.

## Data & privacy

All planner data (budget, guest list, timeline, vendor info, diary entries,
vows drafts) lives only in the visitor's browser `localStorage` — nothing is
sent to a server. Use the "Export backup" / "Import" buttons in the planner
to save or restore that data as a JSON file.

Clearing the browser's storage for the page resets the planner back to the
first-run setup.
