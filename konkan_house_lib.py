"""
Konkan House 3D Library
Reusable functions for creating house models in Blender

This is the main module that provides all functions for:
- 3D model generation in Blender (blender_3d module)
- 2D floor plan and elevation view generation (svg_2d module)
- Shared configuration (config module)

Coordinate System:
- Input: Inkscape-style (origin top-left, X right, Y down)
- Blender: X right, Y forward, Z up
- Conversion: Blender_X = Input_X, Blender_Y = -Input_Y, Blender_Z = height
"""

# Import configuration
from config import GLOBAL_CONFIG

# Ensure modules are reloaded to pick up changes
import importlib
import svg_2d
import blender_3d
importlib.reload(svg_2d)
importlib.reload(blender_3d)

# Import all 3D Blender functions
from blender_3d import (
    # Utility functions
    to_meters,
    inkscape_to_blender,
    set_model_origin_from_plinth,
    get_floor_z_offset,
    create_material,
    initialize_materials,
    get_or_create_collection,
    add_to_collection,
    create_box,

    # Construction functions
    create_plinth,
    create_wall,
    create_pillar,
    create_room,
    create_floor_slab,
    create_beam,
    create_staircase,
    create_door,
    create_window,
    apply_openings_to_walls,
    create_gable_roof,
    create_hip_roof,
    create_roof_frame_3d,
    create_ground_plane,

    # Scene management
    clear_scene,
    setup_camera_and_lighting,
    configure_render,
    init_scene,
    export_to_web,
)

# Import all 2D SVG functions
from svg_2d import (
    # Basic SVG drawing
    svg_draw_wall,
    svg_draw_room,
    svg_draw_door,
    svg_draw_window,
    svg_draw_floor_slab,
    svg_draw_pillar,
    svg_draw_beam,

    # Dimensioning functions
    format_dimension,
    normalize_edge_key,
    extract_floor_edges,
    classify_perimeter_edges,
    assign_dimension_offset_levels,
    detect_wall_connections,
    svg_draw_dimension_line,
    assign_opening_offset_levels,
    svg_draw_opening_dimensions,

    # Plan and elevation generation
    generate_floor_plan_svg,
    generate_elevation_view,
    generate_all_elevations,
    generate_all_floor_plans,
    generate_pillar_elevation_view,
    generate_pillar_section_view,
    generate_all_pillar_elevations,

    # Combined view generation
    generate_combined_floor_plans,
    generate_combined_elevations,
    generate_roof_sections_svg,

    # Web viewer setup
    setup_web_viewer,
)

# Re-export everything for backward compatibility
__all__ = [
    # Configuration
    'GLOBAL_CONFIG',

    # 3D functions
    'to_meters',
    'inkscape_to_blender',
    'set_model_origin_from_plinth',
    'get_floor_z_offset',
    'create_material',
    'initialize_materials',
    'get_or_create_collection',
    'add_to_collection',
    'create_box',
    'create_plinth',
    'create_wall',
    'create_pillar',
    'create_room',
    'create_floor_slab',
    'create_beam',
    'create_staircase',
    'create_door',
    'create_window',
    'apply_openings_to_walls',
    'create_gable_roof',
    'create_hip_roof',
    'create_roof_frame_3d',
    'create_ground_plane',
    'clear_scene',
    'setup_camera_and_lighting',
    'configure_render',
    'init_scene',
    'export_to_web',

    # 2D SVG functions
    'svg_draw_wall',
    'svg_draw_room',
    'svg_draw_door',
    'svg_draw_window',
    'svg_draw_floor_slab',
    'svg_draw_pillar',
    'svg_draw_beam',
    'format_dimension',
    'normalize_edge_key',
    'extract_floor_edges',
    'classify_perimeter_edges',
    'assign_dimension_offset_levels',
    'detect_wall_connections',
    'svg_draw_dimension_line',
    'assign_opening_offset_levels',
    'svg_draw_opening_dimensions',
    'generate_floor_plan_svg',
    'generate_elevation_view',
    'generate_all_elevations',
    'generate_all_floor_plans',
    'generate_pillar_elevation_view',
    'generate_pillar_section_view',
    'generate_all_pillar_elevations',
    'generate_combined_floor_plans',
    'generate_combined_elevations',
    'generate_roof_sections_svg',
    'setup_web_viewer',
]
