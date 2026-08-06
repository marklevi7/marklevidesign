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
