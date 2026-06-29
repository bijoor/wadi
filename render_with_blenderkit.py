#!/usr/bin/env python3
"""
Render using BlenderKit materials
Downloads and applies specific BlenderKit assets for realistic materials
"""

import bpy
import sys
import os
import math
import mathutils
import time

sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

print("\n" + "="*70)
print("RENDERING WITH BLENDERKIT MATERIALS")
print("="*70)
print()

# Build house
print("Building house...")
exec(open('/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/konkan_house_config.py').read())
build_house(use_explosion=False)
print("✓ House built\n")

# BlenderKit asset IDs
MANGALORE_TILE_ASSET_ID = "85da6529-fc03-41c0-abd7-7af3718356b5"
LATERITE_WALL_ASSET_ID = "db3c8151-c1ad-4c8e-9033-6638b53af132"

print("Downloading BlenderKit materials...")
print(f"  Mangalore tiles: {MANGALORE_TILE_ASSET_ID}")
print(f"  Laterite walls: {LATERITE_WALL_ASSET_ID}")
print()

def get_blenderkit_material(asset_id, material_name):
    """
    Download and get a BlenderKit material by asset ID
    """
    print(f"  Downloading {material_name}...")

    # Check if material already exists in scene
    for mat in bpy.data.materials:
        if hasattr(mat, 'blenderkit') and hasattr(mat.blenderkit, 'asset_base_id'):
            if mat.blenderkit.asset_base_id == asset_id:
                print(f"    ✓ Material already in scene: {mat.name}")
                return mat

    # Try to download the material using BlenderKit
    try:
        # BlenderKit download operator
        # This might take a moment as it downloads from the server
        bpy.ops.wm.blenderkit_search(
            keywords="",
            category='MATERIAL',
            asset_type='MATERIAL'
        )

        # Import material directly by asset_base_id
        bpy.ops.scene.blenderkit_download(
            asset_type='MATERIAL',
            asset_base_id=asset_id,
            target_object=""
        )

        # Wait a moment for download
        time.sleep(2)

        # Find the downloaded material
        for mat in bpy.data.materials:
            if hasattr(mat, 'blenderkit') and hasattr(mat.blenderkit, 'asset_base_id'):
                if mat.blenderkit.asset_base_id == asset_id:
                    print(f"    ✓ Downloaded: {mat.name}")
                    return mat

        print(f"    ⚠ Material downloaded but not found in scene")
        return None

    except Exception as e:
        print(f"    ⚠ BlenderKit download failed: {e}")
        print(f"    Will try alternative method...")
        return None

def apply_blenderkit_materials():
    """
    Apply BlenderKit materials to objects
    """
    print("\nApplying BlenderKit materials...\n")

    # Get the materials
    mangalore_mat = get_blenderkit_material(MANGALORE_TILE_ASSET_ID, "Mangalore tiles")
    laterite_mat = get_blenderkit_material(LATERITE_WALL_ASSET_ID, "Laterite walls")

    # If download failed, try to find materials by name or create fallback
    if not mangalore_mat:
        print("\n  Searching for Mangalore tile material in scene...")
        for mat in bpy.data.materials:
            if 'mangalore' in mat.name.lower() or 'tile' in mat.name.lower():
                mangalore_mat = mat
                print(f"    ✓ Found: {mat.name}")
                break

    if not laterite_mat:
        print("\n  Searching for laterite/stone material in scene...")
        for mat in bpy.data.materials:
            if 'laterite' in mat.name.lower() or 'stone' in mat.name.lower() or 'brick' in mat.name.lower():
                laterite_mat = mat
                print(f"    ✓ Found: {mat.name}")
                break

    # Apply to objects
    print("\nApplying materials to objects...")
    walls_count = 0
    roofs_count = 0

    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.hide_render or obj.hide_viewport:
            continue

        obj_name_lower = obj.name.lower()

        # Apply laterite to walls
        if any(keyword in obj_name_lower for keyword in ['wall', 'verandah', 'living', 'kitchen', 'bathroom', 'bedroom', 'workshop', 'room']):
            if laterite_mat:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(laterite_mat)
                else:
                    obj.data.materials[0] = laterite_mat
                walls_count += 1

        # Apply mangalore tiles to roof
        elif 'roof' in obj_name_lower or 'gable' in obj_name_lower:
            if mangalore_mat:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(mangalore_mat)
                else:
                    obj.data.materials[0] = mangalore_mat
                roofs_count += 1

    print(f"  ✓ Applied to {walls_count} walls, {roofs_count} roofs")

    return laterite_mat is not None or mangalore_mat is not None

# Try to apply BlenderKit materials
materials_applied = apply_blenderkit_materials()

