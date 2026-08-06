# Publishing Vuma to Google Play Store — Step-by-Step Guide

Vuma is a PWA (Progressive Web App). Rather than rewriting it as a separate
native app, we're publishing it via **TWA (Trusted Web Activity)** — Google's
official, supported way to wrap an existing PWA as a real Play Store app. Your
web app becomes the actual app content; the "native" part is a thin wrapper
that opens it full-screen with no browser UI. This is not a hack or a
workaround — Google explicitly designed TWA for exactly this purpose, and
plenty of well-known apps ship this way.

**What you get**: a real `.aab` file, listed properly on Play Store, no more
"unverified source" Play Protect warnings, installable straight from the
Store like any other app — all without rewriting a single line of Vuma's
existing code.

---

## Before you start — what you need

- [ ] Vuma already deployed and working on a real HTTPS domain (you have this: your Vercel URL)
- [ ] A Google account
- [ ] **$25 USD one-time fee** for a Google Play Console developer account
- [ ] A Windows/Mac/Linux computer with:
  - [ ] Node.js (you already have this)
  - [ ] **Java Development Kit (JDK) 17 or later**
  - [ ] **Android SDK** (installed automatically by Bubblewrap, or via Android Studio)
- [ ] About 1–2 hours for first-time setup, plus Google's review time (typically a few hours to a few days for a new app)

---

## Step 1: Create your Google Play Console developer account

