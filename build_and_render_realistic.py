#!/usr/bin/env python3
"""
Build House Model and Apply Realistic Materials
This script:
1. Builds the complete house 3D model
2. Applies realistic PBR materials
3. Sets up lighting
4. Renders the scene
"""

import bpy
import sys
import os

# Add script directory to path
sys.path.insert(0, '/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender')

print("\n" + "="*70)
print("STEP 1: BUILDING HOUSE MODEL")
print("="*70)
print()

# Import and execute the house configuration to build the model
exec(open('/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/konkan_house_config.py').read())

# Build the house without explosion
build_house(use_explosion=False)

print("\n" + "="*70)
print("STEP 2: APPLYING REALISTIC MATERIALS")
print("="*70)
print()

# Now import and run the realistic materials script
import math

def create_laterite_material():
    """Create a realistic laterite stone material."""
    mat = bpy.data.materials.new(name="Laterite_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Clear default nodes
    nodes.clear()

    # Create nodes
    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (600, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (300, 0)

    # Laterite stone properties
    node_bsdf.inputs['Base Color'].default_value = (0.55, 0.25, 0.15, 1.0)
    node_bsdf.inputs['Roughness'].default_value = 0.95
    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.1
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.1

    # Add subsurface scattering
    node_bsdf.inputs['Subsurface Weight'].default_value = 0.05
    node_bsdf.inputs['Subsurface Radius'].default_value = (0.5, 0.3, 0.2)

    # Noise texture for variation
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-300, 0)
    node_noise.inputs['Scale'].default_value = 5.0
    node_noise.inputs['Detail'].default_value = 10.0
    node_noise.inputs['Roughness'].default_value = 0.7

    # Color ramp
    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-100, 0)
    node_colorramp.color_ramp.elements[0].position = 0.4
    node_colorramp.color_ramp.elements[0].color = (0.5, 0.22, 0.12, 1.0)
    node_colorramp.color_ramp.elements[1].position = 0.6
    node_colorramp.color_ramp.elements[1].color = (0.6, 0.28, 0.18, 1.0)

    # Bump map
    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (0, -200)
    node_bump.inputs['Strength'].default_value = 0.3
    node_bump.inputs['Distance'].default_value = 0.05

    # Voronoi texture
    node_voronoi = nodes.new(type='ShaderNodeTexVoronoi')
    node_voronoi.location = (-300, -200)
    node_voronoi.inputs['Scale'].default_value = 15.0
    node_voronoi.feature = 'DISTANCE_TO_EDGE'

    # Connect nodes
    links.new(node_noise.outputs['Fac'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
    links.new(node_voronoi.outputs['Distance'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Laterite_Realistic material")
    return mat

def create_terracotta_material():
    """Create a realistic terracotta tile material."""
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

    # Noise
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-300, 0)
    node_noise.inputs['Scale'].default_value = 8.0
    node_noise.inputs['Detail'].default_value = 5.0

    # Color ramp
    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-100, 0)
    node_colorramp.color_ramp.elements[0].color = (0.7, 0.28, 0.18, 1.0)
    node_colorramp.color_ramp.elements[1].color = (0.8, 0.36, 0.26, 1.0)

    # Bump
    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (0, -200)
    node_bump.inputs['Strength'].default_value = 0.2

    # Wave texture
    node_wave = nodes.new(type='ShaderNodeTexWave')
    node_wave.location = (-300, -200)
    node_wave.inputs['Scale'].default_value = 20.0
    node_wave.wave_type = 'BANDS'

    # Connect
    links.new(node_noise.outputs['Fac'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
    links.new(node_wave.outputs['Fac'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Terracotta_Realistic material")
    return mat

def create_aluminum_anodized_material():
    """Create a realistic golden anodized aluminum material."""
    mat = bpy.data.materials.new(name="Aluminum_Golden_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    nodes.clear()

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (400, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (200, 0)
    node_bsdf.inputs['Base Color'].default_value = (0.85, 0.65, 0.35, 1.0)
    node_bsdf.inputs['Metallic'].default_value = 1.0
    node_bsdf.inputs['Roughness'].default_value = 0.25

    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.8
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.8

    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Aluminum_Golden_Realistic material")
    return mat

def create_wood_material():
    """Create a realistic wood material for doors."""
    mat = bpy.data.materials.new(name="Wood_Realistic")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    nodes.clear()

    node_output = nodes.new(type='ShaderNodeOutputMaterial')
    node_output.location = (600, 0)

    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    node_bsdf.location = (300, 0)
    node_bsdf.inputs['Base Color'].default_value = (0.35, 0.22, 0.12, 1.0)
    node_bsdf.inputs['Roughness'].default_value = 0.4

    if 'Specular IOR Level' in node_bsdf.inputs:
        node_bsdf.inputs['Specular IOR Level'].default_value = 0.5
    elif 'Specular' in node_bsdf.inputs:
        node_bsdf.inputs['Specular'].default_value = 0.5

    if 'Sheen Weight' in node_bsdf.inputs:
        node_bsdf.inputs['Sheen Weight'].default_value = 0.3

    # Wave texture for wood grain
    node_wave = nodes.new(type='ShaderNodeTexWave')
    node_wave.location = (-500, 0)
    node_wave.inputs['Scale'].default_value = 10.0
    node_wave.inputs['Distortion'].default_value = 3.0
    node_wave.inputs['Detail'].default_value = 5.0
    node_wave.wave_type = 'BANDS'

    # Noise
    node_noise = nodes.new(type='ShaderNodeTexNoise')
    node_noise.location = (-700, -200)
    node_noise.inputs['Scale'].default_value = 5.0
    node_noise.inputs['Detail'].default_value = 10.0

    # Mix
    node_mix = nodes.new(type='ShaderNodeMix')
    node_mix.location = (-300, 0)
    node_mix.data_type = 'RGBA'
    node_mix.inputs['Factor'].default_value = 0.3

    # Color ramp
    node_colorramp = nodes.new(type='ShaderNodeValToRGB')
    node_colorramp.location = (-100, 0)
    node_colorramp.color_ramp.elements[0].position = 0.4
    node_colorramp.color_ramp.elements[0].color = (0.3, 0.18, 0.1, 1.0)
    node_colorramp.color_ramp.elements[1].position = 0.6
    node_colorramp.color_ramp.elements[1].color = (0.45, 0.28, 0.16, 1.0)

    # Bump
    node_bump = nodes.new(type='ShaderNodeBump')
    node_bump.location = (0, -200)
    node_bump.inputs['Strength'].default_value = 0.15

    # Connect
    links.new(node_wave.outputs['Fac'], node_mix.inputs['A'])
    links.new(node_noise.outputs['Fac'], node_mix.inputs['B'])
    links.new(node_mix.outputs['Result'], node_colorramp.inputs['Fac'])
    links.new(node_colorramp.outputs['Color'], node_bsdf.inputs['Base Color'])
    links.new(node_wave.outputs['Fac'], node_bump.inputs['Height'])
    links.new(node_bump.outputs['Normal'], node_bsdf.inputs['Normal'])
    links.new(node_bsdf.outputs['BSDF'], node_output.inputs['Surface'])

    print("  ✓ Created Wood_Realistic material")
    return mat

def apply_materials_to_objects():
    """Apply the realistic materials to the appropriate objects."""
    laterite_mat = bpy.data.materials.get("Laterite_Realistic")
    terracotta_mat = bpy.data.materials.get("Terracotta_Realistic")
    aluminum_mat = bpy.data.materials.get("Aluminum_Golden_Realistic")
    wood_mat = bpy.data.materials.get("Wood_Realistic")

    walls_count = 0
    roof_count = 0
    window_count = 0
    door_count = 0

    for obj in bpy.data.objects:
        if obj.type != 'MESH' or obj.hide_render or obj.hide_viewport:
            continue

        obj_name_lower = obj.name.lower()

        # Apply laterite to walls and rooms
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
                roof_count += 1

        # Apply wood to doors
        elif 'door' in obj_name_lower:
            if wood_mat:
                if len(obj.data.materials) == 0:
                    obj.data.materials.append(wood_mat)
                else:
                    obj.data.materials[0] = wood_mat
                door_count += 1

    print(f"\n  ✓ Applied Laterite to {walls_count} wall/room objects")
    print(f"  ✓ Applied Terracotta to {roof_count} roof objects")
    print(f"  ✓ Applied Aluminum to {window_count} window objects")
    print(f"  ✓ Applied Wood to {door_count} door objects")

def setup_lighting_and_camera():
    """Set up world lighting, additional lights, and camera."""
    import mathutils

    # World lighting
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

    print("  ✓ Created sky lighting")

    # Get scene bounds
    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    min_z, max_z = float('inf'), float('-inf')

    for obj in bpy.data.objects:
        if obj.type == 'MESH' and not obj.hide_render and not obj.hide_viewport:
            for corner in obj.bound_box:
                world_coord = obj.matrix_world @ mathutils.Vector(corner)
                min_x = min(min_x, world_coord.x)
                max_x = max(max_x, world_coord.x)
                min_y = min(min_y, world_coord.y)
                max_y = max(max_y, world_coord.y)
                min_z = min(min_z, world_coord.z)
                max_z = max(max_z, world_coord.z)

    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    center_z = (min_z + max_z) / 2

    # Sun light
    bpy.ops.object.light_add(type='SUN', location=(center_x + 10, center_y - 10, center_z + 20))
    sun = bpy.context.active_object
    sun.name = "Sun_Main"
    sun.data.energy = 3.0
    sun.data.angle = math.radians(5)
    sun.rotation_euler = (math.radians(45), 0, math.radians(135))
    print("  ✓ Added Sun light")

    # Fill light
    bpy.ops.object.light_add(type='AREA', location=(center_x - 10, center_y + 10, center_z + 15))
    fill_light = bpy.context.active_object
    fill_light.name = "Fill_Light"
    fill_light.data.energy = 200
    fill_light.data.size = 10
    fill_light.data.color = (0.9, 0.95, 1.0)
    fill_light.rotation_euler = (math.radians(135), 0, math.radians(-45))
    print("  ✓ Added Fill light")

    # Camera
    width = max_x - min_x
    depth = max_y - min_y
    height = max_z - min_z
    camera_distance = max(width, depth, height) * 2.5

    camera = bpy.data.objects.get('Camera')
    if camera:
        camera.location = (
            center_x + camera_distance * 0.7,
            center_y - camera_distance * 0.7,
            center_z + camera_distance * 0.5
        )
    else:
        bpy.ops.object.camera_add(
            location=(
                center_x + camera_distance * 0.7,
                center_y - camera_distance * 0.7,
                center_z + camera_distance * 0.5
            )
        )
        camera = bpy.context.active_object

    direction = mathutils.Vector((
        center_x - camera.location.x,
        center_y - camera.location.y,
        center_z - camera.location.z
    ))

    rot_quat = direction.to_track_quat('-Z', 'Y')
    camera.rotation_euler = rot_quat.to_euler()

    bpy.context.scene.camera = camera
    camera.data.lens = 35
    camera.data.sensor_width = 36
    camera.data.clip_end = 1000

    print("  ✓ Positioned camera")

def configure_render():
    """Configure render settings."""
    scene = bpy.context.scene

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU' if bpy.context.preferences.addons.get('cycles') else 'CPU'
    scene.cycles.samples = 256
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

    print("  ✓ Configured render settings (Cycles, 256 samples, 1920x1080)")

# Create materials
print("Creating realistic materials...")
create_laterite_material()
create_terracotta_material()
create_aluminum_anodized_material()
create_wood_material()

# Apply materials
print("\nApplying materials to objects...")
apply_materials_to_objects()

# Setup lighting and camera
print("\nSetting up lighting and camera...")
setup_lighting_and_camera()

# Configure render
print("\nConfiguring render settings...")
configure_render()

# Save blend file
if bpy.data.filepath:
    bpy.ops.wm.save_mainfile()
    print("\n✓ Saved blend file")

# Render
print("\n" + "="*70)
print("STEP 3: RENDERING")
print("="*70)
print()

output_path = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/realistic_render.png"
os.makedirs(os.path.dirname(output_path), exist_ok=True)

scene = bpy.context.scene
scene.render.filepath = output_path
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.compression = 15

print(f"Output: {output_path}")
print(f"Resolution: {scene.render.resolution_x}x{scene.render.resolution_y}")
print(f"Samples: {scene.cycles.samples}")
print()
print("Rendering... (this may take a few minutes)")
print()

bpy.ops.render.render(write_still=True)

if os.path.exists(output_path):
    file_size = os.path.getsize(output_path) / 1024 / 1024
    print(f"\n✓ Render complete! Saved to: {output_path}")
    print(f"✓ File size: {file_size:.2f} MB")
else:
    print(f"\n✗ Error: Render failed")

print("\n" + "="*70)
print("✓ ALL DONE!")
print("="*70)
