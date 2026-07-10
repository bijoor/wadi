"""
Konkan House Configuration
Shared configuration for both 3D Blender functions and 2D SVG generation
"""

# ============================================================================
# GLOBAL CONFIGURATION (Default values - override in your config file)
# ============================================================================

GLOBAL_CONFIG = {
    # Scaling & Units
    'units_to_meters_ratio': 0.3048,  # Default: feet to meters (1 ft = 0.3048 m)
    'scale_factor': 1.0,               # Additional scaling multiplier

    # Ground reference
    'ground_level_z': 0.0,             # Ground level Z coordinate in meters

    # Model origin (center of plinth - will be set from house config)
    'model_origin_offset_x': 0.0,      # X offset to center model
    'model_origin_offset_y': 0.0,      # Y offset to center model

    # Floor configuration (heights in input units)
    'floor_heights': {
        0: 10.0,   # Ground floor wall height (feet)
        1: 9.0,    # First floor wall height (feet)
        2: 8.0,    # Second floor wall height (feet)
    },

    # Default dimensions (in input units)
    'wall_thickness': 0.67,            # ~8 inches in feet
    'floor_slab_thickness': 0.33,      # ~4 inches in feet
    'roof_thickness': 0.33,            # ~4 inches in feet (roof slab thickness)
    'plinth_height': 1.5,              # feet
    'explosion_factor': 0.0,           # Vertical separation between floors for exploded view (0 = normal)
    'explosion_factors': {             # Per-floor explosion factors {floor_num: separation_above_this_floor}
        0: 0,                          # Default: no separation above ground floor
        1: 0,                          # Default: no separation above first floor
        2: 0,                          # Default: no separation above second floor
    },                                 # If set, overrides uniform explosion_factor

    # Materials & Colors
    'colors': {
        'ground': (0.36, 0.45, 0.28, 1.0),     # Muted grass green — outdoor ground plane
        'walls': (0.55, 0.25, 0.15, 1.0),      # Laterite: reddish-brown
        'floor': (0.6, 0.55, 0.5, 1.0),
        'plinth': (0.5, 0.45, 0.4, 1.0),
        'roof': (0.7, 0.3, 0.2, 1.0),
        'verandah': (0.5, 0.25, 0.15, 1.0),    # Laterite
        'living': (0.55, 0.25, 0.15, 1.0),     # Laterite
        'kitchen': (0.55, 0.25, 0.15, 1.0),    # Laterite
        'bathroom': (0.55, 0.25, 0.15, 1.0),   # Laterite
        'bedroom': (0.55, 0.25, 0.15, 1.0),    # Laterite
        'workshop': (0.55, 0.25, 0.15, 1.0),   # Laterite
    },

    # SVG Dimension Configuration
    'dimensions': {
        'show_outer_dimensions': True,      # Show building perimeter dimensions
        'show_inner_dimensions': True,      # Show interior wall dimensions
        'show_room_dimensions': True,       # Show room size labels (Width × Length)
        'show_opening_dimensions': True,    # Show door/window dimensions
        'dimension_offset': 30,             # Distance from building edge (in input units)
        'dimension_offset_increment': 20,   # Additional offset for each stacked dimension level
        'inner_dimension_offset': 15,       # Offset for interior dimensions
        'opening_dimension_offset': 8,      # Offset for door/window dimensions
        'min_dimension_length': 20,         # Don't dimension edges shorter than this
        'unit_display': 'feet',             # Display unit name
        'unit_conversion': 10.0,            # Conversion factor (10 units = 1 foot)
        'precision': 1,                     # Decimal places for dimensions (used when use_feet_inches is False)
        'use_feet_inches': True,            # Display as feet-inches (12' 6") instead of decimal feet (12.5')
        'text_size': 10,                    # Font size for dimension text
        'room_text_size': 12,               # Font size for room labels
        'opening_text_size': 8,             # Font size for door/window dimensions
    },

    # Elevation View Rendering Order Configuration
    # When objects have the same depth coordinate, this priority determines rendering order
    # Lower number = drawn first (appears underneath)
    # Default order: beam < floor_slab < wall/room < pillar
    'elevation_rendering_priority': {
        'beam': 0,
        'floor_slab': 1,
        'room': 2,
        'wall': 2,
        'pillar': 3
    }
}
