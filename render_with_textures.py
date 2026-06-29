#!/usr/bin/env python3
"""
Render perspectives with image-based textures and improved lighting
Supports both image textures and procedural materials as fallback
"""

import bpy
import sys
import os
import math
import mathutils

# Add script directory to path
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

# =============================================================================
# TEXTURE CONFIGURATION
# Place your texture images in the textures/ folder and update these paths
# =============================================================================

TEXTURES_DIR = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/textures"

# Laterite wall texture (download from freepik.com or 3dtextures.me)
# Supported formats: .jpg, .jpeg, .png, .webp, .tga, .tiff, .bmp
LATERITE_TEXTURE_PATH = os.path.join(TEXTURES_DIR, "laterite_wall.jpg")
LATERITE_NORMAL_MAP_PATH = os.path.join(TEXTURES_DIR, "laterite_wall_normal.jpg")  # Optional

# Terracotta roof texture (download from 3dtextures.me or texturecan.com)
# Supported formats: .jpg, .jpeg, .png, .webp, .tga, .tiff, .bmp
TERRACOTTA_TEXTURE_PATH = os.path.join(TEXTURES_DIR, "terracotta_roof.jpg")
TERRACOTTA_NORMAL_MAP_PATH = os.path.join(TEXTURES_DIR, "terracotta_roof_normal.jpg")  # Optional

# Auto-detect texture format (checks multiple file extensions)
def find_texture_file(base_path):
    """Find texture file with any supported extension"""
    base_name = os.path.splitext(base_path)[0]
    extensions = ['.jpg', '.jpeg', '.png', '.webp', '.tga', '.tiff', '.bmp']
    for ext in extensions:
        path = base_name + ext
        if os.path.exists(path):
            return path
    return base_path  # Return original path if not found

# Auto-detect actual file formats
LATERITE_TEXTURE_PATH = find_texture_file(LATERITE_TEXTURE_PATH)
LATERITE_NORMAL_MAP_PATH = find_texture_file(LATERITE_NORMAL_MAP_PATH)
TERRACOTTA_TEXTURE_PATH = find_texture_file(TERRACOTTA_TEXTURE_PATH)
TERRACOTTA_NORMAL_MAP_PATH = find_texture_file(TERRACOTTA_NORMAL_MAP_PATH)

# =============================================================================

print("\n" + "="*70)
print("RENDERING WITH IMAGE TEXTURES AND IMPROVED LIGHTING")
print("="*70)
print()

# Check texture directory
os.makedirs(TEXTURES_DIR, exist_ok=True)
print(f"Texture directory: {TEXTURES_DIR}")

# STEP 1: Build the house
print("\nSTEP 1: Building house model...")
exec(open('/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/konkan_house_config.py').read())
build_house(use_explosion=False)
print("✓ House built")

# STEP 2: Create materials with textures
print("\nSTEP 2: Creating realistic materials...")

