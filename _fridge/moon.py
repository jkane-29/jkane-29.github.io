#!/usr/bin/env python3
"""
Render the place on the far side of the orb: the surface of the Moon, with the fridge standing on it.

    python _fridge/moon.py --quick                 # small + noisy, for checking the scene
    python _fridge/moon.py --sun=-128,17           # sun's azimuth (° right of the lens axis; ±180 = behind you) and elevation (°)
    python _fridge/moon.py --closed                # without the open door's shadow and the orb's glow

Same world as render.py: metres, x → right, y → up from the bottom of the lower door, z → toward
the viewer, the fridge's front at z = 0, the photo's camera 6 m back and level with the photo's
centre. So the picture drops in behind the fridge photo with the regolith meeting its feet.

The fridge is not rendered: a black box (and a black slab for the open door) stands in for it, to
throw its shadow, and the cut-out photo covers them.
"""
import math, os, sys
import numpy as np
from meshes import rounded_box

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, '.build', 'moon')
os.makedirs(BUILD, exist_ok=True)
QUICK = '--quick' in sys.argv
rng = np.random.default_rng(7)
def arg(name, default):
    v = next((a.split('=')[1] for a in sys.argv if a.startswith(f'--{name}=')), None)
    return default if v is None else type(default)(v)

# ── The photo and its camera (see render.py) ─────────────────────────────────
PX = 0.573 / 522
CAM_Y, CAM_D = (1314 - 768) * PX, 6.0
GROUND = -(1429 - 1314) * PX                 # the fridge's feet: 115 px below the lower door
EYE = CAM_Y - GROUND                         # lens height above the ground
FR_X, FR_TOP = (785 - 239) / 2 * PX, (1314 - 95) * PX
HXP, HYP, TOP = 2012, 1550, 1050             # the picture: this many photo pixels left/right of the photo's centre, below it, and above it
HALF_W, HALF_H = HXP * PX, HYP * PX
F_PX = CAM_D / PX                            # focal length in photo pixels
SCALE = arg('scale', 0.35 if QUICK else 1.0) # picture pixels per photo pixel
SUN_AZ, SUN_EL = [float(v) for v in arg('sun', '-128,17').split(',')]
a_, e_ = math.radians(SUN_AZ), math.radians(SUN_EL)
SUN = np.array([math.sin(a_) * math.cos(e_), math.sin(e_), -math.cos(a_) * math.cos(e_)])
OPEN = '--closed' not in sys.argv
R_MOON = 1.7374e6

# ── Noise and hashing ────────────────────────────────────────────────────────
_tab = rng.uniform(0, 1, (256, 256))
def vnoise(x, y):
    xi, yi = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    fx, fy = x - xi, y - yi
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = _tab[xi % 256, yi % 256], _tab[(xi + 1) % 256, yi % 256]
    c, d = _tab[xi % 256, (yi + 1) % 256], _tab[(xi + 1) % 256, (yi + 1) % 256]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
def fbm(x, y, octaves=4, gain=0.5):
    s, a, n = 0.0, 1.0, 0.0
    for i in range(octaves):
        s = s + a * vnoise(x * 2 ** i + 17.3 * i, y * 2 ** i + 5.1 * i); n += a; a *= gain
    return s / n
smooth = lambda a, b, x: (lambda t: t * t * (3 - 2 * t))(np.clip((x - a) / (b - a), 0, 1))
def cell_rand(i, j, k, n):
    """n uniform randoms for each integer cell (i, j) of octave k."""
    with np.errstate(over='ignore'):
        h = i.astype(np.uint64) * np.uint64(0x9E3779B97F4A7C15) + j.astype(np.uint64) * np.uint64(0xC2B2AE3D27D4EB4F) + np.uint64((k + 1) * 0x165667B19E3779F9 % 2 ** 64)
        h ^= h >> np.uint64(29); h *= np.uint64(0xBF58476D1CE4E5B9); h ^= h >> np.uint64(32)
        out = []
        for _ in range(n):
            h = h * np.uint64(0x94D049BB133111EB) + np.uint64(0x2545F4914F6CDD1D); h ^= h >> np.uint64(31)
            out.append((h >> np.uint64(11)).astype(np.float64) / 2.0 ** 53)
    return out

