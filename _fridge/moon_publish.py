#!/usr/bin/env python3
"""Turn the Moon renders in _fridge/.build into what the site loads.

    python _fridge/moon_publish.py [--quick]

    fridge/moon.webp        the ground with the fridge's door shut (moon.py --closed); the sky left transparent
    fridge/moon-door.webp   the patch of it that changes when the door hangs open (its shadow), to lay on top
Prints the patch's rectangle in photo pixels, for DOOR in js/away.js.
"""
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'fridge')
sfx = '-quick' if '--quick' in sys.argv else ''
PX, CAM_D = 0.573 / 522, 6.0
CAM_Y = (1314 - 768) * PX
X0, Y0 = -1500, -282                                        # the picture's top left corner, in photo pixels

opened = np.asarray(Image.open(os.path.join(HERE, '.build', f'moon{sfx}.png')).convert('RGB')).astype(float)
closed = np.asarray(Image.open(os.path.join(HERE, '.build', f'moon-closed{sfx}.png')).convert('RGB')).astype(float)
H, W = closed.shape[:2]
k = W / 4024                                                # picture pixels per photo pixel

# the sky: the black that reaches the top of the picture. It is made transparent, so the page can
# draw its own stars behind the ground (js/away.js: one for every visit)
lab, _ = ndi.label(closed.max(-1) < 4)
top = np.unique(lab[0]); sky = np.isin(lab, top[top > 0])
land = np.clip(1 - ndi.gaussian_filter(sky.astype(float), 0.7), 0, 1)

# the edges fall away into the dark, which the page continues
yy, xx = np.mgrid[0:H, 0:W]
t = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
fade = (1 - t(0.90, 1.0, np.abs((xx + 0.5) / W * 2 - 1))) * (1 - t(0.93, 1.0, (yy + 0.5) / H))
closed, opened = closed * fade[..., None], opened * fade[..., None]

def save(arr, name, **kw):
    dst = os.path.join(OUT, name)
    Image.fromarray(arr.round().astype(np.uint8)).save(dst, 'WEBP', method=6, **kw)
    print(f'{name}  {arr.shape[1]}×{arr.shape[0]}  {os.path.getsize(dst) // 1024} KB')
save(np.dstack([closed, land * 255]), 'moon.webp', quality=86, alpha_quality=80)

# where the stand-in door itself shows, keep the door-shut ground: the page draws the real door there
HW, DOOR_H = 0.573 / 2, 811 * PX
c, s = math.cos(math.radians(112)), math.sin(math.radians(112))
pts = []
for x in (-HW, HW):
    for y in (0, DOOR_H):
        for z in (-0.048, 0):
            dx, dz = x - (HW - 0.010), z - (-0.012)
            wx, wz = (HW - 0.010) + dx * c + dz * s, -0.012 - dx * s + dz * c
            m = CAM_D / (CAM_D - wz) / PX
            pts.append(((512 + wx * m - X0) * k, (768 - (y - CAM_Y) * m - Y0) * k))
pts = np.array(pts)
mask = Image.new('L', (W, H), 0)
ImageDraw.Draw(mask).polygon([tuple(p) for p in pts[ConvexHull(pts).vertices]], fill=255)
door = ndi.binary_dilation(np.asarray(mask) > 0, iterations=max(1, int(3 * k)))
opened[door] = closed[door]

diff = ndi.gaussian_filter(np.abs(opened - closed).max(-1), 4 * k) > 6
lab, n = ndi.label(diff)
if n:                                                       # the one big change is the shadow; the rest is render noise
    diff = lab == 1 + np.argmax(ndi.sum(diff, lab, range(1, n + 1)))
ys, xs = np.where(diff)
pad = int(24 * k)
x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + pad, W), max(ys.min() - pad, 0), min(ys.max() + pad, H)
alpha = np.clip(ndi.gaussian_filter(ndi.binary_dilation(diff, iterations=int(10 * k) + 1).astype(float), 5 * k) * 1.6, 0, 1)
patch = np.dstack([opened, alpha * 255])[y0:y1, x0:x1]
save(patch, 'moon-door.webp', quality=86, alpha_quality=90)
print('DOOR = { x: %d, y: %d, w: %d, h: %d }' % (round(x0 / k + X0), round(y0 / k + Y0), round((x1 - x0) / k), round((y1 - y0) / k)))
