"""Stamp every cache-busting ?v= on the site with a hash of the file it points to.

Browsers cache the site's scripts, styles and images, so each reference carries
a version (styles.css?v=…). Keeping those numbers by hand is easy to forget and
easy to get wrong; this sets each one to the first 8 characters of the file's
SHA-1, so a version changes exactly when its file does.

Run from the repo root before committing:
    python3 _tools/version_assets.py          # rewrite references in place
    python3 _tools/version_assets.py --check  # just list what's out of date

A reference is any local path followed by a query containing v=, inside the
site's .html, .js and .css files, e.g.
    <script src="js/door.js?v=7">   'fridge/open.webp?v=4'   /amtrak/map.html?embed=1&v=4
Paths starting with / are from the site root; other paths are tried relative to
the referencing file first, then to the root (scripts in js/ name files the way
index.html sees them).
"""
import hashlib
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = re.compile(r"""(?P<path>(?:https?:)?[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)\?(?P<pre>[^"'\s)<>]*?)\bv=(?P<v>[A-Za-z0-9._-]+)""")


def site_files():
    out = subprocess.run(['git', 'ls-files', '*.html', '*.js', '*.css'], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout.split()
    return [ROOT / f for f in out if not f.startswith(('_', 'ClockClock24/static/'))]


def resolve(ref, src):
    ref = re.sub(r'^(https?:)?//(www\.)?jackkane\.me', '', ref)   # this site's own absolute URLs
    cands = [ROOT / ref.lstrip('/')] if ref.startswith('/') else [src.parent / ref, ROOT / ref]
    return next((c.resolve() for c in cands if c.is_file()), None)


def digest(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def stamp(check=False):
    stale = []
    for _ in range(6):   # a stamped file can change another's hash; repeat until settled
        changed = False
        for f in site_files():
            text = f.read_text(encoding='utf-8')

            def sub(m):
                target = resolve(m['path'], f)
                if not target:
                    return m[0]
                v = digest(target)
                if v != m['v']:
                    stale.append(f"{f.relative_to(ROOT)}: {m['path']} {m['v']} -> {v}")
                return f"{m['path']}?{m['pre']}v={v}"

            new = REF.sub(sub, text)
            if new != text:
                changed = True
                if not check:
                    f.write_text(new, encoding='utf-8')
        if check or not changed:
            break
    return stale


if __name__ == '__main__':
    check = '--check' in sys.argv
    stale = stamp(check)
    for line in dict.fromkeys(stale):
        print(line)
    if check and stale:
        sys.exit(1)
    print('versions up to date' if not stale else f'{len(set(stale))} reference(s) {"stale" if check else "updated"}')
