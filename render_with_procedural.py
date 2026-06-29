#!/usr/bin/env python3
"""
Render with ENHANCED PROCEDURAL materials - no image textures needed!
Creates realistic brick and tile patterns using Blender nodes
"""

import bpy
import sys
import os
import math
import mathutils

sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

print("\n" + "="*70)
print("RENDERING WITH ENHANCED PROCEDURAL MATERIALS")
print("="*70)
print("Using Blender nodes to create realistic brick and tile patterns")
print("="*70)
print()

# Build house
print("Building house...")
exec(open('/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/konkan_house_config.py').read())
build_house(use_explosion=False)
print("✓ House built")

# Create enhanced procedural materials
print("\nCreating enhanced procedural materials...")

def create_laterite_brick_material():
    """Create realistic laterite brick material with mortar joints using procedural nodes"""
    mat = bpy.data.materials.new(name="Laterite_Procedural")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    # Output
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (800, 0)

    # Principled BSDF
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (500, 0)
    node_bsdf.inputs['Roughness'].default_value = 0.95
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.1
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.1

    # BRICK TEXTURE - creates brick pattern
    node_brick = nodes.new(type='ShaderNodeTexBrick')
    node_brick.location = (-600, 200)
    node_brick.inputs['Scale'].default_value = 8.0  # Number of bricks
    node_brick.inputs['Mortar Size'].default_value = 0.02  # Mortar joint width
    node_brick.inputs['Mortar Smooth'].default_value = 0.0  # Sharp mortar lines
    node_brick.inputs['Bias'].default_value = 0.0
    node_brick.inputs['Brick Width'].default_value = 0.5
    node_brick.inputs['Row Height'].default_value = 0.25

    # Brick color (reddish-brown laterite)
    node_brick.inputs['Color1'].default_value = (0.55, 0.25, 0.15, 1.0)  # Brick color
    node_brick.inputs['Color2'].default_value = (0.6, 0.28, 0.18, 1.0)  # Alternate brick
    node_brick.inputs['Mortar'].default_value = (0.15, 0.12, 0.10, 1.0)  # Dark mortar

    # Texture coordinates
    node_texcoord = nodes.new(type='ShaderNodeTexCoord')
    node_texcoord.location = (-1000, 0)

    # Mapping for proper scaling
    node_mapping = nodes.new(type='ShaderNodeMapping')
    node_mapping.location = (-800, 0)
    node_mapping.inputs['Scale'].default_value = (3.0, 3.0, 3.0)

    # Noise for brick color variation
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-400, -200)
    node_noise.inputs['Scale'].default_value = 15.0
    node_noise.inputs['Detail'].default_value = 10.0

    # Mix noise with brick color
    node_mix = nodes.new(type='ShaderNodeMix')
    node_mix.location = (-200, 0)
    node_mix.data_type = 'RGBA'
    node_mix.inputs['Factor'].default_value = 0.15  # Subtle variation

    # Bump for texture
    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (200, -200)
    node_bump.inputs['Strength'].default_value = 0.3
    node_bump.inputs['Distance'].default_value = 0.05

    # Connect everything
    links.new(node_texcoord.outputs['Object'], node_mapping.inputs['Vector'])
    links.new(node_mapping.outputs['Vector'], node_brick.inputs['Vector'])
    links.new(node_brick.outputs['Color'], node_mix.inputs['A'])
    links.new(node_noise.outputs['Fac'], node_mix.inputs['B'])
    links.new(node_mix.outputs['Result'], node_bsdf.inputs['Base Color'])
    links.new(node_brick.outputs['Fac'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Laterite brick procedural material")
    return mat

def create_terracotta_tile_material():
    """Create realistic terracotta roof tile material using procedural nodes"""
    mat = bpy.data.materials.new(name="Terracotta_Procedural")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    # Output
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (800, 0)

    # Principled BSDF
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (500, 0)
    node_bsdf.inputs['Roughness'].default_value = 0.6
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.5
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.5

    # WAVE TEXTURE for tile ridges
    node_wave = nodes.new(type='ShaderNodeTexWave')
    node_wave.location = (-600, 200)
    node_wave.inputs['Scale'].default_value = 40.0  # Many tiles
    node_wave.inputs['Distortion'].default_value = 0.5
    node_wave.inputs['Detail'].default_value = 5.0
    node_wave.wave_type = 'BANDS'
    node_wave.bands_direction = 'X'

    # Texture coordinates
    node_texcoord = nodes.new(type='ShaderNodeTexCoord')
    node_texcoord.location = (-1000, 0)

    # Mapping
    node_mapping = nodes.new(type='ShaderNodeMapping')
    node_mapping.location = (-800, 0)
    node_mapping.inputs['Scale'].default_value = (5.0, 5.0, 5.0)
    node_mapping.inputs['Rotation'].default_value = (0, 0, math.radians(45))  # Angle tiles

    # Color ramp for tile color
    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-400, 200)
    node_colorramp.color_ramp.elements[0].position = 0.45
    node_colorramp.color_ramp.elements[0].color = (0.7, 0.3, 0.2, 1.0)  # Darker tile
    node_colorramp.color_ramp.elements[1].position = 0.55
    node_colorramp.color_ramp.elements[1].color = (0.8, 0.35, 0.25, 1.0)  # Lighter tile

    # Noise for variation
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-600, -200)
    node_noise.inputs['Scale'].default_value = 10.0
    node_noise.inputs['Detail'].default_value = 8.0

    # Mix for final color
    node_mix = nodes.new(type='ShaderNodeMix')
    node_mix.location = (-200, 0)
    node_mix.data_type = 'RGBA'
    node_mix.inputs['Factor'].default_value = 0.2

    # Bump for tile texture
    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (200, -200)
    node_bump.inputs['Strength'].default_value = 0.4
    node_bump.inputs['Distance'].default_value = 0.1

    # Connect everything
    links.new(node_texcoord.outputs['Object'], node_mapping.inputs['Vector'])
    links.new(node_mapping.outputs['Vector'], node_wave.inputs['Vector'])
    links.new(node_wave.outputs['Fac'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_mix.inputs['A'])
    links.new(node_noise.outputs['Fac'], node_mix.inputs['B'])
    links.new(node_mix.outputs['Result'], node_bsdf.inputs['Base Color'])
    links.new(node_wave.outputs['Fac'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Terracotta tile procedural material")
    return mat

laterite_mat = create_laterite_brick_material()
terracotta_mat = create_terracotta_tile_material()

# Apply materials
print("\nApplying materials...")
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

    # Apply terracotta to roof
    elif 'roof' in obj_name_lower or 'gable' in obj_name_lower:
        if terracotta_mat:
            if len(obj.data.materials) == 0:
                obj.data.materials.append(terracotta_mat)
            else:
                obj.data.materials[0] = terracotta_mat
            roofs_count += 1

print(f"  ✓ Applied to {walls_count} walls, {roofs_count} roofs")

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
    "name": "procedural_test",
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
output_path = os.path.join(OUTPUT_DIR, "procedural_test.png")
scene.render.filepath = output_path

bpy.ops.render.render(write_still=True)

if os.path.exists(output_path):
    file_size = os.path.getsize(output_path) / 1024 / 1024
    print(f"\n✓ Procedural render complete: {output_path}")
    print(f"  File size: {file_size:.2f} MB")
    print("\n  Brick pattern on walls: Clear mortar joints")
    print("  Tile pattern on roof: Wave texture with ridges")
else:
    print("\n✗ Render failed")

print("\n" + "="*70)
print("✓ PROCEDURAL TEST COMPLETE!")
print("="*70)
