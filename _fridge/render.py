#!/usr/bin/env python3
"""
Render the inside of the fridge, physically, to composite behind the lower door.

    python _fridge/render.py --quick     # small + noisy, for checking the model
    python _fridge/render.py             # full quality

Needs: pip install mitsuba numpy pillow   (a path tracer; uses the GPU on Apple Silicon)

The scene is built to the real size of the fridge in fridge2.jpg (a 60 cm wide
Smeg-style retro fridge: 1 photo pixel ≈ 1.1 mm), and the virtual camera sits
where the photo's camera was, level with the centre of the photo. The render is
cropped to exactly the lower door's rectangle (DOOR in the door script), so it
drops straight into the opening.

Units are metres. x → right, y → up from the bottom of the door, z → toward the
viewer; z = 0 is the plane of the door's front face.
"""
import math, os, sys
import numpy as np
from meshes import rounded_box, rounded_ring, merge, write_ply

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, '.build')
QUICK = '--quick' in sys.argv

# ── The photo ────────────────────────────────────────────────────────────────
PX = 0.573 / 522            # metres per photo pixel (lower door = 522 px wide)
DOOR_W, DOOR_H = 522 * PX, 811 * PX
HW = DOOR_W / 2
CAM_Y = (1314 - 768) * PX   # photo centre (768 px down) above the door's bottom edge (1314 px)
CAM_D = 3.0                 # camera distance: a product shot on a normal-to-long lens

# ── The cabinet ──────────────────────────────────────────────────────────────
ZC = -0.065                 # cabinet face sits one door-thickness behind the door front
RIM = 0.022                 # black enamel face around the opening
COLLAR = 0.020              # white liner collar inside it
CAV_X = HW - RIM - COLLAR + 0.001            # cavity half-width (a hair behind the collar's lip)
CAV_Y0, CAV_Y1 = RIM + COLLAR - 0.001, DOOR_H - RIM - COLLAR + 0.001
CAV_Z0, CAV_Z1 = ZC - 0.50, ZC - 0.006      # back wall, front
CAV_R = 0.022

RIBS = [0.33 + 0.055 * i for i in range(9)]  # shelf supports moulded into the side walls
SHELF_RIBS = [3, 7]                          # which of them carry a glass shelf
CRISPER_LID_Y = 0.262

import mitsuba as mi
for variant in ('metal_ad_rgb', 'llvm_ad_rgb', 'scalar_rgb'):
    try:
        mi.set_variant(variant); break
    except Exception:
        continue
T = mi.ScalarTransform4f
import glass   # registers the 'thinglass' material

# ── Materials ────────────────────────────────────────────────────────────────
rgb = lambda *v: {'type': 'rgb', 'value': list(v) if len(v) > 1 else [v[0]] * 3}
LINER   = {'type': 'roughplastic', 'distribution': 'ggx', 'alpha': 0.13, 'int_ior': 1.5,
           'diffuse_reflectance': rgb(0.80, 0.81, 0.82), 'nonlinear': True}       # white ABS, satin
TRIM    = {'type': 'roughplastic', 'distribution': 'ggx', 'alpha': 0.08, 'int_ior': 1.5,
           'diffuse_reflectance': rgb(0.83, 0.83, 0.83), 'nonlinear': True}       # glossier white trim
ENAMEL  = {'type': 'roughplastic', 'distribution': 'ggx', 'alpha': 0.02, 'int_ior': 1.5,
           'diffuse_reflectance': rgb(0.004)}                                     # the black body
STEEL   = {'type': 'roughconductor', 'material': 'Al', 'distribution': 'ggx', 'alpha': 0.11}   # satin aluminium trim
GLASS   = {'type': 'thinglass', 'int_ior': 1.52, 'tr': 0.95, 'tg': 0.985, 'tb': 0.965}    # shelves: faintly green
CLEAR   = {'type': 'thinglass', 'int_ior': 1.58, 'tr': 0.97, 'tg': 0.98, 'tb': 0.985}     # crisper bins
CLEAR_SOLID = {'type': 'dielectric', 'int_ior': 1.58}
DARK    = {'type': 'diffuse', 'reflectance': rgb(0.02)}

