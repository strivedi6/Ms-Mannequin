# Ms. Mannequin Invoices: setup

An iPhone web app (PWA) built on the same structure as the hotel team app. It works straight away on your phone.
Connecting a Google Sheet is optional: it keeps a safe copy of everything and lets you open the app on another iPhone.

## A. Put the app online (Netlify, about 3 minutes)
1. Go to https://app.netlify.com/drop and sign in.
2. Drag this whole folder onto the page. You get a link such as `https://something.netlify.app`.
3. Open that link in **Safari on your iPhone**, tap **Share > Add to Home Screen**.
   Open the app from the new Ms. Mannequin icon.

Without step B the app runs in "this phone only" mode (Settings > Data & backup shows this).
Use **Backup** there now and then.

### Or: host it on GitHub Pages instead of Netlify
1. Create a GitHub repository (for example `ms-mannequin-invoices`) and upload everything in this folder to it,
   including the hidden `.nojekyll` file. Easiest: on the repo page choose Add file > Upload files and drag the contents in.
2. Repo **Settings > Pages**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`. Save.
3. After a minute your app is at `https://YOUR-NAME.github.io/ms-mannequin-invoices/`. Open it in Safari on your iPhone
   and Add to Home Screen as above.
4. To update later, upload the changed files to the repo (commit); Pages republishes automatically.
Notes: Pages on a private repo needs a paid GitHub plan, so the repo is usually public. That makes the code, and your
Apps Script link in `config.js`, visible to anyone. Your invoices are not in the repo, and the sheet is protected by your PIN
(5 wrong tries locks sign-in for 10 minutes), but choose a PIN that is not obvious.

## B. Connect a Google Sheet (about 5 minutes)
1. Create a new Google Sheet, name it "Ms. Mannequin Invoices".
2. **Extensions > Apps Script**. Delete the sample code, paste all of `Code.gs`.
3. Near the top, change `SETUP_PIN = '1234'` to the 4-digit PIN you want.
4. Select the function **setup** in the toolbar and press **Run**. Approve the permissions
   (Advanced > Go to project). This creates the sheet tabs and saves your PIN.
5. **Deploy > New deployment > Web app**. Execute as **Me**, who has access **Anyone**. Deploy and copy the Web app URL.
6. Open `config.js` in this folder and paste the URL inside the quotes: `apiUrl: 'https://script.google.com/macros/s/.../exec'`.
7. Publish the change: drag the folder onto Netlify again, or upload the new `config.js` to your GitHub repo.
8. Open the app on your iPhone. It asks for your PIN. Your existing invoices on the phone are uploaded automatically.

To change the PIN later: edit `SETUP_PIN`, run **setup** again. Everyone is signed out.
If you change Code.gs later: Deploy > Manage deployments > edit > New version.

## What each tab in the sheet holds
Customers, Invoices (readable columns plus a Data column the app uses), Settings, Sessions. Do not edit the Data columns.
Reading the sheet is fine; for changes, use the app.

## Sharing an invoice
Open an invoice and tap **Share with customer**. iPhone's share sheet opens with the PDF so you can pick
WhatsApp, Messages, Mail or AirDrop. **WhatsApp** opens a chat with the customer's number and a ready message with the pay link.
**Print** uses AirPrint. Set the payment link and your phone number under Settings.

## Updating the app
Replace the files and re-deploy. Bump `appVersion` in `config.js` and `CACHE` in `sw.js` so phones pick up the new files.
