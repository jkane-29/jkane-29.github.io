#!/usr/bin/env python3
"""
Build the Best Rides Chi data files from rides.config.json.

    python3 rides/tools/build_rides.py            # use cached downloads
    python3 rides/tools/build_rides.py --refresh  # re-download routes + transit feeds

Writes:
    rides/data/rides.js    — every ride + computed stats (generated, don't hand-edit)
    rides/data/transit.js  — CTA 'L', Metra, South Shore lines + stations + bike rules

Sources (all public):
    RideWithGPS route JSON ........ distance, climbing, surface, track type, POIs, per-point road class
    CTA / Metra / South Shore GTFS  line geometry, stations, which lines serve each station
    OpenStreetMap Overpass ........ checks "busy road" stretches for a parallel bike path or bike lane
    OpenStreetMap Nominatim ....... start / finish place names
"""
import csv, io, json, math, os, re, sys, time, urllib.parse, urllib.request, zipfile
from collections import defaultdict
from datetime import date

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
CACHE = os.path.join(TOOLS, '.cache')
OUT = os.path.join(ROOT, 'data')
REFRESH = '--refresh' in sys.argv
UA = 'BestRidesChi-build/1.0 (+https://bestrideschi.com)'

GTFS = {
    'cta': 'https://www.transitchicago.com/downloads/sch_data/google_transit.zip',
    'metra': 'https://schedules.metrarail.com/gtfs/schedule.zip',
    'southshore': 'http://www.mysouthshoreline.com/google/google_transit.zip',
}

# Verified against the agencies' own pages (see transit.js BIKE_RULES for sources).
SOUTHSHORE_BIKE_STOPS = {  # stop_ids of hi-level platforms where bikes may board (mysouthshoreline.com/faq)
    's1', 's2', 's3', 's5', 's6',          # Millennium, Van Buren, Museum Campus, 57th, 63rd (Metra stations)
    's7', 's8', 's9', 's12', 's13', 's14',  # Hegewisch, Hammond Gateway, East Chicago, Miller, Portage/Ogden Dunes, Dune Park
    's16', 's19', 's20', 's21', 's22',      # 11th St Michigan City, South Bend Airport, South Hammond, Munster Ridge, Munster/Dyer
}

# RideWithGPS per-point road class (track_points[].R) → OpenStreetMap highway type.
# Decoded empirically by sampling points for each code and querying OSM (see README in this folder).
R_HIGHWAY = {
    0: 'motorway', 1: 'trunk', 2: 'primary', 3: 'secondary', 4: 'tertiary', 5: 'unclassified',
    6: 'residential', 7: 'motorway_link', 8: 'trunk_link', 9: 'primary_link', 10: 'secondary_link',
    11: 'tertiary_link', 12: 'living_street', 13: 'service', 14: 'pedestrian', 15: 'cycleway',
    21: 'footway', 25: 'path', 28: 'cycleway',
}
MAIN_ROADS = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary',
              'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}
PATHS = {'cycleway', 'path', 'footway', 'pedestrian', 'bridleway'}

POI_KEEP = {'restroom', 'water', 'food', 'cafe', 'coffee', 'bike_shop', 'convenience_store',
            'bar', 'brewery', 'winery', 'restaurant', 'park', 'camping', 'lodging', 'viewpoint',
            'trailhead', 'parking', 'transit', 'bike_parking', 'shower', 'first_aid', 'ice_cream'}


# ── plumbing ────────────────────────────────────────────────────────────────
def get(url, cache_path, binary=False, data=None, refresh=REFRESH, tries=5, timeout=180):
    path = os.path.join(CACHE, cache_path)
    if os.path.exists(path) and not refresh:
        with open(path, 'rb') as f:
            raw = f.read()
        return raw if binary else json.loads(raw)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': 'application/json'})
    for attempt in range(tries):
        try:
            raw = urllib.request.urlopen(req, timeout=timeout).read()
            break
        except Exception as e:
            if attempt == tries - 1:
                raise
            time.sleep(4 * (attempt + 1))
    with open(path, 'wb') as f:
        f.write(raw)
    return raw if binary else json.loads(raw)


