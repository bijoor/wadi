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
    }
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
                    'x': 124,
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Workshop',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bedroom_Entry',
                    'x': 90,
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
                    'width': 50,        # 4 feet wide
                    'height': 40,       # 4 feet tall
                    'sill_height': 25,  # 2 feet from floor
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
                    'x': 124,
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bedroom_3',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bedroom_2_Entry',
                    'x': 90,
                    'y': 196,
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'south',
                    'room': 'Bedroom_2',  # Which room's wall
                },
                {
                    'type': 'door',
                    'name': 'Bathroom_2_Entry_N',
                    'x': 176,
                    'y': 209,           # centered in north half (interior y=204..244)
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'west',
                    'room': 'Bathroom_2',
                },
                {
                    'type': 'door',
                    'name': 'Bathroom_2_Entry_S',
                    'x': 176,
                    'y': 257,           # centered in south half (interior y=252..292)
                    'width': 30,        # 3 feet wide
                    'height': 65,       # 6.5 feet tall
                    'direction': 'west',
                    'room': 'Bathroom_2',
                },

                # Windows
                {
                    'type': 'window',
                    'name': 'Bedroom_2_Window_North',
                    'x': 25,
                    'y': 80,
                    'width': 80,        # 4 feet wide
                    'height': 65,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'north',
                    'room': 'Bedroom_2',  # Which room's wall
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
                    'x': 135,
                    'y': 80,
                    'width': 80,        # 4 feet wide
                    'height': 65,       # 4 feet tall
                    'sill_height': 5,  # 2 feet from floor
                    'direction': 'north',
                    'room': 'Bedroom_3',  # Which room's wall
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
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 0,
                    'width': 270,
                    'length': 8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 80,
                    'width': 270,
                    'length': 12,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 196,
                    'width': 270,
                    'length': 8,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 290,
                    'width': 270,
                    'length': 12,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 438,
                    'width': 270,
                    'length': 12,
                },
                {
                    'type': 'beam',
                    'x': 0,
                    'y': 0,
                    'width': 8,
                    'length': 450,
                },
                {
                    'type': 'beam',
                    'x': 262,
                    'y': 0,
                    'width': 8,
                    'length': 450,
                },

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
                    'eave_x_west': -30,     # 3 ft overhang west of plot (x=0)
                    'eave_x_east': 300,     # 3 ft overhang east of plot (x=270)
                    'eave_y_north': -30,    # 5 ft overhang north of plot (y=0)
                    'eave_y_south': 480,    # 5 ft overhang south of plot (y=450)
                    'eave_z': -10,
                    'slope_angle_ew': 26,   # E and W trapezoidal main slopes
                    'slope_angle_ns': 26,   # N and S triangular hip ends
                    'ridge_length': 150,  # uncomment to override slope_angle_ns
                    # Exploded-view-only Z lift (ignored in normal view). Lifts
                    # the roof above the rest of the floor in the exploded GLB.
                    'explosion_offset': 250,
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