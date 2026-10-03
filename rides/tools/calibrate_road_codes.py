"""Re-derive what RideWithGPS's per-point road (R) and surface (S) codes mean by sampling
points for each code and asking OpenStreetMap what road is there. Reads routes from .cache/routes.
Only needed if RWGPS ever changes its codes; results feed R_HIGHWAY in build_rides.py."""
import json, os, glob, urllib.request, urllib.parse, time, collections, random
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.cache', 'routes'))
random.seed(1)
routes=[json.load(open(f)) for f in glob.glob('[0-9]*.json')]
def runs(tp, key):
    out=[]; i=0
    while i<len(tp):
        j=i
        while j+1<len(tp) and tp[j+1].get(key)==tp[i].get(key): j+=1
        if j-i>=8: out.append((tp[i].get(key), tp[(i+j)//2]))
        i=j+1
    return out
samples=collections.defaultdict(list)
for key in ['R','S']:
    pool=collections.defaultdict(list)
    for r in routes:
        for code,pt in runs(r['track_points'],key): pool[code].append((r['id'],pt))
    for code,lst in pool.items():
        random.shuffle(lst)
        # prefer distinct routes
        picked=[];used=set()
        for rid,pt in lst:
            if rid in used: continue
            picked.append(pt); used.add(rid)
            if len(picked)>=7: break
        samples[(key,code)]=picked
def overpass(lat,lon):
    q=f'[out:json][timeout:25];way(around:9,{lat},{lon})["highway"];out tags;'
    req=urllib.request.Request('https://overpass-api.de/api/interpreter',data=('data='+urllib.parse.quote(q)).encode(),headers={'User-Agent':'bestrideschi-calibration/1.0'})
    for attempt in range(4):
        try: return json.load(urllib.request.urlopen(req,timeout=60))['elements']
        except Exception as e: time.sleep(5*(attempt+1))
    return []
res={}
for (key,code),pts in sorted(samples.items(), key=lambda kv:(kv[0][0],kv[0][1])):
    tally=collections.Counter(); surf=collections.Counter()
    for pt in pts:
        for el in overpass(pt['y'],pt['x']):
            t=el.get('tags',{}); tally[t.get('highway')]+=1
            if t.get('surface'): surf[t['surface']]+=1
        time.sleep(1.1)
    res[f'{key}{code}']={'n':len(pts),'highway':tally.most_common(6),'surface':surf.most_common(4)}
    print(f"{key}={code:<3} n={len(pts)} highway={tally.most_common(5)} surface={surf.most_common(3)}", flush=True)
json.dump(res,open('../calibration.json','w'),indent=1)