def miles(lat1, lng1, lat2, lng2):
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def seg_dist_m(px, py, ax, ay, bx, by):
    """Point–segment distance in metres on a local equirectangular projection (fine at <1 km)."""
    k = math.cos(math.radians(py))
    px, ax, bx = px * k, ax * k, bx * k
    dx, dy = bx - ax, by - ay
    t = 0 if dx == dy == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy)) * 111320


def simplify(pts, tol_m):
    """Ramer–Douglas–Peucker on [lat, lng] pairs."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = 0, None
        for k in range(i + 1, j):
            d = seg_dist_m(pts[k][1], pts[k][0], pts[i][1], pts[i][0], pts[j][1], pts[j][0])
            if d > best:
                best, idx = d, k
        if idx is not None and best > tol_m:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(pts, keep) if k]


def gtfs_rows(zf, name):
    with zf.open(name) as f:
        return [{(k or '').strip(): (v or '').strip() for k, v in r.items()}
                for r in csv.DictReader(io.TextIOWrapper(f, 'utf-8-sig'))]


# ── transit (GTFS) ──────────────────────────────────────────────────────────
def build_transit():
    zips = {k: zipfile.ZipFile(io.BytesIO(get(u, f'gtfs/{k}.zip', binary=True))) for k, u in GTFS.items()}
    lines, stations = [], []

    def shapes_of(zf):
        pts = defaultdict(list)
        for s in gtfs_rows(zf, 'shapes.txt'):
            pts[s['shape_id']].append((int(s['shape_pt_sequence']), float(s['shape_pt_lat']), float(s['shape_pt_lon'])))
        return {k: [[la, lo] for _, la, lo in sorted(v)] for k, v in pts.items()}

    # CTA 'L' — rail routes only, longest shape per route, colors from GTFS
    cta = zips['cta']
    CTA = {'Red': 'Red', 'P': 'Purple', 'Y': 'Yellow', 'Blue': 'Blue', 'Pink': 'Pink',
           'G': 'Green', 'Org': 'Orange', 'Brn': 'Brown'}
    croutes = {r['route_id']: r for r in gtfs_rows(cta, 'routes.txt')}
    ctrips = [t for t in gtfs_rows(cta, 'trips.txt') if t['route_id'] in CTA]
    cshapes = shapes_of(cta)
    rshape = defaultdict(set)
    for t in ctrips:
        rshape[t['route_id']].add(t['shape_id'])
    for rid, name in CTA.items():
        best = max(rshape[rid], key=lambda s: len(cshapes.get(s, [])))
        lines.append({'sys': 'cta', 'name': f'{name} Line', 'short': name,
                      'color': '#' + croutes[rid]['route_color'], 'coords': simplify(cshapes[best], 12)})
    trip_route = {t['trip_id']: t['route_id'] for t in ctrips}
    cstops = {s['stop_id']: s for s in gtfs_rows(cta, 'stops.txt')}
    served = defaultdict(set)
    with cta.open('stop_times.txt') as f:
        for r in csv.DictReader(io.TextIOWrapper(f, 'utf-8-sig')):
            rid = trip_route.get(r['trip_id'].strip())
            if rid:
                s = cstops.get(r['stop_id'].strip(), {})
                served[s.get('parent_station') or r['stop_id'].strip()].add(CTA[rid])
    for sid, ls in served.items():
        s = cstops.get(sid)
        if s:
            stations.append({'name': re.sub(r'\s*\(.*?\)\s*$', '', s['stop_name']), 'lat': float(s['stop_lat']),
                             'lng': float(s['stop_lon']), 'sys': 'cta', 'lines': sorted(ls), 'bike': True})

    # Metra — shape_id prefix is the route; GTFS ships no colors, so use the official system-map colors
    METRA = {'UP-N': ('Union Pacific North', '#00843d'), 'UP-NW': ('Union Pacific Northwest', '#fedd00'),
             'UP-W': ('Union Pacific West', '#ffb1bb'), 'MD-N': ('Milwaukee District North', '#e57200'),
             'MD-W': ('Milwaukee District West', '#f1be48'), 'NCS': ('North Central Service', '#9063cd'),
             'BNSF': ('BNSF', '#43b02a'), 'HC': ('Heritage Corridor', '#862041'),
             'SWS': ('SouthWest Service', '#005eb8'), 'RI': ('Rock Island', '#da291c'),
             'ME': ('Metra Electric', '#fe5000')}
    met = zips['metra']
    mshapes = shapes_of(met)
    by_route = defaultdict(list)
    for sid in mshapes:
        by_route[sid.rsplit('_', 2)[0]].append(sid)
    for rid, (name, color) in METRA.items():
        best = max(by_route[rid], key=lambda s: len(mshapes[s]))
        lines.append({'sys': 'metra', 'name': name, 'short': rid, 'color': color, 'coords': simplify(mshapes[best], 15)})
    mtrip = {t['trip_id']: t['route_id'] for t in gtfs_rows(met, 'trips.txt')}
    mserved = defaultdict(set)
    for r in gtfs_rows(met, 'stop_times.txt'):
        if mtrip.get(r['trip_id']):
            mserved[r['stop_id']].add(mtrip[r['trip_id']])
    for s in gtfs_rows(met, 'stops.txt'):
        if s['stop_id'] in mserved:
            stations.append({'name': s['stop_name'], 'lat': float(s['stop_lat']), 'lng': float(s['stop_lon']),
                             'sys': 'metra', 'lines': sorted(mserved[s['stop_id']]), 'bike': True})

    # South Shore Line (NICTD) — Lakeshore + Monon corridors, colors from GTFS
    ss = zips['southshore']
    sroutes = {r['route_id']: r for r in gtfs_rows(ss, 'routes.txt')}
    sshapes = shapes_of(ss)
    strips = gtfs_rows(ss, 'trips.txt')
    srs = defaultdict(set)
    for t in strips:
        srs[t['route_id']].add(t['shape_id'])
    for rid, r in sroutes.items():
        best = max(srs[rid], key=lambda s: len(sshapes.get(s, [])))
        lines.append({'sys': 'southshore', 'name': 'South Shore — ' + r['route_long_name'], 'short': r['route_short_name'],
                      'color': '#' + r['route_color'], 'coords': simplify(sshapes[best], 15)})
    for s in gtfs_rows(ss, 'stops.txt'):
        stations.append({'name': s['stop_name'], 'lat': float(s['stop_lat']), 'lng': float(s['stop_lon']),
                         'sys': 'southshore', 'lines': ['South Shore'], 'bike': s['stop_id'] in SOUTHSHORE_BIKE_STOPS})

    # South Shore shares its Chicago platforms with Metra Electric — merge those into one station
    merged = []
    for s in stations:
        twin = next((m for m in merged if m['sys'] != 'cta' and s['sys'] != 'cta' and m['sys'] != s['sys']
                     and miles(m['lat'], m['lng'], s['lat'], s['lng']) < 0.12), None)
        if twin:
            twin['sys2'] = s['sys']
            twin['lines'] = sorted(set(twin['lines']) | set(s['lines']))
            twin['bike'] = twin['bike'] or s['bike']
        else:
            merged.append(dict(s))
    return lines, merged


# ── RideWithGPS route analysis ──────────────────────────────────────────────
def route_json(rid):
    return get(f'https://ridewithgps.com/routes/{rid}.json', f'routes/{rid}.json')


def clean_name(n):
    n = re.sub(r'^Great Rides (Chicago|Schererville|Algonquin)\s*-\s*', '', n.strip())
    return re.sub(r'\s*\(copy\)\s*$', '', n).strip()


def start_landmark(desc):
    """Creator descriptions often begin 'Start: <place>' — keep just the place line."""
    if not desc:
        return None
    m = re.match(r'\s*Start:?\s*\n?\s*(.+)', desc)
    if not m:
        return None
    line = m.group(1).split('\n')[0].strip()
    line = re.split(r'\s\d{2,5}\s[NSEW]?\.?\s?\w', line)[0].strip()  # drop the street address
    return line[:60] or None


def destep(tp, min_jump=4.0, max_run=20.0):
    """RideWithGPS elevation sometimes jumps 4–40 m within a few metres of travel and stays there —
    seams in the underlying elevation data, not terrain (a bike route can't climb 20%+ in 20 m).
    Remove each jump by shifting the rest of the profile, and report how much fake climbing it added."""
    e, out, offset, fake_up = [p.get('e', 0) for p in tp], [], 0.0, 0.0
    for i, p in enumerate(tp):
        if i:
            de, dd = e[i] - e[i - 1], p['d'] - tp[i - 1]['d']
            if abs(de) >= min_jump and dd <= max_run:
                offset -= de
                fake_up += max(de, 0)
        out.append(e[i] + offset)
    return out, fake_up


def smoothed(tp, e):
    """Resample every 25 m, then a 5-sample (125 m) median to drop bridge/underpass blips."""
    total, step, k, xs = tp[-1]['d'], 25.0, 0, []
    for i in range(int(total // step) + 1):
        t = i * step
        while k < len(tp) - 2 and tp[k + 1]['d'] < t:
            k += 1
        a, b = tp[k], tp[min(k + 1, len(tp) - 1)]
        f = 0 if b['d'] == a['d'] else max(0, min(1, (t - a['d']) / (b['d'] - a['d'])))
        xs.append(e[k] + (e[min(k + 1, len(e) - 1)] - e[k]) * f)
    med = [sorted(xs[max(0, i - 2):i + 3])[len(xs[max(0, i - 2):i + 3]) // 2] for i in range(len(xs))]
    return [{'d': i * step, 'e': v} for i, v in enumerate(med)]


def climbs(tp):
    """Max sustained grade over 150 m, and the biggest single climb (5 m hysteresis), on a cleaned profile."""
    d = [p['d'] for p in tp]
    e = [p.get('e', 0) for p in tp]
    max_grade, j = 0.0, 0
    for i in range(len(tp)):
        while j < len(tp) - 1 and d[j] - d[i] < 150:
            j += 1
        if d[j] - d[i] >= 150:
            max_grade = max(max_grade, (e[j] - e[i]) / (d[j] - d[i]) * 100)
    # A climb runs from a low point to the highest point reached before dropping >5 m below it.
    best = (0, 0)
    low_i = peak_i = 0
    for i in range(1, len(tp)):
        if e[i] > e[peak_i]:
            peak_i = i
        elif e[i] < e[low_i] and peak_i == low_i:
            low_i = peak_i = i                       # still descending — move the low point down
        if e[peak_i] - e[i] > 5 or i == len(tp) - 1:  # climb over
            if e[peak_i] - e[low_i] > best[0]:
                best = (e[peak_i] - e[low_i], d[peak_i] - d[low_i])
            low_i = peak_i = i
    return round(max_grade, 1), round(best[0] * 3.28084), round(best[1] / 1609.34, 1)


def profile(tp, n=90):
    total = tp[-1]['d']
    out, k = [], 0
    for i in range(n + 1):
        target = total * i / n
        while k < len(tp) - 1 and tp[k + 1]['d'] < target:
            k += 1
        out.append(round(tp[k].get('e', 0) * 3.28084))
    return out


OVERPASS = ['https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter']
HW_FILTER = '["highway"~"^(cycleway|path|footway|motorway|trunk|primary|secondary|tertiary)(_link)?$"]'


def segments(tp):
    out = []
    for a, b in zip(tp, tp[1:]):
        dd = b['d'] - a['d']
        if dd > 0:
            out.append((a, dd, R_HIGHWAY.get(a.get('R'), 'unknown')))
    return out


def overpass_query(tp):
    """One query per route: just the paths and main roads within 16 m of the route's main-road stretches."""
    segs = segments(tp)
    main_pts = [(i, a) for i, (a, dd, hw) in enumerate(segs) if hw in MAIN_ROADS]
    main_m = sum(segs[i][1] for i, _ in main_pts)
    if not main_pts or main_m < 0.005 * tp[-1]['d']:
        return None  # under 0.5% on main roads: the OSM check can't change the rounded numbers
    runs, cur = [], [main_pts[0]]
    for prev, nxt in zip(main_pts, main_pts[1:]):
        if nxt[0] == prev[0] + 1:
            cur.append(nxt)
        else:
            runs.append(cur); cur = [nxt]
    runs.append(cur)
    parts = []
    for run in runs:
        coords = [run[0][1]] if len(run) == 1 else simplify_pts([p for _, p in run])
        c = ','.join(f"{p['y']:.6f},{p['x']:.6f}" for p in coords)
        parts.append(f'way(around:16,{c}){HW_FILTER};')
    return '[out:json][timeout:180];(' + ''.join(parts) + ');out tags geom;'


def fetch_overpass(rid, q, start=0):
    """Cached; tries each public mirror in turn so one busy server doesn't stall the build."""
    path = os.path.join(CACHE, f'overpass/{rid}.json')
    if os.path.exists(path) and not REFRESH:
        return json.load(open(path))['elements']
    last = None
    for k in range(len(OVERPASS)):
        url = OVERPASS[(start + k) % len(OVERPASS)]
        try:
            return get(url, f'overpass/{rid}.json', data=('data=' + urllib.parse.quote(q)).encode(),
                       refresh=True, tries=2, timeout=120)['elements']
        except Exception as e:
            last = e
    raise last


def road_mix(tp, ways):
    """Share of distance on: trail/path, quiet street, main road with bike lane, main road without.
    Main-road stretches are checked against OSM: a parallel cycleway within 15 m (e.g. the Lakefront
    Trail beside Lake Shore Drive) counts as path; a road tagged with a bike lane/track counts as lane."""
    segs = segments(tp)
    main_pts = [(i, a) for i, (a, dd, hw) in enumerate(segs) if hw in MAIN_ROADS]
    upgraded, road_name = {}, {}
    if main_pts and ways:
        paths, roads = [], []
        for w in ways:
            t, g = w.get('tags', {}), w.get('geometry') or []
            hw = t.get('highway')
            if hw == 'cycleway' or (hw in ('path', 'footway') and t.get('bicycle') in ('designated', 'yes')
                                     and t.get('footway') != 'sidewalk'):
                paths.append(g)
            elif hw in MAIN_ROADS:
                cyc = ' '.join(t.get(k, '') for k in ('cycleway', 'cycleway:both', 'cycleway:right', 'cycleway:left'))
                roads.append((g, 'track' in cyc or 'separate' in cyc, 'lane' in cyc and 'shared_lane' not in cyc,
                              t.get('name') or t.get('ref')))
        for i, p in main_pts:
            def near(g, tol):
                return any(seg_dist_m(p['x'], p['y'], g[k]['lon'], g[k]['lat'], g[k + 1]['lon'], g[k + 1]['lat']) < tol
                           for k in range(len(g) - 1))
            if any(near(g, 15) for g in paths):
                upgraded[i] = 'path'
            else:
                best = None
                for g, trk, lane, nm in roads:
                    dist = min((seg_dist_m(p['x'], p['y'], g[k]['lon'], g[k]['lat'], g[k + 1]['lon'], g[k + 1]['lat'])
                                for k in range(len(g) - 1)), default=1e9)
                    if dist < 12 and (best is None or dist < best[0]):
                        best = (dist, trk or lane, nm)
                if best and best[1]:
                    upgraded[i] = 'lane'
                elif best and best[2]:
                    road_name[i] = re.sub(r'^(North|South|East|West|N|S|E|W)\.? ', '', best[2])
    mix, busy = defaultdict(float), defaultdict(float)
    for i, (a, dd, hw) in enumerate(segs):
        if i in upgraded:
            cat = upgraded[i]
        elif hw in PATHS:
            cat = 'path'
        elif hw in MAIN_ROADS:
            cat = 'main'
            if i in road_name:
                busy[road_name[i]] += dd
        else:
            cat = 'quiet'  # residential, service, unclassified, track, living street, unknown
        mix[cat] += dd
    total = sum(mix.values()) or 1
    top = [{'name': n, 'mi': round(m / 1609.34, 1)} for n, m in sorted(busy.items(), key=lambda kv: -kv[1])
           if m >= 0.3 * 1609.34][:4]
    return {k: round(100 * mix.get(k, 0) / total) for k in ('path', 'quiet', 'lane', 'main')}, top


def simplify_pts(pts):
    s = simplify([[p['y'], p['x']] for p in pts], 25)
    return [{'y': la, 'x': lo} for la, lo in s]


def comfort(mix):
    if mix['main'] >= 15:
        return 'busy'
    if mix['path'] >= 70 and mix['main'] < 5:
        return 'trail'
    return 'mixed'


def place(lat, lng):
    """Reverse-geocode to a neighbourhood / town name (Nominatim, cached, 1 req/s)."""
    key = f'nominatim/{lat:.4f}_{lng:.4f}.json'
    cached = os.path.exists(os.path.join(CACHE, key))
    d = get(f'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat={lat}&lon={lng}', key, refresh=False)
    if not cached:
        time.sleep(1.1)
    a = d.get('address', {})
    town = a.get('city') or a.get('town') or a.get('village') or a.get('municipality') or a.get('county')
    hood = a.get('neighbourhood') or a.get('suburb') or a.get('quarter')
    state = a.get('state')
    return {'town': town, 'hood': hood, 'state': state,
            'label': (f'{hood}, {town}' if town == 'Chicago' and hood else town) or hood or 'Unknown'}


def nearest(stations, lat, lng, k=2):
    ranked = sorted(stations, key=lambda s: miles(lat, lng, s['lat'], s['lng']))
    out, seen = [], set()
    for s in ranked:
        key = (s['name'], s['sys'])
        if key in seen:
            continue
        seen.add(key)
        out.append({'name': s['name'], 'sys': s['sys'], 'sys2': s.get('sys2'), 'lines': s['lines'],
                    'bike': s['bike'], 'mi': round(miles(lat, lng, s['lat'], s['lng']), 1)})
        if len(out) >= k:
            break
    return out


def track(d):
    return [p for p in d['track_points'] if 'x' in p and 'y' in p and 'd' in p]


def analyze(rid, label, stations, ways):
    d = route_json(rid)
    tp = track(d)
    first, last = tp[0], tp[-1]
    clean_e, fake_up = destep(tp)
    prof = smoothed(tp, clean_e)
    grade, climb_ft, climb_mi = climbs(prof)
    s_place = place(first['y'], first['x'])
    p2p = d.get('track_type') == 'point_to_point'
    e_place = place(last['y'], last['x']) if p2p else s_place
    bike_ok = [s for s in stations if s['bike']]
    mix, busy_roads = road_mix(tp, ways or [])
    pois = [{'type': p.get('poi_type_name') or 'poi', 'name': (p.get('name') or '').strip()[:60]}
            for p in (d.get('points_of_interest') or []) if (p.get('poi_type_name') or '') in POI_KEEP]
    return {
        'rwgps': rid,
        'label': label,
        'rwgpsName': d['name'].strip(),
        'author': (lambda m: m.group(1) if m else None)(re.match(r'(Great Rides \w+)', d['name'])),
        'mi': round(d['distance'] / 1609.34, 1),
        'gain': round(max(0, d['elevation_gain'] - fake_up) * 3.28084),
        'gainRwgps': round(d['elevation_gain'] * 3.28084),
        'type': d.get('track_type'),          # loop | out_and_back | point_to_point
        'unpaved': d.get('unpaved_pct') or 0,
        'surface': d.get('surface'),
        'terrain': d.get('terrain'),
        'difficulty': d.get('difficulty'),
        'maxGrade': grade,
        'climb': {'ft': climb_ft, 'mi': climb_mi},
        'mix': mix,
        'comfort': comfort(mix),
        'busyRoads': busy_roads,
        'osmChecked': ways is not None,
        'cues': len(d.get('course_points') or []),
        'pois': pois,
        'startAt': start_landmark(d.get('description')),
        'start': {'lat': round(first['y'], 5), 'lng': round(first['x'], 5), **s_place,
                  'stations': nearest(bike_ok, first['y'], first['x'])},
        'end': {'lat': round(last['y'], 5), 'lng': round(last['x'], 5), **e_place,
                'stations': nearest(bike_ok, last['y'], last['x'])} if p2p else None,
        'profile': profile(prof),
        'line': [[round(a, 5), round(b, 5)] for a, b in simplify([[p['y'], p['x']] for p in tp], 18)],
    }


def landmark(lm):
    """Creator's stated start, tidied: no street addresses, no generic 'Parking Lot', ≤ 40 chars."""
    if not lm:
        return None
    lm = re.sub(r'\b(\w+) \1\b', r'\1', lm).strip(' -')        # "Park Park Playground" → "Park Playground"
    lm = re.sub(r'\s+-{1,2}\s+', ' · ', lm)                      # "Trail - Trailhead" → "Trail · Trailhead"
    if len(lm) > 46 and ' · ' in lm[:46]:
        lm = lm[:lm[:46].rfind(' · ')]
    if re.match(r'^\d', lm) or re.fullmatch(r'(?i)parking( lot)?', lm):
        return None
    return lm


def tidy_labels(v):
    """Place = neighbourhood (Chicago) or town. Only when geocoding gives just a county/township
    does the start fall back to the route creator's stated start point."""
    v['startAt'] = landmark(v.get('startAt'))
    s = v['start']
    if ('County' in s['label'] or 'Township' in s['label']) and v['startAt']:
        s['label'] = v['startAt']


def region_of(v):
    st, town = v['start'].get('state'), v['start'].get('town')
    if st == 'Indiana':
        return 'indiana'
    return 'city' if town == 'Chicago' else 'suburbs'


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def main():
    from concurrent.futures import ThreadPoolExecutor
    cfg = json.load(open(os.path.join(TOOLS, 'rides.config.json')))
    print('transit feeds…', flush=True)
    lines, stations = build_transit()
    ids = [r[0] for e in cfg['rides'] for r in e['routes']]

    print(f'route data for {len(ids)} routes…', flush=True)
    for rid in ids:
        route_json(rid)

    print('OpenStreetMap road checks (parallel across mirrors)…', flush=True)
    queries = {rid: overpass_query(track(route_json(rid))) for rid in ids}
    ways = {}
    def job(args):
        k, rid = args
        q = queries[rid]
        try:
            ways[rid] = fetch_overpass(rid, q, start=k % len(OVERPASS)) if q else []
            print(f'  osm {rid} · {len(ways[rid])} ways', flush=True)
        except Exception as e:
            ways[rid] = None  # fall back to RideWithGPS road classes alone; flagged in the output
            print(f'  osm {rid} · UNAVAILABLE ({e}) — using RideWithGPS road classes only', flush=True)
    with ThreadPoolExecutor(max_workers=len(OVERPASS)) as pool:
        list(pool.map(job, enumerate(ids)))

    print('analysing (place names at 1 req/s)…', flush=True)
    rides = []
    for entry in cfg['rides']:
        variants = []
        for r in entry['routes']:
            rid, label = r[0], (r[1] if len(r) > 1 else None)
            v = analyze(rid, label, stations, ways[rid])
            tidy_labels(v)
            variants.append(v)
            print(f"  {rid:>9} {v['mi']:6.1f} mi {v['gain']:5d} ft {v['type']:14} unpaved {v['unpaved']:3d}%  "
                  f"mix {v['mix']}  {v['comfort']:6}  start: {v['start']['label']}", flush=True)
        primary = variants[0]
        name = entry.get('name') or clean_name(primary['rwgpsName'])
        rides.append({'id': slug(name), 'name': name, 'region': entry.get('region') or region_of(primary),
                      'note': entry.get('note'), 'variants': variants})

    # Only draw stations that matter to some ride (within 1.5 mi of a start or finish)
    near = set()
    for ride in rides:
        for v in ride['variants']:
            for end in (v['start'], v['end']):
                for s in (end or {}).get('stations', []):
                    if s['mi'] <= 1.5:
                        near.add((s['name'], s['sys']))
    for s in stations:
        s['nearRide'] = (s['name'], s['sys']) in near

    os.makedirs(OUT, exist_ok=True)
    stamp = date.today().isoformat()
    head = f'// GENERATED by rides/tools/build_rides.py on {stamp} — edit rides/tools/rides.config.json and rebuild.\n'
    with open(os.path.join(OUT, 'rides.js'), 'w') as f:
        f.write(head + 'const RIDES = ' + json.dumps(rides, separators=(',', ':')) + ';\n')
    rules = {
        'cta': {'short': 'No bikes weekdays 7–9 am, 4–6 pm · 2 per car',
                'src': 'https://nita.illinois.gov/blog/2026/05/13/how-to-ride-transit-with-bikes'},
        'metra': {'short': 'All trains · first come, first served',
                  'src': 'https://nita.illinois.gov/blog/2026/05/13/how-to-ride-transit-with-bikes'},
        'southshore': {'short': 'All trains · board and exit at hi-level stations only',
                       'src': 'https://mysouthshoreline.com/faq/'},
    }
    with open(os.path.join(OUT, 'transit.js'), 'w') as f:
        f.write(head + 'const TRANSIT_LINES = ' + json.dumps(lines, separators=(',', ':')) + ';\n'
                + 'const STATIONS = ' + json.dumps(stations, separators=(',', ':')) + ';\n'
                + f'const BIKE_RULES = {json.dumps(rules)};\nconst BUILD_DATE = "{stamp}";\n')
    print(f'wrote {len(rides)} rides, {len(lines)} transit lines, {len(stations)} stations → rides/data/')


if __name__ == '__main__':
    main()
