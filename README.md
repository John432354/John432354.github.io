# John432354.github.io — site source

Static site, no build step. Push it and GitHub Pages serves it.

```
/                     → project index (landing page)
/music/               → Sonora, the YouTube Music client (installable web app)
/music/sw.js          → service worker (offline launch; scope must stay /music/)
/music/manifest.webmanifest
/music/icons/         → app icons (180 / 192 / 512 / maskable)
/google-ping/         → Google Ping connectivity tool
/lineforge/           → LineForge, the opening-line trainer (self-contained: index.html, app.js, styles.css, assets/, vendor/)
/404.html             → custom not-found page
/.nojekyll            → stops GitHub Pages from running Jekyll (keeps _files and dotfiles)
```

## Adding a project

1. Drop the project in its own folder: `/<slug>/index.html` (self-contained files preferred).
2. Copy a `<a class="card">…</a>` block in `index.html` and update the href, icon, title and one-line
   description, plus the `<div class="url">/<slug>/</div>` line and the "N live" counter in
   `.sectionhead`.
3. Commit and push. Pages redeploys in about a minute.

## Rules that matter

- **Don't move or rename `/music/sw.js` or `/music/icons/`.** The service worker's scope is
  `/music/`; if the file lives elsewhere it silently stops working, and the manifest icons 404.
- `.nojekyll` must stay at the repo root, or GitHub Pages will hide files starting with `_`.
- No secrets in this repo. Sonora needs no API key; a user who wants an optional fallback key
  pastes it into the app's own Settings, where it's stored in their browser only. LineForge
  saves its optional Lichess/OpenRouter keys in browser `localStorage` only — never commit
  `local-secrets.json` or any token.
