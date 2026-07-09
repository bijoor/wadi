"""Compute the metal-frame member list for the hip roof.

Given `house_config + global_config`, `compute_frame_members` returns a
list of member dicts that the Blender-side `create_roof_frame_3d`
(in `blender_3d.py`) turns into rectangular boxes.

Each member dict has:
    'kind':       str  — member type (`ring_beam`, `truss_top_chord`, `rafter`, …)
    'name':       str  — unique per-member identifier for Blender naming
    'p0':         (x,y,z)  — one endpoint, raw world units (ground z=0)
    'p1':         (x,y,z)  — other endpoint, raw world units
    'section_in': [w_in, d_in]  — HSS cross-section
    'wall_mm':    float  — HSS wall thickness (used only for BOM)

All positions use the same convention as `roof_geometry.derive_hip_roof_geometry`
(absolute world Z from ground = 0). The Blender caller is responsible for
handling the ×10 z-scaling and exploded-view lift.
"""

import math
from roof_geometry import (
    derive_hip_roof_geometry,
    compute_top_floor_wall_top_z,
    find_hip_roof,
)


IN_PER_UNIT = 12.0 / 10.0    # 10 units = 1 ft = 12 in


def compute_frame_members(house_config, global_config):
    hip_roof, floor_num = find_hip_roof(house_config)
    if hip_roof is None:
        return []

    framing = hip_roof.get('framing', {})
    house_ft = framing.get('house_footprint_ft', [27.0, 45.0])
    house_trans_u = house_ft[0] * 10.0
    house_long_u = house_ft[1] * 10.0

    if 'beam_offset_ft' in hip_roof:
        beam_off = hip_roof['beam_offset_ft'] * 10.0
    else:
        beam_off = float(global_config.get('wall_thickness', 8))
    wall_top_z = compute_top_floor_wall_top_z(
        floor_num, global_config, beam_offset=beam_off)

    d = derive_hip_roof_geometry(
        hip_roof, wall_top_z, house_trans_u, house_long_u,
        ridge_axis=hip_roof.get('ridge_axis', 'y'))

    # ---- Aliases ----
    eave_xw, eave_xe = d['eave_x_west'], d['eave_x_east']
    eave_yn, eave_ys = d['eave_y_north'], d['eave_y_south']
    eave_z = d['eave_z']
    ridge_z = wall_top_z + d['ridge_h']
    ridge_y_start, ridge_y_end = d['ridge_y_start'], d['ridge_y_end']
    ridge_x = (eave_xw + eave_xe) / 2.0
    span_x, span_y = eave_xe - eave_xw, eave_ys - eave_yn

    # Wall inset — asymmetric N/S, symmetric W/E
    wall_inset_long_n = -eave_yn                 # house wall at y=0
    wall_inset_long_s = eave_ys - house_long_u
    wall_inset_trans = (span_x - house_trans_u) / 2.0

    # Ring beam corners
    rb_xw = eave_xw + wall_inset_trans
    rb_xe = eave_xe - wall_inset_trans
    rb_yn = eave_yn + wall_inset_long_n
    rb_ys = eave_ys - wall_inset_long_s

    # ---- Framing sections ----
    rafter_size_in = framing.get('rafter_size_in', [2, 4])
    rafter_wall_mm = framing.get('rafter_wall_mm', 2)
    rafter_spacing_in = framing.get('rafter_spacing_in', 36)
    purlin_size_in = framing.get('purlin_size_in', [2, 1])
    purlin_wall_mm = framing.get('purlin_wall_mm', 1.6)
    purlin_spacing_in = framing.get('purlin_spacing_in', 12)
    ridge_size_in = framing.get('ridge_size_in', [6, 3])
    ridge_wall_mm = framing.get('ridge_wall_mm', 2)
    ring_beam_cfg = framing.get('ring_beam', {})
    ring_beam_size = ring_beam_cfg.get('size_in', [4, 2])
    ring_beam_wall = ring_beam_cfg.get('wall_mm', 3)
    hip_beam_cfg = framing.get('hip_end_beam', {})
    hip_beam_count_per_end = int(hip_beam_cfg.get('count_per_end', 3))
    hip_beam_size = hip_beam_cfg.get('size_in', [4, 2])
    hip_beam_wall = hip_beam_cfg.get('wall_mm', 2)
    hip_beam_between_trusses = bool(
        hip_beam_cfg.get('extend_between_trusses', False))

    ridge_depth_u = ridge_size_in[1] / IN_PER_UNIT
    truss_peak_z = ridge_z - ridge_depth_u

    trusses = hip_roof.get('trusses', {})
    truss_positions = trusses.get('positions', [])
    truss_chord_size = trusses.get('chord_size_in', [2, 4])
    truss_chord_wall = trusses.get('chord_wall_mm', 3)
    truss_web_size = trusses.get('web_size_in', [2, 2])
    truss_web_wall = trusses.get('web_wall_mm', 2)

    rafter_spacing_u = rafter_spacing_in / IN_PER_UNIT
    purlin_spacing_u = purlin_spacing_in / IN_PER_UNIT

    # Ridge endpoints (physical top of ridge)
    R1 = (ridge_x, ridge_y_start, ridge_z)
    R2 = (ridge_x, ridge_y_end, ridge_z)
    NW = (eave_xw, eave_yn, eave_z)
    NE = (eave_xe, eave_yn, eave_z)
    SE = (eave_xe, eave_ys, eave_z)
    SW = (eave_xw, eave_ys, eave_z)

    members = []

    # ===== RING BEAM (4 edges) =====
    for name, p0, p1 in [
        ('ring_beam_N', (rb_xw, rb_yn, wall_top_z), (rb_xe, rb_yn, wall_top_z)),
        ('ring_beam_S', (rb_xw, rb_ys, wall_top_z), (rb_xe, rb_ys, wall_top_z)),
        ('ring_beam_W', (rb_xw, rb_yn, wall_top_z), (rb_xw, rb_ys, wall_top_z)),
        ('ring_beam_E', (rb_xe, rb_yn, wall_top_z), (rb_xe, rb_ys, wall_top_z)),
    ]:
        members.append({'kind': 'ring_beam', 'name': name,
                        'p0': p0, 'p1': p1,
                        'section_in': ring_beam_size, 'wall_mm': ring_beam_wall})

    # ===== CENTRAL RIDGE =====
    members.append({'kind': 'central_ridge', 'name': 'central_ridge',
                    'p0': R1, 'p1': R2,
                    'section_in': ridge_size_in, 'wall_mm': ridge_wall_mm})

    # ===== 4 HIP RIDGES =====
    for name, p1 in [('hip_ridge_NW', NW), ('hip_ridge_NE', NE)]:
        members.append({'kind': 'hip_ridge', 'name': name,
                        'p0': R1, 'p1': p1,
                        'section_in': ridge_size_in, 'wall_mm': ridge_wall_mm})
    for name, p1 in [('hip_ridge_SE', SE), ('hip_ridge_SW', SW)]:
        members.append({'kind': 'hip_ridge', 'name': name,
                        'p0': R2, 'p1': p1,
                        'section_in': ridge_size_in, 'wall_mm': ridge_wall_mm})

    # ===== HIP-END BEAMS (3 at each end + optional 3 per truss gap) =====
    if len(truss_positions) >= 2:
        for i in range(hip_beam_count_per_end):
            frac = (i + 1) / (hip_beam_count_per_end + 1)
            bx = rb_xw + frac * (rb_xe - rb_xw)
            members.append({'kind': 'hip_end_beam', 'name': f'hip_end_N_{i}',
                            'p0': (bx, truss_positions[0], wall_top_z),
                            'p1': (bx, rb_yn, wall_top_z),
                            'section_in': hip_beam_size, 'wall_mm': hip_beam_wall})
            members.append({'kind': 'hip_end_beam', 'name': f'hip_end_S_{i}',
                            'p0': (bx, truss_positions[-1], wall_top_z),
                            'p1': (bx, rb_ys, wall_top_z),
                            'section_in': hip_beam_size, 'wall_mm': hip_beam_wall})
            # Continue the same 3 longitudinal beams through the ridge zone
            # between adjacent trusses (T1↔T2, T2↔T3, …) so the transverse
            # bracing is unbroken from N wall to S wall.
            if hip_beam_between_trusses:
                for j in range(len(truss_positions) - 1):
                    y0 = truss_positions[j]
                    y1 = truss_positions[j + 1]
                    members.append({'kind': 'hip_end_beam',
                                    'name': f'hip_bay_{j}_{i}',
                                    'p0': (bx, y0, wall_top_z),
                                    'p1': (bx, y1, wall_top_z),
                                    'section_in': hip_beam_size,
                                    'wall_mm': hip_beam_wall})

    # ===== FINK TRUSSES (bottom chord on ring beam, peak at ridge-beam-bottom) =====
    for ti, ty in enumerate(truss_positions):
        tname = f'T{ti + 1}'
        # Bottom chord panel points
        B0 = (rb_xw,                            ty, wall_top_z)
        B1 = (rb_xw + 0.25 * (rb_xe - rb_xw),   ty, wall_top_z)
        B2 = (ridge_x,                          ty, wall_top_z)
        B3 = (rb_xw + 0.75 * (rb_xe - rb_xw),   ty, wall_top_z)
        B4 = (rb_xe,                            ty, wall_top_z)
        Tpk = (ridge_x, ty, truss_peak_z)
        T1m = (rb_xw + 0.25 * (rb_xe - rb_xw), ty, (wall_top_z + truss_peak_z) / 2)
        T3m = (rb_xw + 0.75 * (rb_xe - rb_xw), ty, (wall_top_z + truss_peak_z) / 2)

        # Chords
        members.append({'kind': 'truss_bottom_chord', 'name': f'{tname}_bottom_chord',
                        'p0': B0, 'p1': B4,
                        'section_in': truss_chord_size, 'wall_mm': truss_chord_wall})
        members.append({'kind': 'truss_top_chord', 'name': f'{tname}_top_chord_L',
                        'p0': B0, 'p1': Tpk,
                        'section_in': truss_chord_size, 'wall_mm': truss_chord_wall})
        members.append({'kind': 'truss_top_chord', 'name': f'{tname}_top_chord_R',
                        'p0': Tpk, 'p1': B4,
                        'section_in': truss_chord_size, 'wall_mm': truss_chord_wall})
        # King post
        members.append({'kind': 'truss_king_post', 'name': f'{tname}_king_post',
                        'p0': Tpk, 'p1': B2,
                        'section_in': truss_web_size, 'wall_mm': truss_web_wall})
        # Diagonals
        members.append({'kind': 'truss_diagonal', 'name': f'{tname}_diag_L',
                        'p0': Tpk, 'p1': B1,
                        'section_in': truss_web_size, 'wall_mm': truss_web_wall})
        members.append({'kind': 'truss_diagonal', 'name': f'{tname}_diag_R',
                        'p0': Tpk, 'p1': B3,
                        'section_in': truss_web_size, 'wall_mm': truss_web_wall})
        # Verticals
        members.append({'kind': 'truss_vertical', 'name': f'{tname}_vert_L',
                        'p0': T1m, 'p1': B1,
                        'section_in': truss_web_size, 'wall_mm': truss_web_wall})
        members.append({'kind': 'truss_vertical', 'name': f'{tname}_vert_R',
                        'p0': T3m, 'p1': B3,
                        'section_in': truss_web_size, 'wall_mm': truss_web_wall})

    # ===== RAFTERS =====
    # Main W/E slopes: rafter at each Y position, from eave (at eave_xw/xe) up
    # to the appropriate ridge point.
    def _upper_on_ridge_for_main_slope(y_pos, is_east):
        """Given a Y along span_y on the W (or E) main slope, return the
        3-D point where a rafter at that Y terminates (central ridge if in
        the ridge zone, otherwise on the corresponding hip ridge)."""
        eave_x = eave_xe if is_east else eave_xw
        if ridge_y_start <= y_pos <= ridge_y_end:
            return (ridge_x, y_pos, ridge_z)
        # In a hip zone: parametric position on the corresponding hip ridge
        if y_pos < ridge_y_start:
            frac = (y_pos - eave_yn) / (ridge_y_start - eave_yn)
        else:
            frac = (eave_ys - y_pos) / (eave_ys - ridge_y_end)
        x_upper = eave_x + frac * (ridge_x - eave_x)
        z_upper = eave_z + frac * (ridge_z - eave_z)
        return (x_upper, y_pos, z_upper)

    def _add_main_slope_rafters(is_east):
        n_r = int(span_y / rafter_spacing_u) + 1
        gap = span_y - (n_r - 1) * rafter_spacing_u
        first_off = gap / 2.0 if gap > 0 else 0.0
        eave_x = eave_xe if is_east else eave_xw
        side = 'E' if is_east else 'W'
        for i in range(n_r):
            y = eave_yn + first_off + i * rafter_spacing_u
            eave_pt = (eave_x, y, eave_z)
            upper_pt = _upper_on_ridge_for_main_slope(y, is_east)
            members.append({'kind': 'rafter', 'name': f'rafter_{side}_{i:02d}',
                            'p0': eave_pt, 'p1': upper_pt,
                            'section_in': rafter_size_in, 'wall_mm': rafter_wall_mm})

    _add_main_slope_rafters(is_east=False)
    _add_main_slope_rafters(is_east=True)

    # Hip-end N/S slopes: rafter at each X position, from eave up along the
    # hip end triangular surface toward R1 (N) or R2 (S).
    def _add_hip_end_rafters(is_south):
        n_r = int(span_x / rafter_spacing_u) + 1
        gap = span_x - (n_r - 1) * rafter_spacing_u
        first_off = gap / 2.0 if gap > 0 else 0.0
        eave_y = eave_ys if is_south else eave_yn
        R_target = R2 if is_south else R1
        end = 'S' if is_south else 'N'
        for i in range(n_r):
            x = eave_xw + first_off + i * rafter_spacing_u
            eave_pt = (x, eave_y, eave_z)
            # Upper end on the appropriate hip ridge (W or E) at parametric frac
            if x < ridge_x:
                frac = (x - eave_xw) / (ridge_x - eave_xw)
                x_upper = eave_xw + frac * (ridge_x - eave_xw)
                y_upper = eave_y + frac * (R_target[1] - eave_y)
                z_upper = eave_z + frac * (ridge_z - eave_z)
            elif x > ridge_x:
                frac = (eave_xe - x) / (eave_xe - ridge_x)
                x_upper = eave_xe - frac * (eave_xe - ridge_x)
                y_upper = eave_y + frac * (R_target[1] - eave_y)
                z_upper = eave_z + frac * (ridge_z - eave_z)
            else:
                x_upper, y_upper, z_upper = R_target
            members.append({'kind': 'rafter', 'name': f'rafter_{end}_{i:02d}',
                            'p0': eave_pt, 'p1': (x_upper, y_upper, z_upper),
                            'section_in': rafter_size_in, 'wall_mm': rafter_wall_mm})

    _add_hip_end_rafters(is_south=False)
    _add_hip_end_rafters(is_south=True)

    # ===== PURLINS =====
    # A purlin at slope-distance k*purlin_spacing_u above the eave sits at
    # vertical height = k * purlin_spacing_u * sin(pitch).
    # For each slope, we compute the purlin count from its perp_h (slope
    # distance from eave to ridge), then place a purlin at each height.
    def _slope_horiz_run(pitch_deg):
        """Given a pitch, how much horizontal distance corresponds to
        one purlin step along the slope?"""
        return purlin_spacing_u * math.cos(math.radians(pitch_deg))

    def _slope_vert_rise(pitch_deg):
        return purlin_spacing_u * math.sin(math.radians(pitch_deg))

    # W and E main slope purlins — parallel to ridge (Y direction).
    pitch_ew = d['slope_angle_ew']
    step_horiz_ew = _slope_horiz_run(pitch_ew)
    step_vert_ew = _slope_vert_rise(pitch_ew)
    if step_horiz_ew > 0:
        # Purlins spaced along the slope (from eave upward). We include
        # only those that fit within the horizontal half-span
        # (from eave_x to ridge_x on each side).
        half_x = (eave_xe - eave_xw) / 2.0
        n_p_main = int(half_x / step_horiz_ew)
        for i in range(1, n_p_main + 1):
            dx = i * step_horiz_ew
            z_here = eave_z + i * step_vert_ew
            # W-slope purlin: x = eave_xw + dx
            x_w = eave_xw + dx
            # Y range at this height depends on whether we're above the
            # ridge zone (constrained by hip ridges) or in the ridge zone.
            # At height z_here (fraction f = z_here-eave_z / (ridge_z-eave_z)),
            # the hip inset from each end = f * d_hip_n or d_hip_s.
            f = (z_here - eave_z) / (ridge_z - eave_z) if ridge_z != eave_z else 1.0
            d_hip_n = ridge_y_start - eave_yn
            d_hip_s = eave_ys - ridge_y_end
            y_lo = eave_yn + f * d_hip_n
            y_hi = eave_ys - f * d_hip_s
            if y_hi > y_lo:
                members.append({'kind': 'purlin', 'name': f'purlin_W_{i:02d}',
                                'p0': (x_w, y_lo, z_here),
                                'p1': (x_w, y_hi, z_here),
                                'section_in': purlin_size_in,
                                'wall_mm': purlin_wall_mm})
                # E-slope mirror
                x_e = eave_xe - dx
                members.append({'kind': 'purlin', 'name': f'purlin_E_{i:02d}',
                                'p0': (x_e, y_lo, z_here),
                                'p1': (x_e, y_hi, z_here),
                                'section_in': purlin_size_in,
                                'wall_mm': purlin_wall_mm})

    # N and S hip-end purlins — parallel to their eave, in the X direction.
    # (Two independent pitches — N and S differ on an asymmetric roof.)
    for is_south, pitch_hip in [(False, d['slope_angle_ns_n']),
                                 (True, d['slope_angle_ns_s'])]:
        step_horiz = _slope_horiz_run(pitch_hip)
        step_vert = _slope_vert_rise(pitch_hip)
        if step_horiz <= 0:
            continue
        d_hip = (ridge_y_start - eave_yn) if not is_south else (eave_ys - ridge_y_end)
        n_p_hip = int(d_hip / step_horiz)
        eave_y = eave_ys if is_south else eave_yn
        end = 'S' if is_south else 'N'
        for i in range(1, n_p_hip + 1):
            dy = i * step_horiz
            z_here = eave_z + i * step_vert
            y_here = eave_y + dy if not is_south else eave_y - dy
            # X range at this height on the hip triangle
            # At height z_here (frac f), width narrows to zero at apex.
            # For a hip end triangle: as f goes 0→1, width goes span_x → 0.
            f = (z_here - eave_z) / (ridge_z - eave_z) if ridge_z != eave_z else 1.0
            half_narrow = (span_x / 2.0) * (1 - f)
            x_lo = ridge_x - half_narrow
            x_hi = ridge_x + half_narrow
            if x_hi > x_lo:
                members.append({'kind': 'purlin', 'name': f'purlin_{end}_{i:02d}',
                                'p0': (x_lo, y_here, z_here),
                                'p1': (x_hi, y_here, z_here),
                                'section_in': purlin_size_in,
                                'wall_mm': purlin_wall_mm})

    # ===== PANI PATTI (4 upright GI strips along the eave perimeter) =====
    # Folded GI water-protector strip that hangs off the rafter ends. Face
    # is vertical, `height_in` tall. `axis_aligned` tells the Blender
    # builder to skip the direction-following box rotation and place an
    # axis-aligned box instead.
    pp_cfg = framing.get('pani_patti', {})
    if pp_cfg:
        pp_h_in = float(pp_cfg.get('height_in', 6.0))
        pp_thk_mm = float(pp_cfg.get('thickness_mm', 1.2))
        pp_h_u = pp_h_in / IN_PER_UNIT                # vertical height
        pp_thk_u = (pp_thk_mm / 25.4) / IN_PER_UNIT    # through-wall thickness
        pp_center_z = eave_z + pp_h_u / 2.0            # bottom sits at eave_z
        # Section is [thickness_in, height_in] — the Blender builder
        # interprets this as [through-wall, vertical] for axis-aligned
        # members.
        pp_section = [pp_thk_mm / 25.4, pp_h_in]

        # N and S — run E-W along the eave
        members.append({'kind': 'pani_patti', 'name': 'pani_patti_N',
                        'p0': (eave_xw, eave_yn, pp_center_z),
                        'p1': (eave_xe, eave_yn, pp_center_z),
                        'section_in': pp_section,
                        'wall_mm': pp_thk_mm,
                        'axis_aligned': True,
                        'height_u': pp_h_u,
                        'thickness_u': pp_thk_u})
        members.append({'kind': 'pani_patti', 'name': 'pani_patti_S',
                        'p0': (eave_xw, eave_ys, pp_center_z),
                        'p1': (eave_xe, eave_ys, pp_center_z),
                        'section_in': pp_section,
                        'wall_mm': pp_thk_mm,
                        'axis_aligned': True,
                        'height_u': pp_h_u,
                        'thickness_u': pp_thk_u})
        # W and E — run N-S along the eave
        members.append({'kind': 'pani_patti', 'name': 'pani_patti_W',
                        'p0': (eave_xw, eave_yn, pp_center_z),
                        'p1': (eave_xw, eave_ys, pp_center_z),
                        'section_in': pp_section,
                        'wall_mm': pp_thk_mm,
                        'axis_aligned': True,
                        'height_u': pp_h_u,
                        'thickness_u': pp_thk_u})
        members.append({'kind': 'pani_patti', 'name': 'pani_patti_E',
                        'p0': (eave_xe, eave_yn, pp_center_z),
                        'p1': (eave_xe, eave_ys, pp_center_z),
                        'section_in': pp_section,
                        'wall_mm': pp_thk_mm,
                        'axis_aligned': True,
                        'height_u': pp_h_u,
                        'thickness_u': pp_thk_u})

    return members
