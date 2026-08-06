#!/usr/bin/env python3
"""Re-stamp the mld-build id on every page.

Run this after editing any page HTML. Each page gets a build id derived
from its own content; the auto-refresh script embedded in every page polls
for a changed id and reloads the page once when it sees one, so visitors
pick up new deploys without clearing their cache.
"""
import glob, hashlib, re

SNIPPET_RE = re.compile(r'<meta name="mld-build"[^>]*>', re.S)

n = 0
for f in glob.glob('**/*.html', recursive=True):
    if 'old-home' in f:
        continue
    s = open(f).read()
    if 'mld-autorefresh' not in s:
        continue
    stripped = SNIPPET_RE.sub('', s)
    bid = hashlib.sha1(stripped.encode()).hexdigest()[:10]
    s = SNIPPET_RE.sub('', s).replace(
        '<script id="mld-autorefresh">',
        '<meta name="mld-build" content="%s"><script id="mld-autorefresh">' % bid, 1)
    open(f, 'w').write(s)
    n += 1
print("stamped", n, "pages")
