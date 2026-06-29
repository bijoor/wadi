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

def build_plinth():
    """Build the foundation plinth"""
    config = HOUSE_CONFIG['plinth']
    create_plinth(
        x=config['x'],
        y=config['y'],
        width=config['width'],
        length=config['length'],
        height=config.get('height'),
        material_name='plinth'
    )

def build_floor(floor_config: dict):
    """Build a single floor with all its objects using unified structure"""
    floor_num = floor_config['floor_number']

    # Support both old and new config formats
    if 'objects' in floor_config:
        # New unified object-based structure
        for obj in floor_config['objects']:
            obj_type = obj.get('type')

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
                create_hip_roof(
                    eave_x_west=obj['eave_x_west'],
                    eave_x_east=obj['eave_x_east'],
                    eave_y_north=obj['eave_y_north'],
                    eave_y_south=obj['eave_y_south'],
                    eave_z=obj['eave_z'],
                    slope_angle=obj.get('slope_angle'),
                    slope_angle_ns=obj.get('slope_angle_ns'),
                    slope_angle_ew=obj.get('slope_angle_ew'),
                    ridge_length=obj.get('ridge_length'),
                    ridge_axis=obj.get('ridge_axis', 'y'),
                    material_name=obj.get('material', 'roof'),
                    floor_number=floor_num,
                    explosion_offset=obj.get('explosion_offset', 0.0),
                )

            else:
                print(f"Warning: Unknown object type '{obj_type}' - skipping")

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
    
    # Build plinth
    print("\n--- Building Foundation ---")
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
                    import math
                    span_x = obj['eave_x_east'] - obj['eave_x_west']
                    span_y = obj['eave_y_south'] - obj['eave_y_north']
                    uniform = obj.get('slope_angle')
                    ang_ew = obj.get('slope_angle_ew', uniform)
                    ang_ns = obj.get('slope_angle_ns', uniform)
                    if obj.get('ridge_axis', 'y') == 'y':
                        h = (span_x / 2.0) * math.tan(math.radians(ang_ew))
                    else:
                        h = (span_y / 2.0) * math.tan(math.radians(ang_ns))
                    max_z = max(max_z, obj['eave_z'] + h)
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
