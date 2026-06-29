#!/usr/bin/env python3
"""
Standalone script to generate the four pillar/slab structural elevation SVGs
(front, back, left, right). Does not require Blender/bpy.
"""
import sys
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

from config import GLOBAL_CONFIG
from svg_2d import generate_all_pillar_elevations

GLOBAL_CONFIG.update({
    'units_to_meters_ratio': 0.1,
    'scale_factor': 1.0,
    'ground_level_z': 0.0,
    'floor_heights': {
        0: 100.0,
        1: 100.0,
        2: 42.0,
        3: 50.0,
    },
    'wall_thickness': 8,
    'floor_slab_thickness': 8,
    'plinth_height': 30,
})

with open('house_config.py', 'r') as f:
    content = f.read()

lines = content.split('\n')
config_started = False
config_lines = []
for line in lines:
    if 'HOUSE_CONFIG = {' in line:
        config_started = True
    if config_started:
        config_lines.append(line)
        if line.strip() == '}' and config_started:
            open_braces = ''.join(config_lines).count('{')
            close_braces = ''.join(config_lines).count('}')
            if open_braces == close_braces:
                break

config_code = '\n'.join(config_lines)
exec(config_code, globals())

house_config = HOUSE_CONFIG

print("Generating pillar elevations...")
generate_all_pillar_elevations(house_config, output_dir='docs')

print("\n✓ Done! Check docs folder for pillar_elevation_*.svg files")
