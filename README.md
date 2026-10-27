# Eyad Aly — Retail Intelligence Portfolio

A responsive static portfolio with a real-data analytics case study built from the [UCI Online Retail dataset](https://archive.ics.uci.edu/dataset/352/online+retail). Preview it with `python3 -m http.server 8080 --bind 127.0.0.1` so the clean section URLs resolve locally.

The canonical CV page is `/cv/` (`cv/index.html`); `cv.html` redirects old links. The homepage sections also have real GitHub Pages entry points, such as `/work/`, `/dashboard/`, and `/pricing/`. After editing `index.html`, run `python3 scripts/build_routes.py` to refresh those directory pages before publishing. `clean-routes.js` keeps in-page navigation, refresh, and browser history in sync with the clean paths. Dashboard selections are encoded as `tab`, `period`, `market`, and (for products) `ranking` query parameters for direct sharing.

## Source and reproduction

Source: Daqing Chen (2015), *Online Retail*, UCI Machine Learning Repository, DOI [10.24432/C5BW33](https://doi.org/10.24432/C5BW33), CC BY 4.0. Original workbook SHA-256: `43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d`.

Rebuild with Python 3.10+:

```sh
python3 analysis/pipeline.py --download
python3 analysis/pricing_study.py
```

If your Python installation lacks CA certificates, download the official UCI archive with `curl` and pass the extracted workbook:

```sh
mkdir -p analysis/.cache
curl -fL 'https://archive.ics.uci.edu/static/public/352/online%2Bretail.zip' -o analysis/.cache/online-retail.zip
unzip -o analysis/.cache/online-retail.zip -d analysis/.cache
python3 analysis/pipeline.py --source 'analysis/.cache/Online Retail.xlsx'
python3 analysis/pricing_study.py
```

The raw workbook and SQLite staging database remain in `analysis/.cache/`, which is ignored by Git. The public site reads the checked-in, validated `assets/data/retail-data.js` snapshot. `validation-report.json` records reconciliation checks.

## Metric definitions

- Each of 541,909 source lines gets one classification. Exact eight-field duplicates are removed first. Positive price and a five-digit stock code with up to two letter suffixes define merchandise in this study. This is an explicit analysis rule, not a universal SKU standard.
- Positive quantity on a non-cancellation invoice is a sale. Negative quantity on an invoice prefixed `C` is a cancellation credit. Credits are accounting reversals; physical returns cannot be inferred.
- Amounts are held as integer ten-thousandths of GBP during processing. Gross merchandise sales less cancellation credits equals net merchandise revenue. Display values are rounded.
- Period and market controls select one of 12 pre-aggregated views. The full period includes a partial December 2011; no figure is annualized.
- Customer segments use identified positive sales from the source start through the selected period's end within the selected market. “Inactive” means no observed purchase in the prior 90 days, not proven churn. Identified revenue share uses the selected reporting period only. Missing customer IDs remain in revenue totals but cannot enter segments.
- Four problem cards show measured findings and suggested decisions. The public dataset does not establish retailer implementation, savings, campaign outcomes, or Eyad's direct employment with the retailer.

## Outputs

The dashboard can export its active view and scope, and the copy-link button restores the current tab, period, market, and product ranking. Full-history exports are in `assets/data/`: product performance, monthly ledger, cleaning summary, customer segments, exception review, and validation report. The second pricing study uses accepted sale lines from the same source, includes only SKUs with at least 100 lines, and flags 90th-to-10th percentile unit-price ratios of at least 3. This is a review queue, not proof of pricing mistakes. Its full export is `assets/data/pricing-variation.csv`. The original synthetic toy dataset remains under `assets/` as an unused legacy file.

The CV feature links to a readable `/cv/` page and an updated one-page PDF at `assets/Eyad-Aly-CV.pdf`. Both use `info@eyadaly.me`. Contact links open an email draft; no form submits data to a server. `robots.txt`, `sitemap.xml`, page metadata, and `assets/social-preview.png` support search discovery and link previews.