scene = {
    'type': 'scene',
    # volpath: the path tracer that lets light be aimed through thin glass (see glass.py)
    'integrator': {'type': 'volpath', 'max_depth': 24, 'rr_depth': 10},
    # The studio the photo was taken in: a dark room (which is why the black enamel stays black)
    # with one big softbox high, in front and to the left: it reaches into the cavity and across the
    # inside of the open door, and stays out of the camera's mirror line.
    'studio': {'type': 'constant', 'radiance': rgb(0.06)},
    'softbox': {'type': 'rectangle', 'bsdf': {'type': 'null'},
                'to_world': T().look_at(origin=[-1.3, 2.1, 2.4], target=[0.15, 0.45, 0], up=[0, 1, 0]).scale([1.0, 0.7, 1]),
                'emitter': {'type': 'area', 'radiance': rgb(40)}},
}
_n = [0]
def add(mesh, bsdf, **extra):
    _n[0] += 1
    name = f'm{_n[0]:03d}'
    scene[name] = {'type': 'ply', 'filename': write_ply(os.path.join(BUILD, name + '.ply'), mesh),
                   'bsdf': dict(bsdf), **extra}

def box(x0, x1, y0, y1, z0, z1, r=0.003, **kw):
    return rounded_box(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), r, **kw)

def frame(x_out, x_in, y0_out, y0_in, y1_in, y1_out, z0, z1, r):
    """Four bars around the opening (picture-frame)."""
    return merge([box(-x_out, -x_in, y0_out, y1_out, z0, z1, r), box(x_in, x_out, y0_out, y1_out, z0, z1, r),
                  box(-x_out, x_out, y0_out, y0_in, z0, z1, r), box(-x_out, x_out, y1_in, y1_out, z0, z1, r)])

# ── Cabinet face, liner collar, neighbours ───────────────────────────────────
BIG = 0.15                                              # the black body carries on past the door's rectangle
add(frame(HW + BIG, HW - RIM, -BIG, RIM, DOOR_H - RIM, DOOR_H + 0.003, ZC - 0.04, ZC, 0.004), ENAMEL)
add(frame(HW - RIM + 0.002, HW - RIM - COLLAR, RIM - 0.002, RIM + COLLAR, DOOR_H - RIM - COLLAR, DOOR_H - RIM + 0.002,
          ZC - 0.03, ZC - 0.004, 0.007), LINER)
add(box(-HW - BIG, HW + BIG, DOOR_H + 0.004, DOOR_H + 0.4, ZC - 0.01, 0, 0.012), ENAMEL)   # freezer door above
add(box(-HW - BIG, HW + BIG, -0.4, -0.003, ZC - 0.01, -0.004, 0.006), ENAMEL)             # base below

# ── Cavity: one moulded liner, rounded in every corner, open at the front ────
add(rounded_box((0, (CAV_Y0 + CAV_Y1) / 2, (CAV_Z0 + CAV_Z1 + CAV_R) / 2),
                (2 * CAV_X, CAV_Y1 - CAV_Y0, CAV_Z1 + CAV_R - CAV_Z0), CAV_R, k=8, flip=True,
                keep=lambda c: c[:, 2] < CAV_Z1 - 1e-4), LINER)
# compressor step at the bottom back
add(box(-CAV_X + 0.001, CAV_X - 0.001, CAV_Y0 - 0.02, CAV_Y0 + 0.17, CAV_Z0 - 0.02, CAV_Z0 + 0.16, 0.03, k=8), LINER)

# shelf supports: a rib at every position, both walls
ribs = []
for y in RIBS:
    for s in (-1, 1):
        ribs.append(rounded_box((s * (CAV_X - 0.002), y, ZC - 0.255), (0.011, 0.009, 0.40), 0.004))
add(merge(ribs), LINER)

# back wall: cooling plate, drain gutter and hole, air slots
add(box(-0.19, 0.19, 0.44, 0.76, CAV_Z0 - 0.01, CAV_Z0 + 0.004, 0.004), LINER)
add(box(-0.15, 0.15, 0.385, 0.398, CAV_Z0 - 0.01, CAV_Z0 + 0.012, 0.005), LINER)
scene['drain'] = {'type': 'disk', 'bsdf': DARK,
                  'to_world': T().translate([0, 0.412, CAV_Z0 + 0.0045]).scale(0.006)}
