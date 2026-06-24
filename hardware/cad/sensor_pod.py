#!/usr/bin/env python3
"""
BlindAid Vest – Sensor Pod CAD Generator
=========================================
Parametric FreeCAD script that exports pod_base.stl and pod_lid.stl.
Target material: Formlabs Tough 1500 Resin (SLA, 50 µm layer height).

Usage
-----
  freecadcmd sensor_pod.py

Both STL files are written next to this script.

Coordinate frame
----------------
  +X  = width  (110 mm)
  +Y  = depth  (80 mm)
  +Z  = height (30 mm, z=0 at base floor outer surface)

All dimensions in mm.
"""

import sys
import os

try:
    import FreeCAD as App
    import Part
    import Mesh
    import MeshPart
except ImportError:
    sys.exit(
        "FreeCAD Python modules not found.\n"
        "Run with:  freecadcmd sensor_pod.py\n"
        "or from FreeCAD's built-in Python console."
    )

# ── Outer shell ───────────────────────────────────────────────────────────────
W  = 110.0   # width  (X)
D  =  80.0   # depth  (Y)
H  =  30.0   # height (Z)
WT =   2.0   # wall + floor thickness

# ── TF-Luna LiDAR sensors – front face (Y = 0) ───────────────────────────────
SENSOR_DIA     = 10.0
SENSOR_COUNT   =  3
SENSOR_SPACING = 30.0        # centre-to-centre
SENSOR_Z_CTR   = H / 2      # vertically centred on front face

# ── GX12 aviation connector – bottom face (Z = 0) ────────────────────────────
GX12_W = 16.0
GX12_D = 16.0

# ── USB-C – right face (X = W) ───────────────────────────────────────────────
USBC_PORT_W = 10.0   # along Y
USBC_PORT_H =  4.0   # along Z

# ── Interior ESP32 shelf ──────────────────────────────────────────────────────
SHELF_Z  = 15.0   # Z of shelf bottom surface
SHELF_W  = 70.0   # along X
SHELF_D  = 30.0   # along Y
SHELF_T  =  2.0   # shelf plate thickness

# ── M2 screw posts on shelf ───────────────────────────────────────────────────
POST_OD    =  5.0   # outer diameter
POST_ID    =  2.2   # M2 clearance hole diameter
POST_H     =  3.0   # height above shelf top surface
POST_INSET =  5.0   # centre inset from shelf edge

# ── M3 corner mounting holes through base floor ───────────────────────────────
M3_DIA   = 3.2   # M3 clearance diameter
M3_INSET = 6.0   # centre inset from outer wall

# ── Snap-fit geometry ─────────────────────────────────────────────────────────
# Lid outer skirt slides over the box exterior.
# Tabs on lid inner skirt surface catch into notches on box outer walls.
SKIRT_H       = 5.0   # lid skirt height below plate
SKIRT_WT      = 2.0   # lid skirt wall thickness
FIT_GAP       = 0.2   # clearance between lid skirt inner / box outer on each side
SNAP_TAB_D    = 1.0   # catch depth (spec: 1 mm)
SNAP_TAB_W    = 12.0  # tab width
SNAP_TAB_H    =  3.0  # tab height
SNAP_TAB_Z    =  1.5  # tab bottom z in lid-model frame (= 1.5 mm above skirt bottom)
# Lead-in ramp on tab top: 45° wedge makes insertion self-guiding
SNAP_RAMP_H   =  1.5  # ramp height (same as catch so total tab feature = 2*SNAP_TAB_H)

# ── Lid plate ─────────────────────────────────────────────────────────────────
LID_T = 2.0   # top plate thickness

# ─────────────────────────────────────────────────────────────────────────────
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))


def v(x, y, z):
    return App.Vector(x, y, z)


# ── Helper: extruded right-triangle prism ────────────────────────────────────
def make_wedge(base_w, base_h, depth):
    """Right-triangle prism: base_w × base_h cross-section, extruded depth in Z."""
    pts = [
        App.Vector(0, 0, 0),
        App.Vector(base_w, 0, 0),
        App.Vector(0, base_h, 0),
        App.Vector(0, 0, 0),
    ]
    wire = Part.makePolygon(pts)
    face = Part.Face(wire)
    return face.extrude(v(0, 0, depth))


