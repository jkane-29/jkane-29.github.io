#!/usr/bin/env python3
"""Lay a render over fridge2.jpg to check it: python _fridge/composite.py open-quick [out.png]"""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
name = sys.argv[1] if len(sys.argv) > 1 else 'open-quick'
r = Image.open(os.path.join(HERE, '.build', name + '.png')).convert('RGBA')
# frame bounds from render.py: left edge = door's left edge; top = FY1 above the door's bottom
FX0, FX1, FY0, FY1, DOOR_W = -0.2865, 0.74, -0.15, 0.97, 0.573
px = 522 / DOOR_W                                   # photo pixels per metre
if r.width / r.height < 0.8: FX1, FY0, FY1 = 0.2865, 0.0, 811 / px   # --interior render
S = 2                                               # work at 2× the photo
w, h = round((FX1 - FX0) * px * S), round((FY1 - FY0) * px * S)
photo = Image.open(os.path.join(HERE, '..', 'fridge2.jpg')).convert('RGB')
canvas = Image.new('RGB', (1300 * S, 1536 * S), 'white')
canvas.paste(photo.resize((1024 * S, 1536 * S), Image.LANCZOS), (0, 0))
canvas.paste(r.resize((w, h), Image.LANCZOS), (250 * S, round((1314 - FY1 * px) * S)), r.resize((w, h), Image.LANCZOS))
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, '.build', 'composite.png')
canvas.crop((150 * S, 380 * S, 1300 * S, 1500 * S)).save(out)
print(out)