# ── The ground ───────────────────────────────────────────────────────────────
# Regolith: a gently rolling plain, saturated with craters of every size (each octave of cells holds
# one crater per cell, more or less), rounded massifs on the horizon, and the Moon's own curvature.
SPOT = (0.0, -0.3)                            # where the fridge stands; the ground is level under it
N_OCT, S0, LAC = 17, 0.10, 1.85
K_RES = F_PX * EYE * SCALE * 1.5              # ground mesh: rows are r²/K_RES apart (about ⅔ of a pixel)
def height(x, z, rc=None):
    """Ground height, and how fresh (bright) the soil is there. rc: distance from the camera, to skip detail too small to see."""
    x, z = np.asarray(x, float), np.asarray(z, float)
    r0 = np.hypot(x - SPOT[0], z - SPOT[1])
    if rc is None: rc = np.zeros_like(x)
    h, fresh = np.zeros_like(x), np.zeros_like(x)
    for L, amp in ((9.0, 0.22), (60.0, 1.6), (420.0, 11.0)):                        # swells
        h += amp * (fbm(x / L + 3.7, z / L + 1.3, 3) - 0.5) * smooth(0.25 * L, 1.3 * L, r0)
    back = np.hypot(x, z - CAM_D)
    ridge = fbm(x / 2600 + 0.4, z / 2600 + 2.2, 5, 0.5)
    h += smooth(2200, 6500, back) * (40 + 420 * smooth(0.38, 0.75, ridge) * ridge)   # massifs beyond the plain
    for k in range(N_OCT):
        s = S0 * LAC ** k
        idx = np.where(np.minimum(rc ** 2 / K_RES, 0.006 * rc) < s / 22)[0]      # only craters the mesh can resolve there
        if not len(idx): continue
        xs, zs = x[idx] / s, z[idx] / s
        ci, cj = np.floor(xs).astype(np.int64), np.floor(zs).astype(np.int64)
        dh, fr = np.zeros(len(idx)), np.zeros(len(idx))
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                u = cell_rand(ci + di, cj + dj, k, 6)
                R = 0.10 + 0.30 * u[3] ** 2.2                                       # radius, in cells: mostly small
                t = np.hypot(xs - (ci + di + 0.5 + (u[1] - 0.5) * 0.7), zs - (cj + dj + 0.5 + (u[2] - 0.5) * 0.7)) / R
                age = u[4] ** 0.45                                                       # 0 fresh and sharp … 1 worn nearly flat
                depth = 2 * R * (0.17 * (1 - age) ** 1.5 + 0.012)
                rim = 0.22 * depth * (1 - 0.6 * age)
                prof = -depth * np.clip(1 - t * t, 0, 1) ** 1.5 + rim * np.exp(-((t - 1) / (0.20 + 0.35 * age)) ** 2)   # a bowl, and a rounded lip
                on = (u[0] < (0.55 if s < 0.6 else 0.5)) & (t < 3.2)
                dh += np.where(on, prof * smooth(3.2, 2.4, t), 0)
                fr += np.where(on & (age < 0.25), np.exp(-np.maximum(t - 0.8, 0) / 0.9) * (1 - age * 4), 0)
        w = smooth(0.45, 1.5, r0[idx]) if s < 1.5 else smooth(1.3 * s, 3.5 * s, r0[idx])
        h[idx] += dh * s * w; fresh[idx] += fr * w * min(1.0, 0.25 + s)
    near = rc < 40
    if near.any():                                                                 # clods and grain
        xn, zn = x[near], z[near]
        h[near] += 0.005 * (fbm(xn / 0.035, zn / 0.035, 3) - 0.5) + 0.008 * (fbm(xn / 0.21 + 9, zn / 0.21, 3) - 0.5)
        grit = vnoise(xn / 0.009 + 31, zn / 0.009) * vnoise(xn / 0.023, zn / 0.023 + 17)          # scattered crumbs, not an even roughness
        h[near] += 0.0045 * smooth(0.36, 0.66, grit) * smooth(34, 12, rc[near])
    h -= (x * x + (z - CAM_D) ** 2) / (2 * R_MOON)                                  # the horizon is 1.6 km off
    return GROUND + h, fresh