def create_laterite_material_with_texture():
    """Create laterite material with image texture or procedural fallback"""
    mat = bpy.data.materials.new(name="Laterite_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    # Output node
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
    node_bsdf.inputs['Subsurface Weight'].default_value = 0.05
    node_bsdf.inputs['Subsurface Radius'].default_value = (0.5, 0.3, 0.2)

    # Check if texture image exists
    if os.path.exists(LATERITE_TEXTURE_PATH):
        print(f"  ✓ Using laterite texture: {os.path.basename(LATERITE_TEXTURE_PATH)}")

        # Load image texture
        img_texture = bpy.data.images.load(LATERITE_TEXTURE_PATH, check_existing=True)
        node_img = nodes.new(type='ShaderNodeTexImage')
        node_img.location = (-400, 200)
        node_img.image = img_texture

        # Texture coordinate + mapping for tiling
        node_texcoord = nodes.new(type='ShaderNodeTexCoord')
        node_texcoord.location = (-800, 0)

        node_mapping = nodes.new(type='ShaderNodeMapping')
        node_mapping.location = (-600, 0)
        node_mapping.inputs['Scale'].default_value = (3.0, 3.0, 3.0)  # Tile 3x

        links.new(node_texcoord.outputs['UV'], node_mapping.inputs['Vector'])
        links.new(node_mapping.outputs['Vector'], node_img.inputs['Vector'])
        links.new(node_img.outputs['Color'], node_bsdf.inputs['Base Color'])

        # Normal map if available
        if os.path.exists(LATERITE_NORMAL_MAP_PATH):
            img_normal = bpy.data.images.load(LATERITE_NORMAL_MAP_PATH, check_existing=True)
            img_normal.colorspace_settings.name = 'Non-Color'

            node_normal_img = nodes.new(type='ShaderNodeTexImage')
            node_normal_img.location = (-400, -200)
            node_normal_img.image = img_normal

            node_normal_map = nodes.new(type='ShaderNodeNormalMap')
            node_normal_map.location = (200, -200)
            node_normal_map.inputs['Strength'].default_value = 0.5

            links.new(node_mapping.outputs['Vector'], node_normal_img.inputs['Vector'])
            links.new(node_normal_img.outputs['Color'], node_normal_map.inputs['Color'])
            links.new(node_normal_map.outputs['Normal'], node_bsdf.inputs['Normal'])
            print(f"  ✓ Using laterite normal map: {os.path.basename(LATERITE_NORMAL_MAP_PATH)}")
    else:
        print(f"  ⚠ Laterite texture not found, using enhanced procedural material")

        # Enhanced procedural material
        node_bsdf.inputs['Base Color'].default_value = (0.55, 0.25, 0.15, 1.0)

        # Noise texture for variation
        node_noise = nodes.new(type='ShaderNodeTexNoise')
        node_noise.location = (-500, 0)
        node_noise.inputs['Scale'].default_value = 8.0
        node_noise.inputs['Detail'].default_value = 15.0
        node_noise.inputs['Roughness'].default_value = 0.65

        # Color ramp for more realistic color variation
        node_colorramp = nodes.new(type='ShaderNodeValToRGB')
        node_colorramp.location = (-200, 0)
        node_colorramp.color_ramp.elements[0].position = 0.35
        node_colorramp.color_ramp.elements[0].color = (0.48, 0.20, 0.10, 1.0)
        node_colorramp.color_ramp.elements[1].position = 0.65
        node_colorramp.color_ramp.elements[1].color = (0.62, 0.30, 0.20, 1.0)

        # Bump for surface detail
        node_bump = nodes.new(type='ShaderNodeBump')
        node_bump.location = (200, -200)
        node_bump.inputs['Strength'].default_value = 0.4
        node_bump.inputs['Distance'].default_value = 0.08

        # Voronoi for stone texture
        node_voronoi = nodes.new(type='ShaderNodeTexVoronoi')
        node_voronoi.location = (-500, -300)
        node_voronoi.inputs['Scale'].default_value = 20.0
        node_voronoi.feature = 'DISTANCE_TO_EDGE'

        links.new(node_noise.outputs['Fac'], node_colorramp.inputs['Fac'])
        links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
        links.new(node_voronoi.outputs['Distance'], node_bump.inputs['Height'])
        links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])

    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

