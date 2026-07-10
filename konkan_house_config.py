"""
Konkan House Configuration and Builder
Edit this file to change the house design

All coordinates are in feet (Inkscape-style: origin top-left, X right, Y down)
"""

import sys
import os
import importlib

# Add the directory containing this script to the path
# This allows importing konkan_house_lib.py from the same folder
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

# Force reload all modules to ensure we're using the latest code
# Order matters: reload dependencies first
import config
import svg_2d
import blender_3d
import konkan_house_lib
import house_config

importlib.reload(config)
importlib.reload(svg_2d)
importlib.reload(blender_3d)
importlib.reload(konkan_house_lib)
importlib.reload(house_config)

# Now import from the reloaded modules
from konkan_house_lib import *
from house_config import HOUSE_CONFIG, GLOBAL_CONFIG

# ============================================================================
# BUILD FUNCTIONS
# ============================================================================

def build_ground():
    """Build a large flat ground plane so the model doesn't look like it
    is hanging in mid-air. Sized ~2× the plot dimensions and centred on
    the plinth."""
    _before = _snapshot_object_names()
    site = HOUSE_CONFIG.get('site', {})
    plinth = HOUSE_CONFIG['plinth']
    # Base dimensions from the plot; fall back to the plinth footprint.
    plot_w = float(site.get('plot_width', plinth['width']))
    plot_l = float(site.get('plot_length', plinth['length']))
    # 2× the plot each way, giving a comfortable border around the house.
    ground_w = plot_w * 2.0
    ground_l = plot_l * 2.0
    center_x = plinth['x'] + plinth['width'] / 2.0
    center_y = plinth['y'] + plinth['length'] / 2.0
    create_ground_plane(center_x, center_y, ground_w, ground_l,
                        thickness=1.0, material_name='ground')
    _tag_new_objects(_before, 'ground')


def build_plinth():
    """Build the foundation plinth"""
    _before = _snapshot_object_names()
    config = HOUSE_CONFIG['plinth']
    create_plinth(
        x=config['x'],
        y=config['y'],
        width=config['width'],
        length=config['length'],
        height=config.get('height'),
        material_name='plinth'
    )
    _tag_new_objects(_before, 'plinth')

def _tag_new_objects(before_names: set, layer: str):
    """Set a `layer` custom property on every Blender mesh created since
    `before_names` was captured. The custom property flows through to the
    glTF `extras` field on export and is exposed to three.js as
    `object.userData.layer`, so the web viewer can group objects by layer
    without inspecting Z coordinates."""
    import bpy as _bpy
    for _o in _bpy.data.objects:
        if _o.type != 'MESH':
            continue
        if _o.name in before_names:
            continue
        # Frame members and hip roof are tagged more specifically at their
        # own creation sites — don't overwrite those.
        if 'layer' in _o.keys():
            continue
        _o['layer'] = layer


def _snapshot_object_names():
    """Snapshot of current mesh object names — used together with
    `_tag_new_objects` to attribute new objects to a build phase."""
    import bpy as _bpy
    return {o.name for o in _bpy.data.objects if o.type == 'MESH'}


def _resolve_layer(obj: dict, floor_num: int) -> str:
    """Return the fine-grained sub-layer name for a single config
    object. Pillars are lifted out of their floor (users often want to
    isolate the column layout), beams on the first floor split into two
    buckets — structural beams under the slab vs. ring beams sitting on
    top of the walls (identified by a positive `z_offset_ft`), and the
    remaining objects follow their floor number."""
    obj_type = obj.get('type')
    if obj_type == 'pillar':
        return 'pillars'
    if floor_num == 0:
        # The ground floor slab sits on top of the plinth and belongs
        # visually with it — group it into the plinth layer so hiding
        # "Plinth" also hides the slab that caps it.
        if obj_type == 'floor_slab':
            return 'plinth'
        return 'f0'
    if floor_num == 1:
        if obj_type == 'beam':
            return 'f1_beam' if float(obj.get('z_offset_ft', 0.0)) > 0 else 'f1_slab'
        if obj_type == 'floor_slab':
            return 'f1_slab'
        return 'f1'
    # Floor 2 (loft). Roof shell + frame handlers set their own tags
    # inside their creation sites, and the helper below skips objects
    # that already have one.
    return 'loft'


