"""
Konkan House 3D Blender Functions
Handles all 3D model generation in Blender

Coordinate System:
- Input: Inkscape-style (origin top-left, X right, Y down)
- Blender: X right, Y forward, Z up
- Conversion: Blender_X = Input_X, Blender_Y = -Input_Y, Blender_Z = height
"""

import bpy
import math
from typing import Dict, List, Tuple, Optional

# Import shared configuration
from config import GLOBAL_CONFIG

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def to_meters(value: float) -> float:
    """Convert input units to meters with scaling"""
    return value * GLOBAL_CONFIG['units_to_meters_ratio'] * GLOBAL_CONFIG['scale_factor']

def inkscape_to_blender(x: float, y: float, z: float = 0) -> Tuple[float, float, float]:
    """
    Convert Inkscape coordinates (origin top-left, Y down) to Blender coordinates.
    Model is centered at the plinth center for symmetric 3D visualization.

    Args:
        x: Horizontal position (right positive)
        y: Vertical position (down positive in Inkscape)
        z: Height (up positive)

    Returns:
        Tuple of (blender_x, blender_y, blender_z) in meters
    """
    # Apply origin offset to center model at plinth center
    centered_x = x - GLOBAL_CONFIG['model_origin_offset_x']
    centered_y = y - GLOBAL_CONFIG['model_origin_offset_y']

    blender_x = to_meters(centered_x)
    blender_y = to_meters(-centered_y)  # Flip Y axis
    blender_z = to_meters(z) + GLOBAL_CONFIG['ground_level_z']
    return (blender_x, blender_y, blender_z)

def set_model_origin_from_plinth(plinth_config: dict):
    """
    Set the model origin to the center of the plinth for symmetric 3D visualization.
    This only affects the 3D model; SVG floor plans use original coordinates.

    Args:
        plinth_config: Dictionary with 'x', 'y', 'width', 'length' keys
        Note: width is X-direction, length is Y-direction
    """
    # width is X-direction, length is Y-direction
    center_x = plinth_config['x'] + plinth_config['width'] / 2.0
    center_y = plinth_config['y'] + plinth_config['length'] / 2.0

    GLOBAL_CONFIG['model_origin_offset_x'] = center_x
    GLOBAL_CONFIG['model_origin_offset_y'] = center_y

    print(f"Model origin set to plinth center: ({center_x:.1f}, {center_y:.1f})")

def get_floor_z_offset(floor_number: int, explosion_factor: float = 0.0) -> float:
    """
    Calculate Z offset for a given floor number (bottom of floor slab).

    Args:
        floor_number: Floor number (0 = ground floor, 1 = first floor, etc.)
        explosion_factor: Additional separation between floors for exploded view (default 0.0 for normal view)
                          Can be a single value (applied to all floors) or will use per-floor values from
                          GLOBAL_CONFIG['explosion_factors'] if available

    Returns:
        Z offset in meters from ground level to the bottom of the floor slab
    """
    z_offset = GLOBAL_CONFIG['plinth_height']  # Start with plinth height

    # Check if explosion is enabled via the use_explosion flag
    use_explosion = GLOBAL_CONFIG.get('use_explosion', False)

    # Check if we have per-floor explosion factors
    use_per_floor_explosion = use_explosion and 'explosion_factors' in GLOBAL_CONFIG and GLOBAL_CONFIG['explosion_factors']
    total_explosion = 0

    # For each previous floor, add: slab thickness + wall height + explosion spacing
    for floor in range(floor_number):
        # Add floor slab thickness
        z_offset += GLOBAL_CONFIG['floor_slab_thickness']

        # Add wall height
        if floor in GLOBAL_CONFIG['floor_heights']:
            wall_height = GLOBAL_CONFIG['floor_heights'][floor]
            z_offset += wall_height
        else:
            # Use ground floor height as default
            wall_height = GLOBAL_CONFIG['floor_heights'].get(0, 10.0)
            z_offset += wall_height

        # Add explosion spacing for exploded view
        if use_per_floor_explosion:
            # Use per-floor explosion factor (the spacing AFTER this floor)
            floor_explosion = GLOBAL_CONFIG['explosion_factors'].get(floor, 0.0)
            z_offset += floor_explosion
            total_explosion += floor_explosion
        elif use_explosion:
            # Use uniform explosion factor
            z_offset += explosion_factor
            total_explosion += explosion_factor

    result = to_meters(z_offset)
    explosion_suffix = f" (exploded +{total_explosion})" if total_explosion > 0 else ""
    print(f"  DEBUG: Floor {floor_number} Z offset = {z_offset} units = {result} meters{explosion_suffix}", flush=True)
    return result

def create_material(name: str, color: Tuple[float, float, float, float]) -> bpy.types.Material:
    """Create or get a Blender material with the given color"""
    if name in bpy.data.materials:
        return bpy.data.materials[name]

    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs['Base Color'].default_value = color

    # Set roughness based on material type
    if 'laterite' in name.lower() or name in ['walls', 'verandah', 'living', 'kitchen', 'bathroom', 'bedroom', 'workshop']:
        # Laterite stone - rough, matte finish
        bsdf.inputs['Roughness'].default_value = 0.95
        # Try to set Specular if it exists (depends on Blender version)
        try:
            bsdf.inputs['Specular'].default_value = 0.1
        except KeyError:
            # Newer Blender versions use 'Specular IOR Level' instead
            try:
                bsdf.inputs['Specular IOR Level'].default_value = 0.1
            except KeyError:
                pass  # Skip if neither exists
    else:
        bsdf.inputs['Roughness'].default_value = 0.7

    return mat

def initialize_materials():
    """Create all materials defined in GLOBAL_CONFIG"""
    for name, color in GLOBAL_CONFIG['colors'].items():
        create_material(name, color)

def get_or_create_collection(name: str) -> bpy.types.Collection:
    """Get or create a Blender collection for organizing objects"""
    if name in bpy.data.collections:
        return bpy.data.collections[name]

    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection

def add_to_collection(obj: bpy.types.Object, collection_name: str):
    """Add an object to a named collection"""
    collection = get_or_create_collection(collection_name)

    # Remove from all other collections
    for coll in obj.users_collection:
        coll.objects.unlink(obj)

    # Add to target collection
    collection.objects.link(obj)

def create_box(name: str, location: Tuple[float, float, float],
               dimensions: Tuple[float, float, float],
               material_name: str,
               collection_name: Optional[str] = None) -> bpy.types.Object:
    """
    Create a box mesh with material.

    Args:
        name: Object name
        location: (x, y, z) center position in meters
        dimensions: (width, depth, height) in meters
        material_name: Name of material to apply
        collection_name: Optional collection to add object to

    Returns:
        Created Blender object
    """
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (dimensions[0]/2, dimensions[1]/2, dimensions[2]/2)

    if material_name in bpy.data.materials:
        mat = bpy.data.materials[material_name]
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat

        # Set viewport display color to match material color
        # This makes the object show the color even in solid shading mode
        base_color = mat.node_tree.nodes["Principled BSDF"].inputs['Base Color'].default_value
        obj.color = (base_color[0], base_color[1], base_color[2], base_color[3])

    if collection_name:
        add_to_collection(obj, collection_name)

    return obj

# ============================================================================
# MAIN CONSTRUCTION FUNCTIONS
# ============================================================================

def create_plinth(x: float, y: float, width: float, length: float,
                  height: Optional[float] = None,
                  material_name: str = 'plinth') -> bpy.types.Object:
    """
    Create a plinth (raised platform foundation).

    Args:
        x, y: Top-left corner position in input units (Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        height: Plinth height (input units), uses config default if None
        material_name: Material to apply

    Returns:
        Created plinth object
    """
    if height is None:
        height = GLOBAL_CONFIG['plinth_height']

    # Convert to Blender coordinates
    # Center of plinth
    center_x = x + width / 2
    center_y = y + length / 2
    center_z = height / 2  # Plinth goes from ground to height

    location = inkscape_to_blender(center_x, center_y, center_z)
    dimensions = (to_meters(width), to_meters(length), to_meters(height))

    plinth = create_box('Plinth', location, dimensions, material_name, 'Foundation')

    plinth_bottom = location[2] - dimensions[2] / 2
    plinth_top = location[2] + dimensions[2] / 2
    print(f"✓ Created plinth: {width}×{length}×{height} units at ({x}, {y})")
    print(f"  Plinth Z: bottom={plinth_bottom:.3f}m, center={location[2]:.3f}m, top={plinth_top:.3f}m", flush=True)
    return plinth

