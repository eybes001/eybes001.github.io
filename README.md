# Eyad Beshier — Pricing & Data Portfolio

A complete responsive static portfolio website: no backend, framework, build step, paid API, or database.

## 1. Open it locally

Open `index.html` in Firefox or Chrome, or open the folder in VS Code. All interactive examples work without a local server.

## 2. REQUIRED: activate your contact address

Open `app.js` and replace:

```js
const CONTACT_EMAIL = 'ADD_YOUR_EMAIL_HERE';
```

with your actual email address in quotes, e.g. `yourname@gmail.com`. Links will open the visitor's email client with an enquiry subject. Until you change it, the contact button is intentionally disabled and a setup reminder is visible.

## 3. Personalize before publishing

- Check that your public professional name is correct: `Eyad Beshier` is a starter value, not identity verification.
- Update your bio in `index.html` to accurately represent your experience and current services.
- Replace / expand demo case studies with real work only if you have permission to share it and can substantiate results. Never publish your employer's confidential data.
- `assets/synthetic-product-data.csv` is synthetic, matched by a JavaScript array in `app.js`.
- Change design colors via `--lime`, `--bg` and other CSS variables at the top of `styles.css`.
- Optional: add your LinkedIn / GitHub links to the header or footer.
- Optional: use a purchased custom domain. The site works on a free Pages subdomain.

## 4. Deploy on Cloudflare Pages for $0/month

1. Sign in at https://dash.cloudflare.com/ .
2. Select **Workers & Pages**, **Create application**, then the **drag and drop / direct upload** option. The exact menus may change.
3. Upload the **ZIP** that contains `index.html` at its root or the unzipped site folder.
4. Choose a unique project name, click **Deploy site**.
5. Open the assigned `your-project.pages.dev` address.

Cloudflare's official instructions: https://developers.cloudflare.com/pages/get-started/direct-upload/

You can reupload updates via the Cloudflare dashboard. A Direct Upload project cannot later switch to Git integration; create a separate Git-integrated project if you want automatic deploys on Git commits.

## 5. Customize for clients

Good case studies use: **problem → anonymized/synthetic data → approach → output → limitations / next steps**. Your site currently has two interactive demonstrations and one methodology concept, none claiming real client gains.

## Data and privacy

The demo runs entirely in visitors' browsers; it sends no uploaded company records anywhere (and does not accept uploads). It requests optional Google Fonts assets if internet is available, and relies on system fonts if not.

### Note on the sample tool

The classification rule is intentionally simple: if `premium_flag = TRUE`, expected group is `Premium {category}`, otherwise expected group is `{category}`. Real ERP pricing depends on customer, contract, region, conditions, product rules, and more. Confirm those rules before adapting it to production.

The margin scenario models **revenue × affected revenue share × illustrative avoidable leakage rate**; it is neither a realized savings claim nor an estimate of net profit.
