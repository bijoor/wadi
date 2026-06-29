#!/usr/bin/env python3
"""
Render all perspective views with realistic materials
This creates photorealistic renders from all the perspective camera angles
"""

import bpy
import sys
import os
import math
import mathutils

# Add script directory to path
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

print("\n" + "="*70)
print("RENDERING REALISTIC PERSPECTIVE VIEWS")
print("="*70)
print()

# STEP 1: Build the house
print("STEP 1: Building house model...")
exec(open('/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/konkan_house_config.py').read())
build_house(use_explosion=False)
print("✓ House built")

# STEP 2: Create and apply realistic materials
print("\nSTEP 2: Creating realistic materials...")

def create_laterite_material():
    """Create realistic laterite material"""
    mat = bpy.data.materials.new(name="Laterite_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (600, 0)
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (300, 0)
    node_bsdf.inputs['Base Color'].default_value = (0.55, 0.25, 0.15, 1.0)
    node_bsdf.inputs['Roughness'].default_value = 0.95
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.1
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.1
    node_bsdf.inputs['Subsurface Weight'].default_value = 0.05
    node_bsdf.inputs['Subsurface Radius'].default_value = (0.5, 0.3, 0.2)

    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-300, 0)
    node_noise.inputs['Scale'].default_value = 5.0
    node_noise.inputs['Detail'].default_value = 10.0
    node_noise.inputs['Roughness'].default_value = 0.7

    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-100, 0)
    node_colorramp.color_ramp.elements[0].position = 0.4
    node_colorramp.color_ramp.elements[0].color = (0.5, 0.22, 0.12, 1.0)
    node_colorramp.color_ramp.elements[1].position = 0.6
    node_colorramp.color_ramp.elements[1].color = (0.6, 0.28, 0.18, 1.0)

    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (0, -200)
    node_bump.inputs['Strength'].default_value = 0.3
    node_bump.inputs['Distance'].default_value = 0.05

    node_voronoi = nodes.new(type='ShaderNodeTexVoronoi')
    node_voronoi.location = (-300, -200)
    node_voronoi.inputs['Scale'].default_value = 15.0
    node_voronoi.feature = 'DISTANCE_TO_EDGE'

    links.new(node_noise.outputs['Fac'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
    links.new(node_voronoi.outputs['Distance'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

def create_terracotta_material():
    """Create realistic terracotta material"""
    mat = bpy.data.materials.new(name="Terracotta_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (600, 0)
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (300, 0)
    node_bsdf.inputs['Base Color'].default_value = (0.75, 0.32, 0.22, 1.0)
    node_bsdf.inputs['Roughness'].default_value = 0.6
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.4
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.4

    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-300, 0)
    node_noise.inputs['Scale'].default_value = 8.0
    node_noise.inputs['Detail'].default_value = 5.0

    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-100, 0)
    node_colorramp.color_ramp.elements[0].color = (0.7, 0.28, 0.18, 1.0)
    node_colorramp.color_ramp.elements[1].color = (0.8, 0.36, 0.26, 1.0)

    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (0, -200)
    node_bump.inputs['Strength'].default_value = 0.2

    node_wave = nodes.new(type='ShaderNodeTexWave')
    node_wave.location = (-300, -200)
    node_wave.inputs['Scale'].default_value = 20.0
    node_wave.wave_type = 'BANDS'

    links.new(node_noise.outputs['Fac'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
    links.new(node_wave.outputs['Fac'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

# Create materials
laterite_mat = create_laterite_material()
terracotta_mat = create_terracotta_material()

# Apply materials
walls_count = 0
roof_count = 0
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
            roof_count += 1

print(f"✓ Applied materials: {walls_count} walls, {roof_count} roofs")

# STEP 3: Setup world lighting
print("\nSTEP 3: Setting up lighting...")
world = bpy.context.scene.world
world.use_nodes = True
nodes = world.node_tree.nodes
links = world.node_tree.links
nodes.clear()

node_output = nodes.new(type='ShaderNodeOutputWorld')
node_output.location = (600, 0)
node_background = nodes.new(type='ShaderNodeBackground')
node_background.location = (400, 0)
node_background.inputs['Strength'].default_value = 1.0

node_sky = nodes.new(type='ShaderNodeTexSky')
node_sky.location = (200, 0)
node_sky.sky_type = 'HOSEK_WILKIE'
node_sky.sun_elevation = math.radians(45)
node_sky.sun_rotation = math.radians(30)
node_sky.turbidity = 3.0
node_sky.ground_albedo = 0.3

links.new(node_sky.outputs['Color'], node_background.inputs['Color'])
links.new(node_background.outputs['Background'], node_output.inputs['Surface'])

# Add sun light
from blender_3d import to_meters
sun_data = bpy.data.lights.new(name="Sun_Main", type='SUN')
sun_data.energy = 3.0
sun_data.angle = math.radians(5)
sun_obj = bpy.data.objects.new(name="Sun_Main", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.location = (10, -10, 20)
sun_obj.rotation_euler = (math.radians(45), 0, math.radians(135))

print("✓ Lighting configured")

# STEP 4: Configure render settings
print("\nSTEP 4: Configuring render settings...")
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU' if bpy.context.preferences.addons.get('cycles') else 'CPU'
scene.cycles.samples = 128  # Lower samples for faster renders
scene.cycles.preview_samples = 64
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'

scene.cycles.max_bounces = 12
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 4
scene.cycles.transmission_bounces = 12
scene.cycles.volume_bounces = 0
scene.cycles.transparent_max_bounces = 8

scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look = 'Medium High Contrast'
scene.render.film_transparent = False

scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.compression = 15

print("✓ Render settings configured (Cycles, 128 samples, 1920x1080)")

# STEP 5: Define and render perspective views
print("\n" + "="*70)
print("STEP 5: RENDERING PERSPECTIVE VIEWS")
print("="*70)

# Building center
plinth_width = 270
plinth_length = 450
building_center_x = plinth_width / 2
building_center_y = plinth_length / 2
building_center_z = 150

center_x_m = to_meters(building_center_x)
center_y_m = to_meters(building_center_y)
center_z_m = to_meters(building_center_z)

# Define camera views (same as original script)
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

# Output directory
OUTPUT_DIR = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/realistic_perspectives"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Render each view
render_count = 0
for i, view in enumerate(camera_views, 1):
    print(f"\n[{i}/{len(camera_views)}] Rendering: {view['description']}")
    print(f"  Camera: {view['name']}")

    # Create camera
    camera_data = bpy.data.cameras.new(name=view["name"])
    camera_data.lens = view.get("lens", 35)
    camera_obj = bpy.data.objects.new(view["name"] + "_camera", camera_data)
    bpy.context.scene.collection.objects.link(camera_obj)

    # Position camera
    camera_obj.location = view["location"]

    # Point camera at target
    direction = mathutils.Vector(view["target"]) - mathutils.Vector(view["location"])
    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera_obj.rotation_euler = rot_quat.to_euler()

    # Set as active camera
    scene.camera = camera_obj

    # Set output path
    output_path = os.path.join(OUTPUT_DIR, f"{view['name']}.png")
    scene.render.filepath = output_path

    print(f"  Location: ({view['location'][0]:.1f}, {view['location'][1]:.1f}, {view['location'][2]:.1f})")
    print(f"  Target: ({view['target'][0]:.1f}, {view['target'][1]:.1f}, {view['target'][2]:.1f})")
    print(f"  Lens: {camera_data.lens}mm")
    print(f"  Rendering...")

    # Render
    try:
        bpy.ops.render.render(write_still=True)

        if os.path.exists(output_path):
            file_size = os.path.getsize(output_path) / 1024 / 1024
            print(f"  ✓ Saved: {output_path} ({file_size:.2f} MB)")
            render_count += 1
        else:
            print(f"  ✗ Error: File not created")
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()

# Save blend file
if bpy.data.filepath:
    bpy.ops.wm.save_mainfile()
    print("\n✓ Saved blend file")

print("\n" + "="*70)
print("✓ RENDERING COMPLETE!")
print("="*70)
print(f"\nRendered {render_count}/{len(camera_views)} views")
print(f"Output directory: {OUTPUT_DIR}")
print()
print("Rendered views:")
for view in camera_views:
    output_path = os.path.join(OUTPUT_DIR, f"{view['name']}.png")
    if os.path.exists(output_path):
        file_size = os.path.getsize(output_path) / 1024 / 1024
        print(f"  ✓ {view['name']}.png ({file_size:.2f} MB) - {view['description']}")
