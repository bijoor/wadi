"""Roof geometry derivation.

The `hip_roof` config now specifies only three primary controls:
 - `ridge_h_ft` (or `min_pitch_deg`)
 - `min_overhang_ft`
 - `trusses.positions`  (defines ridge_y_start / ridge_y_end via first/last)

Everything else — pitches on each of the 4 slopes, the four eave positions,
and `eave_z` — is derived here so the SVG generator and the Blender builder
consume identical geometry.

Constraints enforced by the derivation:
 * ridge runs N-S centred on the E-W direction (ridge_axis='y')
 * every slope's outer surface passes through `wall_top` at the wall x/y
 * all four eaves sit at the same z (`eave_z`)
 * every side's overhang ≥ `min_overhang`; the side with the shortest
   ridge-to-wall run gets exactly `min_overhang`, others get more
"""

import math


def find_hip_roof(house_config):
    """Return (hip_roof_dict, floor_number) or (None, None) if no hip_roof."""
    for floor in house_config.get('floors', []):
        for obj in floor.get('objects', []):
            if obj.get('type') == 'hip_roof':
                return obj, floor.get('floor_number', 0)
    return None, None


def compute_top_floor_wall_top_z(floor_number, global_config, beam_offset=0.0):
    """Absolute Z (world units, ground = 0) of `wall_top` — the level the
    roof frame rests on. The roof lives ON the given floor (e.g. the loft),
    so `wall_top` is the top of the walls of the floors BELOW it (slab
    thickness + wall height per floor, matching the elevation drawing
    code's convention), plus any horizontal ring beam on the roof's floor
    that lifts the frame:

        wall_top = plinth
                 + Σ(slab_thickness + floor_heights[f]  for f < floor_number)
                 + beam_offset

    Example: roof on floor 2 (loft), 8" ring beam on the loft slab →
        30 (plinth) + (8+100) (ground) + (8+90) (first) + 8 (beam) = 244.

    The loft's own floor_heights[2] is NOT added; that value is the height
    of the loft attic space and is captured by ridge_h."""
    z = global_config['plinth_height']
    slab = global_config.get('floor_slab_thickness', 0)
    for f in range(floor_number):
        z += slab
        z += global_config['floor_heights'][f]
    z += beam_offset
    return z