def chunked(x, z, rc, n=600000):
    hs, fs = [], []
    for i in range(0, len(x), n):
        a, b = height(x[i:i + n], z[i:i + n], rc[i:i + n]); hs.append(a); fs.append(b)
    return np.concatenate(hs), np.concatenate(fs)

def ground():
    """A fan of ground spread out from under the camera, as finely divided as the picture's pixels wherever you look."""
    n_th = int(2700 * SCALE)
    th = np.radians(np.linspace(-33, 33, n_th))
    rs, K = [2.45], K_RES
    while rs[-1] < 13000:
        rs.append(rs[-1] + min(rs[-1] ** 2 / K, max(0.006 * rs[-1], 0.004)))
    rs = np.array(rs)
    gr, gt = np.meshgrid(rs, th, indexing='ij')
    x, z = (gr * np.sin(gt)).ravel(), (CAM_D - gr * np.cos(gt)).ravel()
    y, fresh = chunked(x, z, gr.ravel())
    P = np.stack([x, y, z], -1).reshape(len(rs), n_th, 3)
    dr, dt = np.gradient(P, axis=0), np.gradient(P, axis=1)
    N = np.cross(dr, dt); N /= np.linalg.norm(N, axis=-1, keepdims=True)
    N[N[..., 1] < 0] *= -1
    idx = np.arange(P.shape[0] * n_th).reshape(P.shape[:2])
    q = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], -1).reshape(-1, 4)
    F = np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]])
    if np.cross(P[0, 1] - P[0, 0], P[1, 1] - P[0, 0])[1] < 0: F = F[:, ::-1]
    tone = 0.105 * (0.80 + 0.22 * fbm(x / 0.9, z / 0.9, 4) + 0.20 * fbm(x / 37 + 5, z / 37, 3)) * (1 + 0.55 * np.clip(fresh, 0, 1.2))
    tone *= 1 + (0.16 * (vnoise(x / 0.010, z / 0.010) - 0.5) + 0.12 * (vnoise(x / 0.0041 + 3, z / 0.0041) - 0.5)) * (gr.ravel() < 30)
    C = tone[:, None] * np.array([1.0, 0.965, 0.915])
    return P.reshape(-1, 3), N.reshape(-1, 3), F, C

# ── Rocks: every one a different chipped block ───────────────────────────────
def icosphere(level):
    t = (1 + 5 ** 0.5) / 2
    V = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    F = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    V = [np.array(v) / np.linalg.norm(v) for v in V]
    for _ in range(level):
        cache, F2 = {}, []
        def mid(a, b):
            key = (min(a, b), max(a, b))
            if key not in cache:
                m = V[a] + V[b]; V.append(m / np.linalg.norm(m)); cache[key] = len(V) - 1
            return cache[key]
        for a, b, c in F:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            F2 += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        F = F2
    return np.array(V), np.array(F)
_ico = {l: icosphere(l) for l in (2, 3, 4, 5, 6)}

