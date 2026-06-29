#!/usr/bin/env python3
"""
Render with user's downloaded textures at 25x scale for walls
"""

import bpy
import sys
import os
import math
import mathutils

sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

TEXTURES_DIR = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/textures"

# Find texture files
def find_texture_file(base_path):
    base_name = os.path.splitext(base_path)[0]
    extensions = ['.jpg', '.jpeg', '.png', '.webp', '.tga', '.tiff', '.bmp']
    for ext in extensions:
        path = base_name + ext
        if os.path.exists(path):
            return path
    return base_path

LATERITE_TEXTURE_PATH = find_texture_file(os.path.join(TEXTURES_DIR, "laterite_wall.jpg"))
TERRACOTTA_TEXTURE_PATH = find_texture_file(os.path.join(TEXTURES_DIR, "terracotta_roof.jpg"))

print("\n" + "="*70)
print("RENDERING WITH USER TEXTURES - 15X WALLS / 10X ROOF")
print("="*70)
print()

# Build house
print("Building house...")
exec(open('/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/konkan_house_config.py').read())
build_house(use_explosion=False)
print("✓ House built\n")

# Create materials
print("Creating materials with textures...")

def create_laterite_material():
    mat = bpy.data.materials.new(name="Laterite_25x")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (800, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (500, 0)
    node_bsdf.inputs['Roughness'].default_value = 0.95
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.1
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.1

    if os.path.exists(LATERITE_TEXTURE_PATH):
        print(f"  ✓ Using laterite texture at 15x: {os.path.basename(LATERITE_TEXTURE_PATH)}")

        img_texture = bpy.data.images.load(LATERITE_TEXTURE_PATH, check_existing=True)
        node_img = nodes.new(type='ShaderNodeTexImage')
        node_img.location = (-400, 200)
        node_img.image = img_texture

        node_texcoord = nodes.new(type='ShaderNodeTexCoord')
        node_texcoord.location = (-800, 0)

        node_mapping = nodes.new(type='ShaderNodeMapping')
        node_mapping.location = (-600, 0)
        node_mapping.inputs['Scale'].default_value = (15.0, 15.0, 15.0)  # 15X SCALE

        # Use Object coordinates
        links.new(node_texcoord.outputs['Object'], node_mapping.inputs['Vector'])
        links.new(node_mapping.outputs['Vector'], node_img.inputs['Vector'])
        links.new(node_img.outputs['Color'], node_bsdf.inputs['Base Color'])
    else:
        print(f"  ⚠ Texture not found, using solid color")
        node_bsdf.inputs['Base Color'].default_value = (0.55, 0.25, 0.15, 1.0)

    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

def create_terracotta_material():
    mat = bpy.data.materials.new(name="Terracotta_50x")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (800, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (500, 0)
    node_bsdf.inputs['Roughness'].default_value = 0.6
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.5
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.5

    if os.path.exists(TERRACOTTA_TEXTURE_PATH):
        print(f"  ✓ Using terracotta texture at 10x: {os.path.basename(TERRACOTTA_TEXTURE_PATH)}")

        img_texture = bpy.data.images.load(TERRACOTTA_TEXTURE_PATH, check_existing=True)
        node_img = nodes.new(type='ShaderNodeTexImage')
        node_img.location = (-400, 200)
        node_img.image = img_texture

        node_texcoord = nodes.new(type='ShaderNodeTexCoord')
        node_texcoord.location = (-800, 0)

        node_mapping = nodes.new(type='ShaderNodeMapping')
        node_mapping.location = (-600, 0)
        node_mapping.inputs['Scale'].default_value = (10.0, 10.0, 10.0)  # 10X SCALE

        # Use Object coordinates
        links.new(node_texcoord.outputs['Object'], node_mapping.inputs['Vector'])
        links.new(node_mapping.outputs['Vector'], node_img.inputs['Vector'])
        links.new(node_img.outputs['Color'], node_bsdf.inputs['Base Color'])
    else:
        print(f"  ⚠ Texture not found, using solid color")
        node_bsdf.inputs['Base Color'].default_value = (0.75, 0.32, 0.22, 1.0)

    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

laterite_mat = create_laterite_material()
terracotta_mat = create_terracotta_material()

# Apply materials
print("\nApplying materials...")
walls_count = 0
roofs_count = 0

for obj in bpy.data.objects:
    if obj.type != 'MESH' or obj.hide_render or obj.hide_viewport:
        continue

    obj_name_lower = obj.name.lower()

    if any(keyword in obj_name_lower for keyword in ['wall', 'verandah', 'living', 'kitchen', 'bathroom', 'bedroom', 'workshop', 'room']):
        if laterite_mat:
            if len(obj.data.materials) == 0:
                obj.data.materials.append(laterite_mat)
            else:
                obj.data.materials[0] = laterite_mat
            walls_count += 1

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
    "name": "final_texture_test",
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
output_path = os.path.join(OUTPUT_DIR, "final_texture_test.png")
scene.render.filepath = output_path

bpy.ops.render.render(write_still=True)

if os.path.exists(output_path):
    file_size = os.path.getsize(output_path) / 1024 / 1024
    print(f"\n✓ Test render complete: {output_path}")
    print(f"  File size: {file_size:.2f} MB")
    print(f"\n  Wall texture: 15x scale")
    print(f"  Roof texture: 10x scale")
else:
    print("\n✗ Render failed")

print("\n" + "="*70)
print("✓ FINAL TEXTURE TEST COMPLETE!")
print("="*70)
