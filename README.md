# Eyad Aly — Retail Intelligence Portfolio

A responsive static portfolio with a real-data analytics case study built from the [UCI Online Retail dataset](https://archive.ics.uci.edu/dataset/352/online+retail). The site runs without a framework, database, or build step. Open `index.html` directly, or preview it with `python3 -m http.server 8080 --bind 127.0.0.1`.

## Source and reproduction

Source: Daqing Chen (2015), *Online Retail*, UCI Machine Learning Repository, DOI [10.24432/C5BW33](https://doi.org/10.24432/C5BW33), CC BY 4.0. Original workbook SHA-256: `43465a06f2ccf7c8b5bd2892bc7defb52f97487934fe93b16ae4c3936424676d`.

Rebuild with Python 3.10+:

```sh
python3 analysis/pipeline.py --download
```

If your Python installation lacks CA certificates, download the official UCI archive with `curl` and pass the extracted workbook:

```sh
mkdir -p analysis/.cache
curl -fL 'https://archive.ics.uci.edu/static/public/352/online%2Bretail.zip' -o analysis/.cache/online-retail.zip
unzip -o analysis/.cache/online-retail.zip -d analysis/.cache
python3 analysis/pipeline.py --source 'analysis/.cache/Online Retail.xlsx'
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

The dashboard can export its active view and scope. Full-history exports are in `assets/data/`: product performance, monthly ledger, cleaning summary, customer segments, exception review, and validation report. The original synthetic toy dataset remains under `assets/` as an unused legacy file.

The CV feature links to a readable `cv.html` page and the original, unchanged one-page PDF at `assets/Eyad-Aly-CV.pdf`. Contact links open an email draft to `info@eyadaly.me`; no form submits data to a server. The unchanged PDF still prints the earlier Outlook address.

## Private chat

The unlisted `/private-chat/` path hosts the official Element Web v1.12.32 client, configured for the Matrix.org homeserver. It is absent from the public portfolio navigation and has a `noindex` directive. The client itself is public static code; privacy comes from each participant's Matrix account password, an invite-only direct message, and the room's end-to-end encryption. A secret URL is **not** an access control. The Matrix.org server handles account login and stores encrypted messages and some metadata; GitHub Pages serves only the client files. No Matrix credentials or message keys are stored in this repository.

To activate a one-to-one chat after deployment:

1. Open `https://eyadaly.me/private-chat/` in a private browser window. Each person creates their **own** Matrix.org account there, with a distinct strong password. Do not share an account or password.
2. Each person saves their Element recovery key in a password manager or another safe place. Losing every signed-in session and the recovery key can make old messages unreadable.
3. Exchange exact Matrix IDs through a channel where you already know each other. One person starts a direct message with the other ID. The recipient accepts the invite.
4. Before sending private content, check the conversation's encryption status. If encryption is off, enable it in the room's Security & Privacy settings before sending anything; encryption cannot protect earlier messages. Verify the other person's identity by comparing Element's verification emojis or QR code in person or over a trusted call.

The page is intentionally not linked from `index.html`. It is still discoverable through the public repository or by someone who knows the URL, and either participant can copy or screenshot messages. Element updates must be applied promptly when security releases appear. This static host cannot set Element's recommended response security and cache headers, so consider dedicated hosting if the chat becomes especially sensitive. The upstream distribution is at [Element Web releases](https://github.com/element-hq/element-web/releases); its GPL/AGPL licenses are copied into `private-chat/`.