if not materials_applied:
    print("\n⚠ BlenderKit materials not available")
    print("  Creating fallback procedural materials...")

    # Create simple fallback materials
    # Laterite
    laterite_fallback = bpy.data.materials.new(name="Laterite_Fallback")
    laterite_fallback.use_nodes = True
    laterite_fallback.node_tree.nodes["Principled BSDF"].inputs['Base Color'].default_value = (0.55, 0.25, 0.15, 1.0)
    laterite_fallback.node_tree.nodes["Principled BSDF"].inputs['Roughness'].default_value = 0.95

    # Terracotta
    terracotta_fallback = bpy.data.materials.new(name="Terracotta_Fallback")
    terracotta_fallback.use_nodes = True
    terracotta_fallback.node_tree.nodes["Principled BSDF"].inputs['Base Color'].default_value = (0.75, 0.32, 0.22, 1.0)
    terracotta_fallback.node_tree.nodes["Principled BSDF"].inputs['Roughness'].default_value = 0.6

    # Apply fallback materials
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.hide_render or obj.hide_viewport:
            continue
        obj_name_lower = obj.name.lower()

        if any(keyword in obj_name_lower for keyword in ['wall', 'verandah', 'living', 'kitchen', 'bathroom', 'bedroom', 'workshop', 'room']):
            if len(obj.data.materials) == 0:
                obj.data.materials.append(laterite_fallback)
            else:
                obj.data.materials[0] = laterite_fallback

        elif 'roof' in obj_name_lower or 'gable' in obj_name_lower:
            if len(obj.data.materials) == 0:
                obj.data.materials.append(terracotta_fallback)
            else:
                obj.data.materials[0] = terracotta_fallback

    print("  ✓ Applied fallback materials")

# Setup lighting
print("\nSetting up lighting...")
world = bpy.context.scene.world
world.use_nodes = True
nodes = world.node_tree.nodes
links = world.node_tree.links
nodes.clear()

node_output = nodes.new(type='ShaderNodeOutputWorld')
node_output.location = (600, 0)
node_background = nodes.new(type='ShaderNodeBackground')
node_background.location = (400, 0)
node_background.inputs['Strength'].default_value = 1.5

node_sky = nodes.new(type='ShaderNodeTexSky')
node_sky.location = (200, 0)
node_sky.sky_type = 'HOSEK_WILKIE'
node_sky.sun_elevation = math.radians(60)
node_sky.sun_rotation = math.radians(30)
node_sky.turbidity = 2.0
node_sky.ground_albedo = 0.5

links.new(node_sky.outputs['Color'], node_background.inputs['Color'])
links.new(node_background.outputs['Background'], node_output.inputs['Surface'])

from blender_3d import to_meters
sun_data = bpy.data.lights.new(name="Sun_Main", type='SUN')
sun_data.energy = 2.5
sun_data.angle = math.radians(10)
sun_obj = bpy.data.objects.new(name="Sun_Main", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.location = (10, -10, 20)
sun_obj.rotation_euler = (math.radians(60), 0, math.radians(135))

fill_light_data = bpy.data.lights.new(name="Fill_Light", type='AREA')
fill_light_data.energy = 400
fill_light_data.size = 15
fill_light_data.color = (0.95, 0.97, 1.0)
fill_light_obj = bpy.data.objects.new(name="Fill_Light", object_data=fill_light_data)
bpy.context.scene.collection.objects.link(fill_light_obj)
fill_light_obj.location = (-15, 10, 15)
fill_light_obj.rotation_euler = (math.radians(135), 0, math.radians(-45))

rim_light_data = bpy.data.lights.new(name="Rim_Light", type='AREA')
rim_light_data.energy = 250
rim_light_data.size = 10
rim_light_data.color = (1.0, 0.98, 0.9)
rim_light_obj = bpy.data.objects.new(name="Rim_Light", object_data=rim_light_data)
bpy.context.scene.collection.objects.link(rim_light_obj)
rim_light_obj.location = (15, -15, 12)
rim_light_obj.rotation_euler = (math.radians(120), 0, math.radians(45))

print("✓ Lighting configured")

# Configure render
print("\nConfiguring render...")
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU' if bpy.context.preferences.addons.get('cycles') else 'CPU'
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'
scene.cycles.max_bounces = 12
scene.cycles.diffuse_bounces = 6
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look = 'Medium Contrast'
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'

print("✓ Render configured")

# Render test view
print("\nRendering test view...")
plinth_width = 270
plinth_length = 450
building_center_x = plinth_width / 2
building_center_y = plinth_length / 2
building_center_z = 150

center_x_m = to_meters(building_center_x)
center_y_m = to_meters(building_center_y)
center_z_m = to_meters(building_center_z)

test_view = {
    "name": "blenderkit_test",
    "location": (to_meters(-900), to_meters(1250), to_meters(300)),
    "target": (center_x_m, center_y_m, center_z_m),
    "lens": 24
}

camera_data = bpy.data.cameras.new(name=test_view["name"])
camera_data.lens = test_view["lens"]
camera_obj = bpy.data.objects.new(test_view["name"], camera_data)
bpy.context.scene.collection.objects.link(camera_obj)

camera_obj.location = test_view["location"]
direction = mathutils.Vector(test_view["target"]) - mathutils.Vector(test_view["location"])
rot_quat = direction.to_track_quat('-Z', 'Y')
camera_obj.rotation_euler = rot_quat.to_euler()

scene.camera = camera_obj
OUTPUT_DIR = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/realistic_perspectives"
os.makedirs(OUTPUT_DIR, exist_ok=True)
output_path = os.path.join(OUTPUT_DIR, "blenderkit_test.png")
scene.render.filepath = output_path

bpy.ops.render.render(write_still=True)

if os.path.exists(output_path):
    file_size = os.path.getsize(output_path) / 1024 / 1024
    print(f"\n✓ Render complete: {output_path}")
    print(f"  File size: {file_size:.2f} MB")
else:
    print("\n✗ Render failed")

print("\n" + "="*70)
print("✓ BLENDERKIT TEST COMPLETE!")
print("="*70)
