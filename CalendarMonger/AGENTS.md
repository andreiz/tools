# Repository Guidelines

## Project Structure & Module Organization
- `index.html` contains the static page markup and loads Tailwind via CDN.
- `app.js` holds all calendar logic, range selection, and localStorage persistence.
- `style.css` contains custom styles layered on top of Tailwind.
- `TODO.md` tracks near-term UI/feature ideas and known issues.

## Build, Test, and Development Commands
- `open index.html` (macOS) or double-click the file to run locally in a browser.
- `python3 -m http.server` serves the folder at `http://localhost:8000` for local testing (recommended for script loading).
- There is no build step; the app runs as static HTML/CSS/JS.

## Coding Style & Naming Conventions
- JavaScript: 2-space indentation, `const`/`let`, and prefer `camelCase` for variables and functions.
- DOM elements use descriptive IDs (e.g., `monthPicker`, `todayButton`) referenced in `app.js`.
- CSS: keep selectors scoped to the calendar UI; use Tailwind utilities in HTML and reserve `style.css` for custom layout/overrides.

## Testing Guidelines
- No automated tests are present.
- Manual testing checklist: range selection, multi-month navigation, saved ranges reload via localStorage, and UI responsiveness at narrow widths.

## Commit & Pull Request Guidelines
- Commits are short and descriptive; recent history suggests conventional prefixes like `feat:` and `fix:`.
- PRs should include: a concise summary, steps to verify, and screenshots or a short recording for UI changes.
- Link to an issue when applicable and note any changes to `TODO.md`.

## Security & Configuration Tips
- No secrets should be stored in the repo; data is persisted only in browser localStorage.
- When adding new features that serialize data, include versioning or migration notes in the PR.
