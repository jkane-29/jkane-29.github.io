"""Make poetry-magnet word tiles that match items/writing.png.
usage: word_tiles.py OUT.png word [word ...]"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = Image.open('items/writing.png').convert('RGBA').crop((161, 84, 604, 246))
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf', 86)  # closest to items/writing.png


def blank_tile(width):
    """Stretch the tile's left/right edges around a text-free middle."""
    a = np.array(SRC)
    edge = 26
    mid = a[:, 14:15].copy()               # a clean column left of the word
    body = np.repeat(mid, width - 2 * edge, axis=1)
    t = np.concatenate([a[:, :edge], body, a[:, -edge:]], axis=1)
    # Keep the paper's slight speckle so it doesn't look flat
    rng = np.random.default_rng(width)
    n = rng.normal(0, 1.4, t.shape[:2])[..., None]
    t[..., :3] = np.clip(t[..., :3] + n * (t[..., 3:] > 200), 0, 255)
    return Image.fromarray(t.astype(np.uint8))


def tile(word):
    l, t, r, b = FONT.getbbox(word)
    im = blank_tile(max(r - l + 100, 120))
    im = im.resize((im.width, round(im.height * 0.7)), Image.LANCZOS)   # flatter, like the real tiles
    d = ImageDraw.Draw(im)
    d.text(((im.width - (r - l)) / 2 - l, (im.height - (b - t)) / 2 - t - 2), word, font=FONT, fill=(22, 22, 22, 255))
    return im


words = [tile(w) for w in sys.argv[2:]]
gap, tilt = 18, [-1.6, 1.2, -0.6]
rot = [w.rotate(tilt[i % 3], Image.BICUBIC, expand=True) for i, w in enumerate(words)]
W = sum(w.width for w in rot) + gap * (len(rot) - 1) + 40
H = max(w.height for w in rot) + 40
out = Image.new('RGBA', (W, H))
x = 20
for i, w in enumerate(rot):
    out.alpha_composite(w, (x, 20 + (i % 2) * 6))
    x += w.width + gap
# soft contact shadow like the photographed magnets
sh = Image.new('RGBA', out.size, (0, 0, 0, 0)); sh.putalpha(out.getchannel('A').point(lambda v: v * 0.22))
sh = sh.filter(ImageFilter.GaussianBlur(3))
final = Image.new('RGBA', out.size); final.alpha_composite(sh, (2, 3)); final.alpha_composite(out)
final.save(sys.argv[1])
