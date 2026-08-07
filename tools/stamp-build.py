#!/usr/bin/env python3
"""Re-stamp the build id on every page.

Run this after editing any page HTML. Each page gets an id derived from its
own content, carried as data-build on the inline #mld-autorefresh script.
That script polls the current URL and reloads the page once when it sees a
different id, so visitors pick up new deploys without clearing their cache.

The id lives on the script tag rather than in a <meta>: React/Vike manages
<head> during hydration and prunes metas it doesn't own, which silently
disabled the whole mechanism once before.
"""
import glob, hashlib, re

BUILD_ATTR = re.compile(r'(<script[^>]*\bid="mld-autorefresh"[^>]*\bdata-build=")[^"]*(")')

n = missed = 0
for f in glob.glob('**/*.html', recursive=True):
    if 'old-home' in f:
        continue
    s = open(f).read()
    if 'mld-autorefresh' not in s:
        continue
    stripped = BUILD_ATTR.sub(r'\1\2', s)
    bid = hashlib.sha1(stripped.encode()).hexdigest()[:10]
    new, cnt = BUILD_ATTR.subn(lambda m: m.group(1) + bid + m.group(2), s, count=1)
    if not cnt:
        print("WARNING: no data-build anchor, skipped", f)
        missed += 1
        continue
    open(f, 'w').write(new)
    n += 1
print("stamped", n, "pages" + (" | %d SKIPPED" % missed if missed else ""))
