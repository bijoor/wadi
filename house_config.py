# ============================================================================
# GLOBAL CONFIGURATION OVERRIDES
# ============================================================================

import sys
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')
from konkan_house_lib import GLOBAL_CONFIG

# Override default config values
GLOBAL_CONFIG.update({
    'units_to_meters_ratio': 0.1,   # feet to meters
    'scale_factor': 1.0,
    'ground_level_z': 0.0,
    
    'floor_heights': {
        0: 100.0,   # Ground floor: 10 feet
        1: 90.0,    # First floor: 10 feet
        2: 70.0,    # Second floor: 5 feet
        #3: 50.0,    # Second floor: 5 feet
    },
    
    'wall_thickness': 8,     # 8 inches = 0.67 feet
    'floor_slab_thickness': 8,  # 4 inches = 0.33 feet
    'roof_thickness': 3,       # 8 inches = 0.67 feet (roof slab thickness)
    'plinth_height': 30,       # 1.5 feet

    # Explosion factors for exploded view (vertical separation above each floor in units)
    # These are only applied when build_house(use_explosion=True) is called.
    # The normal model (use_explosion=False) ignores these values.
    'explosion_factors': {
        0: 250,  # Separation above ground floor (17.5 feet)
        1: 0,  # Separation above first floor (17.5 feet)
        2: 250,    # Separation above loft floor (no separation)
    },

    # ------------------------------------------------------------------
    # Materials palette. Keys are material names referenced by objects
    # in HOUSE_CONFIG (e.g. `material_name='walls'` on a wall) — keeping
    # this dict alongside the house config means renaming a material
    # here forces you to update both sides together.
    # ------------------------------------------------------------------
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

    # ------------------------------------------------------------------
    # Elevation-view z-order for objects that share the same depth. Keys
    # are `type` values used in HOUSE_CONFIG['floors'][…]['objects']; if
    # a new object type is added there, add it here too. Lower number →
    # drawn first (underneath).
    # ------------------------------------------------------------------
    'elevation_rendering_priority': {
        'beam': 0,
        'floor_slab': 1,
        'room': 2,
        'wall': 2,
        'pillar': 3,
    },

    # ------------------------------------------------------------------
    # Web-viewer layer panel — ordered top-to-bottom. Each entry is
    # {id, label, color}. The `id` must match what `_resolve_layer` (in
    # konkan_house_config.py) assigns to a mesh, or what
    # `create_roof_frame_3d` (in blender_3d.py) tags on frame members.
    # `frame_spine_kinds` selects which frame `kind`s belong in the
    # "Ridges & trusses" bucket vs. the "Purlins & rafters" bucket.
    # export_to_web writes this whole config out as docs/layers.json so
    # the web viewer builds both toggle panels from the same source.
    # ------------------------------------------------------------------
    'layers': [
        {'id': 'loft',          'label': 'Roof shell',            'color': '#e88968'},
        {'id': 'frame_surface', 'label': 'Purlins & rafters',     'color': '#4b515c'},
        {'id': 'frame_spine',   'label': 'Ridges & trusses',      'color': '#8a4a1a'},
        {'id': 'f1_beam',       'label': 'First floor top beams', 'color': '#6b4423'},
        {'id': 'f1',            'label': 'First floor walls',     'color': '#f5c9a0'},
        {'id': 'f1_slab',       'label': 'First floor slab',      'color': '#b8b8b8'},
        {'id': 'f0',            'label': 'Ground floor walls',    'color': '#f5c9a0'},
        {'id': 'pillars',       'label': 'Pillars',               'color': '#ffffff'},
        {'id': 'plinth',        'label': 'Plinth',                'color': '#808080'},
        {'id': 'ground',        'label': 'Ground',                'color': '#5c7346'},
    ],
    'frame_spine_kinds': [
        'ring_beam', 'central_ridge', 'hip_ridge', 'hip_end_beam',
        'truss_bottom_chord', 'truss_top_chord', 'truss_king_post',
        'truss_diagonal', 'truss_vertical', 'pani_patti',
    ],
})

# ============================================================================
# HOUSE CONFIGURATION
# ============================================================================

