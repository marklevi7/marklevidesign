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

Tokens live in `assets/static/app_generated_index-*.css`, but four of them are also
hardcoded in each page's inline dark-mode block (`--color-grey`, `--color-white-hover`,
and `--color-black-light` scoped to `footer` and `.mld-stats`). A token change has to
touch both places or dark mode drifts from light.

Approved token changes so far:

- `--color-black-light`: `rgb(48 48 48)` → `rgb(48 44 58)`. The old value was a neutral
  grey unrelated to the rest of the palette; the new one is `--color-black`
  (`rgb(32 29 39)`) lightened by the same factor, so surfaces built on it — stat cards,
  footer, the dark-mode proof blob — carry the background's purple cast instead of
  reading as a foreign grey.

## Header controls

The theme toggle and hamburger each sit in a 48px circle at 90% opacity of
`--color-white`, so they stay legible over the hero pattern in either theme. The
hamburger bars are 33.6px (30% narrower than the button) and the theme icon is 26px —
picked so the two read at the same weight.

The bars are `#burger-btn::before/::after` from an inline stylesheet that comes *after*
the `mld-theme-css` block, so overriding their width needs the extra `html` specificity.
The open-state X is a rotation about each bar's center and stays correct at any width.

On desktop the theme button is placed by `mld-theme-js` 8px after the last nav link,
with a 56px lane reserved on `#menu`. Pinning it to the viewport edge instead makes it
overlap "Contact" below ~1400px.

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

### Hero pattern variants and how to switch

The hero loads exactly one pattern file via a `<script src>` in `index.html`.
Switching or reverting is that one line — the files stay on disk:

- `assets/patterns/pattern-01-halftone-ripple.js` — pattern 1, sparse dots
- `assets/patterns/pattern-03-halftone-updraft.js` — pattern 3, round dots (**undo target for the square variant**)
- `assets/patterns/pattern-03b-updraft-solid.js` — pattern 3 with square cells, live on the homepage
- `assets/patterns/pattern-03d-durer-composite.js` — 03b with Dürer's solid rendered into the field, live on `/sandbox`

Round cells cap near 20% coverage (`maskCircle` radius is `sqrt(cov) * 0.25`), so they can never read as solid; square cells fill completely, which is the knob for "darker in the dark areas". Other density levers, roughly strongest first: dot radius, `density`, canvas `alpha`, `pixelSize`, then the noise curve in the shader.

### The sandbox and the solid

`/sandbox` is a clone of the homepage (`sandbox.html` + `sandbox/index.html`, both
`noindex`) for trying things without touching what visitors see. Edits there do not
propagate — the two are separate copies and drift apart on purpose.

It runs the composite pattern, whose layer order is the whole point:

    waves (the fBm feed)  →  Dürer's solid  →  the dither/pixelation filter

So the solid is not a canvas on top of the pattern. It renders to a framebuffer inside
the *same* WebGL context, and the dither pass samples that buffer and lets it replace
the noise feed inside the silhouette — which is why it comes out pixelated like
everything else. Two contexts could not do this; a texture cannot cross between them.

- `assets/patterns/shape-durer.js` — geometry, mesh shaders and lighting only, exported
  on `window.MLD_DURER`. Draws nothing itself.
- `assets/patterns/shape-durer-standalone.js` — the earlier version that owned its own
  canvas and sat *above* the pattern, unpixelated. **Undo target.**

Two traps worth remembering. The solid's coverage mapping flips with the theme
(`uShapeLo`/`uShapeHi`): ink is dark on the light page and white on the dark one, so
opposite ends of the shading ramp read as dense. And anything that writes to the
documentElement class list from inside `sync()` re-triggers the theme MutationObserver
that called it — guard the write or the page locks up.

Implementation notes: the handoff drives patterns 1–4 through three.js, which it uses only to draw a fullscreen quad — port shaders onto raw WebGL2 instead (see `assets/patterns/`) so the site takes no CDN dependency. Every pattern must be theme-reactive: light and dark differ in both colour and motion. Mount patterns by script, never in markup, or React hydration drops them.

## The homepage testimonial carousel

Swiper runs it in loop mode with autoplay, and loop mode rotates the list on init: the
**last** slide in source order is the one that shows first. Production proved it twice -
with Ilan Dray last the page opened on Ilan, and moving Ariel Ben Lulu to the end made
the page open on Ariel. So "first in the carousel" means last in the markup, in both
`index.html` and the homepage bundle. Autoplay advances after about five seconds, which
makes this easy to mismeasure - sample the active slide within the first few seconds.

## The one blur

There is a single blur value, `--mld-blur` (currently 15px), declared next to `#mld-theme-host` in every page's inline styles. It drives **both** the sticky header (once scrolled) and the hero proof blob. If the owner asks to change "the blur", change this one value — both places follow.

The proof blob is deliberately translucent (`color-mix` on `--color-grey`) so the hero pattern reads through it, with `backdrop-filter: blur(var(--mld-blur))` softening what shows through.
