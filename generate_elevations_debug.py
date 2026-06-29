#!/usr/bin/env python3
"""
Standalone script to generate elevation views with debug output
Does not require Blender/bpy
"""
import sys
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

# Import only non-Blender modules
from config import GLOBAL_CONFIG
from svg_2d import generate_all_elevations

# Configure
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

# Import house_config without going through konkan_house_lib
# We'll manually read and exec the relevant parts
import re

# Read house_config.py and extract just the HOUSE_CONFIG dictionary
with open('house_config.py', 'r') as f:
    content = f.read()
    
# Find the HOUSE_CONFIG definition
# Execute only the HOUSE_CONFIG part, skipping the imports
lines = content.split('\n')
config_started = False
config_lines = []
for line in lines:
    if 'HOUSE_CONFIG = {' in line:
        config_started = True
    if config_started:
        config_lines.append(line)
        if line.strip() == '}' and config_started:
            # Check if this closes the main dict (not nested)
            # Simple heuristic: if we have roughly balanced braces
            open_braces = ''.join(config_lines).count('{')
            close_braces = ''.join(config_lines).count('}')
            if open_braces == close_braces:
                break

config_code = '\n'.join(config_lines)
exec(config_code, globals())

# Rename to house_config for compatibility
house_config = HOUSE_CONFIG

print("Generating elevations with debug output...")
print(f"House has {len(house_config['floors'])} floors")

generate_all_elevations(house_config, output_dir='docs')

print("\n✓ Done! Check docs folder for:")
print("  - elevation_*.svg files")
print("  - walls_debug_*.json files")
