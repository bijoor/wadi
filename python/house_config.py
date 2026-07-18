# ============================================================================
# GLOBAL CONFIGURATION OVERRIDES
# ============================================================================

import sys
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')
from wadi_lib import GLOBAL_CONFIG

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
    # wadi_config.py) assigns to a mesh, or what
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
        # Ridge-vent members — all live with the "ridges & trusses" spine
        # so a single toggle hides the whole ventilation feature.
        'vent_strut', 'vent_mesh',
    ],
})

# ============================================================================
# HOUSE CONFIGURATION
# ============================================================================
#
# HOUSE_CONFIG is loaded from house_config.json — the JSON is the source of
# truth so the standalone browser editor (docs/editor/) and the Blender
# pipeline read from the same file. Edit the JSON directly or via the web
# editor; the loader below re-reads it every import so `importlib.reload`
# from Blender picks up changes without a Python restart.

import json
import pathlib

# house_config.json lives at repo root (one level above this file's
# `python/` folder) so it's a single source of truth shared with the
# TypeScript editor.
_CONFIG_JSON = pathlib.Path(__file__).parent.parent / 'house_config.json'
HOUSE_CONFIG = json.loads(_CONFIG_JSON.read_text())
