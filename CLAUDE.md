# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

`quoteconv` — a client-side tool that turns a **quote export CSV** into
**importer-ready rows**, in two output formats. Static site on GitHub Pages
(`https://lukem570.github.io/quoteconv/`).

**Why it exists:** BigCommerce can't create quotes from shopping carts. The
*B2B Quotes by Fresh Click* app can export cart quotes, but it offers exactly
one export — you can't select specific quotes, and its shape doesn't match the
*Transactions Pro* importer format QuickBooks needs. This tool bridges that gap
for one specific shop, so the mapping is deliberately tailored, not general.

Stakeholder workflow (written up in `docs/Generic Quote Importer.docx`, local
only — see **Untracked data** below):

1. User uploads the quote export CSV. Same format every time, new entries
   appended to the end.
2. User types the FC numbers they want (`29, 31-33, FC54`).
3. A tab picks the output format. Output renders on screen for copy/paste,
   with an optional CSV download. Everything happens in the browser — no
   server, no upload.

## The two formats

Both read the same uploaded export and the same FC selection
(`selectQuotes()` in `js/transform.js` does the picking), then flatten to one
row per line item.

| Tab | Builder | Target |
| --- | --- | --- |
| Importer rows | `buildOutput()` | the flat version of the export (`docs/before-after.xlsx`) |
| Transactions Pro | `buildTransactionsPro()` | QuickBooks via Transactions Pro |

## The transform — Importer rows

The export is two-level: a `Quote` row carries the header fields, and the
`Product` rows after it are its line items. The importer wants **one row per
line item, with the quote's header fields repeated on every row**.

Input (export) → output column:

| Output column | Source |
| --- | --- |
| Quote | quote row, col A (`Quote`) |
| Quote No | quote row `Quote No` |
| Status | quote row `Status` |
| Date Time | quote row `Date Time` (kept as the original string) |
| Type | product row, col A (`Product`) |
| Item | product row `Product Name` |
| SKU | product row `SKU` |
| Quantity | product row `Qty` |
| Original Price | product row `Price` |
| Quote Price | product row `Quote Price` |
| Total | quote row `Total` (repeated) |
| Name | quote row `Name` |
| Company | quote row `Company` |
| Email | quote row `Email` |

Dropped: `Product No`, `Comment`. The export's second line
(`,Product No,Product Name,...`) is a sub-header and is skipped, as is any
`Product` row appearing before the first `Quote` row.

`docs/before-after.xlsx` is the stakeholders' spec: the **Before** sheet is the
export, **After** is the importer format, and the cell fills show which source
cell lands in which output column. Those colors are reproduced as per-column
CSS tints via `OUTPUT_COLUMNS[].color` in `js/transform.js` — keep them in sync
with the spreadsheet; they are the only reason the colors exist. The table above
is the authoritative copy of the mapping, since the spreadsheet is untracked.

FC number = the trailing number in `Quote No` (`RR Books Quote FC29` → 29),
matched case-insensitively with optional leading zeros. Output rows follow the
order the user typed, and FC numbers not in the file are reported rather than
silently dropped.

## The transform — Transactions Pro

Spec: the stakeholders' `output sample.jpg`. Seven columns, one row per line
item, header row included:

| # | Column | Source |
| --- | --- | --- |
| A | `Quote #` | the number after `FC` in `Quote No`, as a bare number (`54`), repeated on every line item |
| B | *(blank)* | intentionally empty |
| C | *(blank)* | intentionally empty |
| D | `Shipping Method` | static, default `BIBO - BestWay`, filled down |
| E | `Payment Method` | static, default `Purchase Order`, filled down |
| F | `Qty` | export column E (`Qty`) |
| G | `SKU` | export column D (`SKU`) |

Columns B and C have **empty header labels** — the importer template expects
two blank columns there, so don't "fix" them by naming them. The table shows
them as a muted `(blank)` cell for legibility only; the copied and downloaded
output has genuinely empty fields.

The two static values are editable in the UI (`TPRO_DEFAULTS` seeds them), so a
different shipping or payment method needs no code change.

Decisions already settled with the stakeholders, don't re-litigate:
quote id repeats on every row; the header row is included in copy and download;
colors in the sample image are descriptive only. The `Qty 4` in the sample image
is illustrative — quantity always comes from the export.

## Hard constraints

- **Light mode only.** No dark-mode media queries, no theme toggle. Requested.
- **No build step.** The repo root is exactly what ships. No bundler, no
  transpiler, no `dist/`.