def rocks(n):
    Vs, Ns, Fs, Cs, off = [], [], [], [], 0
    r = np.exp(rng.uniform(np.log(2.5), np.log(500), n)); th = np.radians(rng.uniform(-24, 24, n))
    x, z = r * np.sin(th), CAM_D - r * np.cos(th)
    size = 0.007 * (1 - rng.uniform(0, 1, n)) ** (-1 / 2.3)                         # many pebbles, few boulders
    size = np.minimum(size, 0.10) * np.maximum(1, r / 10) ** 0.8
    keep = ~((np.abs(x) < 0.75) & (z > -1.2) & (z < 1.6)) | (size < 0.02)
    y0, _ = height(x, z)
    for i in np.where(keep)[0]:
        px = size[i] * F_PX * SCALE / r[i]
        lvl = 6 if px > 90 else 5 if px > 24 else 4 if px > 9 else 3 if px > 4 else 2
        D, F = _ico[lvl]
        k = rng.integers(9, 20)
        nrm = rng.normal(size=(k, 3)); nrm /= np.linalg.norm(nrm, axis=1, keepdims=True)
        dist = rng.uniform(0.55, 1.0, k)
        rad = np.where(D @ nrm.T > 0.05, dist / np.maximum(D @ nrm.T, 0.05), 9)
        rad = -np.log(np.exp(-rad * 45).sum(1)) / 45                         # the nearest face, with its edges knocked off
        rad = np.minimum(rad, 1.25) * (1 + 0.07 * (vnoise(D[:, 0] * 4 + i, D[:, 1] * 4 + D[:, 2] * 3) - 0.5) + 0.035 * (vnoise(D[:, 0] * 13 + i, D[:, 2] * 13 + D[:, 1] * 9) - 0.5))
        V = D * rad[:, None] * size[i] * np.array([1, rng.uniform(0.5, 0.85), rng.uniform(0.7, 1.0)])
        a = rng.uniform(0, 2 * np.pi); c, s = np.cos(a), np.sin(a)
        V = V @ np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
        V += [x[i], y0[i] + size[i] * rng.uniform(0.05, 0.3), z[i]]
        fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
        vn = np.zeros_like(V)
        for c3 in range(3): np.add.at(vn, F[:, c3], fn)
        Ns.append(vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-20))
        Vs.append(V); Fs.append(F + off); off += len(V)
        Cs.append(np.tile(rng.uniform(0.09, 0.20) * np.array([1.0, 0.97, 0.93]), (len(V), 1)) * (0.9 + 0.2 * vnoise(D[:, :1] * 9 + i, D[:, 1:2] * 9)))
    return np.concatenate(Vs), np.concatenate(Ns), np.concatenate(Fs), np.concatenate(Cs)

def write_ply(name, V, N, F, C):
    path = os.path.join(BUILD, name + '.ply')
    cols = [V] + ([N] if N is not None else []) + [C]
    props = 'property float x\nproperty float y\nproperty float z\n' + ('property float nx\nproperty float ny\nproperty float nz\n' if N is not None else '') + 'property float r\nproperty float g\nproperty float b\n'
    with open(path, 'wb') as f:
        f.write(f'ply\nformat binary_little_endian 1.0\nelement vertex {len(V)}\n{props}element face {len(F)}\nproperty list uchar int vertex_indices\nend_header\n'.encode())
        f.write(np.hstack(cols).astype('<f4').tobytes())
        rec = np.empty(len(F), dtype=[('n', 'u1'), ('i', '<i4', 3)]); rec['n'], rec['i'] = 3, F
        f.write(rec.tobytes())
    return path

# ── Scene ────────────────────────────────────────────────────────────────────
import mitsuba as mi
for variant in ('metal_ad_rgb', 'llvm_ad_rgb', 'scalar_rgb'):
    try:
        mi.set_variant(variant); break
    except Exception:
        continue
T = mi.ScalarTransform4f
rgb = lambda *v: {'type': 'rgb', 'value': list(v)}
SOIL = {'type': 'principled', 'roughness': 1.0, 'specular': 0.0, 'base_color': {'type': 'mesh_attribute', 'name': 'vertex_color'}}
BLACK = {'type': 'diffuse', 'reflectance': rgb(0.004, 0.004, 0.004)}

