#!/usr/bin/env python3
"""
Render all 7 perspective views with final textures and auto-crop
"""

import bpy
import sys
import os
import math
import mathutils

sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

TEXTURES_DIR = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/textures"

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
print("RENDERING ALL 7 PERSPECTIVES WITH AUTO-CROP")
print("="*70)
print("Settings: 15x walls, 10x roof, soft lighting")
print("="*70)
print()

# Build house
print("Building house...")
exec(open('/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/konkan_house_config.py').read())
build_house(use_explosion=False)
print("✓ House built\n")

# Create materials
print("Creating materials...")

def create_laterite_material():
    mat = bpy.data.materials.new(name="Laterite_15x")
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
        img_texture = bpy.data.images.load(LATERITE_TEXTURE_PATH, check_existing=True)
        node_img = nodes.new(type='ShaderNodeTexImage')
        node_img.location = (-400, 200)
        node_img.image = img_texture

        node_texcoord = nodes.new(type='ShaderNodeTexCoord')
        node_texcoord.location = (-800, 0)
        node_mapping = nodes.new(type='ShaderNodeMapping')
        node_mapping.location = (-600, 0)
        node_mapping.inputs['Scale'].default_value = (15.0, 15.0, 15.0)

        links.new(node_texcoord.outputs['Object'], node_mapping.inputs['Vector'])
        links.new(node_mapping.outputs['Vector'], node_img.inputs['Vector'])
        links.new(node_img.outputs['Color'], node_bsdf.inputs['Base Color'])
    else:
        node_bsdf.inputs['Base Color'].default_value = (0.55, 0.25, 0.15, 1.0)

    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

def create_terracotta_material():
    mat = bpy.data.materials.new(name="Terracotta_10x")
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
        img_texture = bpy.data.images.load(TERRACOTTA_TEXTURE_PATH, check_existing=True)
        node_img = nodes.new(type='ShaderNodeTexImage')
        node_img.location = (-400, 200)
        node_img.image = img_texture

        node_texcoord = nodes.new(type='ShaderNodeTexCoord')
        node_texcoord.location = (-800, 0)
        node_mapping = nodes.new(type='ShaderNodeMapping')
        node_mapping.location = (-600, 0)
        node_mapping.inputs['Scale'].default_value = (10.0, 10.0, 10.0)

        links.new(node_texcoord.outputs['Object'], node_mapping.inputs['Vector'])
        links.new(node_mapping.outputs['Vector'], node_img.inputs['Vector'])
        links.new(node_img.outputs['Color'], node_bsdf.inputs['Base Color'])
    else:
        node_bsdf.inputs['Base Color'].default_value = (0.75, 0.32, 0.22, 1.0)

    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

laterite_mat = create_laterite_material()
terracotta_mat = create_terracotta_material()

# Apply materials
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

print(f"✓ Materials applied to {walls_count} walls, {roofs_count} roofs\n")

# Setup lighting
print("Setting up lighting...")
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

print("✓ Lighting configured\n")

# Configure render
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

# Auto-crop will be done as a separate step after rendering

# Define camera views
plinth_width = 270
plinth_length = 450
building_center_x = plinth_width / 2
building_center_y = plinth_length / 2
building_center_z = 150

center_x_m = to_meters(building_center_x)
center_y_m = to_meters(building_center_y)
center_z_m = to_meters(building_center_z)

camera_views = [
    {
        "name": "front_left_corner",
        "description": "Front Left Corner View (Northwest)",
        "location": (to_meters(-900), to_meters(1250), to_meters(300)),
        "target": (center_x_m, center_y_m, center_z_m),
        "lens": 24
    },
    {
        "name": "front_right_corner",
        "description": "Front Right Corner View (Northeast)",
        "location": (to_meters(1170), to_meters(1250), to_meters(300)),
        "target": (center_x_m, center_y_m, center_z_m),
        "lens": 24
    },
    {
        "name": "back_left_corner",
        "description": "Back Left Corner View (Southwest)",
        "location": (to_meters(-900), to_meters(-800), to_meters(300)),
        "target": (center_x_m, center_y_m, center_z_m),
        "lens": 24
    },
    {
        "name": "back_right_corner",
        "description": "Back Right Corner View (Southeast)",
        "location": (to_meters(1170), to_meters(-800), to_meters(300)),
        "target": (center_x_m, center_y_m, center_z_m),
        "lens": 24
    },
    {
        "name": "aerial",
        "description": "Aerial View",
        "location": (to_meters(700), to_meters(-200), to_meters(1000)),
        "target": (center_x_m, center_y_m, to_meters(100)),
        "lens": 24
    },
    {
        "name": "eye_level_back",
        "description": "Eye Level Back View (South)",
        "location": (center_x_m, to_meters(-900), to_meters(60)),
        "target": (center_x_m, center_y_m, to_meters(150)),
        "lens": 28
    },
    {
        "name": "eye_level_front",
        "description": "Eye Level Front View (North)",
        "location": (center_x_m, to_meters(1350), to_meters(60)),
        "target": (center_x_m, center_y_m, to_meters(150)),
        "lens": 28
    }
]

OUTPUT_DIR = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/realistic_perspectives"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Render all views
print("\n" + "="*70)
print("RENDERING ALL 7 PERSPECTIVE VIEWS")
print("="*70)

render_count = 0
for i, view in enumerate(camera_views, 1):
    print(f"\n[{i}/{len(camera_views)}] {view['description']}")

    camera_data = bpy.data.cameras.new(name=view["name"])
    camera_data.lens = view["lens"]
    camera_obj = bpy.data.objects.new(view["name"] + "_cam", camera_data)
    bpy.context.scene.collection.objects.link(camera_obj)

    camera_obj.location = view["location"]
    direction = mathutils.Vector(view["target"]) - mathutils.Vector(view["location"])
    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera_obj.rotation_euler = rot_quat.to_euler()

    scene.camera = camera_obj
    output_path = os.path.join(OUTPUT_DIR, f"{view['name']}.png")
    scene.render.filepath = output_path

    print(f"  Rendering...")
    try:
        bpy.ops.render.render(write_still=True)

        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path) / 1024 / 1024
            print(f"  ✓ Complete: {file_size:.2f} MB")
            render_count += 1
        else:
            print(f"  ✗ Render failed")
    except Exception as e:
        print(f"  ✗ Error: {e}")

# Save blend file
if bpy.data.filepath:
    bpy.ops.wm.save_mainfile()

print("\n" + "="*70)
print(f"✓ COMPLETE! Rendered {render_count}/{len(camera_views)} views")
print("="*70)
print(f"\nOutput: {OUTPUT_DIR}")
print("\nRun auto_crop_perspectives.py to crop the images for web viewer.")
