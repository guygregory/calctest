# calctest

A simple **scientific calculator** web app, designed to be hosted on **GitHub Pages** and used comfortably from an **iPhone** (or any modern browser).

## Features

- Standard arithmetic: `+ − × ÷`, parentheses, percent, sign toggle (`±`)
- Scientific functions: `sin`, `cos`, `tan` (and inverses via the `2nd` key), `ln`, `log`, `√`, `xʸ`, `x²`, `n!`, `eˣ`, `10ˣ`, `x³`
- Constants: `π`, `e`
- Toggle between **DEG** and **RAD** angle modes
- Memory keys: `MC`, `MR`, `M+`, `M−`
- Live result preview as you type
- Physical keyboard support (digits, `+ - * / ^ ( ) ! %`, `Enter` for `=`, `Backspace`, `Esc` for clear)
- Mobile-first layout with iPhone safe-area support
- Installable as a home‑screen app on iOS (uses `apple-mobile-web-app-capable` + Web App Manifest)

## Run locally

The app is pure static HTML/CSS/JS — no build step. Just open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8080
# then open http://localhost:8080
```

## Publish to GitHub Pages

1. Commit and push these files to your default branch (e.g. `main`).
2. In the repository on GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Pick the `main` branch and the `/ (root)` folder, then **Save**.
5. Wait a minute, then visit `https://<your-username>.github.io/<repo-name>/`.

## Use it on iPhone

1. Open the published URL in **Safari** on your iPhone.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Launch the calculator from your home screen — it runs full‑screen like a native app.

## Files

| File                   | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `index.html`           | Calculator markup and metadata                |
| `styles.css`           | Mobile-first styling, safe-area aware         |
| `script.js`            | Calculator logic + safe expression evaluator  |
| `manifest.webmanifest` | PWA manifest for installable behavior         |
| `icon.svg`             | App icon (used for tab/home screen)           |
