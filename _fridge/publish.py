#!/usr/bin/env python3
"""Turn the renders in _fridge/.build into the images the site loads (fridge/*.webp).

    python _fridge/publish.py            # final renders (interior.png, open.png)
    python _fridge/publish.py --quick    # whatever quick previews exist, as placeholders
"""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'fridge')
os.makedirs(OUT, exist_ok=True)
suffix = '-quick' if '--quick' in sys.argv else ''
for name in ('interior', 'open'):
    im = Image.open(os.path.join(HERE, '.build', name + suffix + '.png'))
    dst = os.path.join(OUT, name + '.webp')
    im.save(dst, 'WEBP', quality=88, method=6, alpha_quality=95)
    print(f'{name}.webp  {im.size[0]}×{im.size[1]}  {os.path.getsize(dst) // 1024} KB')
