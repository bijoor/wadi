#!/usr/bin/env python3
"""
Regenerate combined SVGs without requiring Blender
Run this after making changes to individual floor plans or elevations
"""
import sys
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

from config import GLOBAL_CONFIG

# Read and execute house_config.py without importing konkan_house_lib (which needs Blender)
with open('house_config.py', 'r') as f:
    config_code = f.read()

# Remove the Blender-dependent import
config_code = config_code.replace(
    'from konkan_house_lib import GLOBAL_CONFIG',
    '# GLOBAL_CONFIG imported separately'
)

# Execute config in a namespace
namespace = {'GLOBAL_CONFIG': GLOBAL_CONFIG}
exec(config_code, namespace)

# Import SVG functions (no Blender dependency)
from svg_2d import generate_combined_floor_plans, generate_combined_elevations, generate_roof_sections_svg

HOUSE_CONFIG = namespace['HOUSE_CONFIG']

if __name__ == "__main__":
    print("\n" + "="*70)
    print("Regenerating Combined SVGs")
    print("="*70)

    print("\n1. Generating combined floor plans...")
    fp_path = generate_combined_floor_plans(HOUSE_CONFIG)

    print("\n2. Generating combined elevations...")
    el_path = generate_combined_elevations(HOUSE_CONFIG)

    print("\n3. Generating roof sections...")
    rs_path = generate_roof_sections_svg(HOUSE_CONFIG)

    print("\n" + "="*70)
    print("✓ Done!")
    print("="*70)
