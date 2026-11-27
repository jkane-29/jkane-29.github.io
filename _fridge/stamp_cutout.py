"""Cut postcard stamps out of their scan backgrounds (black frames, grey
perforation shadows), leaving just the stamp on a transparent background.
usage: stamp_cutout.py SRC_DIR OUT_DIR"""
import sys, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def cut_on_dark(a, lum, sat, bg, t, b_, l, r):
    """Dark scanner bed: the real perforation teeth show against it, so keep
    them and clear background only in a band around the stamp's edge."""
    pad = int(0.03 * min(b_ - t, r - l)) + 2
    t, l = max(0, t - pad), max(0, l - pad)
    b_, r = min(a.shape[0], b_ + pad), min(a.shape[1], r + pad)
    band = int(0.06 * min(b_ - t, r - l)) + 3
    inner = np.zeros_like(bg); inner[t + band:b_ - band, l + band:r - band] = True
    rect = np.zeros_like(bg); rect[t:b_, l:r] = True
    fg = ndi.binary_opening(rect & (inner | ~bg), iterations=1)
    fl, fn = ndi.label(fg)
    if fn > 1:
        fg = fl == 1 + int(np.argmax(ndi.sum(fg, fl, range(1, fn + 1))))
    return fg


def cut_on_white(a, lum, sat, t, b_, l, r):
    """White scanner bed: a stamp's own white border can't be told apart from
    the background, so keep the whole rectangle (border and all), paint out the
    grey perforation shadows, and cut clean perforations into the edge."""
    h, w = b_ - t, r - l
    edge = max(3, int(0.025 * min(h, w)))
    rect = np.zeros(lum.shape, bool); rect[t:b_, l:r] = True
    inner = np.zeros_like(rect); inner[t + edge:b_ - edge, l + edge:r - edge] = True
    ring = rect & ~inner
    paper_px = a[ring & (lum > 200) & (sat < 30)]
    paper = np.median(paper_px, 0) if len(paper_px) > 50 else np.array([250., 249., 246.])
    shadow = ring & (sat < 45) & (lum < 238)
    a = a.copy(); a[shadow] = paper
    # perforations: half-circle holes centred on each edge
    rr = max(2.0, 0.017 * min(h, w)); pitch = rr * 2.7
    yy, xx = np.mgrid[0:lum.shape[0], 0:lum.shape[1]]
    holes = np.zeros_like(rect)
    for x0, x1, y in [(l, r, t), (l, r, b_)]:
        n = max(2, int(round((x1 - x0) / pitch)))
        for cx in np.linspace(x0, x1, n + 1):
            holes |= (xx - cx) ** 2 + (yy - y) ** 2 < rr ** 2
    for y0, y1, x in [(t, b_, l), (t, b_, r)]:
        n = max(2, int(round((y1 - y0) / pitch)))
        for cy in np.linspace(y0, y1, n + 1):
            holes |= (xx - x) ** 2 + (yy - cy) ** 2 < rr ** 2
    return a, rect & ~holes


src, out = sys.argv[1], sys.argv[2]
for f in sorted(glob.glob(os.path.join(src, '*.webp'))):
    im = Image.open(f).convert('RGB')
    a = np.asarray(im).astype(float)
    lum = a.mean(-1)
    sat = a.max(-1) - a.min(-1)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    dark_bg = border.mean() < 110
    # background-like pixels: dark scanner bed, or white/grey paper + shadows
    cand = (lum < 95) if dark_bg else ((lum > 135) & (sat < 38))
    lab, _ = ndi.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    # The stamp is a rectangle: rows/columns that are mostly not background.
    # Background is only cleared in a band around its edge (perforation gaps,
    # shadows), so a stamp's own white paper inside is kept.
    fgc = ~bg
    if dark_bg:
        rows = np.where(fgc.mean(1) > 0.5)[0]; cols = np.where(fgc.mean(0) > 0.5)[0]
    else:   # white scanner bed: the stamp is everything not near-white, incl. its perforation shadows
        ink = ndi.binary_opening((lum < 228) | (sat > 22), iterations=1)
        rows = np.where(ink.any(1))[0]; cols = np.where(ink.any(0))[0]
    t, b_, l, r = rows.min(), rows.max() + 1, cols.min(), cols.max() + 1
    if dark_bg:
        fg = cut_on_dark(a, lum, sat, bg, t, b_, l, r)
    else:
        a, fg = cut_on_white(a, lum, sat, t, b_, l, r)
    ys, xs = np.where(fg)
    l, t, r, b_ = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    alpha = ndi.gaussian_filter(fg.astype(float), 0.6)
    box = (l, t, r, b_)
    rgba = np.dstack([a, alpha * 255]).clip(0, 255).astype(np.uint8)
    Image.fromarray(rgba).crop(box).save(os.path.join(out, os.path.basename(f)), quality=88, alpha_quality=90)
    print(os.path.basename(f), 'dark' if dark_bg else 'light', box)