HOUSE_CONFIG = {
    # Overall dimensions and reference point
    'site': {
        'reference_x': 0,      # Top-left corner X
        'reference_y': 0,      # Top-left corner Y
        'plot_length': 450,     # feet
        'plot_width': 270,      # feet
    },
    
    # Foundation
    'plinth': {
        'x': 0,
        'y': 0,
        'length': 450,
        'width': 270,
        'height': 30,  # 3 feet (10 units = 1 foot)
    },
    
    # Floors configuration - unified object-based structure
    'floors': [
        # ============ GROUND FLOOR ============
        {
            'floor_number': 0,
            'name': 'Ground Floor',

            # =================================================================
            # E/W VARIANT — STRUCTURAL NOTES (not modeled as 3D geometry)
            # =================================================================
            # * All east-face pillars (x≈266) and all west-face pillars (x≈4)
            #   are uniform 19 ft tall (h=190 = 10 ft ground floor + 9 ft above
            #   first-floor slab). Their tops sit at z=220 absolute.
            #
            # * A peripheral wall plate / eave beam (NOT modeled) runs along the
            #   full perimeter at z=220, connecting all pillar tops in a closed
            #   rectangle. This is the support that the roof eave rests on all
            #   the way around the circumference.
            #
            # * The ridge (z=328 absolute) is well above the middle east/west
            #   pillars (whose tops are at z=220). A king-post or queen-post
            #   ROOF TRUSS (NOT modeled) spans east-west at intervals along the
            #   ridge, transferring the ridge load down to the perimeter wall
            #   plate. Truss tie-beam at z=220, top chord follows the rafters.
            # =================================================================

            # List of all objects on this floor
            'objects': [
                # Floor slab
                {
                    'type': 'floor_slab',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 450,
                },
                {
                    'type': 'pillar',
                    'x': 5,
                    'y': 4,
                    'width': 10,
                    'name': 'First_Pillar_1',
                    'height': 200,  # E/W variant: west-face pillar, 9 ft above first-floor slab (10+9 ft total)
                },
                {
                    'type': 'pillar',
                    'x': 105,
                    'y': 4,
                    'width': 10,
                    'name': 'First_Pillar_2',
                    'height': 200,
                },
                {
                    'type': 'pillar',
                    'x': 165,
                    'y': 4,
                    'width': 10,
                    'name': 'First_Pillar_3',
                    'height': 200,
                },
                {
                    'type': 'pillar',
                    'x': 265,
                    'y': 4,
                    'width': 10,
                    'name': 'First_Pillar_4',
                    'height': 200,  # E/W variant: east-face pillar, 9 ft above first-floor slab
                },
                {
                    'type': 'pillar',
                    'x': 4,
                    'y': 86.225,
                    'length': 12.5,
                    'name': 'Second_Pillar_1',
                    'height': 200,  # E/W variant: west-face pillar
                },
                {
                    'type': 'pillar',
                    'x': 120,
                    'y': 86.225,
                    'length': 12.5,
                    'name': 'Second_Pillar_2',
                    'height': 200,
                },
                {
                    'type': 'pillar',
                    'x': 266,
                    'y': 86.225,
                    'length': 12.5,
                    'name': 'Second_Pillar_3',
                    'height': 200,  # E/W variant: east-face pillar
                },
                {
                    'type': 'pillar',
                    'x': 6.2,
                    'y': 200,
                    'width': 12.5,
                    'name': 'Center_Pillar_1',
                    'height': 200,  # E/W variant: west-face pillar (was 313 for the N/S ridge it used to support)
                },
                {
                    'type': 'pillar',
                    'x': 120,
                    'y': 197.5,
                    'length': 12.5,
                    'name': 'Center_Pillar_2',
                    'height': 200,
                },
                {
                    'type': 'pillar',
                    'x': 263.8,
                    'y': 200,
                    'width': 12.5,
                    'name': 'Center_Pillar_3',
                    'height': 200,  # E/W variant: east-face pillar (was 313 for the N/S ridge it used to support)
                },
                {
                    'type': 'pillar',
                    'x': 4,
                    'y': 296,
                    'length': 12.5,
                    'name': 'Fourth_Pillar_1',
                    'height': 200,  # E/W variant: west-face pillar
                },
                {
                    'type': 'pillar',
                    'x': 44,
                    'y': 296,
                    'name': 'Staircase_Pillar',
                    'height': 200,
                },
                {
                    'type': 'pillar',
                    'x': 180,
                    'y': 296,
                    'width': 12.5,
                    'name': 'Fourth_Pillar_2',
                    'height': 200,
                },
                {
                    'type': 'pillar',
                    'x': 266,
                    'y': 296,
                    'length': 12.5,
                    'name': 'Fourth_Pillar_3',
                    'height': 200,  # E/W variant: east-face pillar
                },
                {
                    'type': 'pillar',
                    'x': 4,
                    'y': 443.5,
                    'length': 12.5,
                    'name': 'Rear_Corner_Pillar_1',
                    'height': 200,  # E/W variant: west-face pillar (was 193, normalized to 190)
                },
                {
                    'type': 'pillar',
                    'x': 93.5,
                    'y': 446,
                    'width': 10,
                    'name': 'Rear_Entrance_Pillar_1',
                    'height': 200,
                },
                {
                    'type': 'pillar',
                    'x': 178.5,
                    'y': 446,
                    'width': 10,
                    'name': 'Rear_Entrance_Pillar_2',
                    'height': 200,
                },
                {
                    'type': 'pillar',
                    'x': 266,
                    'y': 443.5,
                    'length': 12.5,
                    'name': 'Rear_Corner_Pillar_2',
                    'height': 200,  # E/W variant: east-face pillar (was 193, normalized to 190)
                },

                # Rooms - only create exterior walls, not shared partition walls
                {
                    'type': 'room',
                    'name': 'Verandah',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 88,
                    'height': 30,
                    'material': 'verandah',
                    'walls': ['north', 'east', 'west'],  # South is shared with Bedroom/Workshop
                },
                {
                    'type': 'room',
                    'name': 'Bedroom_1',
                    'x': 0,
                    'y': 80,
                    'width': 124,
                    'length': 124,
                    'material': 'bedroom',
                    'walls': ['north','east','west','south'], # East shared with Workshop, South shared with Living_Kitchen
                },
                {
                    'type': 'room',
                    'name': 'Workshop',
                    'x': 116,
                    'y': 80,
                    'width': 154,
                    'length': 124,
                    'material': 'workshop',
                    'walls': ['north','east','south'],  # West shared with Bedroom
                },
                {
                    'type': 'room',
                    'name': 'Bathroom_1',
                    'x': 176,
                    'y': 196,
                    'width': 94,
                    'length': 104,
                    'material': 'bathroom',
                    'walls': ['west','south'],  # North shared with Workshop, West shared with Living_Kitchen
                },
                {
                    'type': 'room',
                    'name': 'Living_Kitchen',
                    'x': 0,
                    'y': 196,
                    'width': 270,
                    'length': 254,
                    'material': 'living',
                    'walls': ['east','west', 'south'],  # North shared with Bedroom/Bathroom, East shared with Bathroom
                },

                {
                    'type': 'wall',
                    'name': 'Washbasin_Wall',
                    'start_x': 136,
                    'start_y': 296,
                    'end_x': 176,
                    'end_y': 296,
                    'material': 'bathroom',
                },

                # Staircases
                {
                    'type': 'staircase',
                    'start_x': 8,
                    'start_y': 430,
                    'direction': 'north',  # 'north', 'south', 'east', or 'west'
                    'num_steps': 20,
                    'step_width': 30,
                    'step_tread': 10,
                    'step_rise': 5,
                    'material': 'floor',
                },

                # Doors
                {
                    'type': 'door',
                    'name': 'Main_Entry',
                    'x': 110,
                    'y': 0,
                    'width': 50,        # 5 feet wide
                    'height': 70,       # 7 feet tall
                    'direction': 'north',
                    'room': 'Verandah',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Workshop_Entry',
                    'x': 124,
                    'y': 80,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'north',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Workshop_Exit',
                    'x': 126.5,         # 3 in east of separating wall (matches Bedroom_3_Entry on top floor)
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bedroom_Entry',
                    'x': 83.5,          # 3 in west of separating wall (matches Bedroom_2_Entry on top floor)
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bedroom_1',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bathroom_1_Entry',
                    'x': 176,
                    'y': 228,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'west',
                    'room': 'Bathroom_1',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Living_Kitchen_Exit',
                    'x': 98.5,
                    'y': 442,
                    'width': 75,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Living_Kitchen',  # Which room's wall
                },

                # Windows
                {
                    'type': 'window',
                    'name': 'Bedroom_1_Window_North',
                    'x': 35,
                    'y': 80,
                    'width': 50,        # 5 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2.5 feet from floor
                    'direction': 'north',
                    'room': 'Bedroom_1',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Bedroom_1_Window_West',
                    'x': 0,
                    'y': 117,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'west',
                    'room': 'Bedroom_1',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Workshop_Window_North',
                    'x': 187,
                    'y': 80,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'north',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Workshop_Window_East',
                    'x': 262,
                    'y': 115,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': ' Bathroom_1_Window_1',
                    'x': 262,
                    'y': 214,
                    'width': 20,        # 4 feet wide
                    'height': 20,       # 4 feet tall
                    'sill_height': 45,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': ' Bathroom_1_Window_2',
                    'x': 262,
                    'y': 254,
                    'width': 20,        # 4 feet wide
                    'height': 20,       # 4 feet tall
                    'sill_height': 45,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': ' Kitchen_Window',
                    'x': 262,
                    'y': 310,
                    'width': 60,        # 4 feet wide
                    'height': 30,       # 4 feet tall
                    'sill_height': 35,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Staircase_Window_1',
                    'x': 0,
                    'y': 224,
                    'width': 40,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'west',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Staircase_Window_2',
                    'x': 0,
                    'y': 386,
                    'width': 40,        # 4 feet wide
                    'height': 30,       # 4 feet tall
                    'sill_height': 35,  # 2 feet from floor
                    'direction': 'west',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Living_Rear_Window_1',
                    'x': 24,
                    'y': 442,
                    'width': 60,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'south',
                    'room': 'Living_Kitchen',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Living_Rear_Window_2',
                    'x': 187.5,
                    'y': 442,
                    'width': 60,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'south',
                    'room': 'Living_Kitchen',  # Which room's wall
                },

            ],
        },
        # ============ FIRST FLOOR ============
        {
            'floor_number': 1,
            'name': 'First Floor',

            # List of all objects on this floor
            'objects': [
                # Floor slab
                {
                    'type': 'floor_slab',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 234,
                },
                {
                    'type': 'floor_slab',
                    'x': 40,
                    'y': 234,
                    'width': 230,
                    'length': 100,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 230,
                    'width': 8,
                    'length': 220,
                },
                {
                    'type': 'beam',
                    'x': 262,
                    'y': 330,
                    'width': 8,
                    'length': 120,
                },
                {
                    'type': 'beam',
                    'x': 8,
                    'y': 442,
                    'width': 254,
                    'length': 8,
                },

                # ---------- Ring beams on top of the first-floor walls ----------
                # Previously configured on floor 2 (the loft). Moved here
                # so they group with the "First floor" layer in the web
                # viewer. z_offset_ft = 9.8 = slab (0.8') + wall (9') so
                # the beam bottom lands at the top of the wall.
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 8,
                    'z_offset_ft': 9.8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 80,
                    'width': 270,
                    'length': 12,
                    'z_offset_ft': 9.8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 196,
                    'width': 270,
                    'length': 8,
                    'z_offset_ft': 9.8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 290,
                    'width': 270,
                    'length': 12,
                    'z_offset_ft': 9.8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 438,
                    'width': 270,
                    'length': 12,
                    'z_offset_ft': 9.8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 0,
                    'width': 8,
                    'length': 450,
                    'z_offset_ft': 9.8,
                },
                {
                    'type': 'beam',
                    'x': 262,
                    'y': 0,
                    'width': 8,
                    'length': 450,
                    'z_offset_ft': 9.8,
                },

                # Rooms - only create exterior walls, not shared partition walls
                {
                    'type': 'room',
                    'name': 'Upper_Verandah',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 88,
                    'height': 30,
                    'material': 'verandah',
                    'walls': ['north', 'east', 'west'],  # South is shared with Bedroom/Workshop
                },
                {
                    'type': 'room',
                    'name': 'Bedroom_2',
                    'x': 0,
                    'y': 80,
                    'width': 124,
                    'length': 124,
                    'material': 'bedroom',
                    'walls': ['north','east','west','south'], # East shared with Workshop, South shared with Living_Kitchen
                    'wall_heights': {
                        'north': 90,
                        'east': 90,
                        'west': 90,
                        'south': 90,
                    }
                },
                {
                    'type': 'room',
                    'name': 'Bedroom_3',
                    'x': 116,
                    'y': 80,
                    'width': 154,
                    'length': 124,
                    'material': 'workshop',
                    'walls': ['north','east','south'],  # West shared with Bedroom
                    'wall_heights': {
                        'north': 90,
                        'east': 90,
                        'west': 90,
                        'south': 90,
                    }
                },
                # Single Bathroom_2 room with one interior partition wall at the
                # E-W centerline (y=248). Partition spans inner edge to inner edge
                # of the room's west and east walls so it joins them seamlessly.
                # Two doors on the west wall give independent access to each half.
                {
                    'type': 'room',
                    'name': 'Bathroom_2',
                    'x': 176,
                    'y': 196,
                    'width': 94,
                    'length': 104,
                    'material': 'bathroom',
                    'walls': ['west', 'south', 'east'],  # north shared with Bedroom_3
                    'wall_heights': {
                        'east': 90,
                        'west': 90,
                        'south': 90,
                    }
                },
                {
                    'type': 'wall',
                    'name': 'Bathroom_2_Partition',
                    'start_x': 184,   # inner edge of west wall (176 + thickness/2 + thickness/2)
                    'start_y': 248,   # midpoint of y=196..300 → equal halves
                    'end_x': 262,     # inner edge of east wall (270 - thickness)
                    'end_y': 248,
                    'height': 90,
                    'material': 'bathroom',
                },
                {
                    'type': 'wall',
                    'name': 'Staircase_Landing_West',
                    'start_x': 4,
                    'start_y': 200,
                    'end_x': 4,
                    'end_y': 300,
                    'height': 90,
                    'material': 'living',
                },
                # Living_Kitchen_2 area - replaced room with individual walls for sloping roof
                {
                    'type': 'wall',
                    'name': 'Living_Kitchen_2_East',
                    'start_x': 266,
                    'start_y': 300,
                    'end_x': 266,
                    'end_y': 450,
                    'height': 90,
                    #'height_end': 85,  # Sloping wall
                    'material': 'walls',
                },
                {
                    'type': 'wall',
                    'name': 'Living_Kitchen_2_West',
                    'start_x': 4,
                    'start_y': 300,
                    'end_x': 4,
                    'end_y': 450,
                    'height': 90,
                    #'height_end': 85,  # Sloping wall
                    'material': 'walls',
                },
                {
                    'type': 'wall',
                    'name': 'Living_Kitchen_2_South',
                    'start_x': 0,
                    'start_y': 446,
                    'end_x': 270,
                    'end_y': 446,
                    'height': 90,
                    'material': 'walls',
                },
                # Doors
                {
                    'type': 'door',
                    'name': 'Bedroom_3_Entry',
                    'x': 126.5,         # 3 in east of separating wall (wall ends at x=124)
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bedroom_3',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bedroom_2_Entry',
                    'x': 83.5,          # 3 in west of separating wall (wall starts at x=116, door right edge at 113.5)
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bedroom_2',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bathroom_2_Entry_N',
                    'x': 186.5,         # 3 in east of west wall inner edge (184 + 2.5)
                    'y': 196,           # northern face of Bedroom_3's south wall (y=196..204)
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'north',
                    'wall': 'Bedroom_3_South',  # explicit — Bathroom_2 has no north wall of its own
                },
                {
                    'type': 'door',
                    'name': 'Bathroom_2_Entry_S',
                    'x': 186.5,         # 3 in east of west wall inner edge
                    'y': 292,           # northern face of Bathroom_2's south wall (y=292..300)
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bathroom_2',
                },

                # Both bedrooms → Upper_Verandah doors. Bedroom_2 mirrors
                # Bedroom_1's ground-floor Verandah door; Bedroom_3
                # mirrors Workshop_Entry on the same wall.
                {
                    'type': 'door',
                    'name': 'Bedroom_2_Verandah_Door',
                    'x': 83.5,          # 3 in west of the Bedroom_2 / Bedroom_3 partition
                    'y': 80,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'north',
                    'room': 'Bedroom_2',
                },
                {
                    'type': 'door',
                    'name': 'Bedroom_3_Verandah_Door',
                    'x': 124,
                    'y': 80,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'north',
                    'room': 'Bedroom_3',
                },

                # Windows
                {
                    'type': 'window',
                    'name': 'Bedroom_2_Window_North',
                    'x': 25,
                    'y': 80,
                    'width': 30,        # 3 feet wide (was 5' — reduced to fit the door)
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2.5 feet from floor
                    'direction': 'north',
                    'room': 'Bedroom_2',
                },
                {
                    'type': 'window',
                    'name': 'Bedroom_2_Window_West',
                    'x': 0,
                    'y': 115,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'west',
                    'room': 'Bedroom_2',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Bedroom_3_Window_North',
                    'x': 187,
                    'y': 80,
                    'width': 50,        # 5 feet wide (matches Workshop_Window_North)
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2.5 feet from floor
                    'direction': 'north',
                    'room': 'Bedroom_3',
                },
                {
                    'type': 'window',
                    'name': 'Bedroom_3_Window_East',
                    'x': 262,
                    'y': 115,
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Bedroom_3',  # Which room's wall
                },
                {
                    'type': 'window',
                    'name': 'Bathroom_2_Window_N',
                    'x': 262,
                    'y': 214,
                    'width': 20,        # 4 feet wide
                    'height': 20,       # 4 feet tall
                    'sill_height': 45,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Bathroom_2',
                },
                {
                    'type': 'window',
                    'name': 'Bathroom_2_Window_S',
                    'x': 262,
                    'y': 262,           # centered in south half (interior y=252..292)
                    'width': 20,        # 4 feet wide
                    'height': 20,       # 4 feet tall
                    'sill_height': 45,  # 2 feet from floor
                    'direction': 'east',
                    'room': 'Bathroom_2',
                },
                {
                    'type': 'window',
                    'name': 'Above_Kitchen_Window_1',
                    'x': 262,
                    'y': 310,
                    'width': 50,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'east',
                    'wall': 'Living_Kitchen_2_East',
                },
                {
                    'type': 'window',
                    'name': 'Above_Kitchen_Window_2',
                    'x': 262,
                    'y': 375,
                    'width': 50,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'east',
                    'wall': 'Living_Kitchen_2_East',
                },
                {
                    'type': 'window',
                    'name': 'Above_Stairs_Window_1',
                    'x': 0,
                    'y': 310,
                    'width': 50,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'west',
                    'wall': 'Living_Kitchen_2_West',
                },
                {
                    'type': 'window',
                    'name': 'Above_Stairs_Window_2',
                    'x': 0,
                    'y': 375,
                    'width': 50,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'west',
                    'wall': 'Living_Kitchen_2_West',
                },
                {
                    'type': 'window',
                    'name': 'Above_Living_Rear_Window_1',
                    'x': 24,
                    'y': 442,
                    'width': 60,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'south',
                    'wall': 'Living_Kitchen_2_South',
                },
                {
                    'type': 'window',
                    'name': 'Above_Living_Rear_Window_2',
                    'x': 103.5,
                    'y': 442,
                    'width': 65,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'south',
                    'wall': 'Living_Kitchen_2_South',
                },
                {
                    'type': 'window',
                    'name': 'Above_Living_Rear_Window_3',
                    'x': 187.5,
                    'y': 442,
                    'width': 60,        # 4 feet wide
                    'height': 60,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'south',
                    'wall': 'Living_Kitchen_2_South',
                },
            ],
        },
        # ============ LOFT FLOOR ============
        {
            'floor_number': 2,
            'name': 'Loft Floor',
            'objects': [
                # Floor slab
                # {
                #     'type': 'floor_slab',
                #     'x': 8,
                #     'y': 88,
                #     'width': 252,
                #     'length': 120,
                # },
                # {
                #     'type': 'floor_slab',
                #     'x': 176,
                #     'y': 208,
                #     'width': 84,
                #     'length': 92,
                # },
                # Ring beams that sit on top of the first-floor walls have
                # been moved into the first-floor config (with
                # z_offset_ft = 9.8) so the layer grouping in the web
                # viewer treats them as part of "First floor" instead of
                # "Roof shell". Only the hip roof itself lives on this
                # (loft) floor now.

                # ============================================================
                # ROOF — pick ONE (comment out the other)
                # ============================================================

                # Option A: Hip roof — four-sided slope (Konkan style).
                # Independent pitches for the two slope pairs:
                #   slope_angle_ew sets ridge height h (main, perpendicular to
                #     the ridge): h = (eave_span_x / 2) * tan(angle_ew).
                #     With span_x=330 and angle_ew=26°: h = 80.5.
                #   slope_angle_ns sets the ridge endpoint inset along Y
                #     (triangular hip ends): d_hip = h / tan(angle_ns).
                #     With angle_ns=26°: d_hip = 165, so ridge runs
                #     y = -50+165..500-165 = 115..335 (length 220).
                # Set slope_angle_ns == slope_angle_ew for a uniform pitch.
                #
                # Optional: ridge_length overrides slope_angle_ns. If set, the
                # ridge is centered with the given length; the N/S slope angle
                # is recomputed from geometry (see startup log for actual value).
                {
                    'type': 'hip_roof',
                    'ridge_axis': 'y',
                    # --- Primary controls (everything else is derived from
                    # these + house_footprint_ft + floor_heights + wall_top) ---
                    #  ridge_h_ft — ridge height above wall_top
                    #  min_overhang_ft — smallest allowed roof extension past
                    #                    any wall (the critical side gets
                    #                    exactly this; others get more)
                    #  trusses.positions — first and last are ridge endpoints;
                    #                       structurally anchored to pillar rows
                    'ridge_h_ft':        7.0,
                    'min_overhang_ft':   2.5,
                    'trusses': {
                        'type': 'fink',
                        # T1 over pillar row A (y=86.225),
                        # T2 over pillar row B (W/E pillars at y=200),
                        # T3 over pillar row C (y=296).
                        'positions': [86.225, 200, 296],
                        'chord_size_in': [2, 4],
                        'chord_wall_mm': 3,
                        'web_size_in': [2, 2],
                        'web_wall_mm': 2,
                        'panel_ratio_bottom': 0.25,
                        'include_king_post': True,
                        'note': '3 Fink trusses aligned to pillar rows for direct load transfer',
                    },
                    # Exploded-view-only Z lifts (ignored in normal view):
                    #   frame_explosion_offset — lift of the metal-frame
                    #                            members above the loft.
                    #   explosion_offset       — lift of the roof SHELL.
                    # Keep shell > frame so the shell sits further from the
                    # frame in the exploded GLB.
                    'frame_explosion_offset': 250,
                    'explosion_offset':       500,
                    # Enable the metal-frame member generation in the GLB.
                    'show_frame_3d': True,
                    # Framing config — used by roof_plan.svg. All members are
                    # METAL PIPES (hollow rectangular sections). Dimensions in
                    # inches; wall_mm is the pipe wall thickness in millimetres.
                    #  * Rafters: perpendicular to ridge, from eave to ridge.
                    #  * Purlins: parallel to ridge, run across rafters.
                    #  * Ridge (central + hip ridges): the peak line and the 4
                    #    diagonal ridges from ridge endpoints to eave corners.
                    #  * Eave edge: Pani Patti (folded metal water-protector
                    #    strip) + 1"×1"×3mm L-channel angle support fixed on
                    #    top, with the L-channel's top aligned to the top of
                    #    the purlins. Together they hold the bottom tile
                    #    course at the correct level and shed water off the
                    #    eave. Per site video (Santosh Roofing).
                    #  * Barge pipe: 3"×1"×1.6mm HSS welded to purlin ends
                    #    at free roof edges (no adjoining section), bottom
                    #    flush with the purlin bottom.
                    #  * Ridge angle: 1"×1"×3mm L-angle at the top ridge to
                    #    support tiles cut at the top when roof width isn't a
                    #    clean multiple of tile size.
                    #  * Corner double angle: 1"×1"×3mm doubled L-angle at
                    #    panel corners to support cut ceiling tiles.
                    #  * Main beam: 8"×4"×4mm HSS pipes forming the structural
                    #    spine (two per span, ~3 ft OC).
                    #  * Supporting truss: 4"×8"×4mm HSS mid-span truss where
                    #    extra strength is needed.
                    'framing': {
                        # Rafter mounted ON-EDGE (stiff axis vertical):
                        # cross section is 2" wide × 4" tall.
                        'rafter_size_in': [2, 4],
                        'rafter_wall_mm': 2,            # (1.5 mm alternative available)
                        'rafter_spacing_in': 36,        # centre-to-centre (3 ft)
                        'purlin_size_in': [2, 1],       # 2" wide × 1" tall HSS (flat)
                        'purlin_wall_mm': 1.6,          # per site video
                        'purlin_spacing_in': 12,        # centre-to-centre (1 ft)
                        'ridge_size_in': [6, 3],        # 6" wide × 3" tall HSS
                        'ridge_wall_mm': 2,
                        # Legacy alias — kept so existing SVG code still runs
                        # until the eave-edge is fully replaced by pani_patti
                        # + eave_L_channel below.
                        'eave_edge_size_in': [1, 2],
                        'eave_edge_wall_mm': 1.5,
                        # ---- New members per Santosh Roofing video ----
                        'pani_patti': {
                            'material': 'GI sheet',
                            'thickness_mm': 1.2,          # nominal, verify on site
                            # Total face height at the eave = rafter (4) +
                            # purlin (1) + 1" extra above purlin top = 6".
                            'height_in': 6.0,
                            'note': 'folded water-protector strip along the eave',
                        },
                        'eave_L_channel_size_in': [1, 1],  # 1" × 1" L-angle
                        'eave_L_channel_wall_mm': 3,
                        'barge_pipe_size_in': [3, 1],     # 3" tall × 1" wide HSS
                        'barge_pipe_wall_mm': 1.6,
                        'ridge_angle_size_in': [1, 1],    # 1" × 1" L-angle at top ridge
                        'ridge_angle_wall_mm': 3,
                        'corner_double_angle_size_in': [1, 1],
                        'corner_double_angle_wall_mm': 3,
                        'main_beam_size_in': [8, 4],      # 8" × 4" HSS spine
                        'main_beam_wall_mm': 4,
                        'main_beam_spacing_in': 36,       # ~3 ft centre-to-centre
                        'supporting_truss_size_in': [4, 8],  # 4" × 8" HSS truss
                        'supporting_truss_wall_mm': 4,
                        # ---- Common Fink (W) trusses in the ridge zone ----
                        # Section A-A profile: 34'2" bottom chord × 8'4" rise,
                        # 26° pitch. 4 common trusses at 4' OC, distributed
                        # symmetrically across the 15'9" ridge length.
                        # Members:
                        #   - chords (top + bottom): 2"×4"×3 mm HSS on-edge
                        #   - king post + W diagonals: 2"×2"×2 mm HSS
                        # Panel points at 1/4 and 3/4 of the bottom chord.
                        # ---- House footprint (walls) — inset from eave ----
                        # The eave outline is 34'2" × 52'2". The house walls
                        # form a smaller rectangle inside, with the roof
                        # overhanging on all four sides.
                        'house_footprint_ft': [27.0, 45.0],  # [transverse, longitudinal]
                        # Note: wall_top_above_eave_ft and framing.truss are
                        # DERIVED — see hip_roof.trusses (above) and the
                        # runtime output of roof_geometry.derive_for_house().
                        # ---- Ring beam (rectangular frame around walls) ----
                        # Perimeter tie beam at wall-top level, sits on the walls.
                        'ring_beam': {
                            'size_in': [4, 2],
                            'wall_mm': 3,
                            'note': 'Perimeter ring beam at wall top — 27×45 rectangle at 1\'4" above eave',
                        },
                        # ---- Hip-end beams ----
                        # 6 beams (3 at each hip end) running longitudinally
                        # from the corresponding corner truss (Truss 1 or 3) to
                        # the N/S wall of the ring-beam frame. Spaced across the
                        # 27' transverse width.
                        'hip_end_beam': {
                            'count_per_end': 3,
                            'size_in': [4, 2],
                            'wall_mm': 2,
                            # When True, also runs the same 3 longitudinal
                            # beams BETWEEN adjacent trusses (T1↔T2, T2↔T3),
                            # so the ring beam is continuously braced along
                            # the transverse dimension across the ridge zone.
                            'extend_between_trusses': True,
                            'note': 'Longitudinal beams at wall level, from corner trusses to N/S walls (+ between trusses when extend_between_trusses)',
                        },
                        # ---- Membrane between ceiling and roof tiles ----
                        'membrane': {
                            'material': 'thermal + waterproof fabric',
                            'sealing_tape': 'RBD / aluminium-butyl',
                            'overlap_horizontal_in': 12,  # 1 foot
                            'overlap_vertical_in': 8,
                            'barge_extension_in': 2,
                            'note': 'depression pressed at each ceiling-tile gap so tile lip seats',
                        },
                    },
                    'material': 'roof',
                },

                # Option B (commented): Gable roof — two-sided slope, ridge N-S.
                # Symmetric 22° slopes (original 26° east slope would drop the
                # east eave below floor on the wider X span).
                # {
                #     'type': 'gable_roof',
                #     'ridge_axis': 'y',
                #     'ridge_start_x': 135,
                #     'ridge_start_y': -50,
                #     'ridge_z': 75,
                #     'ridge_length': 550,
                #     'left_slope_angle': 26,
                #     'left_slope_length': 200,
                #     'right_slope_angle': 26,
                #     'right_slope_length': 200,
                #     'material': 'roof',
                # },
            ]
        },
    ],
}