def build_floor(floor_config: dict):
    """Build a single floor with all its objects using unified structure"""
    floor_num = floor_config['floor_number']
    _floor_before = _snapshot_object_names()

    # Support both old and new config formats
    if 'objects' in floor_config:
        # New unified object-based structure
        for obj in floor_config['objects']:
            obj_type = obj.get('type')
            # Snapshot before each config object so we can attribute the
            # freshly created Blender meshes to a fine-grained sub-layer.
            _obj_before = _snapshot_object_names()

            if obj_type == 'floor_slab':
                create_floor_slab(
                    x=obj['x'],
                    y=obj['y'],
                    width=obj['width'],
                    length=obj['length'],
                    floor_number=floor_num,
                    thickness=obj.get('thickness'),
                    material_name=obj.get('material', 'floor'),
                    name=obj.get('name')
                )

            elif obj_type == 'beam':
                create_beam(
                    x=obj['x'],
                    y=obj['y'],
                    width=obj['width'],
                    length=obj['length'],
                    floor_number=floor_num,
                    thickness=obj.get('thickness'),
                    z_offset_ft=obj.get('z_offset_ft', 0.0),
                    material_name=obj.get('material', 'beam'),
                    name=obj.get('name')
                )

            elif obj_type == 'room':
                create_room(
                    name=obj['name'],
                    x=obj['x'],
                    y=obj['y'],
                    width=obj['width'],
                    length=obj['length'],
                    floor_number=floor_num,
                    height=obj.get('height'),
                    wall_thickness=obj.get('wall_thickness'),
                    material_name=obj.get('material', 'walls'),
                    walls=obj.get('walls'),  # Optional list of which walls to create
                    wall_heights=obj.get('wall_heights')  # Optional dict of individual wall heights
                )

            elif obj_type == 'wall':
                create_wall(
                    start_x=obj['start_x'],
                    start_y=obj['start_y'],
                    end_x=obj['end_x'],
                    end_y=obj['end_y'],
                    floor_number=floor_num,
                    height=obj.get('height'),
                    height_end=obj.get('height_end'),  # For sloping walls
                    thickness=obj.get('thickness'),
                    name=obj.get('name', 'Wall'),
                    material_name=obj.get('material', 'walls')
                )

            elif obj_type == 'staircase':
                create_staircase(
                    start_x=obj['start_x'],
                    start_y=obj['start_y'],
                    direction=obj['direction'],
                    num_steps=obj['num_steps'],
                    step_width=obj['step_width'],
                    step_tread=obj['step_tread'],
                    step_rise=obj['step_rise'],
                    floor_number=floor_num,
                    material_name=obj.get('material', 'floor')
                )

            elif obj_type == 'pillar':
                create_pillar(
                    x=obj['x'],
                    y=obj['y'],
                    floor_number=floor_num,
                    height=obj.get('height'),
                    size=obj.get('size'),
                    width=obj.get('width'),
                    length=obj.get('length'),
                    name=obj.get('name'),
                    material_name=obj.get('material', 'floor')
                )

            elif obj_type == 'door':
                # Construct wall name from room + direction (e.g., "Verandah_North")
                direction = obj.get('direction', 'north')
                room = obj.get('room')
                wall_name = f"{room}_{direction.capitalize()}" if room else obj.get('wall')

                create_door(
                    x=obj['x'],
                    y=obj['y'],
                    width=obj['width'],
                    height=obj['height'],
                    floor_number=floor_num,
                    direction=direction,
                    wall_name=wall_name,
                    name=obj.get('name'),
                    material_name=obj.get('material', 'walls')
                )

            elif obj_type == 'window':
                # Construct wall name from room + direction (e.g., "Verandah_North")
                direction = obj.get('direction', 'north')
                room = obj.get('room')
                wall_name = f"{room}_{direction.capitalize()}" if room else obj.get('wall')

                create_window(
                    x=obj['x'],
                    y=obj['y'],
                    width=obj['width'],
                    height=obj['height'],
                    floor_number=floor_num,
                    sill_height=obj.get('sill_height'),
                    direction=direction,
                    wall_name=wall_name,
                    name=obj.get('name'),
                    material_name=obj.get('material', 'walls')
                )

            elif obj_type == 'gable_roof':
                create_gable_roof(
                    ridge_start_x=obj['ridge_start_x'],
                    ridge_start_y=obj['ridge_start_y'],
                    ridge_z=obj['ridge_z'],
                    ridge_length=obj['ridge_length'],
                    left_slope_angle=obj['left_slope_angle'],
                    left_slope_length=obj['left_slope_length'],
                    right_slope_angle=obj['right_slope_angle'],
                    right_slope_length=obj['right_slope_length'],
                    material_name=obj.get('material', 'roof'),
                    floor_number=floor_num,
                    ridge_axis=obj.get('ridge_axis', 'x'),
                    explosion_offset=obj.get('explosion_offset', 0.0),
                )

            elif obj_type == 'hip_roof':
                # Reduced config schema: derive eave positions, eave_z,
                # slopes, ridge_h from ridge_h_ft + min_overhang_ft +
                # trusses.positions before handing to the Blender builder.
                from roof_geometry import (
                    derive_hip_roof_geometry, compute_top_floor_wall_top_z,
                )
                _framing = obj.get('framing', {})
                _house_ft = _framing.get('house_footprint_ft', [27.0, 45.0])
                if 'beam_offset_ft' in obj:
                    _beam_off = obj['beam_offset_ft'] * 10.0
                else:
                    _beam_off = float(GLOBAL_CONFIG.get('wall_thickness', 8))
                _wall_top_z = compute_top_floor_wall_top_z(
                    floor_num, GLOBAL_CONFIG, beam_offset=_beam_off)
                _derived = derive_hip_roof_geometry(
                    obj, _wall_top_z,
                    _house_ft[0] * 10.0, _house_ft[1] * 10.0,
                    ridge_axis=obj.get('ridge_axis', 'y'))
                # Express eave_z RELATIVE to the loft-slab bottom (the
                # anchor `create_hip_roof` uses when it adds floor_z_offset
                # from get_floor_z_offset). That way create_hip_roof handles
                # the ×10 scaling AND the exploded-view floor shift itself,
                # matching what create_beam/create_wall do — so the roof
                # sits at the same Blender scale as the beams below it.
                from roof_geometry import compute_top_floor_wall_top_z
                # Loft-slab bottom (raw units, non-exploded) = plinth +
                # Σ(slab + wall for floors below roof's floor). This matches
                # what `create_hip_roof` reads via get_floor_z_offset — we
                # subtract it out of the absolute eave_z so create_hip_roof
                # can add its own (possibly exploded) floor_z_offset back.
                _loft_slab_bottom_raw = compute_top_floor_wall_top_z(
                    floor_num, GLOBAL_CONFIG, beam_offset=0.0)
                _eave_rel_to_loft = _derived['eave_z'] - _loft_slab_bottom_raw
                _shell = create_hip_roof(
                    eave_x_west=_derived['eave_x_west'],
                    eave_x_east=_derived['eave_x_east'],
                    eave_y_north=_derived['eave_y_north'],
                    eave_y_south=_derived['eave_y_south'],
                    eave_z=_eave_rel_to_loft,
                    slope_angle_ns=_derived['slope_angle_ns_n'],   # Blender only
                    slope_angle_ew=_derived['slope_angle_ew'],     # supports one
                    ridge_y_start=_derived['ridge_y_start'],
                    ridge_y_end=_derived['ridge_y_end'],
                    ridge_axis=obj.get('ridge_axis', 'y'),
                    material_name=obj.get('material', 'roof'),
                    floor_number=floor_num,
                    explosion_offset=obj.get('explosion_offset', 0.0),
                )
                # Tag the roof shell as the 'loft' layer so the web
                # viewer can toggle it independently of the floors below.
                if _shell is not None:
                    _shell['layer'] = 'loft'

                # ---- Build the metal frame as individual box members ----
                if obj.get('show_frame_3d', False):
                    from roof_frame import compute_frame_members
                    _members = compute_frame_members(HOUSE_CONFIG, GLOBAL_CONFIG)
                    # In exploded view the frame inherits the cumulative
                    # explosion factors of the floors below it, then adds
                    # its OWN frame_explosion_offset (independent from the
                    # roof-shell's own explosion_offset).
                    _frame_lift = 0.0
                    if GLOBAL_CONFIG.get('use_explosion', False):
                        _factors_f = GLOBAL_CONFIG.get('explosion_factors', {}) or {}
                        for _f in range(floor_num):
                            _frame_lift += float(_factors_f.get(_f, 0))
                        _frame_lift += float(obj.get('frame_explosion_offset', 0.0))
                    create_roof_frame_3d(_members, frame_z_lift=_frame_lift)

            else:
                print(f"Warning: Unknown object type '{obj_type}' - skipping")

            # Tag every mesh created for this config object with a
            # fine-grained sub-layer (pillars, f0, f1_slab, f1, f1_beam,
            # loft, …). The helper skips meshes that already carry a
            # `layer` custom property, so create_hip_roof + the frame
            # code's own tags survive.
            _tag_new_objects(_obj_before, _resolve_layer(obj, floor_num))

        # After creating all objects, apply boolean operations for doors and windows
        apply_openings_to_walls(floor_num)

    else:
        # Backward compatibility with old structure
        if 'floor_slab' in floor_config:
            slab = floor_config['floor_slab']
            create_floor_slab(
                x=slab['x'],
                y=slab['y'],
                width=slab['width'],
                length=slab['length'],
                floor_number=floor_num
            )

        if 'rooms' in floor_config:
            for room in floor_config['rooms']:
                create_room(
                    name=room['name'],
                    x=room['x'],
                    y=room['y'],
                    width=room['width'],
                    length=room['length'],
                    floor_number=floor_num,
                    height=room.get('height'),
                    material_name=room.get('material', 'walls')
                )

        if 'walls' in floor_config:
            for wall in floor_config['walls']:
                create_wall(
                    start_x=wall['start_x'],
                    start_y=wall['start_y'],
                    end_x=wall['end_x'],
                    end_y=wall['end_y'],
                    floor_number=floor_num,
                    name=wall.get('name', 'Wall'),
                    material_name=wall.get('material', 'walls')
                )

    # Catch-all: anything the loop didn't tag (backward-compat schema,
    # etc.) is tagged with a floor-wide default.
    _default = {0: 'f0', 1: 'f1'}.get(floor_num, 'loft')
    _tag_new_objects(_floor_before, _default)


