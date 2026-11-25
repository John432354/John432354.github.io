# John432354.github.io — site source

Static site, no build step. Push it and GitHub Pages serves it.

```
/                     → project index (landing page)
/music/               → Sonora, the YouTube Music client (official player only)
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

- **Sonora is a plain web page, not an installable app.** There is deliberately no service
  worker, manifest or icon set: no Add-to-Home-Screen, no offline cache. On phones it fills
  the screen edge to edge and asks for browser fullscreen on first tap. Don't reintroduce
  `sw.js`/`manifest.webmanifest` without also re-adding the install UI.
- `.nojekyll` must stay at the repo root, or GitHub Pages will hide files starting with `_`.
- No secrets in this repo. Sonora needs no API key; a user who wants an optional fallback key
  pastes it into the app's own Settings, where it's stored in their browser only. LineForge
  saves its optional Lichess/OpenRouter keys in browser `localStorage` only — never commit
  `local-secrets.json` or any token.
