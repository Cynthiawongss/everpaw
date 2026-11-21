"""EverPaw Home — builds the rooms in Blender and bakes their light.

Run:  Blender --background --python tools/build_rooms.py -- <out_dir> [room ...] [--fast]

Each room is modelled here in code, lit three ways (day, evening, night), and the light is baked
into one texture per time of day. Out come  <room>.glb  (the shell, with baked-texture UVs, plus glass),
<room>_day.jpg / _evening.jpg / _night.jpg  and  <room>_preview.png.

Coordinates follow the app: x and z run 0..8 across the floor, y is up, the two walls stand on x=0 and z=0.
"""
import bpy, bmesh, math, os, sys, random
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(argv[0]) if argv else os.path.abspath('rooms')
FAST = '--fast' in argv
WANT = [a for a in argv[1:] if not a.startswith('--')]
N, T = 8.0, 0.36  # floor size, wall thickness
os.makedirs(OUT, exist_ok=True)


# ---------- small modelling kit (all in app coordinates) ----------

def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def rgb(hexs):
    h = hexs.lstrip('#'); return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))

MATS = {}
def mat(color, emit=0.0, rough=0.9):
    key = (color, emit, rough)
    if key in MATS: return MATS[key]
    m = bpy.data.materials.new(color); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; r, g, bl = rgb(color)
    b.inputs['Base Color'].default_value = (r, g, bl, 1); b.inputs['Roughness'].default_value = rough
    if emit:
        b.inputs['Emission Color'].default_value = (r, g, bl, 1); b.inputs['Emission Strength'].default_value = emit
    MATS[key] = m; return m

PARTS = {'shell': [], 'glass': []}
def add(bm, loc, color, group='shell', emit=0.0, smooth=False, rot=None, rough=0.9):
    me = bpy.data.meshes.new('p'); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    ob = bpy.data.objects.new('p', me); bpy.context.scene.collection.objects.link(ob)
    x, y, z = loc; ob.location = (x, -z, y)
    if rot: ob.rotation_euler = rot
    me.materials.append(mat(color, emit, rough)); PARTS[group].append(ob); return ob

def box(x0, x1, y0, y1, z0, z1, color, bevel=0.035, **kw):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = abs(x1 - x0), abs(z1 - z0), abs(y1 - y0)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    bv = min(bevel, min(sx, sy, sz) * 0.3)
    if bv > 0.004: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bv, segments=2, affect='EDGES', profile=0.5)
    return add(bm, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), color, **kw)

def cyl(x, y, z, r, h, color, r2=None, seg=28, **kw):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    return add(bm, (x, y + h / 2, z), color, smooth=True, **kw)

def ball(x, y, z, r, color, sx=1, sy=1, sz=1, **kw):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=r)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sz, v.co.z * sy))
    return add(bm, (x, y, z), color, smooth=True, **kw)