1. Go to [play.google.com/console](https://play.google.com/console/signup)
2. Sign in with the Google account you want to publish under (consider creating
   a dedicated one for the business, not a personal account, if you haven't already)
3. Pay the one-time **$25 registration fee**
4. Complete the identity verification Google requires (can take up to 48 hours
   for a new account) — start this step early since it can be a bottleneck

---

## Step 2: Install the build tools

**Install a JDK** (if you don't have one):
- Download from [adoptium.net](https://adoptium.net) (choose JDK 17, "Temurin")
- Verify: `java -version` in your terminal

**Install Bubblewrap CLI** (Google's official TWA build tool):
```bash
npm install -g @bubblewrap/cli
```

Bubblewrap will offer to download the Android SDK for you the first time you
run it — let it do so (takes a few minutes, several GB).

---

## Step 3: Generate the Android project from your PWA

This project already includes a pre-filled `twa-manifest.json` at the project
root with Vuma's branding, colors, and your deployed URL already configured.

1. Create a new folder **outside** your `vuma` web project for the Android
   build (keeps things clean):
   ```bash
   mkdir vuma-android
   cd vuma-android
   ```
2. Copy `twa-manifest.json` from the Vuma project into this new folder
3. Initialize the TWA project from that manifest:
   ```bash
   bubblewrap init --manifest=./twa-manifest.json
   ```
4. Bubblewrap will ask a series of questions — press Enter to accept the
   defaults pulled from `twa-manifest.json` for most of them. **When it asks
   about the signing key, choose "Create new key"** and follow the prompts.

### Critical: back up your signing key immediately

Bubblewrap will generate a file (commonly `android.keystore`) and ask you to
set a password. **This file and its password are irreplaceable.** If you lose
them, you can never publish an update to this app again under the same
listing — you'd have to publish as a brand new app from scratch, losing all
reviews, ranking, and install history.

- [ ] Copy `android.keystore` to at least two secure backup locations (a
      password manager's file storage, an encrypted USB drive, etc.)
- [ ] Write down the keystore password and key alias somewhere safe (not just
      in your head)
- [ ] Never commit this file to a public GitHub repo

---

## Step 4: Get your key's fingerprint and update assetlinks.json

The Play Store app and your website need to "shake hands" to prove they're
both really you — this is what Digital Asset Links does.

1. Get your key's SHA-256 fingerprint:
   ```bash
   keytool -list -v -keystore android.keystore -alias vuma
   ```
   (use whatever alias you chose in Step 3 if different)
2. Copy the line that starts with `SHA256:` — it looks like
   `AA:BB:CC:11:22:33:...`
3. Open `public/.well-known/assetlinks.json` in your **Vuma web project**
   (already created for you, currently has a placeholder) and replace
   `REPLACE_WITH_YOUR_UPLOAD_KEYSTORE_SHA256_FINGERPRINT` with your real
   fingerprint. Bubblewrap's own generated `assetlinks.json` in Step 3's
   output folder will show you the exact format it expects (with or without
   colons) — copy that format exactly.
4. **Deploy this change to your live Vuma site** (commit, push, let Vercel
   redeploy) — the file must be reachable at exactly:
   ```
   https://vuma-self.vercel.app/.well-known/assetlinks.json
   ```
5. Verify it's live by visiting that URL directly in a browser — you should
   see the JSON, not a 404.

**Do this before submitting to Play Store.** Without a matching
`assetlinks.json`, your installed app will show a browser address bar (it
falls back to a Custom Tab instead of a true full-screen TWA), which isn't
broken, just not the polished native look you want.

---

## Step 5: Build the signed app bundle

Back in your `vuma-android` folder:
```bash
bubblewrap build
```

This produces `app-release-bundle.aab` — this is the file you upload to Play
Console. Bubblewrap will also generate an `.apk` for local testing.

**Test it locally first** (recommended): connect an Android phone via USB with
developer mode + USB debugging enabled, then:
```bash
bubblewrap install
```
This installs the actual app on your phone so you can confirm it opens
full-screen (no browser bar) before submitting to Google.

---

## Step 6: Prepare your store listing assets

Everything text-based is already drafted for you in
`docs/PLAY_STORE_LISTING.md` in the Vuma project — short description, full
description, category suggestion, content rating guidance, and data safety
answers, all ready to copy-paste.

Graphics already generated for you:
- `public/icon-512.png` — app icon
- `public/play-store-feature-graphic.png` — feature graphic banner

Still needed from you:
- [ ] 2–8 phone screenshots (see the list of suggested screens in
      `PLAY_STORE_LISTING.md`) — easiest way: open your live site in Chrome
      DevTools' device emulator, or on a real phone, and screenshot each screen
- [ ] A support email address and privacy contact email (replace the
      `[BRACKETS]` placeholders in `app/privacy/page.tsx`, `app/terms/page.tsx`,
      and `PLAY_STORE_LISTING.md`)
- [ ] Your actual business/legal entity name if you have one registered (also
      replace the bracketed placeholders in the privacy policy and terms pages)

---

## Step 7: Create the app listing in Play Console

1. Play Console → **Create app**
2. Fill in app name (`Vuma`), default language, app/game (App), free/paid (Free)
3. Accept the declarations (US export laws, content guidelines, etc.)
4. Work through the left-hand checklist Play Console gives you:
   - **Store listing**: paste in the content from `PLAY_STORE_LISTING.md`,
     upload your icon, feature graphic, and screenshots
   - **App content**: privacy policy URL, ads (No, unless you add them later),
     content rating questionnaire, target audience, data safety form, app
     access (reviewer test credentials), government apps (No), COVID-19
     contact tracing (No)
   - **Store settings**: category, contact details

---

## Step 8: Upload your app bundle

1. Play Console → **Production** (or start with **Internal testing** —
   recommended for your very first release, see below) → **Create new release**
2. Upload `app-release-bundle.aab` from Step 5
3. Add release notes (e.g., "Initial release")
4. Save and review

### Recommended: use Internal Testing first

Rather than going straight to full public **Production**, use Play Console's
**Internal testing** track first:
- Instantly available (no review wait) to testers you email-invite
- Lets you and a few trusted people install the real Play Store version and
  confirm everything works before the public sees it
- Once happy, promote the same build to **Production** from within Play Console

---

## Step 9: Submit for review

Once every checklist item is green, submit the release. Google's review for a
new app typically takes anywhere from a few hours to a few days. You'll get an
email when it's approved (or if something needs fixing — Google is usually
specific about what to change).

---

## After approval — updating the app later

Any time you change Vuma's code and redeploy to Vercel, **the live app updates
automatically for everyone with zero Play Store action needed** — that's the
beauty of TWA, since the actual content is just loading your website. You only
need to publish a new Play Store release if you change something in
`twa-manifest.json` itself (app name, icon, colors, version number) — in which
case, repeat Steps 3–5 with the **same signing key** and upload the new
`.aab` as a new release.

---

## Known limitations of this approach

- **Requires internet connection.** TWA loads your live site — it won't work
  fully offline unless you build out the service worker's caching further
  (currently minimal, by design, per earlier setup).
- **Reviewed as a web-wrapped app.** Google's review is generally
  straightforward for TWAs, but if your app later adds features Google
  restricts more heavily (e.g., background location), expect closer review.
- **You are responsible for keeping the underlying site up.** If
  `vuma-self.vercel.app` (or your production domain) goes down, so does the
  Play Store app — there's no separate "native" fallback.
