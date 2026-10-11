# quoteconv

Turn a B2B Quotes export CSV into importer-ready rows, in the browser.

**Live:** https://lukem570.github.io/quoteconv/

1. Upload the quote export CSV (drag and drop, or pick a file).
2. Type the FC numbers you want: `29, 31-33, FC54`.
3. Pick an output format tab. The table appears on screen — copy it straight
   into a spreadsheet, or download it as a CSV.

## Why

BigCommerce can't create quotes from shopping carts. *B2B Quotes by Fresh Click*
exports them, but only as one fixed export: no picking individual quotes, and
the wrong shape for the *Transactions Pro* importer that feeds QuickBooks.
quoteconv does the picking and the reshaping.

Nothing is uploaded. The file is read, mapped and written entirely inside your
browser, so customer names and emails never leave the machine. No build step, no
dependencies, no tracking.

## Output formats

### Importer rows

The export nests line items under their quote: a `Quote` row holds the header
fields, and the `Product` rows that follow are its items. The importer wants one
flat row per item, so every item row gets its quote's Quote No, Status, Date
Time, Total, Name, Company and Email repeated onto it.

Output columns, in order:

`Quote` · `Quote No` · `Status` · `Date Time` · `Type` · `Item` · `SKU` ·
`Quantity` · `Original Price` · `Quote Price` · `Total` · `Name` · `Company` ·
`Email`

`Product No` and `Comment` are dropped. Prices and dates are passed through as
written — nothing is rounded or reformatted. Column colors on screen match the
fills in the before/after spreadsheet the mapping was specified in.

### Transactions Pro (QuickBooks)

Seven columns, one row per line item:

| Column | Contents |
| --- | --- |
| `Quote #` | the number after `FC` (`RR Books Quote FC54` → `54`), on every row |
| *(blank)* | intentionally empty |
| *(blank)* | intentionally empty |
| `Shipping Method` | static, default `BIBO - BestWay` — editable |
| `Payment Method` | static, default `Purchase Order` — editable |
| `Qty` | quantity from the export |
| `SKU` | SKU from the export |

The header row is included in both the copy and the download.

## FC numbers

FC numbers are read from the quote number (`RR Books Quote FC29` → 29). You can
type them with or without the `FC` prefix, as singles or ranges, separated by
commas or spaces. Output follows the order you type, and anything you ask for
that isn't in the file is called out instead of being silently skipped.

## Run locally

```bash
git clone https://github.com/lukem570/quoteconv.git
cd quoteconv
npm run dev          # python3 -m http.server 8000
open http://localhost:8000
```

Any static server works. Don't open `index.html` over `file://` — browsers block
ES modules there.

## Test

```bash
npm test             # node --test test/   (Node 20+, zero dependencies)
```

The suites run against `test/fixtures.js`, a synthetic export of the same shape.
Real exports are not in the repo: `sample/` and `docs/` are gitignored because
they contain customer names and email addresses. Drop a real export at
`sample/quote-export-sample.csv` locally and the "Load local sample" button will
pick it up; the button hides itself when the file isn't there.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Upload / FC input / output table |
| `css/styles.css` | Styles (light mode), per-column tints |
| `js/csv.js` | CSV parse and CSV/TSV serialize |
| `js/transform.js` | Quote grouping, FC parsing, flattening |
| `js/app.js` | DOM wiring |
| `test/` | `node:test` suites + `fixtures.js` (synthetic export) |
| `sample/`, `docs/` | Local only, gitignored (real data) |

## Deploy

GitHub Actions publishes the repo root on every push to `main`
(`.github/workflows/pages.yml`), gated on `npm test`. One-time setup:
**Settings → Pages → Source: GitHub Actions**.

## License

MIT — see [LICENSE](LICENSE).