- **No dependencies.** No npm packages in the browser, no CDN `<script>` tags.
  `package.json` exists only for `npm test` and the dev server. In particular:
  no CSV or spreadsheet library — `js/csv.js` is the parser.
- **Raw HTML + CSS + ES modules.** Relative paths, explicit `.js` extensions.
- **Relative asset paths in `index.html`** — the site is served from the
  `/quoteconv/` subpath. `404.html` is the exception (absolute, prefixed).
- **Nothing leaves the browser.** No fetch to any origin except the local
  sample file, no telemetry. The CSV download is a local `Blob`. This is a
  product requirement, not an implementation detail — uploaded files contain
  customer names and emails.
- **No real customer data in git.** `sample/` and `docs/` are gitignored, so
  nothing in them may be a dependency of the build, the tests, or the deployed
  page. Test fixtures live in `test/fixtures.js`.

## Layout

```
index.html        three-step UI, format tabs, output table; loads js/app.js
404.html          Pages 404 (absolute /quoteconv/ paths)
css/styles.css    all styles, light mode, per-column tints via --col
js/csv.js         RFC 4180 parse / CSV + TSV serialize (pure)
js/transform.js   quote grouping, FC parsing, both flatteners, column specs (pure)
js/app.js         DOM wiring only: file read, render, copy, download
sample/           local real export, gitignored — "Load local sample" button
docs/             before-after.xlsx + user story, gitignored
test/fixtures.js  synthetic export used by the suites (committed)
test/*.test.js    node:test suites (csv, transform, tpro)
.nojekyll         stops Pages running Jekyll over the files
```

## Pure / impure split

`js/csv.js` and `js/transform.js` are pure string/array functions — that is why
the tests run in Node with no DOM shim. Anything touching `document`, `FileReader`, the clipboard, or `Blob`
belongs in `js/app.js`. New mapping logic goes in `transform.js` **with tests**;
new controls go in `index.html` + `app.js`.

## Commands

```bash
npm test                            # node:test, no deps
npm run dev                         # python3 -m http.server 8000
node --test test/transform.test.js  # single file
```

Use the dev server, not `file://` — ES modules and the sample-file `fetch` both
fail on `file://`.

## Conventions

- 2-space indent, semicolons, single quotes in JS, LF endings (`.editorconfig`).
- Prices, quantities and dates stay **strings** end to end. Never `Number()` or
  reformat them: the importer wants the export's own text, and parsing
  `175.88`/`7/24/2026 9:36` only invites rounding and locale bugs.
- Column colors live in the column specs (`OUTPUT_COLUMNS`, `TPRO_COLUMNS`);
  the table reads them through the `--col` custom property. Dark fills get
  white header text via `DARK_COLORS` in `app.js`. A `null` color means no tint.
- A new output format is a new entry in `FORMATS` in `app.js` (columns, note,
  numeric keys, download suffix, `build()`) plus a builder and column spec in
  `transform.js`. Nothing else in the UI should need to know about it.
- Build DOM with `document.createElement` / `textContent`, not `innerHTML` —
  book titles and company names are untrusted input.
- Layout must hold at ~400px wide; the step cards stack below 860px and the
  output table scrolls horizontally inside `.table-wrap`.

## Untracked data

`sample/` and `docs/` hold the stakeholders' real files (customer names, emails)
and are gitignored — they exist on this machine only, and the deployed site does
not have them. Consequences to respect:

- The suites must never read from them. `test/fixtures.js` holds a synthetic
  export of the same shape; extend that instead.
- The "Load local sample" button fetches `sample/quote-export-sample.csv` and
  hides itself when the file 404s, which is what happens on Pages.
- Mapping changes driven by a new spreadsheet: update the mapping table in this
  file and `OUTPUT_COLUMNS`, so the spec survives in the repo.

## Deploying

Push to `main`. `.github/workflows/pages.yml` runs `npm test`, then publishes
the repo root. One-time repo setup: **Settings → Pages → Source: GitHub
Actions**. Failing tests block the deploy.

## Before saying work is done

1. `npm test` passes.
2. Loaded through `npm run dev`: upload a real export (drop one in `sample/`
   and the "Load local sample" button picks up
   `sample/quote-export-sample.csv`), enter a few FC numbers, then check **both
   tabs** — row counts, copy, and download.
3. No console errors; layout checked at phone width.
