#!/usr/bin/env python3
"""
Generate both normal and exploded 3D models
This script runs Blender twice to generate both versions
"""

import os
import sys
import subprocess

# Project root is the parent of scripts/. All artifacts live there.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
# GLBs land under docs/3d/ (post-reorg location the viewer reads from).
DOCS_DIR = os.path.join(PROJECT_ROOT, "docs", "3d")

# Blender file path
BLEND_FILE = os.path.join(PROJECT_ROOT, "house-model.blend")

# Python script to run inside Blender
BLENDER_SCRIPT_NORMAL = """
import bpy
import sys
sys.path.insert(0, '{script_dir}')

# Import and execute the house configuration
exec(open('{script_dir}/konkan_house_config.py').read())

# Generate the normal model
print("\\n" + "="*70)
print("GENERATING NORMAL MODEL (use_explosion=False)")
print("="*70 + "\\n")

# Clear any existing objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Build the house without explosion
build_house(use_explosion=False)

# Export to GLB
import blender_3d
blender_3d.export_to_web('{docs_dir}/konkan_house.glb')
print("\\n✓ Normal model exported to: {docs_dir}/konkan_house.glb\\n")
"""

BLENDER_SCRIPT_EXPLODED = """
import bpy
import sys
sys.path.insert(0, '{script_dir}')

# Import and execute the house configuration first
exec(open('{script_dir}/konkan_house_config.py').read())

# Explosion factors are configured in house_config.py
from house_config import GLOBAL_CONFIG
print(f"\\nExploded model using explosion factors: {{GLOBAL_CONFIG['explosion_factors']}} units\\n")

# Generate the exploded model
print("\\n" + "="*70)
print("GENERATING EXPLODED MODEL (use_explosion=True)")
print("="*70 + "\\n")

# Clear any existing objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Build the house with explosion enabled
build_house(use_explosion=True)

# Export to GLB
import blender_3d
blender_3d.export_to_web('{docs_dir}/konkan_house_exploded.glb')
print("\\n✓ Exploded model exported to: {docs_dir}/konkan_house_exploded.glb\\n")
"""

def run_blender_script(script_content, description):
    """Run a Python script inside Blender"""
    print(f"\n{'='*70}")
    print(f"{description}")
    print(f"{'='*70}\n")

    # Create a temporary script file
    temp_script = os.path.join(SCRIPT_DIR, "_temp_blender_script.py")
    with open(temp_script, 'w') as f:
        f.write(script_content)

    try:
        # Run Blender in background mode
        # Check if on macOS and use the full path
        blender_cmd = "/Applications/Blender.app/Contents/MacOS/Blender" if os.path.exists("/Applications/Blender.app") else "blender"

        cmd = [
            blender_cmd,
            "--background",
            BLEND_FILE,
            "--python", temp_script
        ]

        result = subprocess.run(cmd, cwd=SCRIPT_DIR, capture_output=False)

        if result.returncode != 0:
            print(f"\n✗ Error running Blender script: {description}")
            return False

        return True

    finally:
        # Clean up temp script
        if os.path.exists(temp_script):
            os.remove(temp_script)

def main():
    """Generate both normal and exploded models"""

    # Explosion factors are now configured in house_config.py
    # Edit house_config.py to change the explosion spacing for the exploded view

    # Ensure docs directory exists
    os.makedirs(DOCS_DIR, exist_ok=True)

    # Generate normal model
    normal_script = BLENDER_SCRIPT_NORMAL.format(
        script_dir=os.path.join(PROJECT_ROOT, "python"),
        docs_dir=DOCS_DIR
    )

    if not run_blender_script(normal_script, "Generating Normal Model"):
        print("\n✗ Failed to generate normal model")
        return 1

    # Generate exploded model
    exploded_script = BLENDER_SCRIPT_EXPLODED.format(
        script_dir=os.path.join(PROJECT_ROOT, "python"),
        docs_dir=DOCS_DIR
    )

    if not run_blender_script(exploded_script, "Generating Exploded Model"):
        print("\n✗ Failed to generate exploded model")
        return 1

    print("\n" + "="*70)
    print("✓ BOTH MODELS GENERATED SUCCESSFULLY")
    print("="*70)
    print(f"\nNormal model: {os.path.join(DOCS_DIR, 'konkan_house.glb')}")
    print(f"Exploded model: {os.path.join(DOCS_DIR, 'konkan_house_exploded.glb')}")
    print(f"\nView at: http://localhost:8000")
    print("="*70 + "\n")

    return 0

if __name__ == "__main__":
    sys.exit(main())