# ═════════════════════════════════════════════════════════════════════════════
# BASE
# ═════════════════════════════════════════════════════════════════════════════
def make_base():
    # ── 1. Hollow shell ──────────────────────────────────────────────────────
    outer_box = Part.makeBox(W, D, H)
    inner_box = Part.makeBox(W - 2*WT, D - 2*WT, H - WT)
    inner_box.translate(v(WT, WT, WT))
    base = outer_box.cut(inner_box)

    # ── 2. TF-Luna sensor cutouts – front face (Y = 0) ───────────────────────
    total_span = (SENSOR_COUNT - 1) * SENSOR_SPACING
    sx0 = (W - total_span) / 2
    for i in range(SENSOR_COUNT):
        sx = sx0 + i * SENSOR_SPACING
        cyl = Part.makeCylinder(
            SENSOR_DIA / 2,
            WT + 2.0,               # 2 mm past inner face
            v(sx, -1.0, SENSOR_Z_CTR),
            v(0, 1, 0),             # axis along +Y
        )
        base = base.cut(cyl)

    # ── 3. GX12 connector slot – bottom face (Z = 0) ─────────────────────────
    gx_x = (W - GX12_W) / 2
    gx_y = (D - GX12_D) / 2
    gx12 = Part.makeBox(GX12_W, GX12_D, WT + 2.0)
    gx12.translate(v(gx_x, gx_y, -1.0))
    base = base.cut(gx12)

    # ── 4. USB-C cutout – right face (X = W) ─────────────────────────────────
    uc_y = (D - USBC_PORT_W) / 2
    uc_z = H / 2 - USBC_PORT_H / 2
    usbc = Part.makeBox(WT + 2.0, USBC_PORT_W, USBC_PORT_H)
    usbc.translate(v(W - WT - 1.0, uc_y, uc_z))
    base = base.cut(usbc)

    # ── 5. Interior ESP32 shelf ───────────────────────────────────────────────
    sh_x = (W - SHELF_W) / 2
    sh_y = (D - SHELF_D) / 2
    shelf = Part.makeBox(SHELF_W, SHELF_D, SHELF_T)
    shelf.translate(v(sh_x, sh_y, SHELF_Z))
    base = base.fuse(shelf)

    # ── 6. M2 screw posts (hollow) on shelf ──────────────────────────────────
    post_z0 = SHELF_Z + SHELF_T
    for px, py in [
        (sh_x + POST_INSET,          sh_y + POST_INSET),
        (sh_x + SHELF_W - POST_INSET, sh_y + POST_INSET),
        (sh_x + POST_INSET,          sh_y + SHELF_D - POST_INSET),
        (sh_x + SHELF_W - POST_INSET, sh_y + SHELF_D - POST_INSET),
    ]:
        post_outer = Part.makeCylinder(POST_OD / 2, POST_H, v(px, py, post_z0), v(0, 0, 1))
        post_bore  = Part.makeCylinder(POST_ID / 2, POST_H + 1, v(px, py, post_z0 - 0.5), v(0, 0, 1))
        base = base.fuse(post_outer.cut(post_bore))

    # ── 7. M3 corner mounting holes through base floor ────────────────────────
    for mx, my in [
        (M3_INSET,     M3_INSET),
        (W - M3_INSET, M3_INSET),
        (M3_INSET,     D - M3_INSET),
        (W - M3_INSET, D - M3_INSET),
    ]:
        hole = Part.makeCylinder(M3_DIA / 2, WT + 2.0, v(mx, my, -1.0), v(0, 0, 1))
        base = base.cut(hole)

    # ── 8. Snap-fit notches in outer walls ────────────────────────────────────
    # Notch z window: aligns with tabs on lid when lid is fully seated.
    # Lid skirt bottom is at assembly z = H - SKIRT_H = 25.
    # Tab bottom in lid frame = SNAP_TAB_Z = 1.5 → assembly z = 25 + 1.5 = 26.5
    notch_z0 = (H - SKIRT_H) + SNAP_TAB_Z
    notch_cut_depth = SNAP_TAB_D + 0.5   # epsilon past notch depth for clean boolean

    # Front wall (Y = 0): notch into outer face going +Y
    nf = Part.makeBox(SNAP_TAB_W, notch_cut_depth, SNAP_TAB_H)
    nf.translate(v((W - SNAP_TAB_W) / 2, -0.5, notch_z0))
    base = base.cut(nf)

    # Back wall (Y = D): notch into outer face going -Y
    nb = Part.makeBox(SNAP_TAB_W, notch_cut_depth, SNAP_TAB_H)
    nb.translate(v((W - SNAP_TAB_W) / 2, D - SNAP_TAB_D, notch_z0))
    base = base.cut(nb)

    # Left wall (X = 0): notch into outer face going +X
    nl = Part.makeBox(notch_cut_depth, SNAP_TAB_W, SNAP_TAB_H)
    nl.translate(v(-0.5, (D - SNAP_TAB_W) / 2, notch_z0))
    base = base.cut(nl)

    # Right wall (X = W): notch into outer face going -X
    nr = Part.makeBox(notch_cut_depth, SNAP_TAB_W, SNAP_TAB_H)
    nr.translate(v(W - SNAP_TAB_D, (D - SNAP_TAB_W) / 2, notch_z0))
    base = base.cut(nr)

    return base