def derive_hip_roof_geometry(hip_roof, wall_top_z, house_trans_u, house_long_u,
                             ridge_axis='y'):
    """Given the reduced hip_roof config plus the fixed inputs (wall_top_z
    and house footprint), return a dict of derived geometry.

    The returned dict is designed to be merged into the roof config so
    downstream code that reads `eave_x_west` / `eave_y_north` / etc.
    continues to work unchanged.
    """
    if ridge_axis != 'y':
        raise ValueError(
            "derive_hip_roof_geometry currently supports ridge_axis='y' only; "
            "ridge_axis='x' can be added by transposing house_trans_u ↔ "
            "house_long_u and swapping N/S ↔ W/E.")

    trusses = hip_roof.get('trusses')
    if not trusses or not trusses.get('positions'):
        raise ValueError("hip_roof.trusses.positions is required "
                         "(at least two positions; first is N ridge endpoint, "
                         "last is S ridge endpoint)")
    positions = trusses['positions']
    if len(positions) < 2:
        raise ValueError("hip_roof.trusses.positions needs at least two entries")
    for i in range(len(positions) - 1):
        if positions[i + 1] <= positions[i]:
            raise ValueError("hip_roof.trusses.positions must be strictly "
                             "increasing")
    ridge_y_start = float(positions[0])
    ridge_y_end = float(positions[-1])
    if ridge_y_start <= 0:
        raise ValueError(f"trusses.positions[0]={ridge_y_start} must be > 0 "
                         "(south of the N wall)")
    if ridge_y_end >= house_long_u:
        raise ValueError(f"trusses.positions[-1]={ridge_y_end} must be "
                         f"< house_long_u ({house_long_u})")

    # Ridge height. Primary control is ridge_h_ft; falls back to min_pitch_deg.
    d_max = max(house_trans_u / 2.0,
                ridge_y_start,
                house_long_u - ridge_y_end)
    if 'ridge_h_ft' in hip_roof:
        if hip_roof['ridge_h_ft'] <= 0:
            raise ValueError("hip_roof.ridge_h_ft must be > 0")
        ridge_h = hip_roof['ridge_h_ft'] * 10.0
    elif 'min_pitch_deg' in hip_roof:
        mp = float(hip_roof['min_pitch_deg'])
        if not (0 < mp < 90):
            raise ValueError("hip_roof.min_pitch_deg must be in (0, 90)")
        ridge_h = d_max * math.tan(math.radians(mp))
    else:
        raise ValueError(
            "hip_roof must specify one of 'ridge_h_ft' or 'min_pitch_deg'")

    min_ov = float(hip_roof.get('min_overhang_ft', 0)) * 10.0
    if min_ov <= 0:
        raise ValueError("hip_roof.min_overhang_ft must be > 0")

    # Critical side — smallest run gets exactly min_overhang; others grow.
    d_crit = min(house_trans_u / 2.0,
                 ridge_y_start,
                 house_long_u - ridge_y_end)

    pitch_ew = math.degrees(math.atan(ridge_h / (house_trans_u / 2.0)))
    pitch_n = math.degrees(math.atan(ridge_h / ridge_y_start))
    pitch_s = math.degrees(math.atan(ridge_h / (house_long_u - ridge_y_end)))

    eave_drop = min_ov * ridge_h / d_crit
    eave_z = wall_top_z - eave_drop

    O_ew = min_ov * (house_trans_u / 2.0) / d_crit
    O_n = min_ov * ridge_y_start / d_crit
    O_s = min_ov * (house_long_u - ridge_y_end) / d_crit

    return {
        # Explicit coordinates the downstream code (SVG + Blender) expects.
        'eave_x_west':      0 - O_ew,
        'eave_x_east':      house_trans_u + O_ew,
        'eave_y_north':     0 - O_n,
        'eave_y_south':     house_long_u + O_s,
        'eave_z':           eave_z,
        # Ridge geometry — endpoints and height above wall_top.
        'ridge_y_start':    ridge_y_start,
        'ridge_y_end':      ridge_y_end,
        'ridge_h':          ridge_h,
        'ridge_axis':       ridge_axis,
        # Individual slope pitches (E/W symmetric; N and S may differ).
        'slope_angle_ew':   pitch_ew,
        'slope_angle_ns':   pitch_n,       # legacy single-value key
        'slope_angle_ns_n': pitch_n,
        'slope_angle_ns_s': pitch_s,
        # Derived reporting values (drawings & BOM annotate these).
        'wall_top_above_eave':    eave_drop,        # world units
        'wall_top_above_eave_ft': eave_drop / 10.0,
        'overhang_ew_ft':   O_ew / 10.0,
        'overhang_n_ft':    O_n / 10.0,
        'overhang_s_ft':    O_s / 10.0,
        'd_crit':           d_crit,
    }


def derive_for_house(house_config, global_config):
    """Convenience: find the hip_roof in `house_config`, compute wall_top_z
    from `global_config` floor_heights, and return the derived geometry
    dict. Returns None if no hip_roof is present."""
    hip_roof, floor_num = find_hip_roof(house_config)
    if hip_roof is None:
        return None
    framing = hip_roof.get('framing', {})
    house_ft = framing.get('house_footprint_ft', [27.0, 45.0])
    house_trans_u = house_ft[0] * 10.0
    house_long_u = house_ft[1] * 10.0
    # Beam under the roof frame — value in feet on the roof config; if
    # absent, fall back to the global wall_thickness (matches the beam
    # thickness used by create_beam).
    if 'beam_offset_ft' in hip_roof:
        beam_offset_u = hip_roof['beam_offset_ft'] * 10.0
    else:
        beam_offset_u = float(global_config.get('wall_thickness', 8))
    wall_top_z = compute_top_floor_wall_top_z(
        floor_num, global_config, beam_offset=beam_offset_u)
    return derive_hip_roof_geometry(
        hip_roof, wall_top_z, house_trans_u, house_long_u,
        ridge_axis=hip_roof.get('ridge_axis', 'y'))