slots = [box(x - 0.016, x + 0.016, 0.795, 0.800, CAV_Z0 - 0.01, CAV_Z0 + 0.0008, 0.0005) for x in np.linspace(-0.14, 0.14, 7)]
add(merge(slots), DARK)

# ── Glass shelves: 5 mm glass, brushed-steel front trim, white rear lip ──────
def shelf(y, z_front=ZC - 0.095, z_back=CAV_Z0 + 0.012, trim=STEEL, trim_h=0.009):
    x = CAV_X - 0.0015
    scene[f'glass{int(y * 1000)}'] = {'type': 'rectangle', 'bsdf': GLASS,     # one sheet stands for the 5 mm pane
        'to_world': T().translate([0, y + 0.004, (z_back + z_front - 0.004) / 2]).rotate([1, 0, 0], -90)
                       .scale([x, (z_front - 0.004 - z_back) / 2, 1])}
    add(box(-x, x, y - 0.002, y - 0.002 + trim_h, z_front - 0.007, z_front, 0.0028), trim)
    add(box(-x, x, y - 0.002, y + 0.014, z_back - 0.004, z_back + 0.004, 0.003), TRIM)

for i in SHELF_RIBS:
    shelf(RIBS[i] + 0.0045)
# the crisper's glass lid, in a deeper white frame
shelf(CRISPER_LID_Y, trim=TRIM, trim_h=0.02)
for s in (-1, 1):   # the ledges it sits on
    add(rounded_box((s * (CAV_X - 0.004), CRISPER_LID_Y - 0.006, ZC - 0.255), (0.014, 0.011, 0.40), 0.004), LINER)

# ── Crisper drawers: two clear bins, each with a moulded grip along the top ──
def drawer(x0, x1):
    y0, y1, z0, z1 = CAV_Y0 + 0.012, CRISPER_LID_Y - 0.022, ZC - 0.42, ZC - 0.088
    add(box(x0, x1, y0, y1 + 0.016, z0, z1, 0.016, k=6, keep=lambda c: c[:, 1] < y1), CLEAR)  # open-top tub
    add(box(x0, x1, y1 - 0.004, y1 + 0.012, z1 - 0.012, z1 + 0.006, 0.005), CLEAR_SOLID)        # rolled front rim / grip
    add(box(x0 + 0.05, x1 - 0.05, y1 - 0.042, y1 - 0.030, z1 - 0.002, z1 + 0.010, 0.004), CLEAR_SOLID)   # finger pull

GAP = 0.004
drawer(-CAV_X + 0.006, -GAP)
drawer(GAP, CAV_X - 0.006)

# ── Light: a lamp housing on the ceiling with a frosted lens ─────────────────
LX, LZ0, LZ1, LY = 0.11, ZC - 0.24, ZC - 0.11, CAV_Y1 - 0.030
add(box(-LX, LX, LY, CAV_Y1 + 0.01, LZ0, LZ1, 0.009, k=6), TRIM)
# The lens has a 'null' surface: it glows but never blocks a ray. (After a shadow ray crosses
# a glass sheet, rounding lets it overshoot by a fraction of a mm and strike the emitter's own
# surface, which wrongly shadows everything lit at a glancing angle.)
scene['lamp'] = {'type': 'rectangle', 'bsdf': {'type': 'null'},
                 'to_world': T().translate([0, LY - 0.002, (LZ0 + LZ1) / 2]).rotate([1, 0, 0], 90).scale([LX - 0.018, (LZ1 - LZ0) / 2 - 0.018, 1]),
                 'emitter': {'type': 'area', 'radiance': rgb(140, 144, 150)}}
# thermostat dial on its front
scene['dial'] = {'type': 'cylinder', 'radius': 0.013, 'p0': [0.06, LY + 0.017, LZ1 - 0.001], 'p1': [0.06, LY + 0.017, LZ1 + 0.006], 'bsdf': TRIM}
scene['dialcap'] = {'type': 'disk', 'bsdf': TRIM, 'to_world': T().translate([0.06, LY + 0.017, LZ1 + 0.006]).scale(0.013)}

