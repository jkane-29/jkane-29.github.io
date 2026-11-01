#!/usr/bin/env python3
"""
Render the ride-list thumbnails from rides/data/rides.js.

    python3 rides/tools/build_thumbs.py            # use cached map tiles
    python3 rides/tools/build_thumbs.py --refresh  # re-download tiles

Writes rides/data/thumbs/<ride id>.webp: the ride's default route in red on the
same grey OpenStreetMap base the site uses. Pre-rendering them means the ride list
loads a few small images instead of starting a live map in every row.

Run it after build_rides.py whenever the ride list changes.
"""
import io, json, math, os, sys, time, urllib.request
from PIL import Image, ImageDraw, ImageEnhance, ImageOps

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
CACHE = os.path.join(TOOLS, '.cache', 'tiles')
OUT = os.path.join(ROOT, 'data', 'thumbs')
REFRESH = '--refresh' in sys.argv
UA = 'BestRidesChi-thumbs/1.0 (+https://www.jackkane.me/rides/)'
TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

W, H = 152, 96          # output: 2x the 76×48 list slot
SS = 2                  # map is rendered at SS× the output, then scaled down (smaller, crisper labels)
PAD = 7                 # px of breathing room around the route, at output size
MAX_ZOOM = 14
ROUTE = (0xE4, 0x00, 0x2B)


def tile(z, x, y):
    path = os.path.join(CACHE, str(z), str(x), f'{y}.png')
    if os.path.exists(path) and not REFRESH:
        return Image.open(path).convert('RGB')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(TILE_URL.format(z=z, x=x, y=y), headers={'User-Agent': UA})
    for attempt in range(4):
        try:
            raw = urllib.request.urlopen(req, timeout=30).read()
            break
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))
    with open(path, 'wb') as f:
        f.write(raw)
    time.sleep(0.15)    # be gentle with the OSM tile servers
    return Image.open(io.BytesIO(raw)).convert('RGB')


def world(lat, lng, z):
    """Web Mercator pixel coordinates at zoom z."""
    n = 256 * 2 ** z
    s = math.sin(math.radians(lat))
    return (lng + 180) / 360 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n


def render(line):
    w, h, pad = W * SS, H * SS, PAD * SS
    # Deepest zoom at which the whole route fits the frame, like Leaflet's fitBounds
    for z in range(MAX_ZOOM, 0, -1):
        pts = [world(lat, lng, z) for lat, lng in line]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        if max(xs) - min(xs) <= w - 2 * pad and max(ys) - min(ys) <= h - 2 * pad:
            break
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    x0, y0 = cx - w / 2, cy - h / 2

    base = Image.new('RGB', (w, h))
    for tx in range(int(x0 // 256), int((x0 + w) // 256) + 1):
        for ty in range(int(y0 // 256), int((y0 + h) // 256) + 1):
            base.paste(tile(z, tx % 2 ** z, ty), (int(tx * 256 - x0), int(ty * 256 - y0)))

    # Same treatment as the site's CSS: grayscale(1) contrast(0.85) brightness(1.08)
    base = ImageOps.grayscale(base).convert('RGB')
    base = ImageEnhance.Contrast(base).enhance(0.85)
    base = ImageEnhance.Brightness(base).enhance(1.08)

    # Route drawn on an oversampled layer for smooth edges
    k = 2
    layer = Image.new('L', (w * k, h * k), 0)
    ImageDraw.Draw(layer).line([((x - x0) * k, (y - y0) * k) for x, y in pts], fill=255,
                               width=int(2.6 * SS * k), joint='curve')
    layer = layer.resize((w, h), Image.LANCZOS)
    base.paste(Image.new('RGB', (w, h), ROUTE), (0, 0), layer)
    return base.resize((W, H), Image.LANCZOS)


def main():
    with open(os.path.join(ROOT, 'data', 'rides.js')) as f:
        src = f.read()
    rides = json.loads(src[src.index('['):src.rindex(']') + 1])
    os.makedirs(OUT, exist_ok=True)
    keep = set()
    for ride in rides:
        name = ride['id'] + '.webp'
        render(ride['variants'][0]['line']).save(os.path.join(OUT, name), 'WEBP', quality=82, method=6)
        keep.add(name)
    for stale in set(os.listdir(OUT)) - keep:   # rides that were removed
        os.remove(os.path.join(OUT, stale))
    print(f'wrote {len(keep)} thumbnails → rides/data/thumbs/')


if __name__ == '__main__':
    main()
