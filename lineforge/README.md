# LineForge

LineForge is a browser-based opening-line trainer for forging repertoire branches until the database runs out. You control your assigned side; the enemy replies from Masters/Lichess database games.

Features:

- Interactive chess GUI with click-to-move and drag-and-drop
- You control your assigned side; the opposite side auto-replies with the most popular uncompleted qualifying database move
- Legal move validation/check/checkmate/draw detection via `chess.js`
- Game setup for player names and side assignment: White / Black / Random
- Side assignment controls your training side, PGN headers, and default orientation
- Startup onboarding guide explaining board control, PGN export, APIs, and move fetching
- Optional Forgey AI mentor that explains why your corrected line move was better than your rejected attempts
- Skip current move button that plays the top eligible line move, adds one mistake, and asks Forgey to explain it
- PGN copy/download export and FEN copy
- Move list, captured pieces, board flip, themes, and responsive layout
- Lichess Opening Explorer integration for most-played human moves in the current position
- Hardcoded explorer sources: Masters database plus Lichess 2500+ rapid/classical/correspondence games
- Player move rules: Masters games plus Lichess games must clear the depth threshold, and at least one source must have score or winrate of 50% or better for your color
- Depth slider values exactly: 100k, 50k, 10k, 5k, 1k, 500
- Enemy reply rule: most popular uncompleted database response from the fixed Masters/Lichess sources, game count and score ignored
- Opening completion when your side has no qualifying database move or the enemy has no uncompleted database response
- Optional same-origin `/api/explorer` proxy for production-style API token handling

## Current mode

LineForge currently runs in **Learning Openings mode**. Freeplay mode is planned for later, but it is intentionally not active yet. In this mode, the app filters your moves by opening-database rules, chooses enemy replies from the fixed databases, saves zero-mistake learned lines by color and depth, and lowers the max depth for that color when a depth is complete.

## How API move fetching works

After each legal move, the app reads the current FEN and makes two fixed opening-explorer requests for that exact position:

1. `masters` — the OTB master database.
2. `lichess` — aggregate Lichess rated games with hardcoded query filters:
   - `ratings=2500`
   - `speeds=rapid,classical,correspondence`
   - fixed move/reference-game limits

Your move list is built from both databases and keeps Master and Lichess results separate. Qualification now uses a combined-depth plus any-positive-result rule:

- depth is always Masters games plus Lichess 2500+ games for that move;
- the move qualifies when combined games clear the selected depth; and
- at least one of these is true for your color: Masters score is at least 50%, Lichess score is at least 50%, Masters pure winrate is at least 50%, or Lichess pure winrate is at least 50%.

The default ordering sorts by the best score or winrate from either source. You can also sort by most combined games.

If your attempted move fails the 500+ combined-games / at least one score or winrate at 50% rule, the app shows “Hmm, try making a better move!”, adds a mistake, and automatically undoes it. If your side has no qualifying database move, the app considers the opening learned. Enemy moves choose the most popular uncompleted database response from the fixed Masters/Lichess sources, ignoring game count and score. If no such enemy database response exists, the app congratulates you, and zero-mistake lines are saved so the enemy will skip them at that depth.


## Optional Forgey AI mentor

LineForge can explain a corrected move after you make mistakes in the same position. Flow:

1. You try one or more moves that fail the 500+ combined-games / at least one score or winrate at 50% rule.
2. LineForge rejects and undoes those attempts, tracking their SAN/UCI and database stats.
3. You then make an accepted move from that same position.
4. Forgey currently gives local advice only. The OpenRouter framework remains in the codebase for future use, but online AI advice is disabled in the current UI.

The OpenRouter key is saved in browser `localStorage` so it persists after closing the site. The default model is:

```text
google/gemma-4-26b-a4b-it:free
```

This uses Google Gemma 4 26B free on OpenRouter by default. LineForge also retries a short list of current free/ultracheap fallback models if the selected model becomes unavailable. You can paste another model slug in the AI mentor settings.

## Client-side persistence

LineForge does not use cookies. It saves progress, completed lines, preferences, the current run, and optional API keys in the browser client using `localStorage`. This means you can close the site and return later with your run and progress restored on the same browser/device. Clearing site data/localStorage will erase this saved state.

For public or shared devices, do not save API keys or remember to clear them from the app settings.

## Run it

### Static preview

Any static web server works:

```bash
python3 -m http.server 5173
# open http://localhost:5173
```


### GitHub Pages / `github.io`

The static app can run on GitHub Pages as long as you publish the whole folder, including `vendor/chess.js`. The included `.nojekyll` file keeps GitHub Pages from processing the static assets with Jekyll.

Important API note: GitHub Pages cannot run `server.js`, cannot read `local-secrets.json`, and cannot hide a Lichess token. On GitHub Pages the app automatically disables the same-origin proxy and makes direct browser requests to `https://explorer.lichess.org`.

If the Lichess explorer returns `401 Unauthorized`, paste your Lichess token into the in-app token field. That token is saved in browser `localStorage` so it persists after closing the site. Do **not** commit `local-secrets.json` or hardcode a token into `app.js` for a public `github.io` deployment.


### With the optional proxy

The current Lichess explorer API may require OAuth depending on deployment and endpoint. Keep the token on the server when possible.

Option A — environment variable:

```bash
LICHESS_TOKEN=your_lichess_oauth_token npm start
# open http://localhost:5173
```

Option B — local hardcoded secret file:

```bash
cp local-secrets.example.json local-secrets.json
# paste your token into local-secrets.json
npm start
# open http://localhost:5173
```

`local-secrets.json` is ignored by `.gitignore`. When the server sees a token, the app automatically enables the same-origin `/api/explorer` proxy. If you do not use the proxy, you can paste a Lichess OAuth token in the app. It is saved in browser `localStorage` so it persists after closing the site.

## Files

- `index.html` — LineForge UI and onboarding content
- `styles.css` — responsive polished styling and board themes
- `app.js` — chess logic, UI state, training flow, PGN export, and explorer API integration
- `server.js` — optional static server + Lichess explorer proxy
- `local-secrets.example.json` — template for a local-only server-side Lichess token
- `.gitignore` — ignores local token files
- `.nojekyll` — makes GitHub Pages serve static assets without Jekyll processing
- `vendor/chess.js` — local vendored chess.js ESM build
- `assets/forgey.svg` — Forgey mascot used for the logo, favicon, and AI mentor
- `vendor/chessjs-LICENSE.txt` — chess.js license

## Online multiplayer next steps

This is currently a single-user opening trainer, not a full multiplayer server. To turn it into true internet multiplayer:

1. Add accounts or guest room IDs.
2. Send local moves from `afterMove(...)` to a WebSocket room.
3. Validate every move server-side with chess.js before broadcasting.
4. Persist PGN, headers, clocks, draw/resign offers, chat, and anti-cheat metadata.
5. Keep explorer/API tokens server-side behind the included proxy pattern.