def build_house(use_explosion=False):
    """Build the complete house from configuration

    Args:
        use_explosion: If True, apply explosion factors for exploded view
    """
    print("\n" + "="*70)
    print("BUILDING KONKAN HOUSE")
    print("="*70 + "\n")

    # Store explosion flag in GLOBAL_CONFIG so get_floor_z_offset can access it
    GLOBAL_CONFIG['use_explosion'] = use_explosion

    # Set model origin to center of plinth (for symmetric 3D visualization)
    set_model_origin_from_plinth(HOUSE_CONFIG['plinth'])

    # Initialize scene
    init_scene()
    
    # Build ground plane + plinth
    print("\n--- Building Foundation ---")
    build_ground()
    build_plinth()
    
    # Build each floor (which now includes roofs as objects)
    for floor_config in HOUSE_CONFIG['floors']:
        print(f"\n--- Building {floor_config['name']} ---")
        build_floor(floor_config)

    # Calculate bounds for camera
    site = HOUSE_CONFIG['site']

    # Determine max Z by looking for roofs in floor objects or using floor heights
    max_z = GLOBAL_CONFIG['plinth_height']
    roof_found = False

    for floor_config in HOUSE_CONFIG['floors']:
        floor_num = floor_config['floor_number']
        max_z += GLOBAL_CONFIG['floor_heights'].get(floor_num, 10.0)

        # Check if this floor has a roof object
        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                if obj.get('type') == 'gable_roof':
                    max_z = max(max_z, obj.get('ridge_z', max_z))
                    roof_found = True
                elif obj.get('type') == 'hip_roof':
                    from roof_geometry import derive_hip_roof_geometry, compute_top_floor_wall_top_z
                    _framing = obj.get('framing', {})
                    _house_ft = _framing.get('house_footprint_ft', [27.0, 45.0])
                    if 'beam_offset_ft' in obj:
                        _beam_off = obj['beam_offset_ft'] * 10.0
                    else:
                        _beam_off = float(GLOBAL_CONFIG.get('wall_thickness', 8))
                    _wall_top_z = compute_top_floor_wall_top_z(
                        floor_config['floor_number'], GLOBAL_CONFIG, beam_offset=_beam_off)
                    _d = derive_hip_roof_geometry(
                        obj, _wall_top_z,
                        _house_ft[0] * 10.0, _house_ft[1] * 10.0,
                        ridge_axis=obj.get('ridge_axis', 'y'))
                    max_z = max(max_z, _d['eave_z'] + _d['ridge_h'] + _d['wall_top_above_eave'])
                    roof_found = True

    bounds = {
        'min_x': site['reference_x'],
        'max_x': site['reference_x'] + site['plot_length'],
        'min_y': site['reference_y'],
        'max_y': site['reference_y'] + site['plot_width'],
        'max_z': max_z,
    }
    
    # Setup camera and lighting
    print("\n--- Setting up Scene ---")
    setup_camera_and_lighting(bounds)
    configure_render()
    
    print("\n" + "="*70)
    print("✓ HOUSE CONSTRUCTION COMPLETE!")
    print("="*70)
    print("\nNavigation Tips:")
    print("  • Numpad 7: Top view")
    print("  • Numpad 1: Front view")
    print("  • Numpad 3: Side view")
    print("  • Middle mouse (or Alt+Click on Mac): Rotate view")
    print("  • Scroll wheel: Zoom")
    print("  • Shift+Middle mouse: Pan view")
    print("\nCollections:")
    print("  • Foundation: Plinth")
    print("  • Floor_0_*: Ground floor objects (rooms, stairs, etc.)")
    print("  • Floor_1_*: First floor objects")
    print("  • Roof: Roof structures")
    print("="*70 + "\n")