def create_terracotta_material_with_texture():
    """Create terracotta material with image texture or procedural fallback"""
    mat = bpy.data.materials.new(name="Terracotta_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    # Output node
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (800, 0)

    # Principled BSDF
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (500, 0)
    node_bsdf.inputs['Roughness'].default_value = 0.55
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.5
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.5

    # Check if texture image exists
    if os.path.exists(TERRACOTTA_TEXTURE_PATH):
        print(f"  ✓ Using terracotta texture: {os.path.basename(TERRACOTTA_TEXTURE_PATH)}")

        # Load image texture
        img_texture = bpy.data.images.load(TERRACOTTA_TEXTURE_PATH, check_existing=True)
        node_img = nodes.new(type='ShaderNodeTexImage')
        node_img.location = (-400, 200)
        node_img.image = img_texture

        # Texture coordinate + mapping for tiling
        node_texcoord = nodes.new(type='ShaderNodeTexCoord')
        node_texcoord.location = (-800, 0)

        node_mapping = nodes.new(type='ShaderNodeMapping')
        node_mapping.location = (-600, 0)
        node_mapping.inputs['Scale'].default_value = (2.0, 2.0, 2.0)  # Tile 2x

        links.new(node_texcoord.outputs['UV'], node_mapping.inputs['Vector'])
        links.new(node_mapping.outputs['Vector'], node_img.inputs['Vector'])
        links.new(node_img.outputs['Color'], node_bsdf.inputs['Base Color'])

        # Normal map if available
        if os.path.exists(TERRACOTTA_NORMAL_MAP_PATH):
            img_normal = bpy.data.images.load(TERRACOTTA_NORMAL_MAP_PATH, check_existing=True)
            img_normal.colorspace_settings.name = 'Non-Color'

            node_normal_img = nodes.new(type='ShaderNodeTexImage')
            node_normal_img.location = (-400, -200)
            node_normal_img.image = img_normal

            node_normal_map = nodes.new(type='ShaderNodeNormalMap')
            node_normal_map.location = (200, -200)
            node_normal_map.inputs['Strength'].default_value = 0.6

            links.new(node_mapping.outputs['Vector'], node_normal_img.inputs['Vector'])
            links.new(node_normal_img.outputs['Color'], node_normal_map.inputs['Color'])
            links.new(node_normal_map.outputs['Normal'], node_bsdf.inputs['Normal'])
            print(f"  ✓ Using terracotta normal map: {os.path.basename(TERRACOTTA_NORMAL_MAP_PATH)}")
    else:
        print(f"  ⚠ Terracotta texture not found, using enhanced procedural material")

        # Enhanced procedural material
        node_bsdf.inputs['Base Color'].default_value = (0.75, 0.32, 0.22, 1.0)

        # Wave texture for tile ridges
        node_wave = nodes.new(type='ShaderNodeTexWave')
        node_wave.location = (-500, 0)
        node_wave.inputs['Scale'].default_value = 25.0
        node_wave.inputs['Distortion'].default_value = 2.0
        node_wave.inputs['Detail'].default_value = 8.0
        node_wave.wave_type = 'BANDS'

        # Noise for variation
        node_noise = nodes.new(type='ShaderNodeTexNoise')
        node_noise.location = (-500, -200)
        node_noise.inputs['Scale'].default_value = 10.0
        node_noise.inputs['Detail'].default_value = 8.0

        # Mix textures
        node_mix = nodes.new(type='ShaderNodeMix')
        node_mix.location = (-300, 0)
        node_mix.data_type = 'RGBA'
        node_mix.inputs['Factor'].default_value = 0.4

        # Color ramp
        node_colorramp = nodes.new(type='ShaderNodeValToRGB')
        node_colorramp.location = (-100, 0)
        node_colorramp.color_ramp.elements[0].color = (0.68, 0.26, 0.16, 1.0)
        node_colorramp.color_ramp.elements[1].color = (0.82, 0.38, 0.28, 1.0)

        # Bump
        node_bump = nodes.new(type='ShaderNodeBump')
        node_bump.location = (200, -200)
        node_bump.inputs['Strength'].default_value = 0.3

        links.new(node_wave.outputs['Fac'], node_mix.inputs['A'])
        links.new(node_noise.outputs['Fac'], node_mix.inputs['B'])
        links.new(node_mix.outputs['Result'], node_colorramp.inputs['Fac'])
        links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
        links.new(node_wave.outputs['Fac'], node_bump.inputs['Height'])
        links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])

    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])
    return mat

# Create materials
laterite_mat = create_laterite_material_with_texture()
terracotta_mat = create_terracotta_material_with_texture()

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

# STEP 3: Setup IMPROVED LIGHTING with much more ambient light
print("\nSTEP 3: Setting up improved lighting (reduced shadows)...")

world = bpy.context.scene.world
world.use_nodes = True
nodes = world.node_tree.nodes
links = world.node_tree.links
nodes.clear()

node_output = nodes.new(type='ShaderNodeOutputWorld')
node_output.location = (600, 0)

node_background = nodes.new(type='ShaderNodeBackground')
node_background.location = (400, 0)
node_background.inputs['Strength'].default_value = 1.5  # INCREASED from 1.0

node_sky = nodes.new(type='ShaderNodeTexSky')
node_sky.location = (200, 0)
node_sky.sky_type = 'HOSEK_WILKIE'
node_sky.sun_elevation = math.radians(60)  # HIGHER sun angle (was 45)
node_sky.sun_rotation = math.radians(30)
node_sky.turbidity = 2.0  # CLEARER sky (was 3.0)
node_sky.ground_albedo = 0.5  # MORE ground reflection (was 0.3)

links.new(node_sky.outputs['Color'], node_background.inputs['Color'])
links.new(node_background.outputs['Background'], node_output.inputs['Surface'])

# Add STRONGER sun light
from blender_3d import to_meters
sun_data = bpy.data.lights.new(name="Sun_Main", type='SUN')
sun_data.energy = 2.5  # REDUCED from 3.0 for softer shadows
sun_data.angle = math.radians(10)  # LARGER sun angle for softer shadows (was 5)
sun_obj = bpy.data.objects.new(name="Sun_Main", object_data=sun_data)
bpy.context.scene.collection.objects.link(sun_obj)
sun_obj.location = (10, -10, 20)
sun_obj.rotation_euler = (math.radians(60), 0, math.radians(135))  # Higher angle