# ── The door, swung open on its right-hand hinge ─────────────────────────────
# Modelled closed (filling the door's rectangle, z from the cabinet face to 0),
# then every part is rotated about the hinge pin.
DOOR = '--interior' not in sys.argv           # --interior: just the cavity, door removed
OPEN_DEG = 112.0
PIVOT = (HW - 0.010, -0.012)                  # hinge pin (x, z): just inside the door's front right corner
GASKET  = {'type': 'roughplastic', 'distribution': 'ggx', 'alpha': 0.35, 'int_ior': 1.45,
           'diffuse_reflectance': rgb(0.62, 0.63, 0.64)}                           # grey magnetic seal

def swing(mesh, deg=OPEN_DEG):
    V, N, F = mesh
    c, s_ = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    def rot(P, origin):
        dx, dz = P[:, 0] - origin[0], P[:, 2] - origin[1]
        out = P.copy()
        out[:, 0], out[:, 2] = origin[0] + dx * c + dz * s_, origin[1] - dx * s_ + dz * c
        return out
    return rot(V, PIVOT), rot(N, (0, 0)), F

door_keys = []
def door_add(mesh, bsdf):
    add(swing(mesh), bsdf)
    door_keys.append(f'm{_n[0]:03d}')

def tub(x0, x1, y0, y1, z0, z1, t=0.004, r=0.014):
    """Open-topped moulded tray with real wall thickness and a flat rim."""
    outer = box(x0, x1, y0, y1 + r, z0, z1, r, k=6, keep=lambda c: c[:, 1] < y1)            # walls run straight up to y1
    inner = box(x0 + t, x1 - t, y0 + t, y1 + r - t, z0 + t, z1 - t, r - t, k=6, flip=True, keep=lambda c: c[:, 1] < y1)
    rim = rounded_ring(x0, x1, z0, z1, r, t, y1)
    return merge([outer, inner, rim])

if DOOR:
    ZL = ZC + 0.012                                                    # the liner's face: a gasket's height off the cabinet
    door_add(box(-HW, HW, 0, DOOR_H, ZL, 0, 0.018, k=8), ENAMEL)       # steel shell, the black you see from outside
    door_add(box(-HW + 0.010, HW - 0.010, 0.010, DOOR_H - 0.010, ZL - 0.004, ZL + 0.01, 0.004), LINER)
    # gasket: a soft ribbed seal around the edge
    for k, (w, d) in enumerate([(0.026, 0.012), (0.016, 0.016)]):
        e = 0.014 + k * 0.005
        door_add(frame(HW - e, HW - e - w, e, e + w, DOOR_H - e - w, DOOR_H - e, ZL - d, ZL, 0.004), GASKET)
    # the dike: a raised wall that plugs into the cabinet opening and carries the shelves
    DX, DY0, DY1, DZ = CAV_X - 0.010, CAV_Y0 + 0.012, CAV_Y1 - 0.012, ZL - 0.060
    door_add(frame(DX, DX - 0.028, DY0, DY0 + 0.028, DY1 - 0.028, DY1, DZ, ZL, 0.012), LINER)
    # three moulded shelves between the dike's walls; the bottom one is deeper, for bottles
    for y0, h, depth in [(0.085, 0.115, 0.088), (0.365, 0.075, 0.078), (0.600, 0.075, 0.078)]:
        door_add(tub(-DX + 0.026, DX - 0.026, y0, y0 + h, ZL - depth, ZL - 0.002), TRIM)

# ── Camera: where the photo's camera was, cropped to the door's rectangle ────
def arg(name, default):
    return type(default)(next((a.split('=')[1] for a in sys.argv if a.startswith(f'--{name}=')), default))

SCALE = arg('scale', 1.0 if QUICK else 3.0)   # render size, in multiples of the door's pixels in the photo
SPP = arg('spp', 64)                          # samples per pixel, per pass
PASSES = arg('passes', 1 if QUICK else 24)
EXPOSURE = 0.34

