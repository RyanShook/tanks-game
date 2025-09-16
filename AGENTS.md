# Repository Guidelines

## Project Structure & Module Organization
Source lives in `js/` and is split by system: `main.js` owns bootstrap and the game loop, `player.js`/`enemy.js` drive actors, `projectile.js` and `effects.js` manage combat visuals, and `hud.js` handles canvas overlays. Shared constants sit in `constants.js`; `state.js` exposes setter/getter helpers for anything persisted between frames. The `index.html` entry point loads the ES modules directly, while `style.css` captures the retro vector aesthetic. Keep assets inline or in new folders under the repo root so GitHub Pages can serve them without a build step.

## Build, Test, and Development Commands
- `python -m http.server 8000` — quick static server for local browser testing from the repo root.
- `npx serve .` — Node-based alternative that mirrors the production setup.
- `npm exec http-server -p 8080` — useful when you need custom ports while validating multi-browser sessions.
All commands assume you run them from `/Users/ryan/Documents/Tanks-Game`.

## Coding Style & Naming Conventions
Follow existing ES module patterns. Use four-space indentation, `const` by default, and camelCase for functions and variables (`createMountainRange`). Reserved configuration and enumerations remain SCREAMING_SNAKE_CASE (`GAME_PARAMS`). Never assign to `state.*` fields directly—call the setter utilities from `state.js` or add new ones when expanding the state surface. Keep imports relative, avoid globals, and gate temporary debug logging with comments for easy cleanup.

## Testing Guidelines
Automated tests are not present; rely on manual validation. Launch the game in Chrome and Safari or Firefox to confirm rendering parity, then use DevTools’ performance overlay when touching Three.js scenes. Validate start-up flow, projectile behavior, HUD updates, and wave transitions after every change. Capture console output and key repro steps when filing bugs or reviews.

## Commit & Pull Request Guidelines
History favors short, imperative subjects (e.g., `Fix authenticity issues`, `Add comprehensive code documentation:`). Keep commits scoped, squashing only when it clarifies the story. Pull requests should include: a concise summary, validation steps (commands and browsers exercised), screenshots or clips for visual tweaks, and linked issues or TODOs addressed. Confirm that static hosting still works—no bundlers, no additional build artifacts—before requesting review.