# ═════════════════════════════════════════════════════════════════════════════
# LID  (modelled in lid-frame: z = 0 at skirt bottom, z = SKIRT_H+LID_T at top)
# ═════════════════════════════════════════════════════════════════════════════
def make_lid():
    """
    Lid orientation in lid-model frame:
      z = 0                    → bottom of skirt (lowest printed point)
      z = SKIRT_H              → top of skirt / bottom of plate
      z = SKIRT_H + LID_T     → top surface of plate

    Print flat: plate-face-down on build platform (no support needed for SLA).
    """

    # ── 1. Top plate ─────────────────────────────────────────────────────────
    plate = Part.makeBox(W, D, LID_T)
    plate.translate(v(0, 0, SKIRT_H))
    lid = plate

    # ── 2. Outer skirt (slides over box exterior with FIT_GAP clearance) ─────
    sk_ow = W + 2 * SKIRT_WT    # skirt outer width  = 114
    sk_od = D + 2 * SKIRT_WT    # skirt outer depth  =  84
    sk_iw = W + 2 * FIT_GAP     # skirt inner width  = 110.4
    sk_id = D + 2 * FIT_GAP     # skirt inner depth  =  80.4

    sk_outer = Part.makeBox(sk_ow, sk_od, SKIRT_H)
    sk_outer.translate(v(-SKIRT_WT, -SKIRT_WT, 0))

    sk_inner = Part.makeBox(sk_iw, sk_id, SKIRT_H + 1.0)
    sk_inner.translate(v(-FIT_GAP, -FIT_GAP, -0.5))

    skirt = sk_outer.cut(sk_inner)
    lid = lid.fuse(skirt)

    # ── 3. Snap tabs – 4 off, one per side ───────────────────────────────────
    # Each tab has two parts:
    #   • Rectangular catch block  (SNAP_TAB_D × SNAP_TAB_H) – engages notch
    #   • 45° ramp wedge on top    (SNAP_TAB_D × SNAP_RAMP_H) – guides insertion
    # Tab z window (lid frame): SNAP_TAB_Z … SNAP_TAB_Z + SNAP_TAB_H

    tab_z0   = SNAP_TAB_Z
    ramp_z0  = tab_z0 + SNAP_TAB_H    # ramp sits on top of catch

    def _tab_front():
        # Front skirt inner face is at y = -FIT_GAP in lid frame.
        # Tab protrudes +Y (toward box centre) by SNAP_TAB_D.
        catch = Part.makeBox(SNAP_TAB_W, SNAP_TAB_D, SNAP_TAB_H)
        catch.translate(v((W - SNAP_TAB_W) / 2, -FIT_GAP, tab_z0))
        # Ramp block above catch guides insertion (chamfer in slicer for best fit)
        ramp_box = Part.makeBox(SNAP_TAB_W, SNAP_TAB_D, SNAP_RAMP_H)
        ramp_box.translate(v((W - SNAP_TAB_W) / 2, -FIT_GAP, ramp_z0))
        return catch.fuse(ramp_box)

    def _tab_back():
        # Back skirt inner face at y = D + FIT_GAP, tab protrudes -Y
        catch = Part.makeBox(SNAP_TAB_W, SNAP_TAB_D, SNAP_TAB_H)
        catch.translate(v((W - SNAP_TAB_W) / 2, D + FIT_GAP - SNAP_TAB_D, tab_z0))
        ramp_box = Part.makeBox(SNAP_TAB_W, SNAP_TAB_D, SNAP_RAMP_H)
        ramp_box.translate(v((W - SNAP_TAB_W) / 2, D + FIT_GAP - SNAP_TAB_D, ramp_z0))
        return catch.fuse(ramp_box)

    def _tab_left():
        # Left skirt inner face at x = -FIT_GAP, tab protrudes +X
        catch = Part.makeBox(SNAP_TAB_D, SNAP_TAB_W, SNAP_TAB_H)
        catch.translate(v(-FIT_GAP, (D - SNAP_TAB_W) / 2, tab_z0))
        ramp_box = Part.makeBox(SNAP_TAB_D, SNAP_TAB_W, SNAP_RAMP_H)
        ramp_box.translate(v(-FIT_GAP, (D - SNAP_TAB_W) / 2, ramp_z0))
        return catch.fuse(ramp_box)

    def _tab_right():
        # Right skirt inner face at x = W + FIT_GAP, tab protrudes -X
        catch = Part.makeBox(SNAP_TAB_D, SNAP_TAB_W, SNAP_TAB_H)
        catch.translate(v(W + FIT_GAP - SNAP_TAB_D, (D - SNAP_TAB_W) / 2, tab_z0))
        ramp_box = Part.makeBox(SNAP_TAB_D, SNAP_TAB_W, SNAP_RAMP_H)
        ramp_box.translate(v(W + FIT_GAP - SNAP_TAB_D, (D - SNAP_TAB_W) / 2, ramp_z0))
        return catch.fuse(ramp_box)

    for tab in [_tab_front(), _tab_back(), _tab_left(), _tab_right()]:
        lid = lid.fuse(tab)

    return lid