def prism(points, z0, z1, color, **kw):
    """A flat shape drawn in the x–y(up) plane and given thickness along z."""
    bm = bmesh.new()
    front = [bm.verts.new((px, -z0, py)) for px, py in points]; back = [bm.verts.new((px, -z1, py)) for px, py in points]
    bm.faces.new(front); bm.faces.new(list(reversed(back)))
    k = len(points)
    for i in range(k): bm.faces.new([front[i], back[i], back[(i + 1) % k], front[(i + 1) % k]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return add(bm, (0, 0, 0), color, **kw)

def wall_back(color, h, openings=(), x0=-T, x1=N):
    """The wall on z=0, built around its window openings: (x_from, x_to, y_from, y_to)."""
    cur = x0
    for a, b, lo, hi in sorted(openings):
        if a > cur: box(cur, a, 0, h, -T, 0, color)
        box(a, b, 0, lo, -T, 0, color); box(a, b, hi, h, -T, 0, color); cur = b
    if cur < x1: box(cur, x1, 0, h, -T, 0, color)

def wall_left(color, h, openings=(), z0=0, z1=N):
    cur = z0
    for a, b, lo, hi in sorted(openings):
        if a > cur: box(-T, 0, 0, h, cur, a, color)
        box(-T, 0, 0, lo, a, b, color); box(-T, 0, hi, h, a, b, color); cur = b
    if cur < z1: box(-T, 0, 0, h, cur, z1, color)

def frame_back(a, b, lo, hi, color, bars_x=1, bars_y=1, depth=0.2, w=0.1, glass=True):
    box(a - w, b + w, lo - w, lo, -T - 0.02, depth - T + 0.2, color); box(a - w, b + w, hi, hi + w, -T - 0.02, depth - T + 0.2, color)
    box(a - w, a, lo, hi, -T - 0.02, depth - T + 0.2, color); box(b, b + w, lo, hi, -T - 0.02, depth - T + 0.2, color)
    for i in range(1, bars_x + 1): xx = a + (b - a) * i / (bars_x + 1); box(xx - 0.035, xx + 0.035, lo, hi, -T * 0.6, -T * 0.6 + 0.07, color, bevel=0.01)
    for i in range(1, bars_y + 1): yy = lo + (hi - lo) * i / (bars_y + 1); box(a, b, yy - 0.035, yy + 0.035, -T * 0.6 + 0.006, -T * 0.6 + 0.064, color, bevel=0.01)
    if glass: box(a, b, lo, hi, -T * 0.55, -T * 0.55 + 0.02, '#DDEFF6', bevel=0, group='glass')

def frame_left(a, b, lo, hi, color, bars_z=1, bars_y=1, w=0.1, glass=True):
    box(-T - 0.02, 0.04, lo - w, lo, a - w, b + w, color); box(-T - 0.02, 0.04, hi, hi + w, a - w, b + w, color)
    box(-T - 0.02, 0.04, lo, hi, a - w, a, color); box(-T - 0.02, 0.04, lo, hi, b, b + w, color)
    for i in range(1, bars_z + 1): zz = a + (b - a) * i / (bars_z + 1); box(-T * 0.6, -T * 0.6 + 0.07, lo, hi, zz - 0.035, zz + 0.035, color, bevel=0.01)
    for i in range(1, bars_y + 1): yy = lo + (hi - lo) * i / (bars_y + 1); box(-T * 0.6 + 0.006, -T * 0.6 + 0.064, yy - 0.035, yy + 0.035, a, b, color, bevel=0.01)
    if glass: box(-T * 0.55, -T * 0.55 + 0.02, lo, hi, a, b, '#DDEFF6', bevel=0, group='glass')

def base(color, drop=0.6):
    box(-T - 0.14, N + 0.14, -drop, -0.02, -T - 0.14, N + 0.14, color, bevel=0.1)

def planks(colors, width=0.5, seed=3, along='x'):
    r = random.Random(seed); rows = int(N / width)
    for i in range(rows):
        a = i * width; cur = -r.random() * 1.6
        while cur < N:
            ln = 1.4 + r.random() * 1.8; s, e = max(0, cur), min(N, cur + ln)
            if e - s > 0.05:
                c = r.choice(colors)
                if along == 'x': box(s + 0.008, e - 0.008, -0.02, 0.0, a + 0.008, a + width - 0.008, c, bevel=0.012)
                else: box(a + 0.008, a + width - 0.008, -0.02, 0.0, s + 0.008, e - 0.008, c, bevel=0.012)
            cur += ln

def tiles(colors, size=1.0, seed=5, grout='#C8B8A2'):
    r = random.Random(seed); box(0, N, -0.03, -0.012, 0, N, grout, bevel=0)
    k = int(N / size)
    for i in range(k):
        for j in range(k): box(i * size + 0.025, (i + 1) * size - 0.025, -0.02, 0.0, j * size + 0.025, (j + 1) * size - 0.025, r.choice(colors), bevel=0.02)

def skirting(color, h=0.3, skip_back=(), skip_left=()):
    cur = 0
    for a, b in sorted(skip_back):
        if a > cur: box(cur, a, 0, h, 0, 0.07, color, bevel=0.02)
        cur = b
    if cur < N: box(cur, N, 0, h, 0, 0.07, color, bevel=0.02)
    cur = 0.07
    for a, b in sorted(skip_left):
        if a > cur: box(0, 0.07, 0, h, cur, a, color, bevel=0.02)
        cur = b
    if cur < N: box(0, 0.07, 0, h, cur, N, color, bevel=0.02)

def books(x0, x1, y, z0, depth, seed, along='x', cols=('#C96A4B', '#E7B24A', '#6E9A8C', '#F2E7D3', '#8E7CC3', '#4F6D8A', '#D99A9A')):
    r = random.Random(seed); cur = x0
    while cur < x1 - 0.12:
        w = 0.07 + r.random() * 0.09; h = 0.34 + r.random() * 0.22
        if r.random() > 0.15:
            if along == 'x': box(cur, cur + w, y, y + h, z0, z0 + depth * (0.75 + r.random() * 0.2), r.choice(cols), bevel=0.01)
            else: box(z0, z0 + depth * (0.75 + r.random() * 0.2), y, y + h, cur, cur + w, r.choice(cols), bevel=0.01)
        cur += w + 0.012

def bush(x, y, z, r, seed, cols=('#6FA06E', '#86B581', '#5C8C5F'), k=9, tall=1.0):
    rr = random.Random(seed)
    for _ in range(k):
        a = rr.random() * 6.28; d = rr.random() * r * 0.8
        ball(x + math.cos(a) * d, y + rr.random() * r * 1.1 * tall, z + math.sin(a) * d, r * (0.42 + rr.random() * 0.3), rr.choice(cols))

def pot(x, z, r, h, color, y=0.0):
    cyl(x, y, z, r * 0.78, h, color, r2=r); cyl(x, y + h - 0.03, z, r * 0.9, 0.035, '#5E4634', seg=20)


# ---------- the rooms ----------

def room_bay():
    """A window seat: one long window, a deep cushioned sill, a low bookcase."""
    wall, trim, wood, sage = '#E4D3B8', '#FBF5E8', '#B98556', '#93AD92'
    base('#A8744B'); planks(['#D2A26E', '#C9965F', '#DBAE7C'], width=0.5, seed=4)
    wall_back(wall, 5.0, [(1.5, 6.5, 1.55, 4.45)]); wall_left(wall, 5.0, [(4.6, 6.6, 1.7, 4.2)])
    box(-T - 0.07, N + 0.05, 5.0, 5.18, -T - 0.07, 0.07, trim, bevel=0.05); box(-T - 0.07, 0.07, 5.0, 5.18, 0.07, N + 0.05, trim, bevel=0.05)
    frame_back(1.5, 6.5, 1.55, 4.45, trim, bars_x=2, bars_y=0); frame_left(4.6, 6.6, 1.7, 4.2, trim, bars_z=1, bars_y=1)
    skirting(trim, skip_back=[(1.1, 6.9)], skip_left=[(0.2, 3.9)])
    # the seat, panelled in sage, with a long cushion and three pillows
    box(1.2, 6.8, 0, 1.0, 0, 1.0, sage, bevel=0.05)
    for i in range(4): box(1.36 + i * 1.36, 2.56 + i * 1.36, 0.14, 0.86, 0.985, 1.02, '#A3BAA1', bevel=0.03)
    box(1.26, 6.74, 1.0, 1.24, 0.04, 0.98, '#F4E9D4', bevel=0.09)
    box(1.42, 2.22, 1.26, 1.94, 0.1, 0.34, '#D9973F', bevel=0.12, rot=(0.22, 0, 0)); box(2.3, 2.95, 1.26, 1.82, 0.14, 0.36, '#F7EFE0', bevel=0.12, rot=(0.2, 0, 0.1))
    box(5.75, 6.55, 1.26, 1.94, 0.1, 0.34, '#B8573C', bevel=0.12, rot=(0.22, 0, 0))
    box(1.3, 6.7, 4.5, 4.86, -0.02, 0.2, '#EADFC9', bevel=0.06)  # blind
    # low bookcase on the left wall, with a trailing plant and a lamp
    box(0.0, 0.08, 0, 1.75, 0.3, 3.8, '#8C6240', bevel=0.01)                                   # back panel
    box(0.0, 0.95, 0, 1.75, 0.3, 0.4, wood, bevel=0.02); box(0.0, 0.95, 0, 1.75, 3.7, 3.8, wood, bevel=0.02); box(0.0, 0.95, 0, 1.75, 2.0, 2.08, wood, bevel=0.02)
    for yy in (0.0, 0.84): box(0.0, 0.95, yy, yy + 0.1, 0.3, 3.8, wood, bevel=0.02)
    box(0.0, 0.99, 1.75, 1.86, 0.24, 3.86, '#C99564', bevel=0.03)
    books(0.46, 1.95, 0.1, 0.14, 0.7, 11, along='z'); books(2.14, 3.66, 0.1, 0.14, 0.7, 13, along='z'); books(0.46, 1.5, 0.94, 0.14, 0.7, 12, along='z'); books(2.6, 3.66, 0.94, 0.14, 0.7, 14, along='z')
    box(0.2, 0.8, 0.94, 1.3, 1.62, 1.9, '#F2E7D3', bevel=0.04); cyl(0.5, 0.94, 2.34, 0.14, 0.34, '#93AD92', r2=0.1)
    pot(0.5, 3.2, 0.2, 0.3, '#F1E9DA', y=0.95); bush(0.5, 1.32, 3.2, 0.26, 2, k=6)
    pot(0.5, 0.85, 0.22, 0.34, '#D9973F', y=1.84); bush(0.5, 2.3, 0.85, 0.34, 3, k=8)
    for i in range(5): ball(0.84 + i * 0.03, 1.72 - i * 0.2, 0.7 + i * 0.05, 0.1, '#6FA06E')
    cyl(0.5, 1.84, 2.4, 0.16, 0.06, '#8C6240'); cyl(0.5, 1.9, 2.4, 0.03, 0.5, '#8C6240', seg=10); cyl(0.5, 2.36, 2.4, 0.3, 0.36, '#FFE7B8', r2=0.18, emit=3.0)
    box(0.02, 0.1, 2.5, 3.9, 0.9, 2.1, '#8C6240', bevel=0.03); box(0.08, 0.12, 2.6, 3.8, 1.0, 2.0, '#F4E9D4', bevel=0.01)  # a framed print
    return dict(sun=(-0.42, 0.72, -0.62), lamps=[(0.5, 2.4, 2.4, 40)], blocked=[[x, 0] for x in range(1, 7)] + [[0, z] for z in range(0, 4)],
                perch=dict(x=4.2, y=1.25, z=0.52, exit=[4.5, 1.5]))

def room_attic():
    """Under the roof: a sloping ceiling with a skylight, rafters, a brick chimney."""
    wall, trim, wood, brick = '#EDE4D3', '#FBF6EC', '#8A5F3F', '#C2724F'
    base('#7C5A44'); planks(['#C9C2B2', '#D6CFBF', '#BFB7A6'], width=0.66, seed=9, along='z')
    low, ridge_x, ridge_y = 2.3, 4.7, 5.5
    prism([(-T, 0), (N, 0), (N, 4.9), (ridge_x, ridge_y), (-T, low)], -T, 0, wall)                       # gable wall
    box(-T, 0, 0, low, 0, N, wall)                                                                        # knee wall
    box(N - 0.02, N + 0.05, 4.9, 5.06, -T - 0.05, 0.07, trim, bevel=0.03)
    # the roof slope, in four pieces around the skylight
    def slope(u0, u1, z0, z1, color, th=0.22, lift=0.0, **kw):
        dx, dy = ridge_x + T, ridge_y - low; ln = math.hypot(dx, dy); ux, uy = dx / ln, dy / ln; nx, ny = -uy, ux
        p = lambda u, t: (-T + ux * u + nx * (t + lift), low + uy * u + ny * (t + lift))
        return prism([p(u0, 0), p(u1, 0), p(u1, th), p(u0, th)], z0, z1, color, **kw)
    dx, dy = ridge_x + T, ridge_y - low; L = math.hypot(dx, dy)
    s0, s1, k0, k1, ZR = 1.5, 3.9, 0.9, 2.7, 3.5
    slope(0, s0, -T, ZR, wall); slope(s1, L, -T, ZR, wall); slope(s0, s1, -T, k0, wall); slope(s0, s1, k1, ZR, wall)
    for zz in (k0 - 0.07, k1): slope(s0 - 0.07, s1 + 0.07, zz, zz + 0.07, trim, th=0.3, lift=-0.04)
    for uu in (s0 - 0.07, s1): slope(uu, uu + 0.07, k0, k1, trim, th=0.3, lift=-0.04)
    slope((s0 + s1) / 2 - 0.03, (s0 + s1) / 2 + 0.03, k0, k1, trim, th=0.08, lift=0.1)
    slope(s0, s1, k0, k1, '#DDEFF6', th=0.02, lift=0.14, group='glass')
    for zz in (0.35, 1.7, 3.1): slope(0.05, L - 0.05, zz, zz + 0.2, wood, th=0.26, lift=-0.26)       # rafters
    box(-0.02, 0.2, low - 0.3, low - 0.06, 0, ZR, wood, bevel=0.03)
    skirting(trim, skip_back=[(6.7, N)])
    # chimney breast with a niche and a lantern
    box(6.8, N, 0, 4.9, 0, 1.0, brick, bevel=0.03)
    r = random.Random(2)
    for row in range(16):
        for col in range(3):
            if r.random() > 0.45: box(6.82 + col * 0.39 + (row % 2) * 0.12, 6.82 + col * 0.39 + 0.3 + (row % 2) * 0.12, 0.08 + row * 0.3, 0.08 + row * 0.3 + 0.2, 0.995, 1.03, r.choice(['#B5653F', '#CC7E5A', '#A85B3A']), bevel=0.012)
    box(7.0, 7.8, 1.5, 1.58, 0.9, 1.22, wood, bevel=0.02); cyl(7.4, 1.58, 1.06, 0.13, 0.3, '#FFE1A6', emit=4.0); cyl(7.4, 1.88, 1.06, 0.15, 0.05, '#3B3430')
    # a string of small lights along the first rafter, and an old trunk under the eaves
    for i in range(9):
        u = 0.5 + i * (L - 1.0) / 8; ln = L; ux, uy = dx / ln, dy / ln
        ball(-T + ux * u + 0.12, low + uy * u - 0.42 - 0.08 * math.sin(i * 1.3), 3.42, 0.07, '#FFE1A6', emit=5.0)
    box(0.25, 1.45, 0, 0.72, 5.5, 7.4, '#4F6D8A', bevel=0.05); box(0.22, 1.48, 0.72, 0.9, 5.47, 7.43, '#5B7B99', bevel=0.06)
    for zz in (5.9, 7.0): box(0.2, 1.5, 0, 0.92, zz - 0.05, zz + 0.05, '#C99A4A', bevel=0.012)
    return dict(sun=(-0.28, 0.88, -0.2), lamps=[(7.4, 1.9, 1.3, 30), (2.2, 3.0, 1.0, 26)], blocked=[[7, 0], [0, 5], [0, 6], [0, 7], [1, 5], [1, 6], [1, 7]],
                perch=dict(x=0.85, y=0.92, z=6.45, exit=[2.5, 6.5]))

def room_glass():
    """A glasshouse corner: brick below, glass above, a raised bed of plants, tiled floor."""
    brick, cap, frame, wood = '#C77D5C', '#EFE6D6', '#F6F1E6', '#B08258'
    base('#8E6A52'); tiles(['#DDA883', '#D39B76', '#E3B391', '#CE9470'], size=1.0, seed=6)
    hb = 1.15
    box(-T, N, 0, hb, -T, 0, brick); box(-T, 0, 0, hb, 0, N, brick)
    r = random.Random(4)
    for row in range(4):
        for col in range(14):
            if r.random() > 0.35: box(0.1 + col * 0.57 + (row % 2) * 0.2, 0.55 + col * 0.57 + (row % 2) * 0.2, 0.1 + row * 0.26, 0.3 + row * 0.26, -0.005, 0.03, r.choice(['#B96F4E', '#D08A68', '#AE6444']), bevel=0.012)
            if r.random() > 0.35: box(-0.005, 0.03, 0.1 + row * 0.26, 0.3 + row * 0.26, 0.1 + col * 0.57 + (row % 2) * 0.2, 0.55 + col * 0.57 + (row % 2) * 0.2, r.choice(['#B96F4E', '#D08A68', '#AE6444']), bevel=0.012)
    box(-T - 0.06, N + 0.04, hb, hb + 0.12, -T - 0.06, 0.1, cap, bevel=0.03); box(-T - 0.06, 0.1, hb, hb + 0.12, 0.1, N + 0.04, cap, bevel=0.03)
    top = 5.0
    for xx in (0, 2, 4, 6, 8): box(xx - 0.07 - (0.1 if xx == 0 else 0), xx + 0.07, hb + 0.12, top, -T * 0.72, -T * 0.72 + 0.14, frame, bevel=0.02)
    for zz in (2, 4, 6, 8): box(-T * 0.72, -T * 0.72 + 0.14, hb + 0.12, top, zz - 0.07, zz + 0.07, frame, bevel=0.02)
    for yy in (3.0, top):
        box(-T, N + 0.085, yy - 0.07, yy + 0.07, -T * 0.72 - 0.012, -T * 0.72 + 0.152, frame, bevel=0.02); box(-T * 0.72 - 0.012, -T * 0.72 + 0.152, yy - 0.07, yy + 0.07, -T * 0.72 + 0.152, N + 0.085, frame, bevel=0.02)
    for xx in (1, 3, 5, 7): box(xx - 0.03, xx + 0.03, 3.0, top, -T * 0.66, -T * 0.66 + 0.06, frame, bevel=0.01)
    for zz in (1, 3, 5, 7): box(-T * 0.66, -T * 0.66 + 0.06, 3.0, top, zz - 0.03, zz + 0.03, frame, bevel=0.01)
    box(-T * 0.6, N, hb + 0.12, top, -T * 0.62, -T * 0.62 + 0.02, '#DDEFF6', bevel=0, group='glass'); box(-T * 0.62, -T * 0.62 + 0.02, hb + 0.12, top, -T * 0.6, N, '#DDEFF6', bevel=0, group='glass')
    # raised bed along the back wall
    box(0.25, 5.6, 0, 0.72, 0.12, 1.0, wood, bevel=0.04); box(0.2, 5.65, 0.72, 0.82, 0.07, 1.05, '#C39566', bevel=0.03); box(0.33, 5.52, 0.74, 0.86, 0.2, 0.92, '#5E4634', bevel=0.02)
    for i in range(3): box(0.24, 5.61, 0.1 + i * 0.22, 0.12 + i * 0.22, 1.0, 1.012, '#9A7049', bevel=0)
    bush(1.0, 1.0, 0.56, 0.42, 21, k=10); bush(2.2, 0.95, 0.56, 0.3, 22, cols=('#86B581', '#A9C99B', '#6FA06E'), k=7)
    for i in range(6):
        a = i * 1.05; cyl(3.3 + math.cos(a) * 0.12, 0.86, 0.56 + math.sin(a) * 0.1, 0.02, 1.1 + (i % 3) * 0.3, '#5E8F5F', seg=6); ball(3.3 + math.cos(a) * 0.2, 1.98 + (i % 3) * 0.3, 0.56 + math.sin(a) * 0.16, 0.2, '#79B07A', sx=1, sy=0.5, sz=1.3)
    bush(4.6, 1.0, 0.56, 0.36, 24, cols=('#6FA06E', '#5C8C5F', '#86B581'), k=9)
    for i, c in enumerate(['#F2A7A0', '#F6D36B', '#FFFFFF', '#E88F8A', '#F4B9C8', '#F6D36B']): ball(4.2 + i * 0.16, 1.42 + (i % 2) * 0.12, 0.48 + (i % 3) * 0.1, 0.08, c)
    # hanging baskets from the rail, a watering can, a stack of pots
    for xx in (2.0, 6.0):
        cyl(xx, 3.9, 0.5, 0.012, 1.1, '#6B5B4B', seg=5); cyl(xx, 3.62, 0.5, 0.2, 0.3, '#B08258', r2=0.3); bush(xx, 3.95, 0.5, 0.3, int(xx * 7), k=7)
        for i in range(4): ball(xx + 0.26 - i * 0.02, 3.72 - i * 0.2, 0.62, 0.09, '#86B581')
    cyl(6.9, 0, 0.75, 0.3, 0.5, '#7FB0C8', r2=0.24); cyl(7.25, 0.2, 0.75, 0.04, 0.5, '#7FB0C8', seg=10, rot=(0, -0.9, 0)); box(6.6, 6.66, 0.2, 0.52, 0.65, 0.85, '#6C9CB3', bevel=0.02)
    pot(0.6, 7.2, 0.3, 0.42, '#C77D5C'); pot(0.6, 7.2, 0.27, 0.4, '#D08A68', y=0.14); pot(0.7, 6.5, 0.2, 0.3, '#C77D5C')
    for i in range(10): ball(0.3 + i * 0.83, top + 0.02, -0.18, 0.07, '#FFE1A6', emit=5.0)          # festoon lights for the evening
    return dict(sun=(-0.5, 0.62, -0.6), lamps=[(2.0, 4.4, 0.6, 26), (6.0, 4.4, 0.6, 26)], blocked=[[x, 0] for x in range(0, 6)] + [[0, 6], [0, 7], [6, 0], [7, 0]], perch=None)

ROOMS = {'bay': room_bay, 'attic': room_attic, 'glass': room_glass}


# ---------- light, bake, export ----------

LIGHT = {
    'day': dict(sky='#DDEBFA', sky_s=1.0, sun='#FFF1DA', sun_s=5.0, lamp=0.0, exposure=0.0),
    'evening': dict(sky='#F6C9A6', sky_s=0.55, sun='#FF9A55', sun_s=3.4, lamp=0.5, exposure=0.15),
    'night': dict(sky='#2A3668', sky_s=0.3, sun='#8FA6FF', sun_s=0.35, lamp=1.0, exposure=0.55),
}

def lights(info, phase):
    sc = bpy.context.scene; L = LIGHT[phase]
    for ob in [o for o in sc.objects if o.type == 'LIGHT']: bpy.data.objects.remove(ob, do_unlink=True)
    w = sc.world or bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes['Background']; r, g, b = rgb(L['sky']); bg.inputs[0].default_value = (r, g, b, 1); bg.inputs[1].default_value = L['sky_s']
    sx, sy, sz = info['sun']; low = 0.55 if phase == 'evening' else 1.0
    d = Vector((-sx, sz, -sy * low)).normalized()                       # direction the light travels, in Blender axes
    sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = L['sun_s']; sd.color = rgb(L['sun']); sd.angle = math.radians(3.5 if phase != 'night' else 12)
    so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so); so.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if L['lamp'] > 0:
        for x, y, z, watts in info['lamps']:
            pd = bpy.data.lights.new('lamp', 'POINT'); pd.energy = watts * 9 * L['lamp']; pd.color = rgb('#FFC983'); pd.shadow_soft_size = 0.35
            po = bpy.data.objects.new('lamp', pd); sc.collection.objects.link(po); po.location = (x, -z, y)
    for m in bpy.data.materials:                                         # lamps and little lights glow more after dark
        if m.use_nodes and 'Principled BSDF' in m.node_tree.nodes:
            b = m.node_tree.nodes['Principled BSDF']
            if 'ev_emit' not in m: m['ev_emit'] = b.inputs['Emission Strength'].default_value
            b.inputs['Emission Strength'].default_value = m['ev_emit'] * (0.25 + 1.6 * L['lamp'])
    sc.view_settings.exposure = L['exposure']

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); ob = bpy.context.view_layer.objects.active; ob.name = name; return ob