def _create_sloped_wall(start_x: float, start_y: float, end_x: float, end_y: float,
                        bottom_z: float, height_start: float, height_end: float,
                        thickness: float, name: str, material_name: str,
                        collection_name: Optional[str]) -> bpy.types.Object:
    """
    Create a wall with sloping top by building a custom mesh.

    All coordinates in input units.
    """
    import bmesh

    # Calculate perpendicular offset for thickness
    dx = end_x - start_x
    dy = end_y - start_y
    length = math.sqrt(dx**2 + dy**2)

    # Unit perpendicular vector (rotated 90 degrees)
    perp_x = -dy / length
    perp_y = dx / length

    # Half thickness offset
    half_thick = thickness / 2

    # Define 8 vertices of the sloped wall (in input units)
    # Bottom face (4 vertices)
    v0 = (start_x - perp_x * half_thick, start_y - perp_y * half_thick, bottom_z)
    v1 = (start_x + perp_x * half_thick, start_y + perp_y * half_thick, bottom_z)
    v2 = (end_x + perp_x * half_thick, end_y + perp_y * half_thick, bottom_z)
    v3 = (end_x - perp_x * half_thick, end_y - perp_y * half_thick, bottom_z)

    # Top face (4 vertices) - sloped
    v4 = (start_x - perp_x * half_thick, start_y - perp_y * half_thick, bottom_z + height_start)
    v5 = (start_x + perp_x * half_thick, start_y + perp_y * half_thick, bottom_z + height_start)
    v6 = (end_x + perp_x * half_thick, end_y + perp_y * half_thick, bottom_z + height_end)
    v7 = (end_x - perp_x * half_thick, end_y - perp_y * half_thick, bottom_z + height_end)

    # Convert all vertices to Blender coordinates (meters)
    verts = [
        inkscape_to_blender(*v0), inkscape_to_blender(*v1),
        inkscape_to_blender(*v2), inkscape_to_blender(*v3),
        inkscape_to_blender(*v4), inkscape_to_blender(*v5),
        inkscape_to_blender(*v6), inkscape_to_blender(*v7)
    ]

    # Define faces (quad faces, counter-clockwise winding)
    faces = [
        [0, 1, 2, 3],  # Bottom
        [4, 5, 6, 7],  # Top (sloped)
        [0, 4, 5, 1],  # Start face
        [2, 6, 7, 3],  # End face
        [1, 5, 6, 2],  # Right side
        [0, 3, 7, 4],  # Left side
    ]

    # Create mesh
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    # Create object
    obj = bpy.data.objects.new(name, mesh)

    # Add to collection
    if collection_name:
        collection = bpy.data.collections.get(collection_name)
        if not collection:
            collection = bpy.data.collections.new(collection_name)
            bpy.context.scene.collection.children.link(collection)
        collection.objects.link(obj)
    else:
        bpy.context.collection.objects.link(obj)

    # Apply material
    if material_name in bpy.data.materials:
        mat = bpy.data.materials[material_name]
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat

        # Set viewport display color to match material color
        # This makes the object show the color even in solid shading mode
        base_color = mat.node_tree.nodes["Principled BSDF"].inputs['Base Color'].default_value
        obj.color = (base_color[0], base_color[1], base_color[2], base_color[3])

    return obj

def create_wall(start_x: float, start_y: float, end_x: float, end_y: float,
                floor_number: int = 0,
                height: Optional[float] = None,
                height_end: Optional[float] = None,
                thickness: Optional[float] = None,
                name: str = "Wall",
                material_name: str = 'walls',
                collection_name: Optional[str] = None) -> bpy.types.Object:
    """
    Create a wall between two points, with optional sloping top.

    Args:
        start_x, start_y: Starting point (input units, Inkscape coordinates)
        end_x, end_y: Ending point (input units, Inkscape coordinates)
        floor_number: Which floor (0=ground, 1=first, etc.)
        height: Wall height at start point (input units), uses floor config if None
        height_end: Wall height at end point (input units). If None, uses 'height' (flat top)
        thickness: Wall thickness (input units), uses config default if None
        name: Wall name
        material_name: Material to apply
        collection_name: Collection to add wall to

    Returns:
        Created wall object
    """
    if height is None:
        height = GLOBAL_CONFIG['floor_heights'].get(floor_number, 10.0)

    # If height_end not specified, use same height as start (flat top)
    if height_end is None:
        height_end = height

    if thickness is None:
        thickness = GLOBAL_CONFIG['wall_thickness']

    # Calculate wall parameters
    dx = end_x - start_x
    dy = end_y - start_y
    length = math.sqrt(dx**2 + dy**2)

    # Debug output
    is_sloped = abs(height_end - height) > 0.01
    slope_indicator = f" (sloped {height}->{height_end})" if is_sloped else ""
    print(f"  Wall '{name}': ({start_x:.3f}, {start_y:.3f}) -> ({end_x:.3f}, {end_y:.3f}), length={length:.3f}{slope_indicator}")

    if length == 0:
        print(f"Warning: Wall {name} has zero length")
        return None

    # Z position: walls sit on top of floor slab
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
    z_offset_units = get_floor_z_offset(floor_number, explosion_factor) / to_meters(1.0)  # Convert meters back to units
    floor_slab_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    wall_bottom_z_units = z_offset_units + floor_slab_thickness_units

    # Check if wall has sloping top
    if is_sloped:
        # Create sloped wall using custom mesh
        wall = _create_sloped_wall(
            start_x, start_y, end_x, end_y,
            wall_bottom_z_units, height, height_end,
            thickness, name, material_name, collection_name
        )
        wall_top_start = wall_bottom_z_units + height
        wall_top_end = wall_bottom_z_units + height_end
        print(f"    Wall Z: bottom={to_meters(wall_bottom_z_units):.2f}m, top_start={to_meters(wall_top_start):.2f}m, top_end={to_meters(wall_top_end):.2f}m", flush=True)
    else:
        # Create regular flat-top wall
        center_x = (start_x + end_x) / 2
        center_y = (start_y + end_y) / 2
        center_z_units = wall_bottom_z_units + height / 2
        wall_top_z_units = wall_bottom_z_units + height

        # Convert to Blender coordinates
        location = inkscape_to_blender(center_x, center_y, center_z_units)
        dimensions = (to_meters(length), to_meters(thickness), to_meters(height))

        print(f"    Wall Z: bottom={to_meters(wall_bottom_z_units):.2f}m, center={to_meters(center_z_units):.2f}m, top={to_meters(wall_top_z_units):.2f}m", flush=True)

        # Create wall
        wall = create_box(name, location, dimensions, material_name, collection_name)

        # Rotate wall to align with start-end direction
        angle = math.atan2(-dy, dx)  # Negative dy because Y is flipped
        wall.rotation_euler = (0, 0, angle)

    return wall

def create_pillar(x: float, y: float,
                  floor_number: int = 0,
                  height: Optional[float] = None,
                  size: Optional[float] = None,
                  width: Optional[float] = None,
                  length: Optional[float] = None,
                  name: Optional[str] = None,
                  material_name: str = 'floor') -> bpy.types.Object:
    """
    Create a pillar (column) with rectangular or square cross-section.

    Args:
        x, y: Position of pillar center (input units, Inkscape coordinates)
        floor_number: Which floor (0=ground, 1=first, etc.)
        height: Pillar height (input units), uses floor height if None
        size: Pillar cross-section size for square pillars (input units, deprecated, use width/length)
        width: Pillar width in X direction (input units), uses size or wall_thickness if None
        length: Pillar length in Y direction (input units), uses size or wall_thickness if None
        name: Optional custom name for the pillar
        material_name: Material to apply (default: 'floor' to match floor slabs)

    Returns:
        Created pillar object

    Notes:
        For backward compatibility:
        - If width/length not specified, uses size parameter
        - If size not specified, uses wall_thickness
        - Supports both square (size or width=length) and rectangular (width≠length) pillars
    """
    if height is None:
        height = GLOBAL_CONFIG['floor_heights'].get(floor_number, 10.0)

    # Backward compatibility: determine pillar dimensions
    default_size = GLOBAL_CONFIG['wall_thickness']

    if width is None:
        width = size if size is not None else default_size
    if length is None:
        length = size if size is not None else default_size

    # Generate name
    if name is None:
        pillar_name = f'Pillar_{floor_number}'
    else:
        pillar_name = f'Pillar_{floor_number}_{name}'

    # Z position: pillar sits on top of floor slab
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
    z_offset_units = get_floor_z_offset(floor_number, explosion_factor) / to_meters(1.0)  # Convert meters back to units
    floor_slab_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    pillar_bottom_z_units = z_offset_units + floor_slab_thickness_units
    center_z_units = pillar_bottom_z_units + height / 2
    pillar_top_z_units = pillar_bottom_z_units + height

    # Convert to Blender coordinates
    location = inkscape_to_blender(x, y, center_z_units)
    dimensions = (to_meters(width), to_meters(length), to_meters(height))

    # Debug output
    print(f"  Pillar '{pillar_name}': {width}×{length}×{height} at ({x}, {y})")
    print(f"    Pillar Z: bottom={to_meters(pillar_bottom_z_units):.2f}m, center={to_meters(center_z_units):.2f}m, top={to_meters(pillar_top_z_units):.2f}m", flush=True)

    # Create pillar
    pillar = create_box(
        pillar_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Structure'
    )

    return pillar