# ============================================================================
# EXECUTE
# ============================================================================

if __name__ == "__main__":
    build_house()

    # ========================================================================
    # FLOOR PLAN EXPORT - Generate 2D SVG floor plans
    # ========================================================================
    # This will create SVG files for each floor showing top-view layouts
    # Useful for visualizing room layouts, door/window positions, etc.
    # ========================================================================

    generate_all_floor_plans(HOUSE_CONFIG)  # Comment to skip floor plans

    # ========================================================================
    # ELEVATION VIEWS - Generate side and front/back views
    # ========================================================================
    # This will create SVG elevation views for:
    #   - Front elevation (north view)
    #   - Back elevation (south view)
    #   - Left elevation (west view)
    #   - Right elevation (east view)
    # ========================================================================

    generate_all_elevations(HOUSE_CONFIG)  # Comment to skip elevation views

    # ========================================================================
    # COMBINED VIEWS - Generate composite SVGs for easy comparison
    # ========================================================================
    # Combined floor plans: all floors side-by-side
    # Combined elevations: left, front, right, back in standard order
    # ========================================================================

    generate_combined_floor_plans(HOUSE_CONFIG)  # Comment to skip
    generate_combined_elevations(HOUSE_CONFIG)   # Comment to skip

    # ========================================================================
    # WEB EXPORT - Uncomment to export for GitHub Pages
    # ========================================================================
    # This will create a 'docs' folder with:
    #   - index.html (interactive 3D viewer)
    #   - your_model.glb (3D model file)
    #   - README.md (documentation)
    #
    # After exporting, commit the docs folder and enable GitHub Pages
    # ========================================================================

    export_to_web()  # Comment this line to skip export