# What the frame covers, in metres on the door-front plane: the door's own rectangle, or (with
# the door) wide enough to take in the open door, which swings out toward the camera and right.
FX0, FX1, FY0, FY1 = (-HW, 0.74, -0.15, 0.97) if DOOR else (-HW, HW, 0.0, DOOR_H)
ppm = 522 * SCALE / DOOR_W
half_w, half_h = max(-FX0, FX1), max(FY1 - CAM_Y, CAM_Y - FY0)       # the lens axis is the frame centre…
W = int(round(-FX0 * ppm)) + int(round(FX1 * ppm))                    # …and the film is cropped to the part we want,
H = int(round((FY1 - CAM_Y) * ppm)) + int(round((CAM_Y - FY0) * ppm))  # measured in whole pixels either side of the axis
scene['sensor'] = {
    'type': 'perspective', 'fov_axis': 'x', 'fov': math.degrees(2 * math.atan(half_w / CAM_D)),
    'to_world': T().look_at(origin=[0, CAM_Y, CAM_D], target=[0, CAM_Y, 0], up=[0, 1, 0]),
    'near_clip': 0.1, 'far_clip': 20,
    'film': {'type': 'hdrfilm', 'width': 2 * int(round(half_w * ppm)), 'height': 2 * int(round(half_h * ppm)),
             'crop_offset_x': int(round(half_w * ppm)) - int(round(-FX0 * ppm)),
             'crop_offset_y': int(round(half_h * ppm)) - int(round((FY1 - CAM_Y) * ppm)),
             'crop_width': W, 'crop_height': H, 'pixel_format': 'rgb', 'rfilter': {'type': 'gaussian'}},
    'sampler': {'type': 'independent', 'sample_count': SPP},
}
# where the closed door's rectangle sits inside the frame, in output pixels (left, top, width, height)
RECT = (int(round((-HW - FX0) * ppm)), int(round((FY1 - DOOR_H) * ppm)), int(round(DOOR_W * ppm)), int(round(DOOR_H * ppm)))


def door_matte():
    """Coverage (0–1) of the open door alone, to cut it out where it hangs outside the fridge."""
    sc = {'type': 'scene', 'integrator': {'type': 'direct'}, 'light': {'type': 'constant'},
          'sensor': dict(scene['sensor'], film=dict(scene['sensor']['film'], pixel_format='rgba'),
                         sampler={'type': 'independent', 'sample_count': 32})}
    sc.update({k: scene[k] for k in door_keys})
    return np.array(mi.render(mi.load_dict(sc)))[..., 3]


def robust_mean(passes):
    """Average several noisy renders of the same frame, ignoring fireflies.

    A path tracer's noise is mostly rare, very bright samples (light that found
    the lamp by bouncing off glass or chrome). Each pass is clamped to a few
    times the per-pixel median across passes before averaging, which removes
    those specks and leaves everything else untouched.
    """
    stack = np.stack(passes)
    if len(passes) < 4:
        return stack.mean(0)
    lum = stack.mean(-1, keepdims=True)
    cap = 2.5 * np.median(lum, axis=0, keepdims=True) + 0.02
    return (stack * np.minimum(1, cap / np.maximum(lum, 1e-6))).mean(0)


def tonemap(lin, exposure=EXPOSURE):
    """Linear radiance → display sRGB: exposure, a soft shoulder so the lamp rolls off, then gamma."""
    x = np.maximum(lin * exposure, 0)
    x = x * (1 + x / 3.0 ** 2) / (1 + x) * 1.6    # filmic shoulder: lit white lands near 0.9, the lens blooms to 1
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * x ** (1 / 2.4) - 0.055)


if __name__ == '__main__':
    from PIL import Image
    sc = mi.load_dict(scene)
    passes = []
    for i in range(PASSES):                      # several passes with fresh seeds
        passes.append(np.array(mi.render(sc, seed=i)))
        print(f'pass {i + 1}/{PASSES}', flush=True)
    lin = robust_mean(passes)
    name = ('open' if DOOR else 'interior') + ('-quick' if QUICK else '')
    out = os.path.join(BUILD, name)
    np.save(out + '.npy', lin.astype(np.float32))
    rgb8 = (tonemap(lin) * 255 + 0.5).astype(np.uint8)
    if DOOR:   # opaque inside the door's rectangle; outside it, only the door itself
        alpha = door_matte()
        x, y, w, h = RECT
        alpha[y:y + h, x:x + w] = 1
        rgb8 = np.dstack([rgb8, (np.clip(alpha, 0, 1) * 255 + 0.5).astype(np.uint8)])
    Image.fromarray(rgb8).save(out + '.png')
    print(variant, lin.shape, 'door rect', RECT, '→', out + '.png')