def build(room):
    bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear(); PARTS['shell'].clear(); PARTS['glass'].clear()
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for dev in prefs.devices: dev.use = True
        sc.cycles.device = 'GPU'
    except Exception as e: print('GPU not available, using CPU:', e)
    sc.cycles.samples = 48 if FAST else 300; sc.cycles.use_denoising = True
    try: sc.view_settings.view_transform = 'Khronos PBR Neutral'
    except Exception: sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    info = ROOMS[room]()
    shell = join(PARTS['shell'], 'shell'); glass = join(PARTS['glass'], 'glass') if PARTS['glass'] else None
    bpy.ops.object.select_all(action='DESELECT'); shell.select_set(True); bpy.context.view_layer.objects.active = shell
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0025, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    size = 1024 if FAST else 2048
    img = bpy.data.images.new('bake', size, size, alpha=False, float_buffer=True)
    for m in shell.data.materials:
        nd = m.node_tree.nodes.new('ShaderNodeTexImage'); nd.image = img; m.node_tree.nodes.active = nd; nd.select = True
    if glass: glass.hide_render = True                                   # light passes straight through the panes
    bk = sc.render.bake; bk.use_pass_direct = True; bk.use_pass_indirect = True; bk.use_pass_diffuse = True; bk.use_pass_glossy = False; bk.use_pass_transmission = False; bk.use_pass_emit = True
    bk.margin = 6; bk.use_clear = True
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 90; sc.render.image_settings.color_mode = 'RGB'
    for phase in ('day', 'evening', 'night'):
        lights(info, phase)
        bpy.ops.object.select_all(action='DESELECT'); shell.select_set(True); bpy.context.view_layer.objects.active = shell
        bpy.ops.object.bake(type='COMBINED')
        img.save_render(os.path.join(OUT, f'{room}_{phase}.jpg'), scene=sc); print('baked', room, phase)
        if phase == 'day': preview(room, sc)
    # the shell leaves with one plain material; the app paints it with the baked texture
    plain = bpy.data.materials.new('baked'); shell.data.materials.clear(); shell.data.materials.append(plain)
    for p in shell.data.polygons: p.material_index = 0
    if glass:
        glass.hide_render = False; gm = bpy.data.materials.new('glass'); glass.data.materials.clear(); glass.data.materials.append(gm)
        for p in glass.data.polygons: p.material_index = 0
    bpy.ops.object.select_all(action='DESELECT'); shell.select_set(True)
    if glass: glass.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, room + '.glb'), export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    return info

def preview(room, sc):
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = 15.5
    co = bpy.data.objects.new('cam', cd); sc.collection.objects.link(co); sc.camera = co
    tgt = Vector((3.9, -3.9, 1.95)); co.location = tgt + Vector((18, -18, 17.4)); co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = 960, 720; sc.render.film_transparent = True
    old = sc.cycles.samples; sc.cycles.samples = 40 if FAST else 128
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = os.path.join(OUT, room + '_preview.png'); bpy.ops.render.render(write_still=True)
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.color_mode = 'RGB'; sc.cycles.samples = old
    bpy.data.objects.remove(co, do_unlink=True)

import json
meta = {}
for name in (WANT or list(ROOMS)):
    info = build(name); meta[name] = dict(blocked=info['blocked'], perch=info['perch'], lamps=[list(l) for l in info['lamps']])
    print('done', name)
path = os.path.join(OUT, 'rooms.json'); old = {}
if os.path.exists(path):
    try: old = json.load(open(path))
    except Exception: old = {}
old.update(meta); json.dump(old, open(path, 'w'), indent=1)
print('ALL DONE', list(meta))
