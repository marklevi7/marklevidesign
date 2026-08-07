# marklevidesign — editing guide

This repo is the live site **marklevi.com**: a Webstudio static export served by GitHub Pages from `main`. Changes go live only after merging to `main` (deploy takes ~1–2 min).

## How to edit content (required procedure)

Page text exists in **two places** and both must be edited, or the old text will flash back after hydration:

1. The static HTML (e.g. `index.html`, `about/index.html`)
2. The matching JS hydration bundle in `assets/entries/` (e.g. `pages_index.<hash>.js`)

After editing a JS bundle, **rename it** (give it a new hash-like suffix) and update every reference — found in the page HTML and `assets/entries/entry-server-routing.<hash>.js`. Keep a copy of the bundle at the old filename so stale cached references don't 404. This cache-bust is mandatory: assets are cached for 4 hours, so an in-place edit won't show up for users.

HTML is cached ~10 min by the CDN; renamed assets show up as soon as the HTML refreshes.

## Notes

- `old-home/` is an archived version of the homepage — leave it untouched unless asked.
- Site-wide styles (e.g. the logo carousel `scroll-x` animation) are inlined in every page's HTML, so global tweaks mean editing all pages (plus their bundles if the value also lives there).

## Design system (hard rule)

The site has a token system: colors (`--color-black`, `--color-black-light`, `--color-grey`, `--color-white`, `--color-accent`), gaps (`--gap-xs/s/m/l/xl/section`), radii (`--border-radius-s/m`), fonts (DM Sans, DM Mono). **Never style with values outside these tokens. Never invent new tokens. Changing a token's value requires the owner's explicit approval.** Blue (`--color-accent`) is reserved for CTAs. Yellow appears only in the hero stars.

## Next session: show this first

Plan: port animations from these two prior projects. Show links to owner before other work.
1. https://claude.ai/code/session_01MKEA6RrcTgMrCcT2XdGLLF
2. MLD website 2026 (David)

## Deploys and cache (auto-refresh)

Every page carries `<meta name="mld-build">` plus an inline `mld-autorefresh` script. The script polls the current URL with `cache: 'no-store'`, compares build ids, and reloads once (guarded by sessionStorage, so no reload loops) when a new build is live. This is what lets visitors pick up changes without clearing their cache.

**After editing any page HTML, run `python3 tools/stamp-build.py`** so the build ids change — otherwise the auto-refresh has nothing to detect.

Deploys can also fail: GitHub Pages sometimes leaves a run stuck in `deployment_queued` until it times out, and the site then silently keeps serving the previous version. If a change is missing from the live site, check the Pages workflow runs before assuming a cache problem; the fix is to re-run the deploy (a new commit on `main` triggers one).

During a GitHub Actions/Pages outage the `build` job can succeed while the `deploy` job sits queued and is eventually cancelled — the run looks half-green but nothing ships. Check https://www.githubstatus.com, and once Actions is operational again push a fresh commit to `main`, since the API rerun endpoint is not available to this integration.

## Pattern list (from the alumot-pattern handoff)

Source: https://raw.githack.com/marklevi7/alumot-pattern/9a304e2e72914d82eda029c100c5c474483a6cd7/handoff.html
Names are ours where the handoff had none. Owner previews these one at a time in the hero.

1. **Halftone Ripple** — dither dot field, hero preset *(currently live)*
2. **Halftone Dense** — same shader, denser field (banner preset)
3. **Halftone Updraft** — bottom-weighted density, upward drift (final preset)
4. **Wave Strip** — wave dither strip
5. **Node Constellation** — AI-node loader
6. **Snowball** — pure-CSS loader
7. **Tier Sigils** — inline SVG with SMIL animations
8. **Shine Sweep** — periodic CTA shine
9. **Scramble Badge** — badge pop-in + digit scramble
10. **Scroll Reveal** — reveal on scroll
11. **Difference Wordmark** — `mix-blend-mode: difference`
12. **Boxed Lines** — per-line backdrop, `box-decoration-break: clone`
13. **Depth Gradient** — body radial gradient

Implementation notes: the handoff drives patterns 1–4 through three.js, which it uses only to draw a fullscreen quad — port shaders onto raw WebGL2 instead (see `assets/patterns/`) so the site takes no CDN dependency. Every pattern must be theme-reactive: light and dark differ in both colour and motion. Mount patterns by script, never in markup, or React hydration drops them.
