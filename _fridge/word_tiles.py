"""Make poetry-magnet word tiles that match the photographed ones
(items/writing.png, items/about-me.png): same paper tile, same lettering.

usage: word_tiles.py OUT.png word [word ...]

Several words come out as separate tiles in one image, set a little apart and
off-true like items/about-me.png. Letters are Times New Roman at the size and
weight measured from items/writing.png, so a tile shown at
    width% = image_width * 12.5 / 760
(writing.png's own scale in js/layout.js) has exactly writing's letter size;
the script prints that width.
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = Image.open('items/writing.png').convert('RGBA').crop((161, 84, 604, 246))   # one real tile
FONT_PATH = '/System/Library/Fonts/Supplemental/Times New Roman.ttf'
SIZE = 106          # px in writing.png's scale (measured from its "writing")
PAD = 70            # paper either side of the word, as on writing's tile
BASE_Y = 197 - 84   # writing's baseline within the tile
INK = (24, 24, 24)


def blank_tile(width):
    """Stretch the real tile's left/right edges around a text-free middle."""
    a = np.array(SRC)
    edge = 26
    mid = a[:, 14:15].copy()               # a clean column left of the word
    body = np.repeat(mid, max(width - 2 * edge, 1), axis=1)
    t = np.concatenate([a[:, :edge], body, a[:, -edge:]], axis=1).astype(float)
    rng = np.random.default_rng(width)     # keep the paper's slight speckle
    n = rng.normal(0, 1.4, t.shape[:2])[..., None]
    t[..., :3] = np.clip(t[..., :3] + n * (t[..., 3:] > 200), 0, 255)
    return Image.fromarray(t.astype(np.uint8))


def ink(word):
    """The word as an alpha mask, drawn at 2x with a hairline stroke and
    halved, which lands on the photographed tiles' weight (between regular and bold)."""
    f = ImageFont.truetype(FONT_PATH, SIZE * 2)
    l, t, r, b = f.getbbox(word, stroke_width=2)
    asc = f.getmetrics()[0]
    m = Image.new('L', (r - l + 8, asc + f.getmetrics()[1] + 8), 0)
    ImageDraw.Draw(m).text((4 - l, 4), word, font=f, fill=255, stroke_width=2, stroke_fill=255)
    m = m.resize((m.width // 2, m.height // 2), Image.LANCZOS)
    return m, (4 + asc) // 2          # mask, baseline within it


def tile(word):
    m, base = ink(word)
    im = blank_tile(max(m.width - 4 + 2 * PAD, 150))
    layer = Image.new('RGBA', im.size, INK + (0,))
    a = Image.new('L', im.size, 0)
    a.paste(m, ((im.width - m.width) // 2, BASE_Y - base))
    layer.putalpha(a)
    im.alpha_composite(layer)
    return im


if __name__ == '__main__':
    out_path, words = sys.argv[1], sys.argv[2:]
    tiles = [tile(w) for w in words]
    gap, tilt, drop = 26, [-1.4, 1.1, -0.7, 0.9], [0, 9, 3, 7]
    rot = [t.rotate(tilt[i % 4], Image.BICUBIC, expand=True) for i, t in enumerate(tiles)]
    W = sum(r.width for r in rot) + gap * (len(rot) - 1) + 40
    H = max(r.height for r in rot) + max(drop[:len(rot)]) + 40
    out = Image.new('RGBA', (W, H))
    x = 20
    for i, r in enumerate(rot):
        out.alpha_composite(r, (x, 20 + drop[i % 4]))
        x += r.width + gap
    # soft contact shadow like the photographed magnets
    sh = Image.new('RGBA', out.size, (0, 0, 0, 0))
    sh.putalpha(out.getchannel('A').point(lambda v: v * 0.22))
    sh = sh.filter(ImageFilter.GaussianBlur(3))
    final = Image.new('RGBA', out.size)
    final.alpha_composite(sh, (2, 3))
    final.alpha_composite(out)
    final.save(out_path)
    print(f'{out_path}: {final.width}x{final.height}, layout width {final.width * 12.5 / 760:.2f}')
