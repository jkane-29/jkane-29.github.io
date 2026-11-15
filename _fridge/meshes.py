"""Small mesh helpers for the fridge scene: rounded boxes, written as binary PLY.

Every solid in the fridge is a box with filleted edges. The fillets are what
make plastic and glass read as real: they catch a highlight along every edge.
"""
import os, struct
import numpy as np


def rounded_box(center, size, r, k=5, flip=False, keep=None):
    """Box of full `size` centred on `center` with all edges rounded to radius r.

    k: segments per 45° of fillet. flip: normals point inward (a cavity).
    keep: optional predicate on triangle centroids (N×3 array → bool mask),
          e.g. to cut the front off a cavity.
    Returns (vertices, normals, faces).
    """
    c = np.asarray(center, float)
    h = np.asarray(size, float) / 2
    r = float(min(r, h.min() * 0.999))

    def coords(hh):
        inner = hh - r
        band = inner + r * np.tan(np.linspace(0, np.pi / 4, k + 1))   # even steps in angle
        band[-1] = hh
        return np.concatenate([-band[::-1], band])

    V, N, F = [], [], []
    for a in range(3):
        b, d = (a + 1) % 3, (a + 2) % 3
        ub, ud = coords(h[b]), coords(h[d])
        for s in (-1.0, 1.0):
            gb, gd = np.meshgrid(ub, ud, indexing='ij')
            p = np.zeros(gb.shape + (3,))
            p[..., a], p[..., b], p[..., d] = s * h[a], gb, gd
            inner = np.clip(p, -(h - r), h - r)
            n = p - inner
            n /= np.linalg.norm(n, axis=-1, keepdims=True)
            pos = inner + r * n
            nb, nd = gb.shape
            idx = np.arange(nb * nd).reshape(nb, nd) + sum(len(v) for v in V)
            q = np.stack([idx[:-1, :-1], idx[1:, :-1], idx[1:, 1:], idx[:-1, 1:]], -1).reshape(-1, 4)
            tri = np.concatenate([q[:, [0, 1, 2]], q[:, [0, 2, 3]]])
            if s < 0:                       # keep winding counter-clockwise seen from outside
                tri = tri[:, ::-1]
            V.append(pos.reshape(-1, 3)); N.append(n.reshape(-1, 3)); F.append(tri)
    V, N, F = np.concatenate(V) + c, np.concatenate(N), np.concatenate(F)
    # drop zero-area triangles (where the fillet band collapses)
    e1, e2 = V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]
    F = F[np.linalg.norm(np.cross(e1, e2), axis=1) > 1e-14]
    if keep is not None:
        F = F[keep(V[F].mean(axis=1))]
    if flip:
        N, F = -N, F[:, ::-1]
    return V, N, F


def merge(parts):
    """Join several (V, N, F) meshes into one."""
    V, N, F, off = [], [], [], 0
    for v, n, f in parts:
        V.append(v); N.append(n); F.append(f + off); off += len(v)
    return np.concatenate(V), np.concatenate(N), np.concatenate(F)


def write_ply(path, mesh):
    V, N, F = mesh
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write((f'ply\nformat binary_little_endian 1.0\nelement vertex {len(V)}\n'
                 'property float x\nproperty float y\nproperty float z\n'
                 'property float nx\nproperty float ny\nproperty float nz\n'
                 f'element face {len(F)}\nproperty list uchar int vertex_indices\nend_header\n').encode())
        f.write(np.hstack([V, N]).astype('<f4').tobytes())
        rec = np.empty(len(F), dtype=[('n', 'u1'), ('i', '<i4', 3)])
        rec['n'], rec['i'] = 3, F
        f.write(rec.tobytes())
    return path


def rounded_ring(x0, x1, z0, z1, r, t, y, n=8):
    """Flat, upward-facing rim of width t following a rounded rectangle in the x–z plane at height y."""
    pts_o, pts_i = [], []
    for cx, cz, a0 in ((x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)):
        for a in np.radians(a0 + np.linspace(0, 90, n + 1)):
            d = np.array([np.cos(a), np.sin(a)])
            pts_o.append((cx + r * d[0], cz + r * d[1])); pts_i.append((cx + (r - t) * d[0], cz + (r - t) * d[1]))
    m = len(pts_o)
    V = np.array([(x, y, z) for x, z in pts_o + pts_i])
    F = []
    for i in range(m):
        j = (i + 1) % m
        F += [(i, m + i, j), (j, m + i, m + j)]
    F = np.array(F)
    nrm = np.cross(V[F[0, 1]] - V[F[0, 0]], V[F[0, 2]] - V[F[0, 0]])
    if nrm[1] < 0:
        F = F[:, ::-1]
    return V, np.tile([0.0, 1.0, 0.0], (len(V), 1)), F