# ═════════════════════════════════════════════════════════════════════════════
# EXPORT
# ═════════════════════════════════════════════════════════════════════════════
def export_stl(shape, filepath, linear_defl=0.05, angular_defl=0.3):
    mesh = MeshPart.meshFromShape(
        Shape=shape,
        LinearDeflection=linear_defl,
        AngularDeflection=angular_defl,
        Relative=False,
    )
    m = Mesh.Mesh(mesh.Facets)
    m.write(filepath)
    facets = m.CountFacets
    size_kb = os.path.getsize(filepath) // 1024
    print(f"  ✓  {os.path.basename(filepath)}  ({facets:,} facets, {size_kb} KB)")


# ═════════════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════════════
def main():
    _doc = App.newDocument("BlindAidSensorPod")

    print()
    print("BlindAid Vest – Sensor Pod CAD Generator")
    print("=" * 50)
    print(f"  Shell        : {W} × {D} × {H} mm,  wall {WT} mm")
    print(f"  Sensors      : {SENSOR_COUNT} × ⌀{SENSOR_DIA} mm,  {SENSOR_SPACING} mm pitch")
    print(f"  GX12 slot    : {GX12_W} × {GX12_D} mm  (bottom)")
    print(f"  USB-C cutout : {USBC_PORT_W} × {USBC_PORT_H} mm  (right side)")
    print(f"  ESP32 shelf  : {SHELF_W} × {SHELF_D} mm @ z={SHELF_Z} mm")
    print(f"  M2 posts     : ⌀{POST_OD}/{POST_ID} mm,  h={POST_H} mm  (×4)")
    print(f"  M3 holes     : ⌀{M3_DIA} mm  corner mounting  (×4)")
    print(f"  Snap tabs    : {SNAP_TAB_D} mm catch,  {SKIRT_H} mm skirt  (×4)")
    print()

    print("Building pod_base …")
    base = make_base()

    print("Building pod_lid  …")
    lid  = make_lid()

    base_path = os.path.join(OUTPUT_DIR, "pod_base.stl")
    lid_path  = os.path.join(OUTPUT_DIR, "pod_lid.stl")

    print("Meshing & exporting …")
    export_stl(base, base_path)
    export_stl(lid,  lid_path)

    print()
    print("Done.  Recommended print settings (Formlabs Tough 1500 Resin):")
    print("  • Layer height : 50 µm")
    print("  • Orientation  : base – open-top-up; lid – plate-face-down")
    print("  • Supports     : auto-generated in PreForm")
    print("  • Wash / cure  : per Formlabs Tough 1500 datasheet")
    print()


if __name__ == "__main__":
    main()