def create_room(name: str, x: float, y: float, width: float, length: float,
                floor_number: int = 0,
                height: Optional[float] = None,
                wall_thickness: Optional[float] = None,
                material_name: str = 'walls',
                walls: Optional[List[str]] = None,
                wall_heights: Optional[dict] = None) -> List[bpy.types.Object]:
    """
    Create a room with specified walls (no floor).

    Args:
        name: Room name
        x, y: Top-left corner (input units, Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        height: Default wall height (input units), uses floor config if None
        wall_thickness: Wall thickness (input units), uses config default if None
        material_name: Material to apply to walls
        walls: List of walls to create ['north', 'south', 'east', 'west'], or None for all 4
        wall_heights: Optional dict with individual wall heights, e.g.:
                     {'north': 100, 'south': 150, 'east': {'start': 100, 'end': 150}, 'west': 120}
                     Can specify single height or {'start': height1, 'end': height2} for sloped walls

    Returns:
        List of created wall objects
    """
    if wall_thickness is None:
        wall_thickness = GLOBAL_CONFIG['wall_thickness']

    # Default to all 4 walls if not specified
    if walls is None:
        walls = ['north', 'south', 'east', 'west']

    # Convert to lowercase for comparison
    walls = [w.lower() for w in walls]

    collection_name = f"Floor_{floor_number}_{name}"

    # Create specified walls around the perimeter
    # Outer room dimensions (including wall thickness): width × length
    # Room occupies rectangle from (x, y) to (x + width, y + length)
    # Walls are INSIDE this boundary
    # North/South walls span full width, East/West fit between them

    t = wall_thickness
    created_walls = []

    # Helper function to get wall height
    def get_wall_height(wall_name: str):
        """Get height for a specific wall, returns (height, height_end)"""
        if wall_heights and wall_name in wall_heights:
            wall_config = wall_heights[wall_name]
            if isinstance(wall_config, dict):
                # Sloped wall: {'start': h1, 'end': h2}
                return wall_config.get('start', height), wall_config.get('end', height)
            else:
                # Single height value
                return wall_config, None
        return height, None

    # North wall - outer edge at y, inner edge at y+t
    # Centerline at y + t/2, spans from x to x+width
    if 'north' in walls:
        wall_height, wall_height_end = get_wall_height('north')
        north_wall = create_wall(
            x, y + t/2,
            x + width, y + t/2,
            floor_number=floor_number,
            height=wall_height,
            height_end=wall_height_end,
            thickness=wall_thickness,
            name=f"{name}_North",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(north_wall)

    # South wall - inner edge at y+length-t, outer edge at y+length
    # Centerline at y + length - t/2, spans from x to x+width
    if 'south' in walls:
        wall_height, wall_height_end = get_wall_height('south')
        south_wall = create_wall(
            x, y + length - t/2,
            x + width, y + length - t/2,
            floor_number=floor_number,
            height=wall_height,
            height_end=wall_height_end,
            thickness=wall_thickness,
            name=f"{name}_South",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(south_wall)

    # East wall - inner edge at x+width-t, outer edge at x+width
    # Centerline at x + width - t/2, spans from y+t to y+length-t (fits between N/S)
    if 'east' in walls:
        wall_height, wall_height_end = get_wall_height('east')
        east_wall = create_wall(
            x + width - t/2, y + t,
            x + width - t/2, y + length - t,
            floor_number=floor_number,
            height=wall_height,
            height_end=wall_height_end,
            thickness=wall_thickness,
            name=f"{name}_East",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(east_wall)

    # West wall - outer edge at x, inner edge at x+t
    # Centerline at x + t/2, spans from y+t to y+length-t (fits between N/S)
    if 'west' in walls:
        wall_height, wall_height_end = get_wall_height('west')
        west_wall = create_wall(
            x + t/2, y + t,
            x + t/2, y + length - t,
            floor_number=floor_number,
            height=wall_height,
            height_end=wall_height_end,
            thickness=wall_thickness,
            name=f"{name}_West",
            material_name=material_name,
            collection_name=collection_name
        )
        created_walls.append(west_wall)

    walls_str = ', '.join(walls)
    print(f"✓ Created room '{name}': {width}×{length} with walls [{walls_str}] at floor {floor_number}")

    return created_walls

def create_floor_slab(x: float, y: float, width: float, length: float,
                      floor_number: int = 0,
                      thickness: Optional[float] = None,
                      material_name: str = 'floor',
                      name: Optional[str] = None) -> bpy.types.Object:
    """
    Create a rectangular floor slab section.

    Args:
        x, y: Top-left corner (input units, Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        thickness: Slab thickness (input units), uses config default if None
        material_name: Material to apply
        name: Optional custom name for the slab

    Returns:
        Created floor slab object
    """
    if thickness is None:
        thickness = GLOBAL_CONFIG['floor_slab_thickness']

    # Center of slab
    center_x = x + width / 2
    center_y = y + length / 2

    # Z position: on top of plinth for ground floor, or on top of previous floor
    # Keep in units until inkscape_to_blender converts to meters
    explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
    z_offset_units = get_floor_z_offset(floor_number, explosion_factor) / to_meters(1.0)  # Convert meters back to units
    center_z_units = z_offset_units + thickness / 2

    location = inkscape_to_blender(center_x, center_y, center_z_units)
    dimensions = (to_meters(width), to_meters(length), to_meters(thickness))

    # Generate name
    if name is None:
        slab_name = f'Floor_Slab_{floor_number}'
    else:
        slab_name = f'Floor_Slab_{floor_number}_{name}'

    slab = create_box(
        slab_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Structure'
    )

    slab_bottom = location[2] - dimensions[2] / 2
    slab_top = location[2] + dimensions[2] / 2
    print(f"✓ Created floor slab '{slab_name}': {width}×{length}×{thickness} units")
    print(f"  Floor slab Z: bottom={slab_bottom:.3f}m, center={location[2]:.3f}m, top={slab_top:.3f}m", flush=True)
    return slab


def create_beam(x: float, y: float, width: float, length: float,
                floor_number: int = 0,
                thickness: Optional[float] = None,
                material_name: str = 'beam',
                name: Optional[str] = None) -> bpy.types.Object:
    """
    Create a structural beam (horizontal element with wall thickness).

    Args:
        x, y: Top-left corner (input units, Inkscape coordinates)
        width: Width in X direction (input units)
        length: Length in Y direction (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        thickness: Beam vertical thickness (input units), uses wall_thickness if None
        material_name: Material to apply
        name: Optional custom name for the beam

    Returns:
        Created beam object
    """
    if thickness is None:
        thickness = GLOBAL_CONFIG['wall_thickness']

    # Center of beam
    center_x = x + width / 2
    center_y = y + length / 2

    # Z position: on top of plinth for ground floor, or on top of previous floor
    # Keep in units until inkscape_to_blender converts to meters
    explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
    z_offset_units = get_floor_z_offset(floor_number, explosion_factor) / to_meters(1.0)  # Convert meters back to units
    center_z_units = z_offset_units + thickness / 2

    location = inkscape_to_blender(center_x, center_y, center_z_units)
    dimensions = (to_meters(width), to_meters(length), to_meters(thickness))

    # Generate name
    if name is None:
        beam_name = f'Beam_{floor_number}'
    else:
        beam_name = f'Beam_{floor_number}_{name}'

    beam = create_box(
        beam_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Structure'
    )

    beam_bottom = location[2] - dimensions[2] / 2
    beam_top = location[2] + dimensions[2] / 2
    print(f"✓ Created beam '{beam_name}': {width}×{length}×{thickness} units")
    print(f"  Beam Z: bottom={beam_bottom:.3f}m, center={location[2]:.3f}m, top={beam_top:.3f}m", flush=True)
    return beam


def create_staircase(start_x: float, start_y: float,
                     direction: str,
                     num_steps: int,
                     step_width: float,
                     step_tread: float,
                     step_rise: float,
                     floor_number: int = 0,
                     material_name: str = 'floor') -> List[bpy.types.Object]:
    """
    Create a staircase with individual steps along cardinal directions.

    Args:
        start_x, start_y: Bottom left corner of first step (input units, Inkscape coordinates)
        direction: Direction stairs go - 'north', 'south', 'east', or 'west'
        num_steps: Number of steps
        step_width: Width of each step (perpendicular to stair direction, input units)
        step_tread: Depth of each step (along stair direction, input units)
        step_rise: Height of each step (vertical, input units)
        floor_number: Which floor the staircase starts from
        material_name: Material to apply to steps

    Returns:
        List of step objects
    """
    # Map direction to movement vectors
    # In Inkscape coords: X right, Y down
    direction = direction.lower()
    if direction == 'north':
        dir_x, dir_y = 0, -1  # Y decreases going north
        angle = math.radians(90)
    elif direction == 'south':
        dir_x, dir_y = 0, 1   # Y increases going south
        angle = math.radians(-90)
    elif direction == 'east':
        dir_x, dir_y = 1, 0   # X increases going east
        angle = 0
    elif direction == 'west':
        dir_x, dir_y = -1, 0  # X decreases going west
        angle = math.radians(180)
    else:
        print(f"Warning: Invalid direction '{direction}'. Use 'north', 'south', 'east', or 'west'")
        return []

    # Get starting Z position - add floor slab thickness so stairs start above floor
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
    z_offset_units = get_floor_z_offset(floor_number, explosion_factor) / to_meters(1.0)  # Convert meters back to units
    floor_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    z_start_units = z_offset_units + floor_thickness_units

    print(f"  DEBUG: Staircase starting Z = {z_offset_units:.1f} units + {floor_thickness_units:.1f} units = {z_start_units:.1f} units = {to_meters(z_start_units):.2f}m", flush=True)

    steps = []
    collection_name = f"Floor_{floor_number}_Staircase"

    for i in range(num_steps):
        # Calculate position of this step
        # Center of each step along the stair direction and width
        if direction in ['north', 'south']:
            # Stairs go in Y direction, width is in X direction
            step_center_x = start_x + step_width / 2
            step_center_y = start_y + dir_y * (step_tread * i + step_tread / 2)
        else:  # east or west
            # Stairs go in X direction, width is in Y direction
            step_center_x = start_x + dir_x * (step_tread * i + step_tread / 2)
            step_center_y = start_y + step_width / 2

        # Z position: on floor (above slab) + cumulative rise + half of this step's rise
        step_center_z = z_start_units + step_rise * i + step_rise / 2

        # Convert to Blender coordinates
        location = inkscape_to_blender(step_center_x, step_center_y, step_center_z)

        # Dimensions for create_box: (X_size, Y_size, Z_size)
        # Width is perpendicular to tread direction
        if direction in ['north', 'south']:
            # Stairs go in Y direction: width is X, tread is Y
            blender_x_size = to_meters(step_width)
            blender_y_size = to_meters(step_tread)
        else:  # east or west
            # Stairs go in X direction: tread is X, width is Y
            blender_x_size = to_meters(step_tread)
            blender_y_size = to_meters(step_width)

        dimensions = (blender_x_size, blender_y_size, to_meters(step_rise))

        # Create step box
        step = create_box(
            f'Step_{i+1}',
            location,
            dimensions,
            material_name,
            collection_name
        )

        steps.append(step)

    print(f"✓ Created staircase: {num_steps} steps going {direction}, {step_width}×{step_tread}×{step_rise} each")

    return steps

def create_door(x: float, y: float, width: float, height: float,
                floor_number: int = 0,
                direction: str = 'north',
                wall_name: Optional[str] = None,
                name: Optional[str] = None,
                material_name: str = 'walls') -> bpy.types.Object:
    """
    Create a door opening that cuts through walls using boolean operations.

    Args:
        x, y: Position of door (input units, Inkscape coordinates)
              - For north/south walls: (x, y) is bottom-left corner, door extends in +X direction
              - For east/west walls: (x, y) is top-left corner, door extends in +Y direction
        width: Door width along the wall (input units)
        height: Door height (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        direction: Which wall the door is in - 'north', 'south', 'east', 'west'
        wall_name: Specific wall to cut (e.g., 'Verandah_North'). If None, uses direction to guess.
        name: Optional custom name for the door
        material_name: Material for door frame (if visible)

    Returns:
        Created door opening object (used for boolean subtraction)
    """
    # Get floor Z position
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
    z_offset_units = get_floor_z_offset(floor_number, explosion_factor) / to_meters(1.0)  # Convert meters back to units
    floor_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    wall_thickness = GLOBAL_CONFIG['wall_thickness']

    # Door starts at floor level (on top of slab)
    z_start_units = z_offset_units + floor_thickness_units
    center_z_units = z_start_units + height / 2

    # Make the opening slightly larger than wall thickness to ensure clean cut
    depth = wall_thickness * 1.5

    # Position and dimensions depend on which wall the door is in
    direction = direction.lower()
    if direction in ['north', 'south']:
        # Door in horizontal wall (north/south)
        # (x, y) is bottom-left corner of door, door width extends in +X direction
        # y is the wall's Y position (north/south coordinate)
        center_x = x + width / 2
        center_y = y + wall_thickness / 2
        dimensions = (to_meters(width), to_meters(depth), to_meters(height))
    else:  # east or west
        # Door in vertical wall (east/west)
        # (x, y) is top-left corner of door, door width extends in +Y direction (downward in Inkscape)
        # x is the wall's X position (east/west coordinate)
        # y is where the door starts along the wall
        center_x = x + wall_thickness / 2
        center_y = y + width / 2
        dimensions = (to_meters(depth), to_meters(width), to_meters(height))

    location = inkscape_to_blender(center_x, center_y, center_z_units)

    # Generate name
    if name is None:
        door_name = f'Door_{floor_number}'
    else:
        door_name = f'Door_{floor_number}_{name}'

    door = create_box(
        door_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Openings'
    )

    print(f"  Door location: ({location[0]:.2f}, {location[1]:.2f}, {location[2]:.2f}), dimensions: ({dimensions[0]:.2f}, {dimensions[1]:.2f}, {dimensions[2]:.2f})", flush=True)

    # Hide the door object (it's just for boolean operations)
    door.hide_viewport = True
    door.hide_render = True

    # Store the wall name as a custom property for later use in apply_openings_to_walls
    if wall_name:
        door['target_wall'] = wall_name

    print(f"✓ Created door opening '{door_name}': {width}×{height} at ({x}, {y}) facing {direction}")
    if wall_name:
        print(f"  Target wall: {wall_name}")
    return door

def create_window(x: float, y: float, width: float, height: float,
                  floor_number: int = 0,
                  sill_height: Optional[float] = None,
                  direction: str = 'north',
                  wall_name: Optional[str] = None,
                  name: Optional[str] = None,
                  material_name: str = 'walls') -> bpy.types.Object:
    """
    Create a window opening that cuts through walls using boolean operations.

    Args:
        x, y: Bottom left corner of window (input units, Inkscape coordinates)
        width: Window width (input units)
        height: Window height (input units)
        floor_number: Which floor (0=ground, 1=first, etc.)
        sill_height: Height of window sill from floor (input units), default is 3 feet
        direction: Which wall the window is in - 'north', 'south', 'east', 'west'
        wall_name: Specific wall to cut (e.g., 'Verandah_North'). If None, uses direction to guess.
        name: Optional custom name for the window
        material_name: Material for window frame (if visible)

    Returns:
        Created window opening object (used for boolean subtraction)
    """
    if sill_height is None:
        sill_height = 30.0  # Default 3 feet from floor (30 units = 3 feet)

    # Get floor Z position
    # Keep everything in INPUT UNITS until inkscape_to_blender converts to meters
    explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
    z_offset_units = get_floor_z_offset(floor_number, explosion_factor) / to_meters(1.0)  # Convert meters back to units
    floor_thickness_units = GLOBAL_CONFIG['floor_slab_thickness']
    wall_thickness = GLOBAL_CONFIG['wall_thickness']

    # Window starts at sill height above floor
    z_start_units = z_offset_units + floor_thickness_units + sill_height
    center_z_units = z_start_units + height / 2

    # Make the opening slightly larger than wall thickness to ensure clean cut
    depth = wall_thickness * 1.5

    # Position and dimensions depend on which wall the window is in
    direction = direction.lower()
    if direction in ['north', 'south']:
        # Window in horizontal wall (north/south)
        center_x = x + width / 2
        center_y = y + wall_thickness / 2
        dimensions = (to_meters(width), to_meters(depth), to_meters(height))
    else:  # east or west
        # Window in vertical wall (east/west)
        center_x = x + wall_thickness / 2
        center_y = y + width / 2
        dimensions = (to_meters(depth), to_meters(width), to_meters(height))

    location = inkscape_to_blender(center_x, center_y, center_z_units)

    # Generate name
    if name is None:
        window_name = f'Window_{floor_number}'
    else:
        window_name = f'Window_{floor_number}_{name}'

    window = create_box(
        window_name,
        location,
        dimensions,
        material_name,
        f'Floor_{floor_number}_Openings'
    )

    # Hide the window object (it's just for boolean operations)
    window.hide_viewport = True
    window.hide_render = True

    # Store the wall name as a custom property for later use in apply_openings_to_walls
    if wall_name:
        window['target_wall'] = wall_name

    print(f"✓ Created window opening '{window_name}': {width}×{height} at sill height {sill_height}")
    if wall_name:
        print(f"  Target wall: {wall_name}")
    return window

def apply_openings_to_walls(floor_number: int):
    """
    Apply boolean operations to cut door and window openings from walls.
    Should be called after all walls, doors, and windows are created for a floor.

    Args:
        floor_number: Which floor to process
    """
    # Find all openings for this floor
    openings = []
    for obj in bpy.data.objects:
        # Check for openings
        if obj.name.startswith(f'Door_{floor_number}') or obj.name.startswith(f'Window_{floor_number}'):
            openings.append(obj)
            target_wall = obj.get('target_wall', 'Not specified')
            print(f"  Found opening: {obj.name} -> target wall: {target_wall}", flush=True)

    if len(openings) == 0:
        print(f"  No openings to apply on floor {floor_number}")
        return

    modifiers_applied = 0

    # Process each opening
    for opening in openings:
        # Check if this opening has a target wall specified
        target_wall_name = opening.get('target_wall')

        if not target_wall_name:
            print(f"  ⚠ Warning: Opening '{opening.name}' has no target_wall specified - skipping", flush=True)
            continue

        # Find the wall object
        wall = bpy.data.objects.get(target_wall_name)

        if not wall:
            print(f"  ✗ Error: Wall '{target_wall_name}' not found for opening '{opening.name}'", flush=True)
            continue

        # Add boolean modifier to wall
        mod = wall.modifiers.new(name=f'Cut_{opening.name}', type='BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = opening
        mod.solver = 'EXACT'  # Use EXACT solver for better reliability

        # Apply the modifier immediately to make the cut permanent
        # First, select the wall and make it active
        bpy.context.view_layer.objects.active = wall
        bpy.ops.object.select_all(action='DESELECT')
        wall.select_set(True)

        # Apply the modifier
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
            print(f"  ✓ Cut opening '{opening.name}' from wall '{wall.name}'", flush=True)
            modifiers_applied += 1
        except Exception as e:
            print(f"  ✗ Failed to apply opening '{opening.name}' to wall '{wall.name}': {e}", flush=True)

    print(f"✓ Applied {modifiers_applied} boolean operations on floor {floor_number}", flush=True)

def create_gable_roof(ridge_start_x: float, ridge_start_y: float, ridge_z: float,
                      ridge_length: float,
                      left_slope_angle: float, left_slope_length: float,
                      right_slope_angle: float, right_slope_length: float,
                      material_name: str = 'roof',
                      thickness: float = None,
                      floor_number: int = None,
                      ridge_axis: str = 'x',
                      explosion_offset: float = 0.0) -> bpy.types.Object:
    """
    Create a gable roof with potentially asymmetric slopes and thickness.

    Args:
        ridge_start_x, ridge_start_y: Start point of ridge (input units, Inkscape coords)
        ridge_z: Height of ridge relative to floor (input units)
        ridge_length: Length of ridge along ridge_axis (input units)
        left_slope_angle: Angle of left slope in degrees (0-90)
        left_slope_length: Length of left slope (input units)
        right_slope_angle: Angle of right slope in degrees (0-90)
        right_slope_length: Length of right slope (input units)
        material_name: Material to apply
        thickness: Roof slab thickness (input units), defaults to roof_thickness from config
        floor_number: Floor number (for Z offset calculation including explosion factor)
        ridge_axis: 'x' (default) — ridge runs along X, slopes face +Y/-Y (N/S).
                    'y' — ridge runs along Y, slopes face +X/-X (E/W). "left" = -X (west),
                    "right" = +X (east).

    Returns:
        Created roof mesh object
    """
    # Get roof thickness from config if not provided
    if thickness is None:
        thickness = GLOBAL_CONFIG.get('roof_thickness', 8)

    # Calculate floor Z offset if floor_number is provided
    floor_z_offset = 0.0
    if floor_number is not None:
        explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
        floor_z_offset_meters = get_floor_z_offset(floor_number, explosion_factor)
        floor_z_offset = floor_z_offset_meters / to_meters(1.0)  # Convert back to input units

    # Roof-specific explosion offset (additive on top of the floor's offset, only
    # in exploded view). Lets the roof separate from its floor without moving it
    # to a dedicated floor.
    if explosion_offset and GLOBAL_CONFIG.get('use_explosion', False):
        floor_z_offset += explosion_offset

    # Adjust ridge_z to be relative to floor
    absolute_ridge_z = ridge_z + floor_z_offset

    # Convert angles to radians
    left_angle_rad = math.radians(left_slope_angle)
    right_angle_rad = math.radians(right_slope_angle)

    # Calculate horizontal projections of slopes
    left_horizontal = left_slope_length * math.cos(left_angle_rad)
    right_horizontal = right_slope_length * math.cos(right_angle_rad)

    # Calculate vertical drops
    left_drop = left_slope_length * math.sin(left_angle_rad)
    right_drop = right_slope_length * math.sin(right_angle_rad)

    # Build the six "triangle" anchor points: left-eave, ridge, right-eave at each
    # end of the ridge. Geometry is parametrized so the same vertex/face layout
    # works for ridge along X (slopes face N/S) or along Y (slopes face E/W).
    if ridge_axis == 'y':
        # Ridge runs along Y; slopes face -X (left/west) and +X (right/east).
        # Front triangle sits at Y = ridge_start_y, back triangle at Y = ridge_start_y + ridge_length.
        ridge_end_y = ridge_start_y + ridge_length
        left_edge_x = ridge_start_x - left_horizontal
        right_edge_x = ridge_start_x + right_horizontal
        left_edge_z = absolute_ridge_z - left_drop
        right_edge_z = absolute_ridge_z - right_drop

        def tri(y, z_off=0.0):
            return [
                (left_edge_x, y, left_edge_z + z_off),
                (ridge_start_x, y, absolute_ridge_z + z_off),
                (right_edge_x, y, right_edge_z + z_off),
            ]

        front_y, back_y = ridge_start_y, ridge_end_y
        bottom_pts = tri(front_y) + tri(back_y)
        top_pts = tri(front_y, thickness) + tri(back_y, thickness)
    else:
        # Default: ridge along X; slopes face -Y (left/north) and +Y (right/south).
        ridge_end_x = ridge_start_x + ridge_length
        left_edge_y = ridge_start_y - left_horizontal
        right_edge_y = ridge_start_y + right_horizontal
        left_edge_z = absolute_ridge_z - left_drop
        right_edge_z = absolute_ridge_z - right_drop

        def tri(x, z_off=0.0):
            return [
                (x, left_edge_y, left_edge_z + z_off),
                (x, ridge_start_y, absolute_ridge_z + z_off),
                (x, right_edge_y, right_edge_z + z_off),
            ]

        front_x, back_x = ridge_start_x, ridge_end_x
        bottom_pts = tri(front_x) + tri(back_x)
        top_pts = tri(front_x, thickness) + tri(back_x, thickness)

    # Bottom surface vertices (indices 0-5) - original positions
    # Top surface vertices (indices 6-11) - offset upward by thickness
    vertices = [inkscape_to_blender(x, y, z) for (x, y, z) in bottom_pts + top_pts]

    # Define faces for the thick roof
    # Note: 0-5 are bottom vertices, 6-11 are top vertices
    faces = [
        # Top surfaces (now using indices 6-11)
        [6, 7, 10, 9],     # Left slope top
        [7, 8, 11, 10],    # Right slope top

        # Bottom surfaces (now using indices 0-5, reversed winding for correct normals)
        [0, 3, 4, 1],      # Left slope bottom
        [1, 4, 5, 2],      # Right slope bottom

        # Edge strips connecting top and bottom (close the thickness gaps)
        [0, 6, 9, 3],      # Left eave edge
        [2, 5, 11, 8],     # Right eave edge
        [1, 4, 10, 7],     # Ridge edge

        # Front gable thickness edges (close the exposed thickness at front)
        [0, 1, 7, 6],      # Front left edge (left eave to ridge)
        [1, 2, 8, 7],      # Front right edge (ridge to right eave)

        # Back gable thickness edges (close the exposed thickness at back)
        [3, 9, 10, 4],     # Back left edge (left eave to ridge)
        [4, 10, 11, 5],    # Back right edge (ridge to right eave)
    ]

    # Create mesh
    mesh = bpy.data.meshes.new('Gable_Roof_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    # Create object
    roof_obj = bpy.data.objects.new('Gable_Roof', mesh)
    bpy.context.collection.objects.link(roof_obj)

    # Apply material
    if material_name in bpy.data.materials:
        roof_obj.data.materials.append(bpy.data.materials[material_name])

    # Add to collection
    add_to_collection(roof_obj, 'Roof')

    floor_info = f" on floor {floor_number} (z_offset={floor_z_offset:.1f})" if floor_number is not None else ""
    print(f"✓ Created gable roof{floor_info}: ridge_length={ridge_length}, "
          f"left={left_slope_angle}°/{left_slope_length}, "
          f"right={right_slope_angle}°/{right_slope_length}, "
          f"thickness={thickness}, ridge_z={absolute_ridge_z:.1f}")

    return roof_obj


def create_hip_roof(eave_x_west: float, eave_x_east: float,
                    eave_y_north: float, eave_y_south: float,
                    eave_z: float,
                    slope_angle: float = None,
                    slope_angle_ns: float = None,
                    slope_angle_ew: float = None,
                    ridge_length: float = None,
                    ridge_y_start: float = None,
                    ridge_y_end: float = None,
                    ridge_x_start: float = None,
                    ridge_x_end: float = None,
                    ridge_axis: str = 'y',
                    material_name: str = 'roof',
                    thickness: float = None,
                    floor_number: int = None,
                    explosion_offset: float = 0.0) -> bpy.types.Object:
    """
    Create a four-sided hip roof: trapezoidal "main" slopes along the ridge axis
    and triangular "hip end" slopes perpendicular to it.

    Args:
        eave_x_west, eave_x_east: West/east X positions of the eave drip edge.
        eave_y_north, eave_y_south: North/south Y positions of the eave drip edge.
        eave_z: Eave height (z above the floor base).
        slope_angle: Uniform pitch for all 4 slopes. Used only when both
            slope_angle_ns and slope_angle_ew are omitted.
        slope_angle_ns: Pitch of the N and S slopes (symmetric pair).
        slope_angle_ew: Pitch of the E and W slopes (symmetric pair).
        ridge_length: Optional override. If set, the ridge is centered along
            its axis with this length, and the hip-end angle is derived from
            geometry — i.e. ridge_length overrides the hip-axis slope angle
            (slope_angle_ns when ridge_axis='y', slope_angle_ew when 'x').
            A warning is printed if the derived angle differs from the input.
        ridge_axis: 'y' (default) — ridge runs N-S, so EW slopes are the long
            trapezoidal main slopes and NS slopes are the triangular hip ends.
            'x' — ridge runs E-W; roles swap.
        material_name: Material to apply.
        thickness: Roof slab thickness (input units), defaults to roof_thickness.
        floor_number: Floor number for Z offset (with explosion factor).

    Geometry: the MAIN-axis angle (perpendicular to the ridge) sets ridge height
    h. The HIP-axis angle (parallel to the ridge) determines how far the ridge
    endpoints sit inset from the hip eaves, and therefore the ridge length.
    The two angles are independent — any combination produces a valid hip.
    """
    import math

    if thickness is None:
        thickness = GLOBAL_CONFIG.get('roof_thickness', 8)

    if slope_angle_ns is None:
        slope_angle_ns = slope_angle
    if slope_angle_ew is None:
        slope_angle_ew = slope_angle
    if slope_angle_ns is None or slope_angle_ew is None:
        raise ValueError("create_hip_roof: provide slope_angle, or both "
                         "slope_angle_ns and slope_angle_ew")

    floor_z_offset = 0.0
    if floor_number is not None:
        explosion_factor = GLOBAL_CONFIG.get('explosion_factor', 0.0)
        floor_z_offset_meters = get_floor_z_offset(floor_number, explosion_factor)
        floor_z_offset = floor_z_offset_meters / to_meters(1.0)

    # Roof-specific explosion offset, only in exploded view.
    if explosion_offset and GLOBAL_CONFIG.get('use_explosion', False):
        floor_z_offset += explosion_offset

    eave_z_abs = eave_z + floor_z_offset

    span_x = eave_x_east - eave_x_west
    span_y = eave_y_south - eave_y_north
    tan_ns = math.tan(math.radians(slope_angle_ns))
    tan_ew = math.tan(math.radians(slope_angle_ew))

    if ridge_axis == 'y':
        # Ridge runs along Y. EW = main (sets ridge height h); NS = hip end.
        # ridge_y_start/ridge_y_end are absolute Y coords and take precedence
        # over ridge_length (symmetric) and slope_angle (fully symmetric) —
        # they allow the two hip ends to be different sizes.
        h = (span_x / 2.0) * tan_ew
        ridge_z_abs = eave_z_abs + h
        ridge_x = (eave_x_west + eave_x_east) / 2.0

        if ridge_y_start is not None and ridge_y_end is not None:
            _rs = ridge_y_start
            _re = ridge_y_end
        else:
            if ridge_length is not None:
                d_hip = (span_y - ridge_length) / 2.0
                if d_hip > 0:
                    derived_ns = math.degrees(math.atan(h / d_hip))
                    if abs(derived_ns - slope_angle_ns) > 0.1:
                        print(f"  hip_roof: ridge_length override → NS slope angle "
                              f"is {derived_ns:.1f}° (input {slope_angle_ns}° ignored)")
            else:
                d_hip = h / tan_ns
            _rs = eave_y_north + d_hip
            _re = eave_y_south - d_hip
        if _re < _rs:
            mid = (eave_y_north + eave_y_south) / 2.0
            _rs = _re = mid

        n_ridge = (ridge_x, _rs, ridge_z_abs)
        s_ridge = (ridge_x, _re, ridge_z_abs)
    else:
        # Ridge runs along X. NS = main; EW = hip end.
        h = (span_y / 2.0) * tan_ns
        ridge_z_abs = eave_z_abs + h
        ridge_y = (eave_y_north + eave_y_south) / 2.0

        if ridge_x_start is not None and ridge_x_end is not None:
            _rs = ridge_x_start
            _re = ridge_x_end
        else:
            if ridge_length is not None:
                d_hip = (span_x - ridge_length) / 2.0
                if d_hip > 0:
                    derived_ew = math.degrees(math.atan(h / d_hip))
                    if abs(derived_ew - slope_angle_ew) > 0.1:
                        print(f"  hip_roof: ridge_length override → EW slope angle "
                              f"is {derived_ew:.1f}° (input {slope_angle_ew}° ignored)")
            else:
                d_hip = h / tan_ew
            _rs = eave_x_west + d_hip
            _re = eave_x_east - d_hip
        if _re < _rs:
            mid = (eave_x_west + eave_x_east) / 2.0
            _rs = _re = mid

        n_ridge = (_rs, ridge_y, ridge_z_abs)
        s_ridge = (_re, ridge_y, ridge_z_abs)

    # 6 bottom anchor points (eave corners + 2 ridge endpoints), then 6 top
    # anchor points offset by thickness in z. inkscape_to_blender flips Y.
    base_inputs = [
        (eave_x_west, eave_y_north, eave_z_abs),   # 0 NW
        (eave_x_east, eave_y_north, eave_z_abs),   # 1 NE
        (eave_x_east, eave_y_south, eave_z_abs),   # 2 SE
        (eave_x_west, eave_y_south, eave_z_abs),   # 3 SW
        n_ridge,                                    # 4 ridge "start"
        s_ridge,                                    # 5 ridge "end"
    ]
    top_inputs = [(x, y, z + thickness) for (x, y, z) in base_inputs]

    vertices = [inkscape_to_blender(x, y, z) for (x, y, z) in base_inputs + top_inputs]

    # Slope faces: bottom layer uses indices 0-5, top layer mirrors with +6.
    # Top uses same winding as bottom — matches the existing gable_roof pattern.
    if ridge_axis == 'y':
        faces = [
            # Bottom slope surfaces
            [0, 1, 4],         # N hip
            [2, 3, 5],         # S hip
            [0, 4, 5, 3],      # W main
            [1, 2, 5, 4],      # E main
            # Top slope surfaces (same winding, +6 indices)
            [6, 7, 10],        # N hip
            [8, 9, 11],        # S hip
            [6, 10, 11, 9],    # W main
            [7, 8, 11, 10],    # E main
        ]
    else:
        faces = [
            # Bottom slope surfaces
            [0, 4, 3],         # W hip
            [1, 2, 5],         # E hip
            [0, 1, 5, 4],      # N main
            [3, 4, 5, 2],      # S main
            # Top slope surfaces (same winding, +6 indices)
            [6, 10, 9],        # W hip
            [7, 8, 11],        # E hip
            [6, 7, 11, 10],    # N main
            [9, 10, 11, 8],    # S main
        ]
    # Eave drip strips (close thickness gap around perimeter) — same for both axes
    faces.extend([
        [0, 1, 7, 6],          # N eave
        [1, 2, 8, 7],          # E eave
        [2, 3, 9, 8],          # S eave
        [3, 0, 6, 9],          # W eave
        # Central ridge cap (strip between bottom and top ridge lines)
        [4, 5, 11, 10],
    ])

    mesh = bpy.data.meshes.new('Hip_Roof_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()

    roof_obj = bpy.data.objects.new('Hip_Roof', mesh)
    bpy.context.collection.objects.link(roof_obj)

    if material_name in bpy.data.materials:
        roof_obj.data.materials.append(bpy.data.materials[material_name])

    add_to_collection(roof_obj, 'Roof')

    floor_info = f" on floor {floor_number} (z_offset={floor_z_offset:.1f})" if floor_number is not None else ""
    # Derive ridge length from the resolved ridge endpoints (_rs / _re),
    # which are set on both the symmetric d_hip path and the asymmetric
    # ridge_y_start/ridge_y_end override path.
    ridge_len = max(0.0, _re - _rs)
    print(f"✓ Created hip roof{floor_info}: axis={ridge_axis}, "
          f"NS={slope_angle_ns}°, EW={slope_angle_ew}°, ridge_z={ridge_z_abs:.1f}, "
          f"ridge_length={ridge_len:.1f}, "
          f"eave bbox=({eave_x_west:.1f},{eave_y_north:.1f})→({eave_x_east:.1f},{eave_y_south:.1f})")

    return roof_obj


def create_roof_frame_3d(members, frame_z_lift: float = 0.0,
                         material_name: str = 'steel_hss',
                         collection_name: str = 'Roof_Frame') -> int:
    """Build every metal-frame member of the hip roof.

    Args:
        members: list of dicts from `roof_frame.compute_frame_members`.
                 Each has p0, p1 in RAW world units (matching eave_z /
                 wall_top_z convention), section_in [w_in, d_in], wall_mm.
        frame_z_lift: RAW-units lift applied to every member's Z (used to
                 separate the frame from the loft in exploded view).
        material_name: shared material for all frame members.
        collection_name: top-level Blender collection.

    Returns:
        Number of members successfully created.
    """
    import mathutils
    import math

    IN_PER_UNIT = 12.0 / 10.0

    # ---- Shared material: dark grey metallic HSS steel ----
    if material_name not in bpy.data.materials:
        mat = bpy.data.materials.new(material_name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        if bsdf is not None:
            bsdf.inputs['Base Color'].default_value = (0.28, 0.30, 0.34, 1.0)
            if 'Metallic' in bsdf.inputs:
                bsdf.inputs['Metallic'].default_value = 0.85
            if 'Roughness' in bsdf.inputs:
                bsdf.inputs['Roughness'].default_value = 0.35
        mat.diffuse_color = (0.28, 0.30, 0.34, 1.0)
    mat = bpy.data.materials[material_name]

    # ---- Collection ----
    if collection_name not in bpy.data.collections:
        col = bpy.data.collections.new(collection_name)
        bpy.context.scene.collection.children.link(col)
    col = bpy.data.collections[collection_name]

    z_axis = mathutils.Vector((0, 0, 1))
    count = 0
    for m in members:
        p0 = m['p0']; p1 = m['p1']
        dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
        length_u = math.sqrt(dx * dx + dy * dy + dz * dz)
        if length_u < 0.01:
            continue

        # Cross-section in world units (section_in given in inches)
        w_in, d_in = m['section_in']
        w_u = w_in / IN_PER_UNIT
        d_u = d_in / IN_PER_UNIT

        # Midpoint (with lift applied to z)
        mx = (p0[0] + p1[0]) / 2.0
        my = (p0[1] + p1[1]) / 2.0
        mz_raw = (p0[2] + p1[2]) / 2.0 + frame_z_lift

        # Blender location — pass raw units (all of x, y, z); the
        # inkscape_to_blender helper applies to_meters (×0.1) internally.
        # This matches how create_beam / create_wall pass their z values.
        location = inkscape_to_blender(mx, my, mz_raw)

        # Create a default (size=2) cube, scale to member dimensions,
        # rotate, position. Matches create_box's convention: default cube
        # has vertices at ±1, so scale = dim/2 yields dim total length.
        bpy.ops.mesh.primitive_cube_add(location=location)
        obj = bpy.context.active_object
        obj.name = m.get('name', f"{m['kind']}_{count}")

        if m.get('axis_aligned'):
            # Axis-aligned box (e.g. pani patti): the member runs along
            # either X or Y with a fixed through-wall thickness and a
            # vertical height. No rotation is applied — we set explicit
            # Blender-space dimensions from the raw p0→p1 span.
            thk_u = float(m.get('thickness_u', w_u))
            h_u = float(m.get('height_u', d_u))
            if abs(dx) >= abs(dy):
                sx = to_meters(abs(dx)) / 2.0    # along X = member length
                sy = to_meters(thk_u) / 2.0      # through-wall
            else:
                sx = to_meters(thk_u) / 2.0
                sy = to_meters(abs(dy)) / 2.0
            sz = to_meters(h_u) / 2.0
            obj.scale = (sx, sy, sz)
            obj.rotation_mode = 'QUATERNION'
            obj.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        else:
            # Direction — Blender flips Y sign, so mirror dy accordingly.
            # We construct a full orthonormal frame [X', Y', Z'] so the
            # cross-section orientation is consistent for every member:
            #   Z' = member direction (length along it)
            #   X' = horizontal, perpendicular to the member's horizontal
            #        projection (this is where the section's WIDTH sits)
            #   Y' = Z' × X' = the roof-normal direction (DEPTH sits here)
            # Using `z_axis.rotation_difference` alone picks the shortest
            # arc, which for E-W members leaves width in the vertical XZ
            # plane while N-S members put it in X — producing visibly
            # different apparent thicknesses in the top view.
            dir_blender = mathutils.Vector((dx, -dy, dz)).normalized()
            horiz = mathutils.Vector((dir_blender.x, dir_blender.y, 0.0))
            if horiz.length < 1e-4:
                # Vertical member — width axis is arbitrary; pick X.
                width_dir = mathutils.Vector((1.0, 0.0, 0.0))
            else:
                horiz.normalize()
                # 90° CCW in the XY plane gives the horizontal perpendicular.
                width_dir = mathutils.Vector((-horiz.y, horiz.x, 0.0)).normalized()
            depth_dir = dir_blender.cross(width_dir).normalized()
            rot_matrix = mathutils.Matrix((
                (width_dir.x, depth_dir.x, dir_blender.x),
                (width_dir.y, depth_dir.y, dir_blender.y),
                (width_dir.z, depth_dir.z, dir_blender.z),
            ))
            obj.scale = (to_meters(w_u) / 2.0,
                         to_meters(d_u) / 2.0,
                         to_meters(length_u) / 2.0)
            obj.rotation_mode = 'QUATERNION'
            obj.rotation_quaternion = rot_matrix.to_quaternion()

        # Assign material
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat

        # Move into target collection (unlink from wherever it landed)
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        col.objects.link(obj)
        count += 1

    print(f"✓ Created {count} roof-frame members in collection '{collection_name}'")
    return count


# ============================================================================
# SCENE SETUP
# ============================================================================

def clear_scene():
    """Clear all objects, meshes, materials, and collections from the scene"""
    # Unhide all objects first to ensure they can be deleted
    for obj in bpy.data.objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False

    # Select and delete all objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Clear all mesh data
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)

    # Clear all materials
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)

    # Clear collections except default
    for collection in bpy.data.collections:
        bpy.data.collections.remove(collection)

    print("✓ Scene cleared (all objects, meshes, materials, and collections deleted)", flush=True)

def setup_camera_and_lighting(bounds: Dict[str, float]):
    """
    Set up camera and lighting for the scene.

    Args:
        bounds: Dictionary with 'min_x', 'max_x', 'min_y', 'max_y', 'max_z' in input units
    """
    # Convert bounds to Blender coordinates
    center_x = (bounds['min_x'] + bounds['max_x']) / 2
    center_y = (bounds['min_y'] + bounds['max_y']) / 2
    center = inkscape_to_blender(center_x, center_y, bounds['max_z'] / 2)

    width = to_meters(bounds['max_x'] - bounds['min_x'])
    depth = to_meters(bounds['max_y'] - bounds['min_y'])

    # Camera
    camera_distance = max(width, depth) * 1.5
    cam_location = (center[0], center[1] - camera_distance, center[2] + camera_distance * 0.5)
    bpy.ops.object.camera_add(location=cam_location)
    camera = bpy.context.active_object
    camera.rotation_euler = (math.radians(60), 0, 0)
    bpy.context.scene.camera = camera

    # Sun light
    bpy.ops.object.light_add(type='SUN', location=(center[0], center[1], 20))
    sun = bpy.context.active_object
    sun.data.energy = 2.0
    sun.rotation_euler = (math.radians(45), 0, math.radians(30))

    # Area light from above
    bpy.ops.object.light_add(type='AREA', location=(center[0], center[1], center[2] + 10))
    area_light = bpy.context.active_object
    area_light.data.energy = 500
    area_light.data.size = 5

def configure_render():
    """Configure render settings"""
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 128
    bpy.context.scene.render.resolution_x = 1920
    bpy.context.scene.render.resolution_y = 1080

    # Set viewport shading
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    # Set to solid shading with object colors
                    space.shading.type = 'SOLID'
                    space.shading.color_type = 'OBJECT'
                    # Or use 'MATERIAL' for material preview mode
                    # space.shading.type = 'MATERIAL'

# ============================================================================
# INITIALIZATION
# ============================================================================

def init_scene():
    """Initialize scene with materials and settings"""
    # Reduce Blender's verbose logging
    import logging
    import sys
    logging.getLogger("bpy").setLevel(logging.WARNING)

    # Force stdout to flush immediately so prints appear right away
    sys.stdout.flush()

    clear_scene()
    initialize_materials()

    print("\n" + "="*70, flush=True)
    print("✓ Scene initialized", flush=True)
    print(f"  Units: {GLOBAL_CONFIG['units_to_meters_ratio']} m per unit", flush=True)
    print(f"  Scale factor: {GLOBAL_CONFIG['scale_factor']}x", flush=True)
    print(f"  Ground level Z: {GLOBAL_CONFIG['ground_level_z']} m", flush=True)
    print("="*70 + "\n", flush=True)

def export_to_web(filepath: str = None):
    """
    Export the Blender model to docs/konkan_house.glb for web viewing.
    Static HTML files are already in the docs/ folder.

    Args:
        filepath: Path to save the file. If None, saves to docs/konkan_house.glb

    Returns:
        Path to the exported file
    """
    import os

    if filepath is None:
        # Get the blend file directory
        blend_filepath = bpy.data.filepath
        if blend_filepath:
            blend_dir = os.path.dirname(blend_filepath)
        else:
            # If blend file not saved, use current working directory
            blend_dir = os.getcwd()

        # Export to docs folder
        docs_dir = os.path.join(blend_dir, "docs")
        os.makedirs(docs_dir, exist_ok=True)
        filepath = os.path.join(docs_dir, "konkan_house.glb")

    print("\n" + "="*70, flush=True)
    print("EXPORTING MODEL FOR WEB", flush=True)
    print("="*70, flush=True)

    # Step 1: Apply all boolean modifiers to wall objects
    print("Applying boolean modifiers to walls...", flush=True)
    walls_processed = 0
    for obj in bpy.data.objects:
        if obj.type == 'MESH' and not obj.hide_viewport:
            # Check if object has boolean modifiers
            has_booleans = any(mod.type == 'BOOLEAN' for mod in obj.modifiers)
            if has_booleans:
                # Select the object
                bpy.ops.object.select_all(action='DESELECT')
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)

                # Apply all modifiers
                for modifier in obj.modifiers:
                    try:
                        bpy.ops.object.modifier_apply(modifier=modifier.name)
                        walls_processed += 1
                    except Exception as e:
                        print(f"  Warning: Could not apply modifier {modifier.name} on {obj.name}: {e}", flush=True)

    print(f"  Applied {walls_processed} boolean modifiers", flush=True)

    # Step 2: Delete all hidden objects (door/window cutters)
    print("Removing boolean cutter objects...", flush=True)
    cutters_removed = 0
    objects_to_remove = []
    for obj in bpy.data.objects:
        if obj.hide_viewport or obj.hide_render:
            objects_to_remove.append(obj)

    for obj in objects_to_remove:
        bpy.data.objects.remove(obj, do_unlink=True)
        cutters_removed += 1

    print(f"  Removed {cutters_removed} cutter objects", flush=True)

    # Step 3: Apply flat shading to all remaining mesh objects
    print("Applying flat shading...", flush=True)
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            # Select the object
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)

            # Apply flat shading for sharp architectural edges
            bpy.ops.object.shade_flat()

            # Enable auto-smooth for better edge definition
            if hasattr(obj.data, 'use_auto_smooth'):
                obj.data.use_auto_smooth = True
                obj.data.auto_smooth_angle = 0.523599  # 30 degrees in radians

    # Step 4: Export as GLB
    print("Exporting to GLB format...", flush=True)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_apply=False,  # Already applied modifiers manually
        export_normals=True,  # Export vertex normals
        export_tangents=True  # Export tangents for lighting
    )

    file_size = os.path.getsize(filepath) / 1024
    print(f"✓ Model exported to: {filepath}", flush=True)
    print(f"  Format: GLB (binary glTF)", flush=True)
    print(f"  File size: {file_size:.1f} KB", flush=True)

    # Check if static files exist
    docs_dir = os.path.dirname(filepath)
    html_path = os.path.join(docs_dir, 'index.html')

    if os.path.exists(html_path):
        print(f"\n✓ Viewer ready at: {html_path}", flush=True)
        print(f"  Open this file in a web browser to view your model", flush=True)
    else:
        print(f"\n⚠ Note: index.html not found in docs/ folder", flush=True)
        print(f"  The static viewer files should be in the docs/ folder", flush=True)

    print("="*70 + "\n", flush=True)

    return filepath