# Add STRONG fill light to reduce shadow darkness
fill_light_data = bpy.data.lights.new(name="Fill_Light", type='AREA')
fill_light_data.energy = 400  # MUCH STRONGER (was 200)
fill_light_data.size = 15  # LARGER area (was 10)
fill_light_data.color = (0.95, 0.97, 1.0)  # Slightly blue fill
fill_light_obj = bpy.data.objects.new(name="Fill_Light", object_data=fill_light_data)
bpy.context.scene.collection.objects.link(fill_light_obj)
fill_light_obj.location = (-15, 10, 15)
fill_light_obj.rotation_euler = (math.radians(135), 0, math.radians(-45))

# Add rim light from opposite side
rim_light_data = bpy.data.lights.new(name="Rim_Light", type='AREA')
rim_light_data.energy = 250  # INCREASED (was 150)
rim_light_data.size = 10
rim_light_data.color = (1.0, 0.98, 0.9)  # Warm rim
rim_light_obj = bpy.data.objects.new(name="Rim_Light", object_data=rim_light_data)
bpy.context.scene.collection.objects.link(rim_light_obj)
rim_light_obj.location = (15, -15, 12)
rim_light_obj.rotation_euler = (math.radians(120), 0, math.radians(45))

print("✓ Lighting configured with reduced shadow darkness:")
print("  • Brighter sky (strength 1.5, higher sun at 60°)")
print("  • Softer sun shadows (larger sun angle)")
print("  • Strong fill light (energy 400)")
print("  • Additional rim light (energy 250)")

# STEP 4: Configure render settings
print("\nSTEP 4: Configuring render settings...")
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'GPU' if bpy.context.preferences.addons.get('cycles') else 'CPU'
scene.cycles.samples = 128
scene.cycles.preview_samples = 64
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'

scene.cycles.max_bounces = 12
scene.cycles.diffuse_bounces = 6  # INCREASED for better ambient light spread
scene.cycles.glossy_bounces = 4
scene.cycles.transmission_bounces = 12
scene.cycles.volume_bounces = 0
scene.cycles.transparent_max_bounces = 8

scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look = 'Medium Contrast'  # CHANGED from High to Medium for softer look

scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.compression = 15

print("✓ Render settings configured")

# STEP 5: Define and render ONE perspective view as a test
print("\n" + "="*70)
print("STEP 5: RENDERING TEST VIEW")
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

# Render just the front left corner view as a test
test_view = {
    "name": "test_front_left",
    "description": "Test Front Left Corner View",
    "location": (to_meters(-900), to_meters(1250), to_meters(300)),
    "target": (center_x_m, center_y_m, center_z_m),
    "lens": 24
}

OUTPUT_DIR = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/realistic_perspectives"
os.makedirs(OUTPUT_DIR, exist_ok=True)

print(f"\nRendering test view: {test_view['description']}")

# Create camera
camera_data = bpy.data.cameras.new(name=test_view["name"])
camera_data.lens = test_view.get("lens", 35)
camera_obj = bpy.data.objects.new(test_view["name"] + "_camera", camera_data)
bpy.context.scene.collection.objects.link(camera_obj)

# Position camera
camera_obj.location = test_view["location"]

# Point camera at target
direction = mathutils.Vector(test_view["target"]) - mathutils.Vector(test_view["location"])
rot_quat = direction.to_track_quat('-Z', 'Y')
camera_obj.rotation_euler = rot_quat.to_euler()

# Set as active camera
scene.camera = camera_obj

# Set output path
output_path = os.path.join(OUTPUT_DIR, f"{test_view['name']}.png")
scene.render.filepath = output_path

print(f"  Output: {output_path}")
print(f"  Rendering with improved lighting...")

# Render
bpy.ops.render.render(write_still=True)

if os.path.exists(output_path):
    file_size = os.path.getsize(output_path) / 1024 / 1024
    print(f"\n  ✓ Test render complete: {output_path} ({file_size:.2f} MB)")
else:
    print(f"\n  ✗ Error: Render failed")

# Save blend file
if bpy.data.filepath:
    bpy.ops.wm.save_mainfile()
    print("\n✓ Saved blend file")

print("\n" + "="*70)
print("✓ TEST RENDER COMPLETE!")
print("="*70)
print()
print("Next steps:")
print("1. Check the test render to see if lighting looks good")
print("2. Download textures if desired (see instructions below)")
print("3. Run again to render all 7 views")
print()