W, H = 2 * int(round(HXP * SCALE)), 2 * int(round(HYP * SCALE))
SPP, PASSES = arg('spp', 48 if QUICK else 96), arg('passes', 1 if QUICK else 6)
sensor = {'type': 'perspective', 'fov_axis': 'x', 'fov': math.degrees(2 * math.atan(HALF_W / CAM_D)),
          'to_world': T().look_at(origin=[0, CAM_Y, CAM_D], target=[0, CAM_Y, 0], up=[0, 1, 0]), 'near_clip': 0.5, 'far_clip': 1e8,
          'film': {'type': 'hdrfilm', 'width': W, 'height': H, 'pixel_format': 'rgb', 'rfilter': {'type': 'gaussian'},
                   'crop_offset_x': 0, 'crop_offset_y': H // 2 - int(round(TOP * SCALE)), 'crop_width': W, 'crop_height': H // 2 + int(round(TOP * SCALE))},   # less sky than ground
          'sampler': {'type': 'independent', 'sample_count': SPP}}
shapes = {}
gV, gN, gF, gC = ground()
shapes['ground'] = {'type': 'ply', 'filename': write_ply('ground', gV, gN, gF, gC), 'bsdf': SOIL}
rV, rN, rF, rC = rocks(arg('rocks', 2600))
shapes['rocks'] = {'type': 'ply', 'filename': write_ply('rocks', rV, rN, rF, rC), 'bsdf': SOIL}
print('ground', len(gV), 'verts; rocks', len(rF), 'tris', flush=True)

def proxy(name, mesh):
    V, N, F = mesh
    shapes[name] = {'type': 'ply', 'filename': write_ply(name, V, N, F, np.zeros_like(V)), 'bsdf': BLACK}
# the fridge's stand-in, a little inside the photo's outline
proxy('fridge', rounded_box((0, (GROUND + FR_TOP) / 2 - 0.004, -0.33), (2 * FR_X - 0.016, FR_TOP - GROUND - 0.012, 0.64), 0.05, k=5))
if OPEN:
    HW, DOOR_H = 0.573 / 2, 811 * PX
    V, N, F = rounded_box((0, DOOR_H / 2, -0.024), (2 * HW, DOOR_H, 0.048), 0.015, k=4)
    c, s = math.cos(math.radians(112)), math.sin(math.radians(112))     # hung open exactly as render.py hangs it
    def swing(P, o):
        dx, dz = P[:, 0] - o[0], P[:, 2] - o[1]
        out = P.copy(); out[:, 0], out[:, 2] = o[0] + dx * c + dz * s, o[1] - dx * s + dz * c
        return out
    proxy('door', (swing(V, (HW - 0.010, -0.012)), swing(N, (0, 0)), F))
    g = arg('glow', 1.0)                                                 # the orb's light, spilling out of the open fridge
    shapes['glow'] = {'type': 'rectangle', 'to_world': T().translate([0, DOOR_H / 2, 0.002]).scale([0.255, DOOR_H / 2 - 0.03, 1]),
                      'bsdf': BLACK, 'emitter': {'type': 'area', 'radiance': rgb(0.03 * g, 0.26 * g, 0.07 * g)}}

SUN_D, SUN_E = 4e7, 10.0                                                 # a real disc, 0.53° across, so shadows soften with distance
shapes['sun'] = {'type': 'sphere', 'center': (SUN * SUN_D).tolist(), 'radius': SUN_D * 0.00465, 'bsdf': BLACK,
                 'emitter': {'type': 'area', 'radiance': rgb(*(np.array([1.0, 0.98, 0.95]) * SUN_E / (math.pi * 0.00465 ** 2)))}}
scene = {'type': 'scene', 'integrator': {'type': 'path', 'max_depth': 5, 'rr_depth': 4}, 'sensor': sensor, **shapes}

def tonemap(lin):
    x = np.maximum(lin, 0)
    x = np.clip(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * x ** (1 / 2.4) - 0.055)

if __name__ == '__main__':
    from PIL import Image
    sc = mi.load_dict(scene)
    stack = []
    for i in range(PASSES):
        stack.append(np.nan_to_num(np.array(mi.render(sc, seed=i)))); print(f'pass {i + 1}/{PASSES}', flush=True)
    lin = np.mean(stack, 0)
    name = os.path.join(HERE, '.build', 'moon' + ('' if OPEN else '-closed') + ('-quick' if QUICK else ''))
    np.save(name + '.npy', lin.astype(np.float32))
    lum = lin @ [0.2126, 0.7152, 0.0722]
    lit = lum[(lum > 1e-5) & (lum < 50)]
    exposure = arg('exposure', 0.0) or 0.30 / np.percentile(lit, 85)
    print('exposure', exposure)
    Image.fromarray((tonemap(np.minimum(lin, 60 / exposure) * exposure) * 255 + 0.5).astype(np.uint8)).save(name + '.png')
    print(variant, (W, H), '→', name + '.png')
