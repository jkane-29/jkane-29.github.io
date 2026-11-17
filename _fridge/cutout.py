#!/usr/bin/env python3
"""Cut the fridge out of its white studio background → fridge/fridge-cut.webp (same 1024×1536 frame, transparent around it)."""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
HERE = os.path.dirname(os.path.abspath(__file__))
im = np.asarray(Image.open(os.path.join(HERE, '..', 'fridge2.jpg')).convert('RGB')).astype(float)
lum = im.mean(-1)
lab, _ = ndi.label(lum > 200)
edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
outside = np.isin(lab, edge[edge > 0])                               # the white that reaches the picture's edge
outside = ndi.binary_dilation(outside, iterations=1)
band = ndi.binary_dilation(outside, iterations=3) & ~outside
a = np.where(outside, 0.0, 1.0)
a[band] = np.clip((250 - lum[band]) / 190, 0, 1)                      # edge pixels are a mix of white wall and black enamel
rgb = im.copy()
m = band & (a > 0.02)
rgb[m] = np.clip((im[m] - (1 - a[m])[:, None] * 255) / a[m][:, None], 0, 255)   # take the wall back out of them
rgb[outside] = 0
# under the fridge the studio left a soft grey shadow on the floor: keep only what is as dark as the fridge itself
yy = np.arange(im.shape[0])[:, None]
floor = (yy > 1385) & (lum > 60)
a = np.where(floor, a * np.clip((130 - lum) / 70, 0, 1), a)
out = np.dstack([rgb, a * 255]).round().astype(np.uint8)
dst = os.path.join(HERE, '..', 'fridge', 'fridge-cut.webp')
Image.fromarray(out).save(dst, 'WEBP', quality=92, method=6, alpha_quality=100)
print(dst, os.path.getsize(dst) // 1024, 'KB')
