"""
Konkan House 2D SVG Functions
Handles all 2D floor plan and elevation view generation

These functions generate SVG drawings for:
- Floor plans (top view)
- Elevation views (front, back, left, right)
- Dimensions and annotations
"""

import math
from typing import Dict, List, Optional

# Import shared configuration
from config import GLOBAL_CONFIG

# ============================================================================
# SVG FLOOR PLAN GENERATION
# ============================================================================

def svg_draw_wall(start_x: float, start_y: float, end_x: float, end_y: float,
                  thickness: float, color: str = "#8B4513") -> str:
    """
    Generate SVG for a wall (top view).

    Args:
        start_x, start_y: Wall start point
        end_x, end_y: Wall end point
        thickness: Wall thickness
        color: Wall fill color

    Returns:
        SVG path string
    """
    # Calculate perpendicular offset for thickness
    import math
    dx = end_x - start_x
    dy = end_y - start_y
    length = math.sqrt(dx*dx + dy*dy)

    if length == 0:
        return ""

    # Perpendicular unit vector
    px = -dy / length
    py = dx / length

    # Wall corners
    offset = thickness / 2
    x1 = start_x + px * offset
    y1 = start_y + py * offset
    x2 = start_x - px * offset
    y2 = start_y - py * offset
    x3 = end_x - px * offset
    y3 = end_y - py * offset
    x4 = end_x + px * offset
    y4 = end_y + py * offset

    return f'<polygon points="{x1},{y1} {x4},{y4} {x3},{y3} {x2},{y2}" fill="{color}" stroke="#000" stroke-width="0.5"/>\n'


def svg_draw_room(x: float, y: float, width: float, length: float,
                  thickness: float, name: str = "",
                  walls: list = None) -> str:
    """
    Generate SVG for a room (top view).

    Args:
        x, y: Top-left corner
        width, length: Room dimensions
        thickness: Wall thickness
        name: Room name for label
        walls: List of walls to draw ['north', 'south', 'east', 'west']

    Returns:
        SVG string with walls and label
    """
    if walls is None:
        walls = ['north', 'south', 'east', 'west']

    walls = [w.lower() for w in walls]
    svg = ""
    t = thickness

    # North wall
    if 'north' in walls:
        svg += svg_draw_wall(x, y + t/2, x + width, y + t/2, thickness)

    # South wall
    if 'south' in walls:
        svg += svg_draw_wall(x, y + length - t/2, x + width, y + length - t/2, thickness)

    # East wall
    if 'east' in walls:
        svg += svg_draw_wall(x + width - t/2, y + t, x + width - t/2, y + length - t, thickness)

    # West wall
    if 'west' in walls:
        svg += svg_draw_wall(x + t/2, y + t, x + t/2, y + length - t, thickness)

    # Room label is now added separately with dimensions, so we don't add it here

    return svg


def svg_draw_door(x: float, y: float, width: float, direction: str = 'north') -> str:
    """
    Generate SVG for a door (top view).

    Args:
        x, y: Door position
        width: Door width
        direction: Door direction ('north', 'south', 'east', 'west')

    Returns:
        SVG string
    """
    direction = direction.lower()

    if direction in ['north', 'south']:
        # Horizontal door
        return f'<rect x="{x}" y="{y-2}" width="{width}" height="4" fill="#A0522D" stroke="#000" stroke-width="0.5"/>\n'
    else:
        # Vertical door
        return f'<rect x="{x-2}" y="{y}" width="4" height="{width}" fill="#A0522D" stroke="#000" stroke-width="0.5"/>\n'


def svg_draw_window(x: float, y: float, width: float, direction: str = 'north') -> str:
    """
    Generate SVG for a window (top view).

    Args:
        x, y: Window position
        width: Window width
        direction: Window direction ('north', 'south', 'east', 'west')

    Returns:
        SVG string
    """
    direction = direction.lower()

    if direction in ['north', 'south']:
        # Horizontal window
        return f'<rect x="{x}" y="{y-1}" width="{width}" height="2" fill="#87CEEB" stroke="#000" stroke-width="0.5"/>\n'
    else:
        # Vertical window
        return f'<rect x="{x-1}" y="{y}" width="2" height="{width}" fill="#87CEEB" stroke="#000" stroke-width="0.5"/>\n'


def svg_draw_floor_slab(x: float, y: float, width: float, length: float) -> str:
    """
    Generate SVG for a floor slab (top view).

    Args:
        x, y: Top-left corner
        width, length: Slab dimensions

    Returns:
        SVG string
    """
    return f'<rect x="{x}" y="{y}" width="{width}" height="{length}" fill="#D3D3D3" stroke="#999" stroke-width="1" opacity="0.6"/>\n'


def svg_draw_pillar(x: float, y: float, size: float = None, width: float = None, length: float = None) -> str:
    """
    Generate SVG for a pillar (top view).

    Args:
        x, y: Center position of pillar
        size: Pillar size for square pillars (deprecated, use width/length)
        width: Pillar width in X direction
        length: Pillar length in Y direction

    Returns:
        SVG string

    Notes:
        For backward compatibility:
        - If width/length not specified, uses size parameter
        - If size not specified, uses wall_thickness
    """
    default_size = GLOBAL_CONFIG.get('wall_thickness', 8)

    # Determine dimensions with backward compatibility
    if width is None:
        width = size if size is not None else default_size
    if length is None:
        length = size if size is not None else default_size

    # Draw pillar as a filled rectangle centered at (x, y)
    pillar_x = x - width / 2
    pillar_y = y - length / 2

    return f'<rect x="{pillar_x}" y="{pillar_y}" width="{width}" height="{length}" fill="#000" stroke="#000" stroke-width="0.5"/>\n'


def svg_draw_beam(x: float, y: float, width: float, length: float) -> str:
    """
    Generate SVG for a beam (top view).

    Beams are structural horizontal elements, similar to floor slabs but with
    wall thickness and distinct color.

    Args:
        x, y: Top-left corner
        width, length: Beam dimensions

    Returns:
        SVG string
    """
    # Use a brown/wood color to distinguish from floor slabs
    return f'<rect x="{x}" y="{y}" width="{width}" height="{length}" fill="#8B4513" stroke="#654321" stroke-width="1" opacity="0.8"/>\n'


def svg_draw_staircase(x: float, y: float, width: float, length: float, direction: str = 'up', num_steps: int = None) -> str:
    """
    Generate SVG for a staircase (top view).

    Args:
        x, y: Top-left corner
        width, length: Staircase dimensions
        direction: 'up' or 'down' (direction indicator)
        num_steps: Number of steps to draw (default: auto-calculate based on length)

    Returns:
        SVG string
    """
    svg = '<g class="staircase">\n'

    # Draw outline
    svg += f'<rect x="{x}" y="{y}" width="{width}" height="{length}" fill="#E8D5B7" stroke="#000" stroke-width="1"/>\n'

    # Calculate number of steps if not provided
    if num_steps is None:
        # Assume ~10 inches per step
        num_steps = max(3, int(length / 10))

    # Draw step lines
    step_spacing = length / num_steps
    for i in range(1, num_steps):
        step_y = y + i * step_spacing
        svg += f'<line x1="{x}" y1="{step_y}" x2="{x + width}" y2="{step_y}" stroke="#666" stroke-width="0.5"/>\n'

    # Draw direction arrow
    arrow_start_x = x + width / 2
    arrow_margin = length * 0.15

    if direction == 'up':
        # Arrow pointing up
        arrow_start_y = y + length - arrow_margin
        arrow_end_y = y + arrow_margin
        arrow_tip_y = arrow_end_y
        arrow_tip_left_x = arrow_start_x - 5
        arrow_tip_right_x = arrow_start_x + 5
        arrow_tip_base_y = arrow_end_y + 8
    else:
        # Arrow pointing down
        arrow_start_y = y + arrow_margin
        arrow_end_y = y + length - arrow_margin
        arrow_tip_y = arrow_end_y
        arrow_tip_left_x = arrow_start_x - 5
        arrow_tip_right_x = arrow_start_x + 5
        arrow_tip_base_y = arrow_end_y - 8

    # Draw arrow line
    svg += f'<line x1="{arrow_start_x}" y1="{arrow_start_y}" x2="{arrow_start_x}" y2="{arrow_end_y}" stroke="#000" stroke-width="2"/>\n'

    # Draw arrowhead
    svg += f'<polygon points="{arrow_start_x},{arrow_tip_y} {arrow_tip_left_x},{arrow_tip_base_y} {arrow_tip_right_x},{arrow_tip_base_y}" fill="#000"/>\n'

    svg += '</g>\n'
    return svg


# ============================================================================
# DIMENSIONING FUNCTIONS
# ============================================================================

def format_dimension(length: float) -> str:
    """
    Format a dimension value according to config settings.

    Args:
        length: Length in input units

    Returns:
        Formatted string like "20' 6\"" or "20.5'" or "20.5 feet"
    """
    dim_config = GLOBAL_CONFIG['dimensions']
    converted = length / dim_config['unit_conversion']
    precision = dim_config['precision']
    unit = dim_config['unit_display']
    use_feet_inches = dim_config.get('use_feet_inches', False)

    # If displaying in feet and feet-inches format is enabled
    if unit == 'feet' and use_feet_inches:
        feet = int(converted)
        inches = (converted - feet) * 12

        # Round inches to nearest integer or fraction
        inches_rounded = round(inches)
        # Roll over 12" up to the next foot so we never display "618' 12\""
        if inches_rounded >= 12:
            feet += inches_rounded // 12
            inches_rounded = inches_rounded % 12

        if feet > 0 and inches_rounded > 0:
            return f"{feet}' {inches_rounded}\""
        elif feet > 0:
            return f"{feet}'"
        else:
            return f"{inches_rounded}\""
    else:
        # Original decimal format
        formatted_value = f"{converted:.{precision}f}"
        return f"{formatted_value}'{'' if unit == 'feet' else ' ' + unit}"


def normalize_edge_key(x1: float, y1: float, x2: float, y2: float) -> tuple:
    """
    Create a normalized key for an edge (independent of direction).

    Args:
        x1, y1: Start point
        x2, y2: End point

    Returns:
        Tuple that's the same regardless of edge direction
    """
    # Sort points to create canonical representation
    if (x1, y1) <= (x2, y2):
        return (round(x1, 2), round(y1, 2), round(x2, 2), round(y2, 2))
    else:
        return (round(x2, 2), round(y2, 2), round(x1, 2), round(y1, 2))


def extract_floor_edges(floor_config: dict) -> dict:
    """
    Extract all edges from floor configuration.

    Returns:
        Dictionary with 'horizontal' and 'vertical' edge lists
    """
    edges = {'horizontal': {}, 'vertical': {}}

    if 'objects' not in floor_config:
        return edges

    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

    for obj in floor_config['objects']:
        obj_type = obj.get('type')

        if obj_type == 'room':
            x, y = obj['x'], obj['y']
            w, h = obj['width'], obj['length']
            t = obj.get('wall_thickness', wall_thickness)
            walls = obj.get('walls', ['north', 'south', 'east', 'west'])
            walls = [w_name.lower() for w_name in walls]

            # North wall (horizontal)
            if 'north' in walls:
                key = normalize_edge_key(x, y, x + w, y)
                edges['horizontal'][key] = {'x1': x, 'y1': y, 'x2': x + w, 'y2': y, 'source': f"{obj['name']}_North"}

            # South wall (horizontal)
            if 'south' in walls:
                key = normalize_edge_key(x, y + h, x + w, y + h)
                edges['horizontal'][key] = {'x1': x, 'y1': y + h, 'x2': x + w, 'y2': y + h, 'source': f"{obj['name']}_South"}

            # East wall (vertical)
            if 'east' in walls:
                key = normalize_edge_key(x + w, y, x + w, y + h)
                edges['vertical'][key] = {'x1': x + w, 'y1': y, 'x2': x + w, 'y2': y + h, 'source': f"{obj['name']}_East"}

            # West wall (vertical)
            if 'west' in walls:
                key = normalize_edge_key(x, y, x, y + h)
                edges['vertical'][key] = {'x1': x, 'y1': y, 'x2': x, 'y2': y + h, 'source': f"{obj['name']}_West"}

        elif obj_type == 'wall':
            x1, y1 = obj['start_x'], obj['start_y']
            x2, y2 = obj['end_x'], obj['end_y']

            # Determine if horizontal or vertical
            if abs(y2 - y1) < 0.01:  # Horizontal wall
                key = normalize_edge_key(x1, y1, x2, y2)
                edges['horizontal'][key] = {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'source': obj.get('name', 'Wall')}
            elif abs(x2 - x1) < 0.01:  # Vertical wall
                key = normalize_edge_key(x1, y1, x2, y2)
                edges['vertical'][key] = {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2, 'source': obj.get('name', 'Wall')}

    return edges


def classify_perimeter_edges(edges: dict, bounds: dict) -> dict:
    """
    Classify which edges are on the building perimeter.

    Args:
        edges: Dictionary with 'horizontal' and 'vertical' edge dictionaries
        bounds: Bounding box dict with min_x, max_x, min_y, max_y

    Returns:
        Dictionary with perimeter edges classified by side
    """
    tolerance = 2.0  # Tolerance for considering an edge on the perimeter
    perimeter = {'north': [], 'south': [], 'east': [], 'west': []}

    # Horizontal edges
    for edge in edges['horizontal'].values():
        y = edge['y1']
        # North (top)
        if abs(y - bounds['min_y']) < tolerance:
            perimeter['north'].append(edge)
        # South (bottom)
        elif abs(y - bounds['max_y']) < tolerance:
            perimeter['south'].append(edge)

    # Vertical edges
    for edge in edges['vertical'].values():
        x = edge['x1']
        # West (left)
        if abs(x - bounds['min_x']) < tolerance:
            perimeter['west'].append(edge)
        # East (right)
        elif abs(x - bounds['max_x']) < tolerance:
            perimeter['east'].append(edge)

    return perimeter


def assign_dimension_offset_levels(edges: list, is_horizontal: bool = True) -> dict:
    """
    Assign offset levels to edges to prevent overlapping dimension lines.
    Edges that overlap in their span get different offset levels.

    Args:
        edges: List of edge dictionaries
        is_horizontal: True for horizontal edges (check X overlap), False for vertical (check Y overlap)

    Returns:
        Dictionary mapping edge keys to offset levels (0, 1, 2, ...)
    """
    if not edges:
        return {}

    # Small gap tolerance - dimensions closer than this get stacked
    gap_tolerance = 5.0

    # Sort edges by their start coordinate
    if is_horizontal:
        sorted_edges = sorted(edges, key=lambda e: (e['x1'], e['x2']))
    else:
        sorted_edges = sorted(edges, key=lambda e: (e['y1'], e['y2']))

    # Track occupied ranges at each level
    # levels[i] = list of (start, end) ranges at level i
    levels = []
    edge_levels = {}

    for edge in sorted_edges:
        # Get the range for this edge
        if is_horizontal:
            edge_start = min(edge['x1'], edge['x2'])
            edge_end = max(edge['x1'], edge['x2'])
        else:
            edge_start = min(edge['y1'], edge['y2'])
            edge_end = max(edge['y1'], edge['y2'])

        # Find the first level where this edge doesn't overlap with existing edges
        assigned_level = None
        for level_idx, ranges in enumerate(levels):
            # Check if this edge overlaps with any range at this level
            overlaps = False
            for range_start, range_end in ranges:
                # Check for overlap with gap tolerance:
                # Overlap if edge starts before range ends (plus gap) AND ends after range starts (minus gap)
                if edge_start < (range_end + gap_tolerance) and edge_end > (range_start - gap_tolerance):
                    overlaps = True
                    break

            if not overlaps:
                # This level works
                assigned_level = level_idx
                ranges.append((edge_start, edge_end))
                break

        # If no existing level works, create a new level
        if assigned_level is None:
            assigned_level = len(levels)
            levels.append([(edge_start, edge_end)])

        # Store the level for this edge
        edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
        edge_levels[edge_key] = assigned_level

    return edge_levels


def detect_wall_connections(edges: dict) -> dict:
    """
    Detect which edges have walls connecting at their endpoints.
    Returns a dict mapping edge_key to (has_start_connection, has_end_connection).

    Args:
        edges: Dictionary with 'horizontal' and 'vertical' keys containing edge dicts

    Returns:
        Dictionary mapping edge_key to (adjust_start, adjust_end) booleans
    """
    tolerance = 2.0  # Tolerance for considering points as connected
    connections = {}

    # Collect all endpoints
    all_edges = list(edges['horizontal'].values()) + list(edges['vertical'].values())

    for edge in all_edges:
        x1, y1, x2, y2 = edge['x1'], edge['y1'], edge['x2'], edge['y2']
        edge_key = normalize_edge_key(x1, y1, x2, y2)

        # Check for connections at start point (x1, y1)
        has_start_connection = False
        for other_edge in all_edges:
            if other_edge == edge:
                continue

            ox1, oy1, ox2, oy2 = other_edge['x1'], other_edge['y1'], other_edge['x2'], other_edge['y2']

            # Check if other edge's endpoint coincides with this edge's start point
            if (abs(ox2 - x1) < tolerance and abs(oy2 - y1) < tolerance) or \
               (abs(ox1 - x1) < tolerance and abs(oy1 - y1) < tolerance):
                has_start_connection = True
                break

        # Check for connections at end point (x2, y2)
        has_end_connection = False
        for other_edge in all_edges:
            if other_edge == edge:
                continue

            ox1, oy1, ox2, oy2 = other_edge['x1'], other_edge['y1'], other_edge['x2'], other_edge['y2']

            # Check if other edge's endpoint coincides with this edge's end point
            if (abs(ox2 - x2) < tolerance and abs(oy2 - y2) < tolerance) or \
               (abs(ox1 - x2) < tolerance and abs(oy1 - y2) < tolerance):
                has_end_connection = True
                break

        connections[edge_key] = (has_start_connection, has_end_connection)

    return connections


def svg_draw_dimension_line(x1: float, y1: float, x2: float, y2: float,
                            offset: float, is_horizontal: bool = True,
                            adjust_start: bool = False, adjust_end: bool = False) -> str:
    """
    Draw a dimension line with arrows and text.

    Args:
        x1, y1: Start point of edge being dimensioned
        x2, y2: End point of edge being dimensioned
        offset: Distance to offset the dimension line (positive = away from drawing)
        is_horizontal: True for horizontal dimensions, False for vertical
        adjust_start: If True, adjust start point inward by wall thickness (clear span)
        adjust_end: If True, adjust end point inward by wall thickness (clear span)

    Returns:
        SVG string
    """
    dim_config = GLOBAL_CONFIG['dimensions']
    text_size = dim_config['text_size']
    min_length = dim_config['min_dimension_length']
    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

    # Adjust points for clear span if needed
    if adjust_start:
        if is_horizontal:
            x1 += wall_thickness
        else:
            y1 += wall_thickness

    if adjust_end:
        if is_horizontal:
            x2 -= wall_thickness
        else:
            y2 -= wall_thickness

    # Calculate length
    length = math.sqrt((x2 - x1)**2 + (y2 - y1)**2)

    # Skip if too short
    if length < min_length:
        return ""

    # Format dimension text
    dim_text = format_dimension(length)

    svg = '<g class="dimension">\n'

    if is_horizontal:
        # Dimension line offset above or below
        dim_y = y1 + offset

        # Main dimension line
        svg += f'  <line x1="{x1}" y1="{dim_y}" x2="{x2}" y2="{dim_y}" stroke="#000" stroke-width="0.5"/>\n'

        # Extension/witness lines
        svg += f'  <line x1="{x1}" y1="{y1}" x2="{x1}" y2="{dim_y}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'
        svg += f'  <line x1="{x2}" y1="{y2}" x2="{x2}" y2="{dim_y}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'

        # Arrowheads
        arrow_size = 3
        if offset > 0:  # Below
            svg += f'  <polygon points="{x1},{dim_y} {x1+arrow_size},{dim_y-arrow_size} {x1+arrow_size},{dim_y+arrow_size}" fill="#000"/>\n'
            svg += f'  <polygon points="{x2},{dim_y} {x2-arrow_size},{dim_y-arrow_size} {x2-arrow_size},{dim_y+arrow_size}" fill="#000"/>\n'
        else:  # Above
            svg += f'  <polygon points="{x1},{dim_y} {x1+arrow_size},{dim_y-arrow_size} {x1+arrow_size},{dim_y+arrow_size}" fill="#000"/>\n'
            svg += f'  <polygon points="{x2},{dim_y} {x2-arrow_size},{dim_y-arrow_size} {x2-arrow_size},{dim_y+arrow_size}" fill="#000"/>\n'

        # Dimension text
        text_y = dim_y - 5 if offset < 0 else dim_y + text_size + 3
        svg += f'  <text x="{(x1+x2)/2}" y="{text_y}" text-anchor="middle" font-size="{text_size}" fill="#000">{dim_text}</text>\n'

    else:  # Vertical
        # Dimension line offset left or right
        dim_x = x1 + offset

        # Main dimension line
        svg += f'  <line x1="{dim_x}" y1="{y1}" x2="{dim_x}" y2="{y2}" stroke="#000" stroke-width="0.5"/>\n'

        # Extension/witness lines
        svg += f'  <line x1="{x1}" y1="{y1}" x2="{dim_x}" y2="{y1}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'
        svg += f'  <line x1="{x2}" y1="{y2}" x2="{dim_x}" y2="{y2}" stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'

        # Arrowheads
        arrow_size = 3
        svg += f'  <polygon points="{dim_x},{y1} {dim_x-arrow_size},{y1+arrow_size} {dim_x+arrow_size},{y1+arrow_size}" fill="#000"/>\n'
        svg += f'  <polygon points="{dim_x},{y2} {dim_x-arrow_size},{y2-arrow_size} {dim_x+arrow_size},{y2-arrow_size}" fill="#000"/>\n'

        # Dimension text (rotated for vertical dimensions)
        text_x = dim_x - text_size - 3 if offset < 0 else dim_x + text_size + 3
        svg += f'  <text x="{text_x}" y="{(y1+y2)/2}" text-anchor="middle" font-size="{text_size}" fill="#000" transform="rotate(-90 {text_x} {(y1+y2)/2})">{dim_text}</text>\n'

    svg += '</g>\n'
    return svg


def assign_opening_offset_levels(openings_by_wall: dict) -> dict:
    """
    Assign offset levels to openings on each wall to prevent overlapping dimensions.

    Args:
        openings_by_wall: Dict mapping wall_name to list of opening dicts with 'x', 'y', 'width', 'direction'

    Returns:
        Dictionary mapping (wall_name, opening_index) to offset level
    """
    opening_levels = {}
    gap_tolerance = 5.0

    for wall_name, openings in openings_by_wall.items():
        if not openings:
            continue

        # Determine if this is a horizontal or vertical wall
        direction = openings[0]['direction'].lower()
        is_horizontal = direction in ['north', 'south']

        # Create pseudo-edges for the openings
        edges = []
        for idx, opening in enumerate(openings):
            if is_horizontal:
                # For horizontal walls, openings span along X
                edge = {
                    'x1': opening['x'],
                    'y1': opening['y'],
                    'x2': opening['x'] + opening['width'],
                    'y2': opening['y'],
                    'index': idx
                }
            else:
                # For vertical walls, openings span along Y
                edge = {
                    'x1': opening['x'],
                    'y1': opening['y'],
                    'x2': opening['x'],
                    'y2': opening['y'] + opening['width'],
                    'index': idx
                }
            edges.append(edge)

        # Use the same algorithm as assign_dimension_offset_levels
        if is_horizontal:
            sorted_edges = sorted(edges, key=lambda e: (e['x1'], e['x2']))
        else:
            sorted_edges = sorted(edges, key=lambda e: (e['y1'], e['y2']))

        levels = []
        for edge in sorted_edges:
            if is_horizontal:
                edge_start = min(edge['x1'], edge['x2'])
                edge_end = max(edge['x1'], edge['x2'])
            else:
                edge_start = min(edge['y1'], edge['y2'])
                edge_end = max(edge['y1'], edge['y2'])

            assigned_level = None
            for level_idx, ranges in enumerate(levels):
                overlaps = False
                for range_start, range_end in ranges:
                    if edge_start < (range_end + gap_tolerance) and edge_end > (range_start - gap_tolerance):
                        overlaps = True
                        break

                if not overlaps:
                    assigned_level = level_idx
                    ranges.append((edge_start, edge_end))
                    break

            if assigned_level is None:
                assigned_level = len(levels)
                levels.append([(edge_start, edge_end)])

            opening_levels[(wall_name, edge['index'])] = assigned_level

    return opening_levels


def svg_draw_opening_dimensions(x: float, y: float, width: float, direction: str,
                                wall_start: float, wall_end: float, offset_level: int = 0,
                                reference_point: float = None) -> str:
    """
    Draw dimensions for a door or window opening.

    Args:
        x, y: Opening position
        width: Opening width
        direction: Opening direction ('north', 'south', 'east', 'west')
        wall_start: Start coordinate of the wall (x for vertical, y for horizontal)
        wall_end: End coordinate of the wall (x for vertical, y for horizontal)
        offset_level: Stacking level for overlapping openings (0, 1, 2, ...)
        reference_point: Reference coordinate for measuring position (previous opening end, or wall start)

    Returns:
        SVG string with two dimensions: position from reference point and opening width
    """
    dim_config = GLOBAL_CONFIG['dimensions']
    base_offset = dim_config['opening_dimension_offset']
    offset_increment = dim_config.get('dimension_offset_increment', 20) * 0.5  # Use smaller increment for openings
    text_size = dim_config['opening_text_size']

    # Calculate actual offset based on level
    offset = base_offset + (offset_level * offset_increment)

    direction = direction.lower()
    svg = '<g class="opening-dimension">\n'

    # Use wall_start as reference if not provided
    if reference_point is None:
        reference_point = wall_start

    if direction in ['north', 'south']:
        # Horizontal wall
        # Dimension 1: Position from reference point to opening
        position_offset = -offset if direction == 'north' else offset
        pos_dim_y = y + position_offset

        if abs(x - reference_point) > 5:  # Only show if not at reference point
            pos_length = abs(x - reference_point)
            pos_dim_text = format_dimension(pos_length)

            # Short dimension line from reference point to opening
            svg += f'  <line x1="{reference_point}" y1="{pos_dim_y}" x2="{x}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.3"/>\n'
            svg += f'  <line x1="{reference_point}" y1="{y}" x2="{reference_point}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
            svg += f'  <line x1="{x}" y1="{y}" x2="{x}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

            # Small arrows
            arrow_size = 2
            svg += f'  <polygon points="{reference_point},{pos_dim_y} {reference_point+arrow_size},{pos_dim_y-arrow_size/2} {reference_point+arrow_size},{pos_dim_y+arrow_size/2}" fill="#666"/>\n'
            svg += f'  <polygon points="{x},{pos_dim_y} {x-arrow_size},{pos_dim_y-arrow_size/2} {x-arrow_size},{pos_dim_y+arrow_size/2}" fill="#666"/>\n'

            # Text
            text_y = pos_dim_y - 3 if direction == 'north' else pos_dim_y + text_size + 1
            svg += f'  <text x="{(reference_point+x)/2}" y="{text_y}" text-anchor="middle" font-size="{text_size}" fill="#666">{pos_dim_text}</text>\n'

        # Dimension 2: Opening width
        width_offset = -offset * 1.8 if direction == 'north' else offset * 1.8
        width_dim_y = y + width_offset
        width_dim_text = format_dimension(width)

        svg += f'  <line x1="{x}" y1="{width_dim_y}" x2="{x+width}" y2="{width_dim_y}" stroke="#000" stroke-width="0.4"/>\n'
        svg += f'  <line x1="{x}" y1="{y}" x2="{x}" y2="{width_dim_y}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
        svg += f'  <line x1="{x+width}" y1="{y}" x2="{x+width}" y2="{width_dim_y}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

        arrow_size = 2
        svg += f'  <polygon points="{x},{width_dim_y} {x+arrow_size},{width_dim_y-arrow_size/2} {x+arrow_size},{width_dim_y+arrow_size/2}" fill="#000"/>\n'
        svg += f'  <polygon points="{x+width},{width_dim_y} {x+width-arrow_size},{width_dim_y-arrow_size/2} {x+width-arrow_size},{width_dim_y+arrow_size/2}" fill="#000"/>\n'

        text_y = width_dim_y - 3 if direction == 'north' else width_dim_y + text_size + 1
        svg += f'  <text x="{x+width/2}" y="{text_y}" text-anchor="middle" font-size="{text_size}" font-weight="bold" fill="#000">{width_dim_text}</text>\n'

    else:  # Vertical wall (east/west)
        # Dimension 1: Position from reference point to opening
        position_offset = -offset if direction == 'west' else offset
        pos_dim_x = x + position_offset

        if abs(y - reference_point) > 5:  # Only show if not at reference point
            pos_length = abs(y - reference_point)
            pos_dim_text = format_dimension(pos_length)

            svg += f'  <line x1="{pos_dim_x}" y1="{reference_point}" x2="{pos_dim_x}" y2="{y}" stroke="#666" stroke-width="0.3"/>\n'
            svg += f'  <line x1="{x}" y1="{reference_point}" x2="{pos_dim_x}" y2="{reference_point}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
            svg += f'  <line x1="{x}" y1="{y}" x2="{pos_dim_x}" y2="{y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

            arrow_size = 2
            svg += f'  <polygon points="{pos_dim_x},{reference_point} {pos_dim_x-arrow_size/2},{reference_point+arrow_size} {pos_dim_x+arrow_size/2},{reference_point+arrow_size}" fill="#666"/>\n'
            svg += f'  <polygon points="{pos_dim_x},{y} {pos_dim_x-arrow_size/2},{y-arrow_size} {pos_dim_x+arrow_size/2},{y-arrow_size}" fill="#666"/>\n'

            text_x = pos_dim_x - text_size - 2 if direction == 'west' else pos_dim_x + text_size + 2
            svg += f'  <text x="{text_x}" y="{(reference_point+y)/2}" text-anchor="middle" font-size="{text_size}" fill="#666" transform="rotate(-90 {text_x} {(reference_point+y)/2})">{pos_dim_text}</text>\n'

        # Dimension 2: Opening width (height in vertical orientation)
        width_offset = -offset * 1.8 if direction == 'west' else offset * 1.8
        width_dim_x = x + width_offset
        width_dim_text = format_dimension(width)

        svg += f'  <line x1="{width_dim_x}" y1="{y}" x2="{width_dim_x}" y2="{y+width}" stroke="#000" stroke-width="0.4"/>\n'
        svg += f'  <line x1="{x}" y1="{y}" x2="{width_dim_x}" y2="{y}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
        svg += f'  <line x1="{x}" y1="{y+width}" x2="{width_dim_x}" y2="{y+width}" stroke="#000" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

        arrow_size = 2
        svg += f'  <polygon points="{width_dim_x},{y} {width_dim_x-arrow_size/2},{y+arrow_size} {width_dim_x+arrow_size/2},{y+arrow_size}" fill="#000"/>\n'
        svg += f'  <polygon points="{width_dim_x},{y+width} {width_dim_x-arrow_size/2},{y+width-arrow_size} {width_dim_x+arrow_size/2},{y+width-arrow_size}" fill="#000"/>\n'

        text_x = width_dim_x - text_size - 2 if direction == 'west' else width_dim_x + text_size + 2
        svg += f'  <text x="{text_x}" y="{y+width/2}" text-anchor="middle" font-size="{text_size}" font-weight="bold" fill="#000" transform="rotate(-90 {text_x} {y+width/2})">{width_dim_text}</text>\n'

    svg += '</g>\n'
    return svg


def generate_floor_plan_svg(floor_config: dict, output_path: str = None,
                            scale: float = 2.0) -> str:
    """
    Generate an SVG floor plan from a floor configuration.

    Args:
        floor_config: Floor configuration dictionary
        output_path: Path to save SVG file (if None, returns SVG string only)
        scale: Pixels per unit (default: 2 pixels per unit)

    Returns:
        SVG content as string
    """
    floor_num = floor_config.get('floor_number', 0)
    floor_name = floor_config.get('name', f'Floor {floor_num}')

    # Find bounds
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')

    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            obj_type = obj.get('type')

            if obj_type in ['floor_slab', 'beam', 'room']:
                x, y = obj['x'], obj['y']
                w, l = obj['width'], obj['length']
                min_x, min_y = min(min_x, x), min(min_y, y)
                max_x, max_y = max(max_x, x + w), max(max_y, y + l)

            elif obj_type == 'wall':
                min_x = min(min_x, obj['start_x'], obj['end_x'])
                max_x = max(max_x, obj['start_x'], obj['end_x'])
                min_y = min(min_y, obj['start_y'], obj['end_y'])
                max_y = max(max_y, obj['start_y'], obj['end_y'])

    # Add margin (extra at top for title and dimensions)
    dim_config = GLOBAL_CONFIG['dimensions']
    base_margin = 20
    # Add extra margin for dimensions if enabled
    # Account for up to 3 stacked wall levels + 1 overall floor extent dimension
    if dim_config['show_outer_dimensions']:
        offset_increment = dim_config['dimension_offset_increment']
        # Max stacked levels (3) + base offset + floor extent dimension with extra gap
        max_offset = dim_config['dimension_offset'] + (3 * offset_increment) + (offset_increment * 1.5) + 10
        dim_margin = (max_offset + 20) * scale
    else:
        dim_margin = 0
    margin = base_margin + dim_margin
    top_margin = 50 + dim_margin  # Extra space for title and top dimensions

    width = (max_x - min_x) * scale + 2 * margin
    height = (max_y - min_y) * scale + margin + top_margin

    # Start SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<title>{floor_name} - Floor Plan</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
    </style>
</defs>
<g transform="translate({margin - min_x * scale}, {top_margin - min_y * scale}) scale({scale}, {scale})">

'''

    # Draw floor slabs first (lowest layer)
    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            if obj.get('type') == 'floor_slab':
                svg += svg_draw_floor_slab(obj['x'], obj['y'], obj['width'], obj['length'])

    # Draw beams next (above floor slabs)
    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            if obj.get('type') == 'beam':
                svg += svg_draw_beam(obj['x'], obj['y'], obj['width'], obj['length'])

    # Draw staircases (after beams, before walls)
    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            if obj.get('type') == 'staircase':
                # Handle both old format (x, y, width, length) and new format (start_x, start_y, step_width, step_tread, direction)
                if 'start_x' in obj:
                    # New format with compass direction
                    start_x = obj['start_x']
                    start_y = obj['start_y']
                    step_width = obj.get('step_width', 30)
                    step_tread = obj.get('step_tread', 10)
                    num_steps = obj.get('num_steps', 10)
                    compass_dir = obj.get('direction', 'north')

                    # Convert compass direction to x, y, width, length, and arrow direction
                    # North = upward (decreasing Y), South = downward (increasing Y)
                    if compass_dir == 'north':
                        x, y = start_x, start_y - num_steps * step_tread
                        width, length = step_width, num_steps * step_tread
                        arrow_dir = 'up'
                    elif compass_dir == 'south':
                        x, y = start_x, start_y
                        width, length = step_width, num_steps * step_tread
                        arrow_dir = 'down'
                    elif compass_dir == 'east':
                        x, y = start_x, start_y
                        width, length = num_steps * step_tread, step_width
                        arrow_dir = 'up'
                    elif compass_dir == 'west':
                        x, y = start_x - num_steps * step_tread, start_y
                        width, length = num_steps * step_tread, step_width
                        arrow_dir = 'down'
                else:
                    # Old format
                    x = obj['x']
                    y = obj['y']
                    width = obj['width']
                    length = obj['length']
                    arrow_dir = obj.get('direction', 'up')
                    num_steps = obj.get('num_steps')

                svg += svg_draw_staircase(x, y, width, length, arrow_dir, num_steps)

    # Store pillar data to draw them last
    pillars_to_draw = []

    # Draw walls and rooms
    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            obj_type = obj.get('type')

            if obj_type == 'room':
                svg += svg_draw_room(
                    obj['x'], obj['y'],
                    obj['width'], obj['length'],
                    obj.get('wall_thickness', wall_thickness),
                    obj.get('name', ''),
                    obj.get('walls')
                )

            elif obj_type == 'wall':
                thickness = obj.get('thickness', wall_thickness)
                svg += svg_draw_wall(
                    obj['start_x'], obj['start_y'],
                    obj['end_x'], obj['end_y'],
                    thickness
                )

            elif obj_type == 'pillar':
                # Store pillar data for drawing later (after all walls and dimensions)
                pillars_to_draw.append({
                    'x': obj['x'],
                    'y': obj['y'],
                    'size': obj.get('size'),
                    'width': obj.get('width'),
                    'length': obj.get('length')
                })

    # Draw doors and windows
    if 'objects' in floor_config:
        for obj in floor_config['objects']:
            obj_type = obj.get('type')

            if obj_type == 'door':
                svg += svg_draw_door(
                    obj['x'], obj['y'],
                    obj['width'],
                    obj.get('direction', 'north')
                )

            elif obj_type == 'window':
                svg += svg_draw_window(
                    obj['x'], obj['y'],
                    obj['width'],
                    obj.get('direction', 'north')
                )

    # Add dimensions
    dim_config = GLOBAL_CONFIG['dimensions']

    # Draw door/window dimensions
    if dim_config['show_opening_dimensions'] and 'objects' in floor_config:
        # First, create a map of wall names to their bounds
        wall_bounds = {}

        for obj in floor_config['objects']:
            if obj.get('type') == 'room':
                room_name = obj['name']
                x, y = obj['x'], obj['y']
                w, h = obj['width'], obj['length']

                wall_bounds[f"{room_name}_North"] = {'start': x, 'end': x + w, 'coord': y, 'direction': 'north'}
                wall_bounds[f"{room_name}_South"] = {'start': x, 'end': x + w, 'coord': y + h, 'direction': 'south'}
                wall_bounds[f"{room_name}_East"] = {'start': y, 'end': y + h, 'coord': x + w, 'direction': 'east'}
                wall_bounds[f"{room_name}_West"] = {'start': y, 'end': y + h, 'coord': x, 'direction': 'west'}

            elif obj.get('type') == 'wall':
                wall_name = obj.get('name', 'Wall')
                x1, y1 = obj['start_x'], obj['start_y']
                x2, y2 = obj['end_x'], obj['end_y']

                if abs(y2 - y1) < 0.01:  # Horizontal wall
                    direction = 'north' if y1 < (min_y + max_y) / 2 else 'south'
                    wall_bounds[wall_name] = {'start': min(x1, x2), 'end': max(x1, x2), 'coord': y1, 'direction': direction}
                elif abs(x2 - x1) < 0.01:  # Vertical wall
                    direction = 'west' if x1 < (min_x + max_x) / 2 else 'east'
                    wall_bounds[wall_name] = {'start': min(y1, y2), 'end': max(y1, y2), 'coord': x1, 'direction': direction}

        # Group openings by wall and collect them
        openings_by_wall = {}

        for obj in floor_config['objects']:
            obj_type = obj.get('type')

            if obj_type in ['door', 'window']:
                direction = obj.get('direction', 'north').lower()
                room = obj.get('room')
                wall_name = obj.get('wall')

                if room and not wall_name:
                    wall_name = f"{room}_{direction.capitalize()}"

                if wall_name and wall_name in wall_bounds:
                    if wall_name not in openings_by_wall:
                        openings_by_wall[wall_name] = []

                    openings_by_wall[wall_name].append(obj)

        # Sort openings on each wall by position
        for wall_name, openings in openings_by_wall.items():
            wall_info = wall_bounds[wall_name]
            direction = wall_info['direction']

            # Sort by X for horizontal walls, Y for vertical walls
            if direction in ['north', 'south']:
                openings.sort(key=lambda o: o['x'])
            else:
                openings.sort(key=lambda o: o['y'])

        # Assign offset levels to prevent overlapping dimensions
        # Convert to the format expected by assign_opening_offset_levels
        openings_for_levels = {}
        for wall_name, openings in openings_by_wall.items():
            openings_for_levels[wall_name] = [
                {'x': o['x'], 'y': o['y'], 'width': o['width'], 'direction': o.get('direction', 'north').lower()}
                for o in openings
            ]
        opening_levels = assign_opening_offset_levels(openings_for_levels)

        # Draw dimensions for doors and windows with running dimensions
        wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)
        opening_offset = dim_config['opening_dimension_offset']
        opening_text_size = dim_config['opening_text_size']

        for wall_name, openings in openings_by_wall.items():
            wall_info = wall_bounds[wall_name]
            direction = wall_info['direction']

            # Start from inside edge of wall (add wall thickness)
            if direction in ['north', 'south']:
                # Horizontal walls - offset along X axis
                reference_point = wall_info['start'] + wall_thickness
            else:
                # Vertical walls - offset along Y axis
                reference_point = wall_info['start'] + wall_thickness

            for wall_index, obj in enumerate(openings):
                offset_level = opening_levels.get((wall_name, wall_index), 0)

                svg += svg_draw_opening_dimensions(
                    obj['x'], obj['y'],
                    obj['width'],
                    direction,
                    wall_info['start'],
                    wall_info['end'],
                    offset_level,
                    reference_point
                )

                # Update reference point to end of this opening for next opening
                if direction in ['north', 'south']:
                    reference_point = obj['x'] + obj['width']
                else:
                    reference_point = obj['y'] + obj['width']

            # Add final dimension from last opening to inside edge of wall
            if openings:
                last_opening = openings[-1]
                wall_inside_end = wall_info['end'] - wall_thickness

                # Calculate the final span
                if direction in ['north', 'south']:
                    final_start = last_opening['x'] + last_opening['width']
                    final_length = wall_inside_end - final_start

                    if final_length > 5:  # Only show if meaningful distance
                        position_offset = -opening_offset if direction == 'north' else opening_offset
                        pos_dim_y = last_opening['y'] + position_offset
                        final_dim_text = format_dimension(final_length)

                        svg += '<g class="opening-dimension">\n'
                        svg += f'  <line x1="{final_start}" y1="{pos_dim_y}" x2="{wall_inside_end}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.3"/>\n'
                        svg += f'  <line x1="{final_start}" y1="{last_opening["y"]}" x2="{final_start}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
                        svg += f'  <line x1="{wall_inside_end}" y1="{last_opening["y"]}" x2="{wall_inside_end}" y2="{pos_dim_y}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

                        arrow_size = 2
                        svg += f'  <polygon points="{final_start},{pos_dim_y} {final_start+arrow_size},{pos_dim_y-arrow_size/2} {final_start+arrow_size},{pos_dim_y+arrow_size/2}" fill="#666"/>\n'
                        svg += f'  <polygon points="{wall_inside_end},{pos_dim_y} {wall_inside_end-arrow_size},{pos_dim_y-arrow_size/2} {wall_inside_end-arrow_size},{pos_dim_y+arrow_size/2}" fill="#666"/>\n'

                        text_y = pos_dim_y - 3 if direction == 'north' else pos_dim_y + opening_text_size + 1
                        svg += f'  <text x="{(final_start+wall_inside_end)/2}" y="{text_y}" text-anchor="middle" font-size="{opening_text_size}" fill="#666">{final_dim_text}</text>\n'
                        svg += '</g>\n'

                else:  # Vertical wall (east/west)
                    final_start = last_opening['y'] + last_opening['width']
                    final_length = wall_inside_end - final_start

                    if final_length > 5:  # Only show if meaningful distance
                        position_offset = -opening_offset if direction == 'west' else opening_offset
                        pos_dim_x = last_opening['x'] + position_offset
                        final_dim_text = format_dimension(final_length)

                        svg += '<g class="opening-dimension">\n'
                        svg += f'  <line x1="{pos_dim_x}" y1="{final_start}" x2="{pos_dim_x}" y2="{wall_inside_end}" stroke="#666" stroke-width="0.3"/>\n'
                        svg += f'  <line x1="{last_opening["x"]}" y1="{final_start}" x2="{pos_dim_x}" y2="{final_start}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'
                        svg += f'  <line x1="{last_opening["x"]}" y1="{wall_inside_end}" x2="{pos_dim_x}" y2="{wall_inside_end}" stroke="#666" stroke-width="0.2" stroke-dasharray="1,1"/>\n'

                        arrow_size = 2
                        svg += f'  <polygon points="{pos_dim_x},{final_start} {pos_dim_x-arrow_size/2},{final_start+arrow_size} {pos_dim_x+arrow_size/2},{final_start+arrow_size}" fill="#666"/>\n'
                        svg += f'  <polygon points="{pos_dim_x},{wall_inside_end} {pos_dim_x-arrow_size/2},{wall_inside_end-arrow_size} {pos_dim_x+arrow_size/2},{wall_inside_end-arrow_size}" fill="#666"/>\n'

                        text_x = pos_dim_x - opening_text_size - 2 if direction == 'west' else pos_dim_x + opening_text_size + 2
                        svg += f'  <text x="{text_x}" y="{(final_start+wall_inside_end)/2}" text-anchor="middle" font-size="{opening_text_size}" fill="#666" transform="rotate(-90 {text_x} {(final_start+wall_inside_end)/2})">{final_dim_text}</text>\n'
                        svg += '</g>\n'

    if dim_config['show_outer_dimensions'] or dim_config['show_inner_dimensions']:
        # Extract all edges
        edges = extract_floor_edges(floor_config)

        # Detect wall connections for clear span dimensioning
        wall_connections = detect_wall_connections(edges)

        # Classify perimeter edges
        bounds_dict = {'min_x': min_x, 'max_x': max_x, 'min_y': min_y, 'max_y': max_y}
        perimeter = classify_perimeter_edges(edges, bounds_dict)

        # Draw outer dimensions with stacked offsets for overlapping dimensions
        if dim_config['show_outer_dimensions']:
            base_offset = dim_config['dimension_offset']
            offset_increment = dim_config['dimension_offset_increment']

            # Assign offset levels for each side to prevent overlapping dimensions
            north_levels = assign_dimension_offset_levels(perimeter['north'], is_horizontal=True)
            south_levels = assign_dimension_offset_levels(perimeter['south'], is_horizontal=True)
            west_levels = assign_dimension_offset_levels(perimeter['west'], is_horizontal=False)
            east_levels = assign_dimension_offset_levels(perimeter['east'], is_horizontal=False)

            # North dimensions (above) - negative offset
            # Always dimension clear interior span (adjust both ends)
            for edge in perimeter['north']:
                edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                level = north_levels.get(edge_key, 0)
                offset = base_offset + (level * offset_increment)
                svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], -offset, True, True, True)

            # South dimensions (below) - positive offset
            # Always dimension clear interior span (adjust both ends)
            for edge in perimeter['south']:
                edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                level = south_levels.get(edge_key, 0)
                offset = base_offset + (level * offset_increment)
                svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], offset, True, True, True)

            # West dimensions (left) - negative offset
            # Always dimension clear interior span (adjust both ends)
            for edge in perimeter['west']:
                edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                level = west_levels.get(edge_key, 0)
                offset = base_offset + (level * offset_increment)
                svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], -offset, False, True, True)

            # East dimensions (right) - positive offset
            # Always dimension clear interior span (adjust both ends)
            for edge in perimeter['east']:
                edge_key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                level = east_levels.get(edge_key, 0)
                offset = base_offset + (level * offset_increment)
                svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], offset, False, True, True)

            # Draw overall floor extent dimensions (outer boundary of this floor)
            # Use maximum offset level + 1 to ensure they're outside all other dimensions
            max_north_level = max(north_levels.values()) if north_levels else 0
            max_south_level = max(south_levels.values()) if south_levels else 0
            max_west_level = max(west_levels.values()) if west_levels else 0
            max_east_level = max(east_levels.values()) if east_levels else 0

            floor_extent_offset_increment = offset_increment * 1.5  # Larger gap for clarity

            # Always draw floor extent dimensions based on calculated bounds
            # North total dimension
            floor_extent_offset = base_offset + (max_north_level + 1) * offset_increment + floor_extent_offset_increment
            svg += svg_draw_dimension_line(min_x, min_y, max_x, min_y, -floor_extent_offset, True, False, False)

            # South total dimension
            floor_extent_offset = base_offset + (max_south_level + 1) * offset_increment + floor_extent_offset_increment
            svg += svg_draw_dimension_line(min_x, max_y, max_x, max_y, floor_extent_offset, True, False, False)

            # West total dimension
            floor_extent_offset = base_offset + (max_west_level + 1) * offset_increment + floor_extent_offset_increment
            svg += svg_draw_dimension_line(min_x, min_y, min_x, max_y, -floor_extent_offset, False, False, False)

            # East total dimension
            floor_extent_offset = base_offset + (max_east_level + 1) * offset_increment + floor_extent_offset_increment
            svg += svg_draw_dimension_line(max_x, min_y, max_x, max_y, floor_extent_offset, False, False, False)

        # Draw interior dimensions
        if dim_config['show_inner_dimensions']:
            inner_offset = dim_config['inner_dimension_offset']

            # Draw non-perimeter horizontal edges
            # Always dimension clear interior span (adjust both ends)
            for edge in edges['horizontal'].values():
                key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                is_perimeter = any(
                    normalize_edge_key(e['x1'], e['y1'], e['x2'], e['y2']) == key
                    for e in perimeter['north'] + perimeter['south']
                )
                if not is_perimeter:
                    # Place dimension below the edge with clear span (both ends adjusted)
                    svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], inner_offset, True, True, True)

            # Draw non-perimeter vertical edges
            # Always dimension clear interior span (adjust both ends)
            for edge in edges['vertical'].values():
                key = normalize_edge_key(edge['x1'], edge['y1'], edge['x2'], edge['y2'])
                is_perimeter = any(
                    normalize_edge_key(e['x1'], e['y1'], e['x2'], e['y2']) == key
                    for e in perimeter['west'] + perimeter['east']
                )
                if not is_perimeter:
                    # Place dimension to the right of the edge with clear span (both ends adjusted)
                    svg += svg_draw_dimension_line(edge['x1'], edge['y1'], edge['x2'], edge['y2'], inner_offset, False, True, True)

    # Add room dimension labels
    if dim_config['show_room_dimensions'] and 'objects' in floor_config:
        room_text_size = dim_config['room_text_size']
        wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

        for obj in floor_config['objects']:
            if obj.get('type') == 'room':
                center_x = obj['x'] + obj['width'] / 2
                center_y = obj['y'] + obj['length'] / 2

                # Calculate carpet area (interior dimensions excluding wall thickness)
                # Since we're dimensioning all walls with clear interior spans (both ends adjusted),
                # the room dimensions should match those wall dimensions
                # Always subtract wall thickness from all sides to match the wall dimensioning
                t = obj.get('wall_thickness', wall_thickness)

                # Start with outer dimensions
                # width = X direction (horizontal), length = Y direction (vertical)
                # Subtract wall thickness from both ends of each dimension
                # This matches the clear interior span shown on the wall dimensions
                carpet_width = obj['width'] - (2 * t)
                carpet_length = obj['length'] - (2 * t)

                # Format dimensions
                width_dim = format_dimension(carpet_width)
                length_dim = format_dimension(carpet_length)

                # Room name
                room_name = obj.get('name', 'Room')
                svg += f'<text x="{center_x}" y="{center_y - 8}" text-anchor="middle" font-size="{room_text_size}" font-weight="bold" fill="#333">{room_name}</text>\n'

                # Carpet area dimensions
                svg += f'<text x="{center_x}" y="{center_y + 8}" text-anchor="middle" font-size="{room_text_size - 2}" fill="#666">{width_dim} × {length_dim}</text>\n'

    # Add floor slab dimensions if they differ from overall floor dimensions
    # Position them outside all other dimensions to avoid overlap
    if dim_config['show_outer_dimensions'] and 'objects' in floor_config:
        # Calculate overall floor dimensions
        overall_width = max_x - min_x
        overall_length = max_y - min_y

        # Calculate offset to position slab dimensions relative to floor extent dimensions
        # Position them one level inside (smaller than) the floor extent dimensions
        # Get the same offset levels used for perimeter dimensions
        base_offset = dim_config['dimension_offset']
        offset_increment = dim_config['dimension_offset_increment']

        # Use same levels as calculated for floor extent dimensions
        max_north_level = max(north_levels.values()) if north_levels else 0
        max_south_level = max(south_levels.values()) if south_levels else 0
        max_west_level = max(west_levels.values()) if west_levels else 0
        max_east_level = max(east_levels.values()) if east_levels else 0

        floor_extent_offset_increment = offset_increment * 1.5

        # Position slab dimensions one level inside floor extent dimensions
        # This places them between the perimeter dimensions and the floor extent dimensions
        slab_offset_north = base_offset + (max_north_level + 1) * offset_increment + floor_extent_offset_increment * 0.5
        slab_offset_south = base_offset + (max_south_level + 1) * offset_increment + floor_extent_offset_increment * 0.5
        slab_offset_west = base_offset + (max_west_level + 1) * offset_increment + floor_extent_offset_increment * 0.5
        slab_offset_east = base_offset + (max_east_level + 1) * offset_increment + floor_extent_offset_increment * 0.5

        for obj in floor_config['objects']:
            if obj.get('type') == 'floor_slab':
                slab_x = obj['x']
                slab_y = obj['y']
                slab_width = obj['width']
                slab_length = obj['length']

                # Check if slab dimensions differ from overall floor dimensions
                # Allow small tolerance for floating point comparison
                tolerance = 1.0
                width_differs = abs(slab_width - overall_width) > tolerance or abs(slab_x - min_x) > tolerance
                length_differs = abs(slab_length - overall_length) > tolerance or abs(slab_y - min_y) > tolerance

                if width_differs or length_differs:
                    # Add dimensions for this floor slab
                    # Use a distinct style for floor slab dimensions
                    svg += '<g class="floor-slab-dimension">\n'

                    # Add horizontal dimensions (top and bottom)
                    if width_differs:
                        # Top dimension - positioned outside all other dimensions
                        svg += svg_draw_dimension_line(
                            slab_x, slab_y,
                            slab_x + slab_width, slab_y,
                            -slab_offset_north, True, False, False
                        )
                        # Bottom dimension
                        svg += svg_draw_dimension_line(
                            slab_x, slab_y + slab_length,
                            slab_x + slab_width, slab_y + slab_length,
                            slab_offset_south, True, False, False
                        )

                    # Add vertical dimensions (left and right)
                    if length_differs:
                        # Left dimension
                        svg += svg_draw_dimension_line(
                            slab_x, slab_y,
                            slab_x, slab_y + slab_length,
                            -slab_offset_west, False, False, False
                        )
                        # Right dimension
                        svg += svg_draw_dimension_line(
                            slab_x + slab_width, slab_y,
                            slab_x + slab_width, slab_y + slab_length,
                            slab_offset_east, False, False, False
                        )

                    svg += '</g>\n'

    # Draw all pillars last so they appear on top
    for pillar in pillars_to_draw:
        svg += svg_draw_pillar(pillar['x'], pillar['y'], pillar['size'], pillar['width'], pillar['length'])

    # Add title
    svg += f'''</g>
<text x="{width/2}" y="30" text-anchor="middle" font-size="16" font-weight="bold">{floor_name}</text>
</svg>'''

    # Save to file if path provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(svg)
        print(f"✓ Floor plan saved to: {output_path}")

    return svg


def generate_elevation_view(house_config: dict, view_type: str, output_path: str = None, scale: float = 2.0) -> str:
    """
    Generate an SVG elevation view (front, back, left, right) from house configuration.

    Args:
        house_config: Complete house configuration
        view_type: 'front', 'back', 'left', or 'right'
        output_path: Path to save SVG file (if None, returns SVG string only)
        scale: SVG scaling factor

    Returns:
        SVG string
    """
    # Get site and plinth info
    site = house_config.get('site', {})
    plinth_config = house_config.get('plinth', {})
    floors = house_config.get('floors', [])

    # Derive hip_roof geometry (idempotent) so downstream code that reads
    # eave_x_*, eave_y_*, eave_z, slope_angle_* on the roof dict works.
    try:
        from roof_geometry import derive_for_house
        _derived_roof = derive_for_house(house_config, GLOBAL_CONFIG)
        if _derived_roof is not None:
            for _floor in house_config.get('floors', []):
                for _obj in _floor.get('objects', []):
                    if _obj.get('type') == 'hip_roof':
                        for _k, _v in _derived_roof.items():
                            _obj.setdefault(_k, _v)
    except Exception:
        pass  # legacy hip_roof configs continue to work

    # Get building dimensions for checking exterior walls
    building_width = plinth_config.get('width', 0)   # X dimension
    building_length = plinth_config.get('length', 0)  # Y dimension
    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)

    # Determine building bounds
    if view_type in ['front', 'back']:
        # Front/back views: looking along Y, showing X-Z
        width = building_width  # X dimension
        view_name = "Front Elevation" if view_type == 'front' else "Back Elevation"
    else:
        # Left/right views: looking along X, showing Y-Z
        width = building_length  # Y dimension
        view_name = "Left Elevation" if view_type == 'left' else "Right Elevation"

    # Calculate total height
    plinth_height = plinth_config.get('height', GLOBAL_CONFIG['plinth_height'])
    total_height = plinth_height

    # Add floor heights
    for floor_config in floors:
        floor_num = floor_config['floor_number']
        floor_height = GLOBAL_CONFIG['floor_heights'].get(floor_num, 100)
        total_height += floor_height

    # Check for roof
    for floor_config in floors:
        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                if obj.get('type') == 'gable_roof':
                    ridge_z = obj.get('ridge_z', 0)
                    total_height = max(total_height, ridge_z)
                elif obj.get('type') == 'hip_roof':
                    import math
                    span_x = obj['eave_x_east'] - obj['eave_x_west']
                    span_y = obj['eave_y_south'] - obj['eave_y_north']
                    uniform = obj.get('slope_angle')
                    ang_ew = obj.get('slope_angle_ew', uniform)
                    ang_ns = obj.get('slope_angle_ns', uniform)
                    if obj.get('ridge_axis', 'y') == 'y':
                        h = (span_x / 2.0) * math.tan(math.radians(ang_ew))
                    else:
                        h = (span_y / 2.0) * math.tan(math.radians(ang_ns))
                    total_height = max(total_height, obj['eave_z'] + h)

    # SVG dimensions - increased margins for dimensions
    dim_config = GLOBAL_CONFIG.get('dimensions', {})
    if dim_config.get('show_outer_dimensions', True):
        # Account for dimension lines and text
        horizontal_margin = 150  # Space for left/right vertical dimensions (increased from 100)
        vertical_margin = 150    # Space for top/bottom horizontal dimensions (increased from 100)
        title_space = 60         # Extra space at top for title
    else:
        horizontal_margin = 50
        vertical_margin = 50
        title_space = 40

    svg_width = width * scale + 2 * horizontal_margin
    svg_height = total_height * scale + 2 * vertical_margin + title_space

    # Helper function to convert world Z to SVG Y (inverted)
    def z_to_y(z):
        """Convert world Z coordinate to SVG Y coordinate (flip vertical axis)"""
        return total_height - z

    # Helper function to convert world X/Y to SVG X based on view type
    def world_to_svg_x(coord, obj_width=0):
        """
        Convert world coordinate to SVG X coordinate (mirror for front and right views).

        Args:
            coord: World X or Y coordinate (left edge of object)
            obj_width: Width of object (needed for proper mirroring)

        Returns:
            SVG X coordinate
        """
        if view_type == 'front':
            # Front view: mirror X so west (0) is on left, east (width) is on right
            # For a rectangle at x with width w, the mirrored position is: width - (x + w)
            return width - (coord + obj_width)
        elif view_type == 'right':
            # Right view: mirror Y so south (0) is on left, north (width) is on right
            # For a rectangle at y with width w, the mirrored position is: width - (y + w)
            return width - (coord + obj_width)
        else:
            # Back, left views: keep as is
            return coord

    # Start SVG
    # Add title_space to vertical translation to push content down
    content_top_margin = vertical_margin + title_space
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}">
<title>{view_name}</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
    </style>
</defs>
<g transform="translate({horizontal_margin}, {content_top_margin}) scale({scale}, {scale})">

'''

    # Draw ground line (at ground level, Z=0)
    ground_y = z_to_y(0)
    svg += f'<line x1="0" y1="{ground_y}" x2="{width}" y2="{ground_y}" stroke="#666" stroke-width="2" stroke-dasharray="5,5"/>\n'

    # Draw plinth (from ground to plinth top)
    plinth_bottom_y = z_to_y(0)
    plinth_top_y = z_to_y(plinth_height)
    svg += f'<rect x="0" y="{plinth_top_y}" width="{width}" height="{plinth_bottom_y - plinth_top_y}" fill="#A0826D" stroke="#000" stroke-width="1"/>\n'

    # Current Z level
    current_z = plinth_height

    # Track floor levels for dimensioning
    floor_levels = [
        {'name': 'Ground Level', 'z': 0, 'height': plinth_height},
        {'name': 'Plinth Top', 'z': plinth_height, 'height': 0}
    ]

    # Track openings for dimensioning
    elevation_openings = []

    # Track walls with non-standard heights for dimensioning
    walls_with_custom_heights = []

    # Collect roof SVG to draw last (so it's not hidden by walls)
    roof_svg = ""

    # Draw each floor
    slab_thickness = GLOBAL_CONFIG.get('floor_slab_thickness', 4)
    wall_thickness = GLOBAL_CONFIG.get('wall_thickness', 8)
    beam_size = GLOBAL_CONFIG.get('beam_size', 8)

    # Get type priority from config for conflict resolution when objects have same depth
    # Lower number = drawn first (appears underneath), Higher number = drawn last (appears on top)
    type_priority = GLOBAL_CONFIG.get('elevation_rendering_priority', {
        'beam': 0,
        'floor_slab': 1,
        'staircase': 1,
        'room': 2,
        'wall': 2,
        'pillar': 3
    })

    # COLLECT ALL OBJECTS FROM ALL FLOORS FIRST
    # This prevents pillars from being overdrawn by objects from higher floors
    all_objects_to_draw = []

    for floor_config in floors:
        floor_num = floor_config['floor_number']
        floor_height = GLOBAL_CONFIG['floor_heights'].get(floor_num, 100)

        # Collect all objects with their depth coordinate for sorting
        floor_objects_with_depth = []

        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                obj_type = obj.get('type')
                depth = 0  # Depth coordinate for sorting
                priority = type_priority.get(obj_type, 2)  # Default to wall/room priority

                # Calculate depth based on view type
                # Only walls, rooms, slabs, beams, staircases, and pillars are depth-sorted (NOT doors/windows)
                if view_type == 'front':
                    # Front view: sort by Y (smaller Y = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam', 'staircase']:
                        depth = obj.get('y', 0)
                    elif obj_type == 'room':
                        depth = obj.get('y', 0)
                    elif obj_type == 'wall':
                        depth = min(obj.get('start_y', 0), obj.get('end_y', 0))
                    elif obj_type == 'pillar':
                        depth = obj.get('y', 0)
                elif view_type == 'back':
                    # Back view: sort by Y (larger Y = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam', 'staircase']:
                        depth = -obj.get('y', 0)  # Negative to reverse sort
                    elif obj_type == 'room':
                        depth = -obj.get('y', 0)
                    elif obj_type == 'wall':
                        depth = -max(obj.get('start_y', 0), obj.get('end_y', 0))
                    elif obj_type == 'pillar':
                        depth = -obj.get('y', 0)
                elif view_type == 'left':
                    # Left view: sort by X (smaller X = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam', 'staircase']:
                        depth = obj.get('x', 0)
                    elif obj_type == 'room':
                        depth = obj.get('x', 0)
                    elif obj_type == 'wall':
                        depth = min(obj.get('start_x', 0), obj.get('end_x', 0))
                    elif obj_type == 'pillar':
                        depth = obj.get('x', 0)
                elif view_type == 'right':
                    # Right view: sort by X (larger X = farther away = draw first)
                    if obj_type in ['floor_slab', 'beam', 'staircase']:
                        depth = -obj.get('x', 0)
                    elif obj_type == 'room':
                        depth = -obj.get('x', 0)
                    elif obj_type == 'wall':
                        depth = -max(obj.get('start_x', 0), obj.get('end_x', 0))
                    elif obj_type == 'pillar':
                        depth = -obj.get('x', 0)

                # Skip doors and windows - they're not depth sorted
                if obj_type in ['door', 'window']:
                    continue

                floor_objects_with_depth.append((depth, priority, obj))

        # Sort objects by depth (back to front), then by type priority for conflict resolution
        floor_objects_with_depth.sort(key=lambda x: (x[0], x[1]))

        # Pre-group doors/windows with their parent walls for efficient rendering
        # Key format: '{room_name}_{direction}' for room walls, or '{wall_name}' for standalone walls
        wall_openings = {}
        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                if obj.get('type') in ['door', 'window']:
                    # Get the parent wall identifier from the door/window config
                    if 'room' in obj:
                        # Door/window belongs to a specific room's wall
                        room_name = obj['room']
                        direction = obj.get('direction', '').lower()
                        wall_key = f"{room_name}_{direction}"
                    elif 'wall_name' in obj or 'wall' in obj:
                        # Door/window belongs to a standalone wall
                        wall_key = obj.get('wall_name') or obj.get('wall')
                    else:
                        # Skip if no parent wall specified
                        continue

                    if wall_key not in wall_openings:
                        wall_openings[wall_key] = []
                    wall_openings[wall_key].append(obj)

        # UNIFIED RENDERING: Collect ALL objects (slabs, beams, walls, pillars) with depth
        objects_to_draw = []

        # Store the Z positions for slabs and walls
        slab_z = current_z
        wall_z = current_z + slab_thickness
        wall_top = wall_z + floor_height

        # Track floor levels for dimensioning
        # Store the height from TOP of slab to TOP of walls (excluding slab thickness)
        floor_name = floor_config.get('name', f'Floor {floor_num}')
        floor_levels.append({
            'name': floor_name,
            'z_bottom': wall_z,  # Top of slab (where walls start)
            'z_top': wall_top,   # Top of walls
            'height': floor_height  # Wall height only
        })

        for depth, priority, obj in floor_objects_with_depth:
            obj_type = obj.get('type')

            if obj_type == 'floor_slab':
                # Add floor slab to unified rendering
                slab_x = obj['x']
                slab_y = obj['y']
                slab_width = obj['width']
                slab_length = obj['length']
                slab_thick = obj.get('thickness', slab_thickness)

                # Calculate position and depth based on view
                if view_type == 'left':
                    # Left view: Y position, -X depth
                    obj_x = slab_y
                    obj_width = slab_length
                    obj_depth = -slab_x
                elif view_type == 'right':
                    # Right view: Y position, +X depth
                    obj_x = slab_y
                    obj_width = slab_length
                    obj_depth = slab_x + slab_width
                elif view_type == 'front':
                    # Front view: X position, -Y depth
                    obj_x = slab_x
                    obj_width = slab_width
                    obj_depth = -slab_y
                elif view_type == 'back':
                    # Back view: X position, +Y depth
                    obj_x = slab_x
                    obj_width = slab_width
                    obj_depth = slab_y + slab_length
                else:
                    continue

                objects_to_draw.append({
                    'type': 'floor_slab',
                    'name': f"Slab_{obj.get('name', '')}",
                    'depth': obj_depth,
                    'priority': type_priority.get('floor_slab', 1),
                    'x': obj_x,
                    'width': obj_width,
                    'height': slab_thick,
                    'z': slab_z,
                    'fill': '#808080'
                })

            elif obj_type == 'beam':
                # Add beam to unified rendering
                beam_x = obj['x']
                beam_y = obj['y']
                beam_width = obj.get('width', beam_size)
                beam_length = obj.get('length', beam_size)
                beam_height = obj.get('height', beam_size)
                beam_orient = obj.get('orientation', 'horizontal')

                # Calculate position and depth based on view and orientation
                if view_type == 'left':
                    if beam_orient in ['horizontal', 'ns']:
                        obj_x = beam_y
                        obj_width = beam_length
                        obj_depth = -beam_x
                    else:  # ew orientation - not visible or just a point
                        continue
                elif view_type == 'right':
                    if beam_orient in ['horizontal', 'ns']:
                        obj_x = beam_y
                        obj_width = beam_length
                        obj_depth = beam_x + beam_width
                    else:
                        continue
                elif view_type == 'front':
                    if beam_orient in ['horizontal', 'ew']:
                        obj_x = beam_x
                        obj_width = beam_width
                        obj_depth = -beam_y
                    else:
                        continue
                elif view_type == 'back':
                    if beam_orient in ['horizontal', 'ew']:
                        obj_x = beam_x
                        obj_width = beam_width
                        obj_depth = beam_y + beam_length
                    else:
                        continue
                else:
                    continue

                # Place beam at floor slab level (beams support the slab from below)
                beam_z = slab_z

                objects_to_draw.append({
                    'type': 'beam',
                    'name': f"Beam_{obj.get('name', '')}",
                    'depth': obj_depth,
                    'priority': type_priority.get('beam', 0),
                    'x': obj_x,
                    'width': obj_width,
                    'height': beam_height,
                    'z': beam_z,
                    'fill': '#654321'
                })

            elif obj_type == 'staircase':
                # Add staircase to unified rendering
                # Handle both old format (x, y, width, length) and new format (start_x, start_y, step_width, step_tread, direction)
                if 'start_x' in obj:
                    # New format with compass direction
                    start_x = obj['start_x']
                    start_y = obj['start_y']
                    step_width = obj.get('step_width', 30)
                    step_tread = obj.get('step_tread', 10)
                    num_steps = obj.get('num_steps', 10)
                    compass_dir = obj.get('direction', 'north')

                    # Convert compass direction to x, y, width, length
                    # North = upward (decreasing Y), South = downward (increasing Y)
                    if compass_dir == 'north':
                        stair_x, stair_y = start_x, start_y - num_steps * step_tread
                        stair_width, stair_length = step_width, num_steps * step_tread
                    elif compass_dir == 'south':
                        stair_x, stair_y = start_x, start_y
                        stair_width, stair_length = step_width, num_steps * step_tread
                    elif compass_dir == 'east':
                        stair_x, stair_y = start_x, start_y
                        stair_width, stair_length = num_steps * step_tread, step_width
                    elif compass_dir == 'west':
                        stair_x, stair_y = start_x - num_steps * step_tread, start_y
                        stair_width, stair_length = num_steps * step_tread, step_width
                else:
                    # Old format
                    stair_x = obj['x']
                    stair_y = obj['y']
                    stair_width = obj['width']
                    stair_length = obj['length']
                    num_steps = obj.get('num_steps')

                    # Auto-calculate steps if not provided
                    if num_steps is None:
                        num_steps = max(3, int(stair_length / 10))

                # Calculate total rise (vertical height)
                # Use step_rise from config if available, otherwise assume 7 inches (standard)
                step_rise = obj.get('step_rise', 7)
                total_rise = num_steps * step_rise

                # Calculate position and depth based on view
                if view_type == 'left':
                    # Left view: Y position, -X depth
                    obj_x = stair_y
                    obj_width = stair_length
                    obj_depth = -stair_x
                elif view_type == 'right':
                    # Right view: Y position, +X depth
                    obj_x = stair_y
                    obj_width = stair_length
                    obj_depth = stair_x + stair_width
                elif view_type == 'front':
                    # Front view: X position, -Y depth
                    obj_x = stair_x
                    obj_width = stair_width
                    obj_depth = -stair_y
                elif view_type == 'back':
                    # Back view: X position, +Y depth
                    obj_x = stair_x
                    obj_width = stair_width
                    obj_depth = stair_y + stair_length
                else:
                    continue

                objects_to_draw.append({
                    'type': 'staircase',
                    'name': f"Stair_{obj.get('name', '')}",
                    'depth': obj_depth,
                    'priority': type_priority.get('staircase', 1),
                    'x': obj_x,
                    'width': obj_width,
                    'height': total_rise,
                    'z': wall_z,
                    'num_steps': num_steps,
                    'fill': '#C19A6B'
                })

            elif obj_type == 'room':
                room_name = obj.get('name', '')
                walls_list = obj.get('walls', ['north', 'south', 'east', 'west'])
                walls_list = [w.lower() for w in walls_list]
                wall_heights = obj.get('wall_heights', {})
                room_x = obj['x']
                room_y = obj['y']
                room_width = obj['width']
                room_length = obj['length']

                # Extract each wall of the room as a separate entity
                for direction in walls_list:
                    wall_key = f"{room_name}_{direction}"
                    wall_height = wall_heights.get(direction, obj.get('height', floor_height))

                    # Calculate wall depth and position based on view type
                    # Show ALL walls in each view and let depth sorting handle visibility
                    if view_type in ['left', 'right']:
                        # Left/right views: show both west AND east walls
                        if direction == 'west':
                            depth = -room_x if view_type == 'left' else -(room_x + wall_thickness)
                            objects_to_draw.append({
                                'type': 'wall',
                                'name': wall_key,
                                'depth': depth,
                                'priority': type_priority.get('wall', 2),
                                'x': room_y,
                                'width': room_length,
                                'height': wall_height,
                                'z': wall_z,
                                'openings': wall_openings.get(wall_key, []),
                                'coord_key': 'y',
                                'floor_height_expected': floor_height
                            })
                        elif direction == 'east':
                            depth = (room_x + room_width) if view_type == 'right' else -(room_x + room_width - wall_thickness)
                            objects_to_draw.append({
                                'type': 'wall',
                                'name': wall_key,
                                'depth': depth,
                                'priority': type_priority.get('wall', 2),
                                'x': room_y,
                                'width': room_length,
                                'height': wall_height,
                                'z': wall_z,
                                'openings': wall_openings.get(wall_key, []),
                                'coord_key': 'y',
                                'floor_height_expected': floor_height
                            })
                    elif view_type in ['front', 'back']:
                        # Front/back views: show both north AND south walls
                        if direction == 'north':
                            depth = -room_y if view_type == 'front' else room_y
                            objects_to_draw.append({
                                'type': 'wall',
                                'name': wall_key,
                                'depth': depth,
                                'priority': type_priority.get('wall', 2),
                                'x': room_x,
                                'width': room_width,
                                'height': wall_height,
                                'z': wall_z,
                                'openings': wall_openings.get(wall_key, []),
                                'coord_key': 'x',
                                'floor_height_expected': floor_height
                            })
                        elif direction == 'south':
                            depth = (room_y + room_length) if view_type == 'back' else -(room_y + room_length)
                            objects_to_draw.append({
                                'type': 'wall',
                                'name': wall_key,
                                'depth': depth,
                                'priority': type_priority.get('wall', 2),
                                'x': room_x,
                                'width': room_width,
                                'height': wall_height,
                                'z': wall_z,
                                'openings': wall_openings.get(wall_key, []),
                                'coord_key': 'x',
                                'floor_height_expected': floor_height
                            })

            elif obj_type == 'wall':
                wall_name = obj.get('name', '')
                start_x = obj['start_x']
                start_y = obj['start_y']
                end_x = obj['end_x']
                end_y = obj['end_y']
                wall_height_val = obj.get('height', floor_height)
                wall_height_end = obj.get('height_end', wall_height_val)

                is_horizontal = abs(end_y - start_y) < 1
                is_vertical = abs(end_x - start_x) < 1

                # Only add if visible in this view
                if view_type in ['front', 'back'] and is_horizontal:
                    wall_length = abs(end_x - start_x)
                    wall_pos = min(start_x, end_x)
                    # Front: smaller Y (north) = closer = negative depth
                    # Back: larger Y (south) = closer = positive depth
                    depth = -start_y if view_type == 'front' else start_y

                    objects_to_draw.append({
                        'type': 'wall',
                        'name': wall_name,
                        'depth': depth,
                        'priority': type_priority.get('wall', 2),
                        'x': wall_pos,
                        'width': wall_length,
                        'height': wall_height_val,
                        'height_end': wall_height_end,
                        'z': wall_z,
                        'openings': wall_openings.get(wall_name, []),
                        'coord_key': 'x',  # Use 'x' coordinate for front/back view
                        'floor_height_expected': floor_height
                    })
                elif view_type in ['left', 'right'] and is_vertical:
                    wall_length = abs(end_y - start_y)
                    wall_pos = min(start_y, end_y)
                    # Left view: -X (larger X = further back), Right view: +X (larger X = closer)
                    depth = -start_x if view_type == 'left' else start_x

                    objects_to_draw.append({
                        'type': 'wall',
                        'name': wall_name,
                        'depth': depth,
                        'priority': type_priority.get('wall', 2),
                        'x': wall_pos,
                        'width': wall_length,
                        'height': wall_height_val,
                        'height_end': wall_height_end,
                        'z': wall_z,
                        'openings': wall_openings.get(wall_name, []),
                        'coord_key': 'y',  # Use 'y' coordinate for left/right view
                        'floor_height_expected': floor_height
                    })

            elif obj_type == 'pillar':
                # Get pillar dimensions with backward compatibility
                default_size = wall_thickness
                pillar_width = obj.get('width', obj.get('size', default_size))   # X dimension
                pillar_length = obj.get('length', obj.get('size', default_size))  # Y dimension
                pillar_height = obj.get('height', floor_height)
                pillar_world_x = obj['x']
                pillar_world_y = obj['y']

                # Calculate depth and position based on view
                # Pillar coords are CENTER, so we need to use nearest edge for depth
                # For elevations, we see different cross-sections:
                # - Front/Back: see pillar width (X dimension)
                # - Left/Right: see pillar length (Y dimension)
                if view_type == 'left':
                    # Left view: looking from west (negative X), see pillar length (Y dimension)
                    pillar_visible_width = pillar_length
                    pillar_x = pillar_world_y - pillar_length / 2
                    depth = -(pillar_world_x - pillar_width / 2)
                elif view_type == 'right':
                    # Right view: looking from east (positive X), see pillar length (Y dimension)
                    pillar_visible_width = pillar_length
                    pillar_x = pillar_world_y - pillar_length / 2
                    depth = pillar_world_x + pillar_width / 2
                elif view_type == 'front':
                    # Front view: looking from north (negative Y), see pillar width (X dimension)
                    pillar_visible_width = pillar_width
                    pillar_x = pillar_world_x - pillar_width / 2
                    depth = -(pillar_world_y - pillar_length / 2)
                elif view_type == 'back':
                    # Back view: looking from south (positive Y), see pillar width (X dimension)
                    pillar_visible_width = pillar_width
                    pillar_x = pillar_world_x - pillar_width / 2
                    depth = pillar_world_y + pillar_length / 2
                else:
                    continue

                # Add pillar to objects array for depth sorting
                objects_to_draw.append({
                    'type': 'pillar',
                    'name': f"Pillar_{obj.get('name', '')}",
                    'depth': depth,
                    'priority': type_priority.get('pillar', 3),
                    'x': pillar_x,
                    'width': pillar_visible_width,
                    'height': pillar_height,
                    'z': wall_z,
                    'openings': [],
                    'coord_key': None  # Pillars don't have openings
                })

        # Step 2: Sort objects by depth (back to front), then by priority
        # Priority ensures correct layering when objects have same depth
        objects_to_draw.sort(key=lambda w: (w['depth'], w.get('priority', 2)))

        # DEBUG: Save objects_to_draw to JSON for examination
        import json
        debug_data = {
            'view_type': view_type,
            'floor_number': floor_num,
            'current_z': current_z,
            'objects': []
        }
        for obj in objects_to_draw:
            # Create a JSON-serializable copy
            obj_copy = {
                'type': obj.get('type', 'unknown'),
                'name': obj.get('name', 'unnamed'),
                'depth': obj['depth'],
                'priority': obj.get('priority', 2),
                'x': obj['x'],
                'width': obj['width'],
                'height': obj['height'],
                'z': obj['z'],
                'height_end': obj.get('height_end'),
                'coord_key': obj.get('coord_key'),
                'num_openings': len(obj.get('openings', [])),
                'openings': []
            }
            # Add opening details for walls
            for opening in obj.get('openings', []):
                obj_copy['openings'].append({
                    'type': opening.get('type'),
                    'wall': obj.get('name', 'unnamed'),  # The wall this opening is associated with
                    'x': opening.get('x'),
                    'y': opening.get('y'),
                    'width': opening['width'],
                    'height': opening['height'],
                    'room': opening.get('room'),
                    'direction': opening.get('direction'),
                    'sill_height': opening.get('sill_height')
                })
            debug_data['objects'].append(obj_copy)

        # Save to docs folder
        try:
            import os
            debug_file = os.path.join(os.path.dirname(output_path) if output_path else '.', f'objects_debug_{view_type}_floor{floor_num}.json')
            with open(debug_file, 'w') as f:
                json.dump(debug_data, f, indent=2)
            print(f"  DEBUG: Saved objects data to {debug_file}")
        except Exception as e:
            print(f"  DEBUG: Could not save debug file: {e}")

        # Step 3: Add objects from this floor to the global collection
        all_objects_to_draw.extend(objects_to_draw)

        # Collect roof data (to draw last, so it's not hidden by walls)
        if 'objects' in floor_config:
            for obj in floor_config['objects']:
                if obj.get('type') == 'gable_roof':
                    import math

                    ridge_axis = obj.get('ridge_axis', 'x')
                    ridge_z_relative = obj.get('ridge_z', 0)
                    ridge_start_x = obj.get('ridge_start_x', 0)
                    ridge_start_y = obj.get('ridge_start_y', 0)
                    ridge_length = obj.get('ridge_length', 0)
                    left_slope_angle = obj.get('left_slope_angle', 22)
                    left_slope_length = obj.get('left_slope_length', 0)
                    right_slope_angle = obj.get('right_slope_angle', 26)
                    right_slope_length = obj.get('right_slope_length', 0)
                    roof_thickness_val = GLOBAL_CONFIG.get('roof_thickness', 8)

                    ridge_z = current_z + ridge_z_relative

                    left_horizontal = left_slope_length * math.cos(math.radians(left_slope_angle))
                    left_drop = left_slope_length * math.sin(math.radians(left_slope_angle))
                    right_horizontal = right_slope_length * math.cos(math.radians(right_slope_angle))
                    right_drop = right_slope_length * math.sin(math.radians(right_slope_angle))

                    left_eave_z = ridge_z - left_drop
                    right_eave_z = ridge_z - right_drop

                    # Pick which views see the triangle (gable end) vs the rectangle (long slope face).
                    if ridge_axis == 'y':
                        triangle_views = ('front', 'back')
                        # Triangle horizontal axis = X; rectangle ridge axis = Y.
                        tri_ridge_world = ridge_start_x
                        tri_left_world = ridge_start_x - left_horizontal
                        tri_right_world = ridge_start_x + right_horizontal
                        ridge_axis_world_start = ridge_start_y
                        ridge_axis_world_end = ridge_start_y + ridge_length
                    else:
                        triangle_views = ('left', 'right')
                        tri_ridge_world = ridge_start_y
                        tri_left_world = ridge_start_y - left_horizontal
                        tri_right_world = ridge_start_y + right_horizontal
                        ridge_axis_world_start = ridge_start_x
                        ridge_axis_world_end = ridge_start_x + ridge_length

                    if view_type in triangle_views:
                        # Gable end: triangle from left eave up to ridge down to right eave.
                        ridge_svg_y = z_to_y(ridge_z + roof_thickness_val)
                        left_eave_svg_y = z_to_y(left_eave_z)
                        right_eave_svg_y = z_to_y(right_eave_z)

                        ridge_svg_x = world_to_svg_x(tri_ridge_world, 0)
                        left_eave_svg_x = world_to_svg_x(tri_left_world, 0)
                        right_eave_svg_x = world_to_svg_x(tri_right_world, 0)

                        roof_svg += f'<line x1="{left_eave_svg_x}" y1="{left_eave_svg_y}" x2="{ridge_svg_x}" y2="{ridge_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'
                        roof_svg += f'<line x1="{ridge_svg_x}" y1="{ridge_svg_y}" x2="{right_eave_svg_x}" y2="{right_eave_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'
                    else:
                        # Side view (looking parallel to ridge): see one full slope as a rectangle.
                        # Pick which slope faces the viewer.
                        if ridge_axis == 'y':
                            # ridge along Y; left view (looking east from west) sees the west slope = left slope.
                            slope_drop = left_drop if view_type == 'left' else right_drop
                        else:
                            # ridge along X; front view (looking south from north) sees the south slope = right slope.
                            slope_drop = right_drop if view_type == 'front' else left_drop

                        ridge_top_y = z_to_y(ridge_z + roof_thickness_val)
                        ridge_bottom_y = z_to_y(ridge_z)
                        roof_bottom_y = z_to_y(ridge_z - slope_drop)

                        ridge_start_svg_x = world_to_svg_x(ridge_axis_world_start, 0)
                        ridge_end_svg_x = world_to_svg_x(ridge_axis_world_end, 0)
                        roof_width = abs(ridge_end_svg_x - ridge_start_svg_x)
                        roof_height = roof_bottom_y - ridge_bottom_y

                        roof_svg += f'<rect x="{min(ridge_start_svg_x, ridge_end_svg_x)}" y="{ridge_bottom_y}" width="{roof_width}" height="{roof_height}" fill="none" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'
                        roof_svg += f'<line x1="{ridge_start_svg_x}" y1="{ridge_top_y}" x2="{ridge_end_svg_x}" y2="{ridge_top_y}" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'

                if obj.get('type') == 'hip_roof':
                    import math
                    ridge_axis_h = obj.get('ridge_axis', 'y')
                    eave_xw = obj['eave_x_west']
                    eave_xe = obj['eave_x_east']
                    eave_yn = obj['eave_y_north']
                    eave_ys = obj['eave_y_south']
                    slope_uniform = obj.get('slope_angle')
                    slope_ns = obj.get('slope_angle_ns', slope_uniform)
                    slope_ew = obj.get('slope_angle_ew', slope_uniform)
                    roof_thickness_val = GLOBAL_CONFIG.get('roof_thickness', 8)

                    # eave_z is now ABSOLUTE (from ground = 0), computed by
                    # roof_geometry.derive_for_house. Use it directly.
                    eave_z_abs = obj['eave_z']
                    span_x_h = eave_xe - eave_xw
                    span_y_h = eave_ys - eave_yn
                    tan_ns_h = math.tan(math.radians(slope_ns))
                    tan_ew_h = math.tan(math.radians(slope_ew))

                    ridge_length_override = obj.get('ridge_length')
                    ridge_ys_override = obj.get('ridge_y_start')
                    ridge_ye_override = obj.get('ridge_y_end')
                    ridge_xs_override = obj.get('ridge_x_start')
                    ridge_xe_override = obj.get('ridge_x_end')
                    if ridge_axis_h == 'y':
                        # EW = main (sets h); NS = hip end (may be asymmetric).
                        h_h = (span_x_h / 2.0) * tan_ew_h
                        if ridge_ys_override is not None and ridge_ye_override is not None:
                            ridge_y_s = ridge_ys_override
                            ridge_y_e = ridge_ye_override
                        else:
                            if ridge_length_override is not None:
                                d_hip_h = (span_y_h - ridge_length_override) / 2.0
                            else:
                                d_hip_h = h_h / tan_ns_h
                            ridge_y_s = eave_yn + d_hip_h
                            ridge_y_e = eave_ys - d_hip_h
                        ridge_x_pos = (eave_xw + eave_xe) / 2.0
                        if ridge_y_e < ridge_y_s:
                            mid_y = (eave_yn + eave_ys) / 2.0
                            ridge_y_s = ridge_y_e = mid_y
                    else:
                        # NS = main; EW = hip end
                        h_h = (span_y_h / 2.0) * tan_ns_h
                        if ridge_xs_override is not None and ridge_xe_override is not None:
                            ridge_x_s = ridge_xs_override
                            ridge_x_e = ridge_xe_override
                        else:
                            if ridge_length_override is not None:
                                d_hip_h = (span_x_h - ridge_length_override) / 2.0
                            else:
                                d_hip_h = h_h / tan_ew_h
                            ridge_x_s = eave_xw + d_hip_h
                            ridge_x_e = eave_xe - d_hip_h
                        ridge_y_pos = (eave_yn + eave_ys) / 2.0
                        if ridge_x_e < ridge_x_s:
                            mid_x = (eave_xw + eave_xe) / 2.0
                            ridge_x_s = ridge_x_e = mid_x

                    ridge_z_abs = eave_z_abs + h_h
                    ridge_top_z = ridge_z_abs + roof_thickness_val
                    eave_top_z = eave_z_abs + roof_thickness_val

                    # Decide whether THIS view shows the triangular hip-end or
                    # the trapezoidal main slope.
                    if ridge_axis_h == 'y':
                        triangle_views = ('front', 'back')
                        # Triangle: horizontal world axis = X. Trapezoid: world axis = Y.
                        tri_eave_low = eave_xw
                        tri_eave_high = eave_xe
                        tri_apex = ridge_x_pos
                        trap_eave_low = eave_yn
                        trap_eave_high = eave_ys
                        trap_ridge_low = ridge_y_s
                        trap_ridge_high = ridge_y_e
                    else:
                        triangle_views = ('left', 'right')
                        tri_eave_low = eave_yn
                        tri_eave_high = eave_ys
                        tri_apex = ridge_y_pos
                        trap_eave_low = eave_xw
                        trap_eave_high = eave_xe
                        trap_ridge_low = ridge_x_s
                        trap_ridge_high = ridge_x_e

                    if view_type in triangle_views:
                        # Triangle: bottom edge (eave) + two slopes meeting at apex
                        eave_low_svg_x = world_to_svg_x(tri_eave_low, 0)
                        eave_high_svg_x = world_to_svg_x(tri_eave_high, 0)
                        apex_svg_x = world_to_svg_x(tri_apex, 0)
                        eave_svg_y = z_to_y(eave_z_abs)
                        apex_svg_y = z_to_y(ridge_top_z)
                        # Two slope edges
                        roof_svg += f'<line x1="{eave_low_svg_x}" y1="{eave_svg_y}" x2="{apex_svg_x}" y2="{apex_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'
                        roof_svg += f'<line x1="{apex_svg_x}" y1="{apex_svg_y}" x2="{eave_high_svg_x}" y2="{eave_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'
                    else:
                        # Trapezoid: eave edge at bottom, ridge edge at top, two slanted sides
                        eave_low_svg_x = world_to_svg_x(trap_eave_low, 0)
                        eave_high_svg_x = world_to_svg_x(trap_eave_high, 0)
                        ridge_low_svg_x = world_to_svg_x(trap_ridge_low, 0)
                        ridge_high_svg_x = world_to_svg_x(trap_ridge_high, 0)
                        eave_svg_y = z_to_y(eave_z_abs)
                        ridge_svg_y = z_to_y(ridge_top_z)
                        # Two slanted sides (eave corner to ridge corner)
                        roof_svg += f'<line x1="{eave_low_svg_x}" y1="{eave_svg_y}" x2="{ridge_low_svg_x}" y2="{ridge_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'
                        roof_svg += f'<line x1="{ridge_high_svg_x}" y1="{ridge_svg_y}" x2="{eave_high_svg_x}" y2="{eave_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'
                        # Ridge line at top
                        roof_svg += f'<line x1="{ridge_low_svg_x}" y1="{ridge_svg_y}" x2="{ridge_high_svg_x}" y2="{ridge_svg_y}" stroke="#8B4513" stroke-width="{roof_thickness_val}"/>\n'

        current_z = wall_top

    # AFTER ALL FLOORS: Sort all objects globally and draw them
    # Sort by depth (back to front), then by priority (for same depth)
    all_objects_to_draw.sort(key=lambda w: (w['depth'], w.get('priority', 2)))

    # Find the MAXIMUM depth among walls (front-most walls only)
    # Objects are sorted by depth: smaller=back, larger=front
    # So maximum depth = closest to viewer = walls we want to dimension
    wall_depths = [obj['depth'] for obj in all_objects_to_draw if obj.get('type') == 'wall']
    max_wall_depth = max(wall_depths) if wall_depths else float('-inf')
    depth_tolerance = 5.0  # Consider walls within this depth range as "front-most"

    # Draw each object in global depth order
    for obj in all_objects_to_draw:
        obj_type = obj.get('type')
        obj_x_world = obj['x']  # World X coordinate
        obj_z = obj['z']  # World Z coordinate (bottom of object)
        obj_width = obj['width']
        obj_height = obj['height']

        # Convert world coordinates to SVG coordinates
        obj_x = world_to_svg_x(obj_x_world, obj_width)  # Convert X with mirroring
        obj_bottom_y = z_to_y(obj_z)
        obj_top_y = z_to_y(obj_z + obj_height)
        obj_svg_height = obj_bottom_y - obj_top_y

        if obj_type == 'floor_slab':
            # Draw floor slab
            fill_color = obj.get('fill', '#808080')
            svg += f'<rect x="{obj_x}" y="{obj_top_y}" width="{obj_width}" height="{obj_svg_height}" fill="{fill_color}" stroke="#000" stroke-width="0.5"/>\n'

        elif obj_type == 'beam':
            # Draw beam
            fill_color = obj.get('fill', '#654321')
            svg += f'<rect x="{obj_x}" y="{obj_top_y}" width="{obj_width}" height="{obj_svg_height}" fill="{fill_color}" stroke="#000" stroke-width="0.5"/>\n'

        elif obj_type == 'staircase':
            # Draw staircase with steps in elevation view
            num_steps = obj.get('num_steps', 10)
            fill_color = obj.get('fill', '#C19A6B')

            # Draw individual steps (risers and treads)
            tread_run = obj_width / num_steps  # Horizontal depth of each tread
            riser_height = obj_svg_height / num_steps  # Vertical height of each riser

            svg += '<g class="staircase-elevation">\n'
            for i in range(num_steps):
                step_x = obj_x + i * tread_run
                step_bottom_y = obj_bottom_y - i * riser_height
                step_top_y = step_bottom_y - riser_height

                # Draw riser (vertical)
                svg += f'<line x1="{step_x}" y1="{step_bottom_y}" x2="{step_x}" y2="{step_top_y}" stroke="#000" stroke-width="0.5"/>\n'

                # Draw tread (horizontal)
                svg += f'<line x1="{step_x}" y1="{step_top_y}" x2="{step_x + tread_run}" y2="{step_top_y}" stroke="#000" stroke-width="0.5"/>\n'

                # Fill the step
                svg += f'<rect x="{step_x}" y="{step_top_y}" width="{tread_run}" height="{riser_height}" fill="{fill_color}" opacity="0.7"/>\n'

            # Close the staircase outline
            last_step_x = obj_x + num_steps * tread_run
            svg += f'<line x1="{last_step_x}" y1="{obj_top_y}" x2="{last_step_x}" y2="{obj_bottom_y}" stroke="#000" stroke-width="0.5"/>\n'
            svg += f'<line x1="{obj_x}" y1="{obj_bottom_y}" x2="{last_step_x}" y2="{obj_bottom_y}" stroke="#000" stroke-width="0.5"/>\n'
            svg += '</g>\n'

        elif obj_type == 'pillar':
            # Draw pillar as solid black rectangle
            svg += f'<rect x="{obj_x}" y="{obj_top_y}" width="{obj_width}" height="{obj_svg_height}" fill="#000" stroke="#000" stroke-width="0.5"/>\n'

        elif obj_type == 'wall':
            # Draw the wall
            # Check if this is a sloping wall (has different height at start vs end)
            # Must explicitly check that height_end key exists AND is different from height
            # Note: height_end can be 0 (valid for walls that slope down to nothing)
            has_height_end = 'height_end' in obj
            height_end_value = obj.get('height_end') if has_height_end else None
            is_sloping = has_height_end and (height_end_value is not None) and (obj_height != height_end_value)

            if is_sloping:
                # Sloping wall - convert all four corners
                # For mirrored views (front, right), swap the heights since we're reversing the wall direction
                if view_type in ['front', 'right']:
                    # Swap heights for mirrored views
                    h_left = obj['height_end']  # What was on right is now on left
                    h_right = obj_height        # What was on left is now on right
                else:
                    # No mirroring, use original heights
                    h_left = obj_height
                    h_right = obj['height_end']

                # Four corners: bottom-left, top-left, top-right, bottom-right
                bl_y = z_to_y(obj_z)
                tl_y = z_to_y(obj_z + h_left)
                tr_y = z_to_y(obj_z + h_right)
                br_y = z_to_y(obj_z)
                # For polygons, we need to convert each X coordinate separately
                x_left = obj_x
                x_right = obj_x + obj_width
                svg += f'<polygon points="{x_left},{bl_y} {x_left},{tl_y} {x_right},{tr_y} {x_right},{br_y}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n'
            else:
                # Regular wall
                svg += f'<rect x="{obj_x}" y="{obj_top_y}" width="{obj_width}" height="{obj_svg_height}" fill="#C19A6B" stroke="#000" stroke-width="0.5"/>\n'

            # Check if this wall is at the front (for dimensioning)
            # Front walls have depth close to the maximum (closest to viewer)
            is_front_wall = abs(obj['depth'] - max_wall_depth) <= depth_tolerance

            # Track walls with non-standard heights for dimensioning
            # Check if this wall's height differs from the expected floor height
            if is_front_wall and 'floor_height_expected' in obj:
                expected_height = obj['floor_height_expected']
                actual_height = obj_height
                height_end = obj.get('height_end', actual_height)

                # Check if height differs from expected (tolerance for floating point)
                height_tolerance = 1.0
                has_custom_height = abs(actual_height - expected_height) > height_tolerance
                has_custom_height_end = abs(height_end - expected_height) > height_tolerance

                # Only show dimensions if at least one height differs from expected
                # This excludes sloping walls that slope within the normal floor height range
                if has_custom_height or has_custom_height_end:
                    walls_with_custom_heights.append({
                        'name': obj.get('name', ''),
                        'x': obj_x_world,
                        'width': obj_width,
                        'z': obj_z,
                        'height_start': actual_height,
                        'height_end': height_end,
                        'is_sloping': is_sloping,
                        'expected_height': expected_height
                    })

            # Draw openings for this wall
            for opening in obj.get('openings', []):
                opening_type = opening.get('type')
                opening_width = opening['width']
                opening_height = opening['height']
                # Get the correct coordinate based on view direction
                coord_key = obj['coord_key']
                opening_x_world = opening.get(coord_key, 0)

                # Convert opening X coordinate with mirroring
                opening_x = world_to_svg_x(opening_x_world, opening_width)

                # Calculate opening position in world Z
                if opening_type == 'window':
                    sill_height = opening.get('sill_height', 30)
                    opening_z_bottom = obj_z + sill_height
                else:
                    opening_z_bottom = obj_z

                # Convert to SVG Y coordinates
                opening_svg_bottom_y = z_to_y(opening_z_bottom)
                opening_svg_top_y = z_to_y(opening_z_bottom + opening_height)
                opening_svg_height = opening_svg_bottom_y - opening_svg_top_y

                fill_color = "#87CEEB" if opening_type == 'window' else "#D2691E"
                svg += f'<rect x="{opening_x}" y="{opening_svg_top_y}" width="{opening_width}" height="{opening_svg_height}" fill="{fill_color}" stroke="#000" stroke-width="0.5"/>\n'

                # Track opening for dimensioning ONLY if it's on a front-most wall
                if is_front_wall:
                    elevation_openings.append({
                        'type': opening_type,
                        'x': opening_x_world,  # Store world X for dimension calculation
                        'z_bottom': opening_z_bottom,  # World Z coordinate
                        'width': opening_width,
                        'height': opening_height,
                        'sill_height': opening.get('sill_height', 0) if opening_type == 'window' else 0,
                        'wall_start': obj_x_world,  # Wall start position for calculating offsets
                        'wall_width': obj_width,    # Wall width
                        'wall_name': obj.get('name', '')  # Wall name for grouping
                    })

    # Draw roof last so it's not hidden by walls
    svg += roof_svg

    # ====================================================================
    # ADD DIMENSIONS TO ELEVATION
    # ====================================================================

    dim_config = GLOBAL_CONFIG.get('dimensions', {})
    if dim_config.get('show_outer_dimensions', True):
        base_offset = 30
        offset_increment = 20

        # 1. RIGHT SIDE: Individual floor heights (from slab top to wall top)
        # Show floor heights on the right side only
        right_offset = base_offset
        for level in floor_levels:
            # Skip initial plinth entries that don't have z_bottom/z_top
            if 'z_bottom' not in level or 'z_top' not in level:
                continue

            if level['height'] > 0:
                # Convert world Z to SVG Y
                # z_bottom is top of slab, z_top is top of walls
                y_bottom = z_to_y(level['z_bottom'])
                y_top = z_to_y(level['z_top'])
                svg += svg_draw_dimension_line(
                    width, y_bottom,
                    width, y_top,
                    right_offset,
                    is_horizontal=False,
                    adjust_start=False,
                    adjust_end=False
                )

        # 2. TOP: Overall width
        # Draw overall width dimension at the top (at the highest point)
        top_y = z_to_y(total_height)
        top_offset = -base_offset
        svg += svg_draw_dimension_line(
            0, top_y,
            width, top_y,
            top_offset,
            is_horizontal=True,
            adjust_start=False,
            adjust_end=False
        )

        # 3. OPENING DIMENSIONS: Show offsets and gaps like floor plans
        # Group openings by wall name only (not z_bottom, so doors and windows are together)
        if elevation_openings:
            # Group openings by wall name only
            wall_groups = {}
            for opening in elevation_openings:
                wall_key = opening['wall_name']
                if wall_key not in wall_groups:
                    wall_groups[wall_key] = []
                wall_groups[wall_key].append(opening)

            # Process each wall group separately
            for wall_key, wall_openings in wall_groups.items():
                if not wall_openings:
                    continue

                # Sort openings by x position along the wall
                sorted_openings = sorted(wall_openings, key=lambda o: o['x'])

                # Get wall info from first opening
                wall_start = sorted_openings[0]['wall_start']
                wall_width = sorted_openings[0]['wall_width']

                # Use the minimum z_bottom for dimension line position (typically floor level for doors)
                # This ensures dimension lines don't overlap with the openings themselves
                min_z_bottom = min(opening['z_bottom'] for opening in sorted_openings)
                opening_y = z_to_y(min_z_bottom)

                # Use half the base offset for opening dimensions
                opening_base_offset = base_offset / 2
                offset = opening_base_offset

                # Draw dimensions: offset to first, then gaps and widths
                current_pos = wall_start

                for i, opening in enumerate(sorted_openings):
                    opening_start = opening['x']
                    opening_end = opening['x'] + opening['width']

                    # Dimension from current position to opening start (offset or gap)
                    if opening_start > current_pos:
                        gap = opening_start - current_pos
                        # Convert to SVG coordinates with mirroring
                        start_svg = world_to_svg_x(current_pos, 0)
                        end_svg = world_to_svg_x(opening_start, 0)

                        svg += svg_draw_dimension_line(
                            min(start_svg, end_svg), opening_y,
                            max(start_svg, end_svg), opening_y,
                            offset,
                            is_horizontal=True,
                            adjust_start=False,
                            adjust_end=False
                        )

                    # Dimension for opening width
                    opening_start_svg = world_to_svg_x(opening_start, opening['width'])
                    svg += svg_draw_dimension_line(
                        opening_start_svg, opening_y,
                        opening_start_svg + opening['width'], opening_y,
                        offset,
                        is_horizontal=True,
                        adjust_start=False,
                        adjust_end=False
                    )

                    current_pos = opening_end

        # 4. WALL HEIGHT DIMENSIONS: Show heights for walls with non-standard heights
        # These are walls whose height differs from the expected floor height (especially sloping walls)
        if walls_with_custom_heights:
            # Position these dimensions on the left side
            left_offset = -base_offset

            # Track which height ranges we've already dimensioned to avoid duplicates
            # (e.g., two walls with heights 0→47 and 47→0 have the same range)
            dimensioned_height_ranges = set()

            for wall in walls_with_custom_heights:
                wall_x_world = wall['x']
                wall_width = wall['width']
                wall_z = wall['z']
                height_start = wall['height_start']
                height_end = wall['height_end']
                is_sloping = wall['is_sloping']

                # Create a normalized height range key (min to max) to detect duplicates
                height_range = (min(height_start, height_end), max(height_start, height_end))

                # Skip if we've already dimensioned this height range
                if height_range in dimensioned_height_ranges:
                    continue

                dimensioned_height_ranges.add(height_range)

                # Convert world coordinates to SVG
                wall_x_svg = world_to_svg_x(wall_x_world, wall_width)
                wall_bottom_y = z_to_y(wall_z)

                if is_sloping:
                    # For sloping walls, show dimensions at both ends
                    # Handle mirroring for front/right views
                    if view_type in ['front', 'right']:
                        # Heights are swapped for mirrored views
                        h_left = height_end
                        h_right = height_start
                    else:
                        h_left = height_start
                        h_right = height_end

                    # Left edge dimension
                    wall_top_left_y = z_to_y(wall_z + h_left)
                    svg += svg_draw_dimension_line(
                        wall_x_svg, wall_bottom_y,
                        wall_x_svg, wall_top_left_y,
                        left_offset,
                        is_horizontal=False,
                        adjust_start=False,
                        adjust_end=False
                    )

                    # Right edge dimension
                    wall_top_right_y = z_to_y(wall_z + h_right)
                    svg += svg_draw_dimension_line(
                        wall_x_svg + wall_width, wall_bottom_y,
                        wall_x_svg + wall_width, wall_top_right_y,
                        left_offset,
                        is_horizontal=False,
                        adjust_start=False,
                        adjust_end=False
                    )
                else:
                    # Non-sloping wall with custom height - dimension in the middle
                    wall_top_y = z_to_y(wall_z + height_start)
                    wall_mid_x = wall_x_svg + wall_width / 2
                    svg += svg_draw_dimension_line(
                        wall_mid_x, wall_bottom_y,
                        wall_mid_x, wall_top_y,
                        left_offset,
                        is_horizontal=False,
                        adjust_start=False,
                        adjust_end=False
                    )

    svg += '''</g>
'''

    # Add title in the title space area (vertically centered in the title_space)
    title_y = title_space / 2 + 10  # Centered in title space, slightly offset
    svg += f'<text x="{svg_width/2}" y="{title_y}" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">{view_name}</text>\n'
    svg += '</svg>'

    # Save to file if path provided
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(svg)
        print(f"✓ Elevation view saved to: {output_path}")

    return svg


def generate_all_elevations(house_config: dict, output_dir: str = None):
    """
    Generate SVG elevation views (front, back, left, right) for the house.

    Args:
        house_config: Complete house configuration
        output_dir: Directory to save SVG files (defaults to docs folder for web deployment)
    """
    import os

    if output_dir is None:
        # Get the blend file directory (if running in Blender) or use current directory
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                blend_dir = os.path.dirname(blend_filepath)
            else:
                blend_dir = os.getcwd()
        except ImportError:
            # Not running in Blender, use current directory
            blend_dir = os.getcwd()

        # Save to docs folder for web deployment
        output_dir = os.path.join(blend_dir, "docs")

    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "="*70)
    print("GENERATING ELEVATION VIEWS (SVG)")
    print("="*70)

    # Generate all four elevation views
    for view_type in ['front', 'back', 'left', 'right']:
        print(f"\nGenerating {view_type} elevation...")
        filename = f"elevation_{view_type}.svg"
        filepath = os.path.join(output_dir, filename)

        # Generate SVG
        generate_elevation_view(house_config, view_type, filepath)

    print("\n" + "="*70)
    print("✓ ELEVATION VIEWS GENERATED")
    print("="*70)


# Pillar elevation / cross-section helpers ----------------------------------

def _collect_ground_floor_pillars(house_config: dict) -> list:
    """Return ground-floor pillar dicts with width/length resolved."""
    default_size = GLOBAL_CONFIG.get('wall_thickness', 8)
    floors = house_config.get('floors', [])
    pillars = []
    for floor_config in floors:
        if floor_config.get('floor_number') != 0:
            continue
        for obj in floor_config.get('objects', []):
            if obj.get('type') != 'pillar':
                continue
            p = dict(obj)
            p['width'] = obj.get('width', obj.get('size', default_size))
            p['length'] = obj.get('length', obj.get('size', default_size))
            pillars.append(p)
    return pillars


def _cluster_pillars_by_axis(pillars: list, axis: str, tolerance: float) -> list:
    """
    Cluster pillars along the given world axis ('x' or 'y').

    Two pillars are in the same cluster if their centre coordinates differ by less
    than ``tolerance``, with single-link chaining. Clusters are returned ordered
    along the axis, each annotated with the mean coordinate and the pillar list.
    """
    if not pillars:
        return []
    sorted_pillars = sorted(pillars, key=lambda p: p[axis])
    clusters = []
    current = [sorted_pillars[0]]
    for p in sorted_pillars[1:]:
        if abs(p[axis] - current[-1][axis]) <= tolerance:
            current.append(p)
        else:
            clusters.append(current)
            current = [p]
    clusters.append(current)

    out = []
    for group in clusters:
        coords = [p[axis] for p in group]
        out.append({
            'axis': axis,
            'centre': sum(coords) / len(coords),
            'min': min(coords),
            'max': max(coords),
            'pillars': group,
        })
    return out


def _project_pillar(pillar: dict, view_type: str,
                    building_width: float, building_length: float) -> dict:
    """
    Project a single pillar dict (with absolute world x/y/width/length) onto the
    view axis, returning fields used by the renderer.
    """
    wx, wy = pillar['x'], pillar['y']
    dim_x, dim_y = pillar['width'], pillar['length']
    if view_type == 'front':
        visible_w = dim_x
        proj_x = building_width - ((wx - dim_x / 2) + visible_w)
        depth = -(wy - dim_y / 2)
    elif view_type == 'back':
        visible_w = dim_x
        proj_x = wx - dim_x / 2
        depth = wy + dim_y / 2
    elif view_type == 'left':
        visible_w = dim_y
        proj_x = wy - dim_y / 2
        depth = -(wx - dim_x / 2)
    elif view_type == 'right':
        visible_w = dim_y
        proj_x = building_length - ((wy - dim_y / 2) + visible_w)
        depth = wx + dim_x / 2
    else:
        raise ValueError(f"Unknown view_type: {view_type}")
    return {
        'proj_x': proj_x,
        'visible_w': visible_w,
        'depth': depth,
    }


def _project_slab_band(slab: dict, view_type: str,
                       building_width: float, building_length: float) -> tuple:
    sx, sy, sw, sl = slab['x'], slab['y'], slab['width'], slab['length']
    if view_type == 'front':
        return building_width - (sx + sw), sw
    if view_type == 'back':
        return sx, sw
    if view_type == 'left':
        return sy, sl
    return building_length - (sy + sl), sl


def _build_key_plan_svg(all_pillars: list, highlighted_pillars: list,
                        building_width: float, building_length: float,
                        view_type: str, inset_origin_x: float, inset_origin_y: float,
                        inset_size: float = 120.0) -> str:
    """
    Build a small key-plan SVG snippet showing the building footprint, all pillars
    as small markers, the highlighted row/column highlighted, and a cut-arrow
    indicating the viewing direction. Coordinates are in the outer (SVG) space —
    the helper handles its own scaling.
    """
    # Plot in Inkscape-style world coords (Y down). Fit building into a square inset.
    pad = 8
    avail = inset_size - 2 * pad
    plan_scale = avail / max(building_width, building_length)
    plan_w = building_width * plan_scale
    plan_l = building_length * plan_scale
    origin_x = inset_origin_x + pad + (avail - plan_w) / 2
    origin_y = inset_origin_y + pad + (avail - plan_l) / 2

    s = '<g class="key-plan">\n'
    # Inset frame
    s += (
        f'<rect x="{inset_origin_x}" y="{inset_origin_y}" width="{inset_size}" '
        f'height="{inset_size}" fill="#fff" stroke="#000" stroke-width="0.7"/>\n'
        f'<text x="{inset_origin_x + 4}" y="{inset_origin_y + 10}" font-size="7" '
        f'font-weight="bold" fill="#000">KEY PLAN</text>\n'
    )
    # Building outline
    s += (
        f'<rect x="{origin_x}" y="{origin_y}" width="{plan_w}" height="{plan_l}" '
        'fill="none" stroke="#000" stroke-width="0.6"/>\n'
    )
    # All pillars as small filled squares
    highlighted_ids = {id(p) for p in highlighted_pillars}
    for p in all_pillars:
        cx = origin_x + p['x'] * plan_scale
        cy = origin_y + p['y'] * plan_scale
        size = max(1.4, p['width'] * plan_scale)
        is_hi = id(p) in highlighted_ids
        fill = '#c00' if is_hi else '#888'
        s += (
            f'<rect x="{cx - size / 2}" y="{cy - size / 2}" width="{size}" '
            f'height="{size}" fill="{fill}" stroke="none"/>\n'
        )
    # Cut-line through the highlighted row/column with arrows in the viewing
    # direction (arrows point AWAY from the viewer, i.e. into the page).
    if highlighted_pillars:
        if view_type in ('front', 'back'):
            # Cut runs along X at the cluster's mean Y
            cy = origin_y + (sum(p['y'] for p in highlighted_pillars)
                             / len(highlighted_pillars)) * plan_scale
            x1 = origin_x - 4
            x2 = origin_x + plan_w + 4
            s += (
                f'<line x1="{x1}" y1="{cy}" x2="{x2}" y2="{cy}" '
                'stroke="#c00" stroke-width="0.8" stroke-dasharray="3,1.5"/>\n'
            )
            arrow_dy = 4 if view_type == 'front' else -4  # front: +Y, back: -Y
            for ax in (x1 + 2, x2 - 2):
                s += (
                    f'<polygon points="{ax},{cy + arrow_dy} '
                    f'{ax - 2},{cy + arrow_dy - (1.5 if arrow_dy > 0 else -1.5)} '
                    f'{ax + 2},{cy + arrow_dy - (1.5 if arrow_dy > 0 else -1.5)}" '
                    'fill="#c00"/>\n'
                )
        else:
            # Cut runs along Y at the cluster's mean X
            cx = origin_x + (sum(p['x'] for p in highlighted_pillars)
                             / len(highlighted_pillars)) * plan_scale
            y1 = origin_y - 4
            y2 = origin_y + plan_l + 4
            s += (
                f'<line x1="{cx}" y1="{y1}" x2="{cx}" y2="{y2}" '
                'stroke="#c00" stroke-width="0.8" stroke-dasharray="3,1.5"/>\n'
            )
            arrow_dx = 4 if view_type == 'left' else -4  # left: +X, right: -X
            for ay in (y1 + 2, y2 - 2):
                s += (
                    f'<polygon points="{cx + arrow_dx},{ay} '
                    f'{cx + arrow_dx - (1.5 if arrow_dx > 0 else -1.5)},{ay - 2} '
                    f'{cx + arrow_dx - (1.5 if arrow_dx > 0 else -1.5)},{ay + 2}" '
                    'fill="#c00"/>\n'
                )
    # Compass mark: 'N' at the top (front side)
    s += (
        f'<text x="{origin_x + plan_w / 2}" y="{origin_y - 1}" font-size="6" '
        'text-anchor="middle" fill="#000">N</text>\n'
    )
    s += '</g>\n'
    return s


def _render_pillar_view(house_config: dict, view_type: str, pillars_to_show: list,
                        title: str, output_path: str = None,
                        scale: float = 2.0,
                        all_pillars: list = None) -> str:
    """
    Internal renderer used by both elevation and section drawings. Receives the
    already-filtered pillar list (in world coordinates) plus the view direction.
    The full pillar list (``all_pillars``) is used to populate the key plan.
    """
    plinth_config = house_config.get('plinth', {})
    floors = house_config.get('floors', [])

    plinth_height = plinth_config.get('height', GLOBAL_CONFIG['plinth_height'])
    slab_thickness = GLOBAL_CONFIG.get('floor_slab_thickness', 8)
    floor_heights = GLOBAL_CONFIG.get('floor_heights', {})
    floor_0_height = floor_heights.get(0, 100)

    building_width = plinth_config.get('width', 0)
    building_length = plinth_config.get('length', 0)

    if view_type in ('front', 'back'):
        view_extent = building_width
    elif view_type in ('left', 'right'):
        view_extent = building_length
    else:
        raise ValueError(f"Unknown view_type: {view_type}")

    z_plinth_top = plinth_height
    z_floor0_slab_top = plinth_height + slab_thickness
    z_pillar_start = z_floor0_slab_top
    z_floor1_slab_bottom = z_floor0_slab_top + floor_0_height
    z_floor1_slab_top = z_floor1_slab_bottom + slab_thickness

    # Project filtered pillars
    rendered = []
    for p in pillars_to_show:
        proj = _project_pillar(p, view_type, building_width, building_length)
        p_height = p.get('height', floor_0_height)
        rendered.append({
            'name': p.get('name', ''),
            'proj_x': proj['proj_x'],
            'visible_w': proj['visible_w'],
            'z_bottom': z_pillar_start,
            'z_top': z_pillar_start + p_height,
            'depth': proj['depth'],
        })
    rendered.sort(key=lambda r: r['depth'])

    # Slabs (floor 0 and floor 1 from world data) — drawn full-width since they
    # span the building
    floor0_slabs = []
    floor1_slabs = []
    for floor_config in floors:
        fn = floor_config.get('floor_number')
        for obj in floor_config.get('objects', []):
            if obj.get('type') == 'floor_slab':
                if fn == 0:
                    floor0_slabs.append(obj)
                elif fn == 1:
                    floor1_slabs.append(obj)

    max_pillar_z = max((r['z_top'] for r in rendered),
                       default=z_floor1_slab_top + 50)
    total_height = max_pillar_z + 20

    horizontal_margin = 160
    top_margin = 40
    title_space = 50
    bottom_label_space = 110
    key_plan_size = 120
    key_plan_margin = 16

    svg_width = view_extent * scale + 2 * horizontal_margin
    svg_height = total_height * scale + top_margin + title_space + bottom_label_space

    # If the canvas is narrower than what's needed to fit the title + key plan,
    # widen it so the inset doesn't overlap the title.
    min_canvas_for_title = 520 + key_plan_size + key_plan_margin
    if svg_width < min_canvas_for_title:
        svg_width = min_canvas_for_title

    def z_to_y(z):
        return total_height - z

    content_top = top_margin + title_space

    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{svg_width}" '
        f'height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}">\n'
        f'<title>{title}</title>\n'
        '<defs>\n'
        '  <style>text { font-family: Arial, sans-serif; }</style>\n'
        '  <pattern id="slab_hatch" patternUnits="userSpaceOnUse" '
        'width="3" height="3" patternTransform="rotate(45)">\n'
        '    <line x1="0" y1="0" x2="0" y2="3" stroke="#555" stroke-width="0.6"/>\n'
        '  </pattern>\n'
        '</defs>\n'
        f'<text x="{svg_width / 2}" y="{top_margin + 25}" text-anchor="middle" '
        f'font-size="20" font-weight="bold">{title}</text>\n'
    )

    # Key plan (top right)
    svg += _build_key_plan_svg(
        all_pillars or pillars_to_show,
        pillars_to_show,
        building_width, building_length,
        view_type,
        inset_origin_x=svg_width - key_plan_size - key_plan_margin,
        inset_origin_y=key_plan_margin,
        inset_size=key_plan_size,
    )

    svg += (
        f'<g transform="translate({horizontal_margin}, {content_top}) '
        f'scale({scale})">\n'
    )

    # Ground line
    ground_y = z_to_y(0)
    svg += (
        f'<line x1="0" y1="{ground_y}" x2="{view_extent}" y2="{ground_y}" '
        'stroke="#666" stroke-width="2" stroke-dasharray="5,5"/>\n'
    )

    # Plinth band
    svg += (
        f'<rect x="0" y="{z_to_y(z_plinth_top)}" width="{view_extent}" '
        f'height="{plinth_height}" fill="#A0826D" stroke="#000" '
        'stroke-width="0.5"/>\n'
    )

    # Ground-floor slab band
    for slab in floor0_slabs:
        sx, sw = _project_slab_band(slab, view_type, building_width, building_length)
        svg += (
            f'<rect x="{sx}" y="{z_to_y(z_floor0_slab_top)}" width="{sw}" '
            f'height="{slab_thickness}" fill="#808080" stroke="#000" '
            'stroke-width="0.5"/>\n'
        )

    # Pillars
    for r in rendered:
        svg += (
            f'<rect x="{r["proj_x"]}" y="{z_to_y(r["z_top"])}" '
            f'width="{r["visible_w"]}" '
            f'height="{r["z_top"] - r["z_bottom"]}" '
            'fill="none" stroke="#000" stroke-width="0.6"/>\n'
        )

    # Floor-1 slab on top of pillars
    for slab in floor1_slabs:
        sx, sw = _project_slab_band(slab, view_type, building_width, building_length)
        svg += (
            f'<rect x="{sx}" y="{z_to_y(z_floor1_slab_top)}" width="{sw}" '
            f'height="{slab_thickness}" fill="url(#slab_hatch)" stroke="#000" '
            'stroke-width="0.6"/>\n'
        )

    # Per-pillar dimensions
    text_size = 4.0
    for r in rendered:
        if r['z_top'] > z_floor1_slab_top:
            seg_b = r['z_top'] - z_floor1_slab_top
            mid_z = (z_floor1_slab_top + r['z_top']) / 2
            cx = r['proj_x'] + r['visible_w'] / 2
            svg += (
                f'<text x="{cx}" y="{z_to_y(mid_z)}" text-anchor="middle" '
                f'font-size="{text_size}" fill="#000" '
                f'transform="rotate(-90 {cx} {z_to_y(mid_z)})">'
                f'{format_dimension(seg_b)}</text>\n'
            )
        elif r['z_top'] < z_floor1_slab_bottom:
            seg_a = r['z_top'] - r['z_bottom']
            mid_z = (r['z_bottom'] + r['z_top']) / 2
            cx = r['proj_x'] + r['visible_w'] / 2
            svg += (
                f'<text x="{cx}" y="{z_to_y(mid_z)}" text-anchor="middle" '
                f'font-size="{text_size}" fill="#000" '
                f'transform="rotate(-90 {cx} {z_to_y(mid_z)})">'
                f'{format_dimension(seg_a)}</text>\n'
            )

    # Pillar names
    label_anchor_y = z_to_y(0) + 6
    for r in rendered:
        cx = r['proj_x'] + r['visible_w'] / 2
        name = r['name'].replace('_', ' ') if r['name'] else ''
        if not name:
            continue
        svg += (
            f'<text x="{cx}" y="{label_anchor_y}" text-anchor="end" '
            f'font-size="3.5" fill="#000" '
            f'transform="rotate(-90 {cx} {label_anchor_y})">{name}</text>\n'
        )

    # Left-side Z-level dimension stack
    dim_levels = [
        (0, z_plinth_top),
        (z_plinth_top, z_floor0_slab_top),
        (z_floor0_slab_top, z_floor1_slab_bottom),
        (z_floor1_slab_bottom, z_floor1_slab_top),
    ]
    dim_x = -8
    for z_lo, z_hi in dim_levels:
        y_lo = z_to_y(z_lo)
        y_hi = z_to_y(z_hi)
        svg += (
            f'<line x1="0" y1="{y_lo}" x2="{dim_x}" y2="{y_lo}" '
            'stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'
            f'<line x1="0" y1="{y_hi}" x2="{dim_x}" y2="{y_hi}" '
            'stroke="#000" stroke-width="0.3" stroke-dasharray="2,2"/>\n'
            f'<line x1="{dim_x}" y1="{y_lo}" x2="{dim_x}" y2="{y_hi}" '
            'stroke="#000" stroke-width="0.5"/>\n'
        )
        arrow = 1.5
        svg += (
            f'<polygon points="{dim_x},{y_lo} {dim_x - arrow},{y_lo - arrow} '
            f'{dim_x + arrow},{y_lo - arrow}" fill="#000"/>\n'
            f'<polygon points="{dim_x},{y_hi} {dim_x - arrow},{y_hi + arrow} '
            f'{dim_x + arrow},{y_hi + arrow}" fill="#000"/>\n'
        )
        mid_y = (y_lo + y_hi) / 2
        text_x = dim_x - 4
        svg += (
            f'<text x="{text_x}" y="{mid_y}" text-anchor="middle" '
            f'font-size="4" fill="#000" '
            f'transform="rotate(-90 {text_x} {mid_y})">'
            f'{format_dimension(z_hi - z_lo)}</text>\n'
        )

    svg += '</g>\n</svg>\n'

    if output_path:
        with open(output_path, 'w') as f:
            f.write(svg)
        print(f"  ✓ Saved: {output_path}")

    return svg


# Tolerance (in input units) used when grouping pillars into rows/columns. Pillar
# centres within this distance along the relevant axis are treated as the same
# row (Y axis) or column (X axis).
PILLAR_CLUSTER_TOLERANCE = 20.0


def generate_pillar_elevation_view(house_config: dict, view_type: str,
                                   output_path: str = None, scale: float = 2.0) -> str:
    """
    Generate a structural elevation showing only plinth, floor slabs, and the
    outermost row/column of pillars for the chosen view, with dimensions on each
    pillar's clear segments.

    For internal rows/columns use ``generate_pillar_section_view`` instead.
    """
    pillars = _collect_ground_floor_pillars(house_config)
    axis = 'y' if view_type in ('front', 'back') else 'x'
    clusters = _cluster_pillars_by_axis(pillars, axis, PILLAR_CLUSTER_TOLERANCE)
    if not clusters:
        raise ValueError("No ground-floor pillars to draw")

    if view_type in ('front', 'left'):
        chosen = clusters[0]
    else:  # 'back' or 'right'
        chosen = clusters[-1]

    label = {
        'front': 'Front Elevation',
        'back':  'Back Elevation',
        'left':  'Left Elevation',
        'right': 'Right Elevation',
    }[view_type]
    title = f"{label} - Pillars &amp; Slabs"

    return _render_pillar_view(
        house_config, view_type,
        pillars_to_show=chosen['pillars'],
        title=title,
        output_path=output_path,
        scale=scale,
        all_pillars=pillars,
    )


def generate_pillar_section_view(house_config: dict, axis: str, cluster_index: int,
                                 section_label: str,
                                 output_path: str = None,
                                 scale: float = 2.0) -> str:
    """
    Generate a structural cross-section through one internal pillar row/column.

    Args:
        house_config: house configuration
        axis: 'y' for a section cut along constant Y (drawn looking from front);
              'x' for a section cut along constant X (drawn looking from left).
        cluster_index: 0-based index into the row/column clusters along that axis.
        section_label: human-readable section identifier (e.g. 'B-B').
        output_path: where to save the SVG.
        scale: SVG scale factor.
    """
    if axis not in ('x', 'y'):
        raise ValueError(f"axis must be 'x' or 'y', got {axis!r}")

    pillars = _collect_ground_floor_pillars(house_config)
    clusters = _cluster_pillars_by_axis(pillars, axis, PILLAR_CLUSTER_TOLERANCE)
    if not 0 <= cluster_index < len(clusters):
        raise IndexError(
            f"cluster_index {cluster_index} out of range (have {len(clusters)} "
            f"{axis}-clusters)")

    chosen = clusters[cluster_index]
    view_type = 'front' if axis == 'y' else 'left'
    title = f"Section {section_label} - Pillars &amp; Slabs"

    return _render_pillar_view(
        house_config, view_type,
        pillars_to_show=chosen['pillars'],
        title=title,
        output_path=output_path,
        scale=scale,
        all_pillars=pillars,
    )


def _section_label(axis: str, index: int) -> str:
    """Make a label like 'B-B' for Y-axis sections or '2-2' for X-axis sections."""
    if axis == 'y':
        letter = chr(ord('A') + index)
        return f"{letter}-{letter}"
    return f"{index + 1}-{index + 1}"


def _section_filename_part(axis: str, index: int) -> str:
    """Filename suffix matching the section label, safe on disk."""
    if axis == 'y':
        letter = chr(ord('A') + index).lower()
        return f"row_{letter}"
    return f"col_{index + 1}"


def generate_all_pillar_elevations(house_config: dict, output_dir: str = None):
    """
    Generate the four outermost-row pillar elevations plus one cross-section per
    internal pillar row/column. SVGs are written to ``output_dir`` (defaults to
    ``<repo>/docs``).

    Outputs (for this house):
      - pillar_elevation_front.svg, pillar_elevation_back.svg
      - pillar_elevation_left.svg,  pillar_elevation_right.svg
      - pillar_section_row_<b/c/d>.svg  (Y-axis sections, viewed from front)
      - pillar_section_col_<2/3/4>.svg  (X-axis sections, viewed from left)
    """
    import os

    if output_dir is None:
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            blend_dir = os.path.dirname(blend_filepath) if blend_filepath else os.getcwd()
        except ImportError:
            blend_dir = os.getcwd()
        output_dir = os.path.join(blend_dir, "docs")

    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "=" * 70)
    print("GENERATING PILLAR ELEVATION & SECTION VIEWS (SVG)")
    print("=" * 70)

    pillars = _collect_ground_floor_pillars(house_config)
    y_clusters = _cluster_pillars_by_axis(pillars, 'y', PILLAR_CLUSTER_TOLERANCE)
    x_clusters = _cluster_pillars_by_axis(pillars, 'x', PILLAR_CLUSTER_TOLERANCE)

    # Outer elevations
    for view_type in ('front', 'back', 'left', 'right'):
        print(f"\nGenerating {view_type} pillar elevation...")
        filepath = os.path.join(output_dir, f"pillar_elevation_{view_type}.svg")
        generate_pillar_elevation_view(house_config, view_type, filepath)

    # Internal Y-row sections (skip first and last — those are the front/back elevations)
    for idx in range(1, len(y_clusters) - 1):
        label = _section_label('y', idx)
        suffix = _section_filename_part('y', idx)
        filepath = os.path.join(output_dir, f"pillar_section_{suffix}.svg")
        print(f"\nGenerating Y-axis section {label}...")
        generate_pillar_section_view(house_config, 'y', idx, label, filepath)

    # Internal X-column sections (skip first and last — left/right elevations)
    for idx in range(1, len(x_clusters) - 1):
        label = _section_label('x', idx)
        suffix = _section_filename_part('x', idx)
        filepath = os.path.join(output_dir, f"pillar_section_{suffix}.svg")
        print(f"\nGenerating X-axis section {label}...")
        generate_pillar_section_view(house_config, 'x', idx, label, filepath)

    print("\n" + "=" * 70)
    print("✓ PILLAR ELEVATION & SECTION VIEWS GENERATED")
    print("=" * 70)


def generate_all_floor_plans(house_config: dict, output_dir: str = None):
    """
    Generate SVG floor plans for all floors in the house configuration.

    Args:
        house_config: Complete house configuration
        output_dir: Directory to save SVG files (defaults to docs folder for web deployment)
    """
    import os

    if output_dir is None:
        # Get the blend file directory (if running in Blender) or use current directory
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                blend_dir = os.path.dirname(blend_filepath)
            else:
                blend_dir = os.getcwd()
        except ImportError:
            # Not running in Blender, use current directory
            blend_dir = os.getcwd()

        # Save to docs folder for web deployment
        output_dir = os.path.join(blend_dir, "docs")

    os.makedirs(output_dir, exist_ok=True)

    print("\n" + "="*70)
    print("GENERATING FLOOR PLANS (SVG)")
    print("="*70)

    for floor_config in house_config.get('floors', []):
        floor_num = floor_config.get('floor_number', 0)
        floor_name = floor_config.get('name', f'Floor_{floor_num}')

        # Clean filename
        filename = f"floor_plan_{floor_num}_{floor_name.replace(' ', '_')}.svg"
        filepath = os.path.join(output_dir, filename)

        print(f"\nGenerating {floor_name}...")
        generate_floor_plan_svg(floor_config, filepath)

    print("\n" + "="*70)
    print("✓ ALL FLOOR PLANS GENERATED")
    print("="*70 + "\n")

def _create_html_viewer(html_path: str, model_filename: str):
    """Create a standalone HTML file with model viewer"""

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Konkan House - 3D Model Viewer</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }}
        header {{
            background: rgba(255, 255, 255, 0.95);
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 100;
        }}
        h1 {{
            color: #333;
            font-size: 1.5rem;
            font-weight: 600;
        }}
        .subtitle {{
            color: #666;
            font-size: 0.9rem;
            margin-top: 0.25rem;
        }}
        #viewer-container {{
            flex: 1;
            position: relative;
        }}
        model-viewer {{
            width: 100%;
            height: 100%;
            background-color: #f0f0f0;
        }}
        .controls {{
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.95);
            padding: 1rem 1.5rem;
            border-radius: 50px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            display: flex;
            gap: 1rem;
            align-items: center;
            z-index: 10;
        }}
        button {{
            background: #667eea;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 25px;
            cursor: pointer;
            font-size: 0.9rem;
            font-weight: 500;
            transition: all 0.3s ease;
        }}
        button:hover {{
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }}
        .loading {{
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #333;
            font-size: 1.2rem;
            background: white;
            padding: 2rem 3rem;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }}
    </style>
    <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js"></script>
</head>
<body>
    <header>
        <h1>🏠 Konkan House</h1>
        <div class="subtitle">3D Interactive Model Viewer</div>
    </header>

    <div id="viewer-container">
        <div class="loading" id="loading">Loading 3D model...</div>

        <model-viewer
            id="model"
            src="{model_filename}"
            alt="Konkan House 3D Model"
            camera-controls
            auto-rotate
            shadow-intensity="1"
            exposure="1"
            camera-orbit="45deg 75deg 50m"
            min-camera-orbit="auto auto 10m"
            max-camera-orbit="auto auto 200m"
            field-of-view="30deg">

            <div class="controls" slot="controls">
                <button onclick="document.getElementById('model').cameraOrbit = '0deg 90deg 50m'">Top View</button>
                <button onclick="document.getElementById('model').cameraOrbit = '0deg 75deg 50m'">Front View</button>
                <button onclick="document.getElementById('model').cameraOrbit = '90deg 75deg 50m'">Side View</button>
                <button onclick="document.getElementById('model').cameraOrbit = '45deg 75deg 50m'">Reset</button>
                <button onclick="toggleAutoRotate()">
                    <span id="rotate-text">⏸ Pause</span>
                </button>
            </div>
        </model-viewer>
    </div>

    <script>
        const modelViewer = document.getElementById('model');
        const loading = document.getElementById('loading');

        // Hide loading message when model loads
        modelViewer.addEventListener('load', () => {{
            loading.style.display = 'none';
        }});

        // Handle loading errors
        modelViewer.addEventListener('error', (event) => {{
            loading.innerHTML = '❌ Error loading model. Please check the file path.';
            loading.style.color = '#d32f2f';
        }});

        // Toggle auto-rotate
        function toggleAutoRotate() {{
            const rotateText = document.getElementById('rotate-text');
            if (modelViewer.autoRotate) {{
                modelViewer.autoRotate = false;
                rotateText.textContent = '▶ Play';
            }} else {{
                modelViewer.autoRotate = true;
                rotateText.textContent = '⏸ Pause';
            }}
        }}
    </script>
</body>
</html>"""

    with open(html_path, 'w') as f:
        f.write(html_content)

def _create_readme(readme_path: str):
    """Create a README.md for the docs folder"""

    readme_content = """# Konkan House - 3D Model Viewer

This folder contains the interactive 3D model viewer for the Konkan House project.

## 🏠 View the Model

**[Open Interactive 3D Viewer](https://YOUR_USERNAME.github.io/YOUR_REPO/)**

Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repository name.

## 📁 Files

- **index.html** - Interactive web viewer with controls
- **konkan_house.glb** - 3D model file (glTF binary format)

## 🎮 Viewer Controls

- **Mouse Drag** - Rotate the model
- **Scroll Wheel** - Zoom in/out
- **View Buttons** - Quick camera presets (Top, Front, Side)
- **Auto-Rotate** - Toggle automatic rotation

## 🚀 Local Testing

To view locally:
1. Open `index.html` in any modern web browser
2. The model will load automatically

## 🔧 Technical Details

- **Format**: glTF 2.0 (GLB - binary)
- **Viewer**: Google Model Viewer
- **Browser Support**: Chrome, Firefox, Safari, Edge (modern versions)
- **No plugins required**: Works directly in the browser

## 📝 About

This 3D model was generated using Blender and Python automation scripts.
The house design represents a traditional Konkan-style architecture with modern features.

---

Generated by Konkan House Builder
"""

    with open(readme_path, 'w') as f:
        f.write(readme_content)

def setup_web_viewer(docs_dir: str = None):
    """
    One-time setup: Create static web viewer files.
    Only needs to be run once or when you want to update the HTML/README.

    Args:
        docs_dir: Path to docs folder. If None, creates in current directory.

    Usage:
        setup_web_viewer()  # Creates docs/ folder with static files
    """
    import os

    if docs_dir is None:
        # Get the blend file directory
        blend_filepath = bpy.data.filepath
        if blend_filepath:
            blend_dir = os.path.dirname(blend_filepath)
        else:
            blend_dir = os.getcwd()

        docs_dir = os.path.join(blend_dir, "docs")

    # Create docs directory
    os.makedirs(docs_dir, exist_ok=True)

    print("\n" + "="*70)
    print("SETTING UP WEB VIEWER")
    print("="*70)

    # Create static files
    html_path = os.path.join(docs_dir, 'index.html')
    readme_path = os.path.join(docs_dir, 'README.md')

    # Model filename (will be created by export_to_web)
    model_filename = "konkan_house.glb"

    _create_html_viewer(html_path, model_filename)
    print(f"✓ Created: {html_path}")

    _create_readme(readme_path)
    print(f"✓ Created: {readme_path}")

    print(f"\n📁 Setup complete! Directory: {docs_dir}")
    print(f"   Run export_to_web() to create the 3D model file.")
    print("="*70 + "\n")

    return docs_dir



# ============================================================================
# COMBINED VIEW GENERATION
# ============================================================================

def generate_combined_floor_plans(house_config: dict, output_dir: str = None) -> str:
    """
    Generate a single combined SVG showing all floor plans side-by-side.
    Uses consistent scaling across all floors for direct comparison.
    
    Args:
        house_config: Complete house configuration
        output_dir: Directory to save the combined SVG
        
    Returns:
        Path to the generated combined SVG file
    """
    import os
    
    if output_dir is None:
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                blend_dir = os.path.dirname(blend_filepath)
            else:
                blend_dir = os.getcwd()
        except ImportError:
            blend_dir = os.getcwd()
        output_dir = os.path.join(blend_dir, "docs")
    
    os.makedirs(output_dir, exist_ok=True)
    
    print("\nGenerating combined floor plans...")
    
    floors = house_config['floors']
    
    # Use consistent scale for all floors
    scale = 2.0
    spacing = 100  # Spacing between floor plans (actual visual spacing)
    left_right_margin = 80  # Extra margin on left/right to prevent clipping
    top_margin = 60
    bottom_margin = 120  # Extra space for labels at bottom
    title_space = 40  # Space for main title at top
    label_offset = 30  # Space between content and label

    # Generate content for each floor and calculate dimensions
    floor_data = []
    for floor_config in floors:
        floor_num = floor_config['floor_number']
        floor_name = floor_config['name']

        # Generate the floor plan SVG content (pass None for output_path to get string only)
        from io import StringIO
        import sys

        # Temporarily capture print output
        old_stdout = sys.stdout
        sys.stdout = StringIO()

        # IMPORTANT: generate_floor_plan_svg takes floor_config (not house_config)
        svg_content = generate_floor_plan_svg(floor_config, output_path=None, scale=scale)

        # Restore stdout
        sys.stdout = old_stdout

        # Extract the entire content group WITH its transform
        import re
        # Find the opening transform tag and extract transform values
        transform_pattern = r'<g transform="translate\(([0-9.]+),\s*([0-9.]+)\)\s*scale\([^)]+\)">'
        transform_match = re.search(transform_pattern, svg_content)

        if not transform_match:
            print(f"Warning: Could not find transform tag for {floor_name}")
            continue

        translate_x = float(transform_match.group(1))
        translate_y = float(transform_match.group(2))
        start_pos = transform_match.end()

        # Find the MATCHING closing </g> tag by counting nested tags
        depth = 1
        pos = start_pos
        while depth > 0 and pos < len(svg_content):
            next_open = svg_content.find('<g ', pos)
            next_close = svg_content.find('</g>', pos)

            if next_close == -1:
                break

            if next_open != -1 and next_open < next_close:
                depth += 1
                pos = next_open + 3
            else:
                depth -= 1
                if depth == 0:
                    content_only = svg_content[start_pos:next_close]
                    break
                pos = next_close + 4

        if depth != 0:
            print(f"Warning: Could not find matching closing tag for {floor_name}")
            continue

        # Reconstruct with the transform
        drawing_content_with_transform = f'<g transform="translate({translate_x}, {translate_y}) scale(2.0, 2.0)">\n{content_only}\n</g>'

        # Extract SVG dimensions and scale from transform
        svg_match = re.search(r'<svg[^>]+width="([0-9.]+)"[^>]+height="([0-9.]+)"', svg_content)
        scale_match = re.search(r'scale\(([0-9.]+)', drawing_content_with_transform)

        if svg_match:
            svg_width = float(svg_match.group(1))
            svg_height = float(svg_match.group(2))
        else:
            svg_width = 1000
            svg_height = 1000

        if scale_match:
            content_scale = float(scale_match.group(1))
        else:
            content_scale = scale  # use the scale we passed in

        # Calculate actual content bounds
        if 'objects' in floor_config:
            min_x, min_y = float('inf'), float('inf')
            max_x, max_y = float('-inf'), float('-inf')

            for obj in floor_config['objects']:
                obj_type = obj.get('type')
                if obj_type in ['floor_slab', 'beam', 'room']:
                    x, y = obj['x'], obj['y']
                    w, l = obj['width'], obj['length']
                    min_x, min_y = min(min_x, x), min(min_y, y)
                    max_x, max_y = max(max_x, x + w), max(max_y, y + l)
                elif obj_type == 'wall':
                    min_x = min(min_x, obj['start_x'], obj['end_x'])
                    max_x = max(max_x, obj['start_x'], obj['end_x'])
                    min_y = min(min_y, obj['start_y'], obj['end_y'])
                    max_y = max(max_y, obj['start_y'], obj['end_y'])

            # Visual dimensions = content_size * scale (without translate offset)
            content_width = (max_x - min_x) * content_scale
            content_height = (max_y - min_y) * content_scale
        else:
            translate_x = 0
            content_width = svg_width

        # Use the actual SVG canvas height (includes dimension lines)
        # instead of just the visual content height
        floor_data.append({
            'name': floor_name,
            'number': floor_num,
            'content': drawing_content_with_transform,
            'canvas_width': svg_width,  # Canvas width for spacing between floors
            'canvas_height': svg_height,  # Full canvas height including dimensions
            'translate_x': translate_x,  # X offset for label centering
            'content_width': content_width,  # Pure content width for centering labels
        })
    
    if not floor_data:
        print("Error: No floor plan data generated")
        return None
    
    # Calculate total dimensions
    max_height = max(f['canvas_height'] for f in floor_data)
    total_width = sum(f['canvas_width'] for f in floor_data) + spacing * (len(floor_data) - 1)

    canvas_width = total_width + 2 * left_right_margin
    # Canvas height needs to accommodate: title + top margin + tallest content + label offset + bottom margin
    canvas_height = title_space + top_margin + max_height + label_offset + bottom_margin

    # Start building the combined SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{canvas_width}" height="{canvas_height}" viewBox="0 0 {canvas_width} {canvas_height}">
<title>All Floor Plans</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
        .floor-label {{ font-size: 16px; font-weight: bold; fill: #333; }}
    </style>
</defs>
'''

    # Add main title
    title_y = title_space - 10
    svg += f'<text x="{canvas_width/2}" y="{title_y}" text-anchor="middle" font-size="20" font-weight="bold" fill="#333">All Floor Plans</text>\n'

    # Calculate consistent label Y position (same for all floors)
    label_y = title_space + top_margin + max_height + label_offset

    # Add each floor plan
    current_x = left_right_margin
    content_start_y = title_space + top_margin
    for floor in floor_data:
        canvas_width = floor['canvas_width']
        translate_x = floor['translate_x']
        content_width = floor['content_width']

        # Add the floor content (includes its own transform)
        svg += f'<g id="floor_{floor["number"]}">\n'
        svg += f'<g transform="translate({current_x}, {content_start_y})">\n'
        svg += floor['content']
        svg += '</g>\n'

        # Add floor label - centered on visual content (actual building)
        # All labels at same Y position (bottom of canvas)
        label_x = current_x + translate_x + content_width / 2
        svg += f'<text x="{label_x}" y="{label_y}" text-anchor="middle" class="floor-label">{floor["name"]}</text>\n'
        svg += '</g>\n'

        current_x += canvas_width + spacing

    svg += '</svg>'
    
    # Save the combined SVG
    output_path = os.path.join(output_dir, 'floor_plans_combined.svg')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg)
    
    print(f"✓ Combined floor plans saved to: {output_path}")
    return output_path


def generate_combined_elevations(house_config: dict, output_dir: str = None) -> str:
    """
    Generate a single combined SVG showing all elevation views side-by-side.
    Views are in standard architectural order: left, front, right, back.
    Uses consistent scaling across all views for direct comparison.
    
    Args:
        house_config: Complete house configuration
        output_dir: Directory to save the combined SVG
        
    Returns:
        Path to the generated combined SVG file
    """
    import os
    
    if output_dir is None:
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                blend_dir = os.path.dirname(blend_filepath)
            else:
                blend_dir = os.getcwd()
        except ImportError:
            blend_dir = os.getcwd()
        output_dir = os.path.join(blend_dir, "docs")
    
    os.makedirs(output_dir, exist_ok=True)
    
    print("\nGenerating combined elevations...")
    
    # Standard architectural order
    views = [
        ('left', 'Left Elevation'),
        ('front', 'Front Elevation'),
        ('right', 'Right Elevation'),
        ('back', 'Back Elevation')
    ]
    
    # Use consistent scale for all elevations
    scale = 2.0
    spacing = 100  # Spacing between elevations (actual visual spacing)
    left_right_margin = 80  # Extra margin on left/right to prevent clipping
    top_margin = 60
    bottom_margin = 120  # Extra space for labels at bottom
    title_space = 40  # Space for main title at top
    label_offset = 30  # Space between content and label

    # Generate content for each elevation
    elevation_data = []
    for view_type, view_label in views:
        from io import StringIO
        import sys

        # Temporarily capture print output
        old_stdout = sys.stdout
        sys.stdout = StringIO()

        svg_content = generate_elevation_view(house_config, view_type, scale=scale)

        # Restore stdout
        sys.stdout = old_stdout

        # Extract the entire content group WITH its transform
        import re
        # Find the opening transform tag and extract transform values
        transform_pattern = r'<g transform="translate\(([0-9.]+),\s*([0-9.]+)\)\s*scale\([^)]+\)">'
        transform_match = re.search(transform_pattern, svg_content)

        if not transform_match:
            print(f"Warning: Could not find transform tag for {view_label}")
            continue

        translate_x = float(transform_match.group(1))
        translate_y = float(transform_match.group(2))
        start_pos = transform_match.end()

        # Find the MATCHING closing </g> tag by counting nested tags
        depth = 1
        pos = start_pos
        while depth > 0 and pos < len(svg_content):
            next_open = svg_content.find('<g ', pos)
            next_close = svg_content.find('</g>', pos)

            if next_close == -1:
                break

            if next_open != -1 and next_open < next_close:
                depth += 1
                pos = next_open + 3
            else:
                depth -= 1
                if depth == 0:
                    content_only = svg_content[start_pos:next_close]
                    break
                pos = next_close + 4

        if depth != 0:
            print(f"Warning: Could not find matching closing tag for {view_label}")
            continue

        # Reconstruct with the transform
        drawing_content_with_transform = f'<g transform="translate({translate_x}, {translate_y}) scale(2.0, 2.0)">\n{content_only}\n</g>'

        # Extract SVG dimensions and scale from transform
        svg_match = re.search(r'<svg[^>]+width="([0-9.]+)"[^>]+height="([0-9.]+)"', svg_content)
        scale_match = re.search(r'scale\(([0-9.]+)', drawing_content_with_transform)

        if svg_match:
            svg_width = float(svg_match.group(1))
            svg_height = float(svg_match.group(2))
        else:
            svg_width = 1000
            svg_height = 800

        if scale_match:
            content_scale = float(scale_match.group(1))
        else:
            content_scale = scale  # use the scale we passed in

        # Calculate actual visual dimensions for elevations
        plinth = house_config.get('plinth', {})

        # Content width depends on view direction
        if view_type in ['front', 'back']:
            base_content_width = plinth.get('width', 0)  # X dimension
        else:  # left, right
            base_content_width = plinth.get('length', 0)  # Y dimension

        # Pure content width (without translate offset)
        scaled_content_width = base_content_width * content_scale

        # Use the actual SVG canvas height (includes dimension lines)
        elevation_data.append({
            'view': view_type,
            'label': view_label,
            'content': drawing_content_with_transform,
            'canvas_width': svg_width,  # Canvas width for spacing between views
            'canvas_height': svg_height,  # Full canvas height including dimensions
            'translate_x': translate_x,  # X offset for label centering
            'content_width': scaled_content_width,  # Pure content width for centering labels
        })
    
    if not elevation_data:
        print("Error: No elevation data generated")
        return None
    
    # Calculate total dimensions
    max_height = max(e['canvas_height'] for e in elevation_data)
    total_width = sum(e['canvas_width'] for e in elevation_data) + spacing * (len(elevation_data) - 1)

    canvas_width = total_width + 2 * left_right_margin
    # Canvas height needs to accommodate: title + top margin + tallest content + label offset + bottom margin
    canvas_height = title_space + top_margin + max_height + label_offset + bottom_margin

    # Start building the combined SVG
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="{canvas_width}" height="{canvas_height}" viewBox="0 0 {canvas_width} {canvas_height}">
<title>All Elevations</title>
<defs>
    <style>
        text {{ font-family: Arial, sans-serif; }}
        .view-label {{ font-size: 16px; font-weight: bold; fill: #333; }}
    </style>
</defs>
'''

    # Add main title
    title_y = title_space - 10
    svg += f'<text x="{canvas_width/2}" y="{title_y}" text-anchor="middle" font-size="20" font-weight="bold" fill="#333">All Elevations</text>\n'

    # Calculate consistent label Y position (same for all elevations)
    label_y = title_space + top_margin + max_height + label_offset

    # Add each elevation
    current_x = left_right_margin
    content_start_y = title_space + top_margin
    for elev in elevation_data:
        canvas_width = elev['canvas_width']
        translate_x = elev['translate_x']
        content_width = elev['content_width']

        # Add the elevation content (includes its own transform)
        svg += f'<g id="elevation_{elev["view"]}">\n'
        svg += f'<g transform="translate({current_x}, {content_start_y})">\n'
        svg += elev['content']
        svg += '</g>\n'

        # Add view label - centered on canvas (entire drawing viewport)
        # All labels at same Y position (bottom of canvas)
        label_x = current_x + canvas_width / 2
        svg += f'<text x="{label_x}" y="{label_y}" text-anchor="middle" class="view-label">{elev["label"]}</text>\n'
        svg += '</g>\n'

        current_x += canvas_width + spacing

    svg += '</svg>'
    
    # Save the combined SVG
    output_path = os.path.join(output_dir, 'elevations_combined.svg')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg)

    print(f"✓ Combined elevations saved to: {output_path}")
    return output_path


def generate_roof_sections_svg(house_config: dict, output_dir: str = None) -> str:
    """
    Generate a single SVG with four dimensioned SLOPE VIEWS of the hip roof
    (each slope face unfolded flat) plus a framing detail showing rafter and
    purlin cross-sections.

    Writes docs/roof_plan.svg. Currently supports hip_roof only.
    """
    import math
    import os

    if output_dir is None:
        try:
            import bpy
            blend_filepath = bpy.data.filepath
            if blend_filepath:
                output_dir = os.path.join(os.path.dirname(blend_filepath), 'docs')
            else:
                output_dir = 'docs'
        except ImportError:
            output_dir = 'docs'
    os.makedirs(output_dir, exist_ok=True)

    roof = None
    for floor in house_config.get('floors', []):
        for obj in floor.get('objects', []):
            if obj.get('type') == 'hip_roof':
                roof = obj
                break
        if roof:
            break
    if roof is None:
        print("⚠ generate_roof_sections_svg: no hip_roof found in config")
        return None

    # Derive everything from the reduced controls in the roof config. The
    # helper is idempotent — calling it repeatedly is safe.
    from roof_geometry import derive_for_house
    _derived = derive_for_house(house_config, GLOBAL_CONFIG)
    if _derived is not None:
        # Merge derived keys into the roof dict so downstream code that
        # reads eave_x_*, eave_y_*, eave_z, slope_angle_* just works.
        for _k, _v in _derived.items():
            roof.setdefault(_k, _v)

    ridge_axis = roof.get('ridge_axis', 'y')
    eave_xw = roof['eave_x_west']
    eave_xe = roof['eave_x_east']
    eave_yn = roof['eave_y_north']
    eave_ys = roof['eave_y_south']
    slope_uniform = roof.get('slope_angle')
    slope_ns = roof.get('slope_angle_ns', slope_uniform)
    slope_ew = roof.get('slope_angle_ew', slope_uniform)
    ridge_length_override = roof.get('ridge_length')

    framing = roof.get('framing', {})
    rafter_size_in = framing.get('rafter_size_in', [4, 2])
    rafter_wall_mm = framing.get('rafter_wall_mm', 2)
    rafter_spacing_in = framing.get('rafter_spacing_in', 36)
    purlin_size_in = framing.get('purlin_size_in', [2, 1])
    purlin_wall_mm = framing.get('purlin_wall_mm', 1.5)
    purlin_spacing_in = framing.get('purlin_spacing_in', 12)
    ridge_size_in = framing.get('ridge_size_in', [6, 3])
    ridge_wall_mm = framing.get('ridge_wall_mm', 2)
    eave_edge_size_in = framing.get('eave_edge_size_in', list(rafter_size_in))
    eave_edge_wall_mm = framing.get('eave_edge_wall_mm', rafter_wall_mm)

    IN_PER_UNIT = 12.0 / 10.0  # 10 units = 1 ft = 12 in
    def in_to_u(inches):
        return inches / IN_PER_UNIT
    rafter_spacing_u = in_to_u(rafter_spacing_in)
    purlin_spacing_u = in_to_u(purlin_spacing_in)

    span_x = eave_xe - eave_xw
    span_y = eave_ys - eave_yn

    # Asymmetric hip endpoints (optional): if the config specifies
    # ridge_y_start/ridge_y_end (for ridge_axis='y') or ridge_x_start/end
    # (for ridge_axis='x'), the two hip ends can be different widths.
    ridge_y_start_override = roof.get('ridge_y_start')
    ridge_y_end_override = roof.get('ridge_y_end')
    ridge_x_start_override = roof.get('ridge_x_start')
    ridge_x_end_override = roof.get('ridge_x_end')

    if ridge_axis == 'y':
        h = (span_x / 2.0) * math.tan(math.radians(slope_ew))
        if ridge_y_start_override is not None and ridge_y_end_override is not None:
            d_hip_n = max(0.0, ridge_y_start_override - eave_yn)
            d_hip_s = max(0.0, eave_ys - ridge_y_end_override)
        elif ridge_length_override is not None:
            _hd = max(0.0, (span_y - ridge_length_override) / 2.0)
            d_hip_n = d_hip_s = _hd
        else:
            _hd = h / math.tan(math.radians(slope_ns))
            d_hip_n = d_hip_s = _hd
        actual_ns_n = math.degrees(math.atan(h / d_hip_n)) if d_hip_n > 0 else 90.0
        actual_ns_s = math.degrees(math.atan(h / d_hip_s)) if d_hip_s > 0 else 90.0
        ridge_length = max(0.0, span_y - d_hip_n - d_hip_s)
        # Legacy alias — use where a single value suffices (average).
        d_hip = (d_hip_n + d_hip_s) / 2.0

        main_perp_h = h / math.sin(math.radians(slope_ew))
        # Corner rafter length depends on which hip end (N or S). We keep
        # `main_slant` as the LONGER of the two so any code sizing panels
        # to fit uses the worst case.
        main_slant_n = math.sqrt(d_hip_n ** 2 + main_perp_h ** 2)
        main_slant_s = math.sqrt(d_hip_s ** 2 + main_perp_h ** 2)
        main_slant = max(main_slant_n, main_slant_s)
        hip_perp_h_n = math.sqrt(d_hip_n ** 2 + h ** 2)
        hip_perp_h_s = math.sqrt(d_hip_s ** 2 + h ** 2)
        hip_slant_n = math.sqrt((span_x / 2.0) ** 2 + hip_perp_h_n ** 2)
        hip_slant_s = math.sqrt((span_x / 2.0) ** 2 + hip_perp_h_s ** 2)
        # Legacy aliases (use larger for panel sizing / worst case)
        hip_perp_h = max(hip_perp_h_n, hip_perp_h_s)
        hip_slant = max(hip_slant_n, hip_slant_s)

        slopes = [
            {'code': 'W', 'title': 'WEST SLOPE (main, trapezoid)',
             'base': span_y, 'top': ridge_length,
             'perp_h': main_perp_h, 'slant': main_slant,
             'pitch': slope_ew, 'is_tri': False,
             'd_hip_left': d_hip_n, 'd_hip_right': d_hip_s},
            {'code': 'E', 'title': 'EAST SLOPE (main, trapezoid)',
             'base': span_y, 'top': ridge_length,
             'perp_h': main_perp_h, 'slant': main_slant,
             'pitch': slope_ew, 'is_tri': False,
             'd_hip_left': d_hip_n, 'd_hip_right': d_hip_s},
            {'code': 'N', 'title': 'NORTH SLOPE (hip end, triangle)',
             'base': span_x, 'top': 0.0,
             'perp_h': hip_perp_h_n, 'slant': hip_slant_n,
             'pitch': actual_ns_n, 'is_tri': True,
             'd_hip': d_hip_n},
            {'code': 'S', 'title': 'SOUTH SLOPE (hip end, triangle)',
             'base': span_x, 'top': 0.0,
             'perp_h': hip_perp_h_s, 'slant': hip_slant_s,
             'pitch': actual_ns_s, 'is_tri': True,
             'd_hip': d_hip_s},
        ]
    else:
        h = (span_y / 2.0) * math.tan(math.radians(slope_ns))
        if ridge_x_start_override is not None and ridge_x_end_override is not None:
            d_hip_w = max(0.0, ridge_x_start_override - eave_xw)
            d_hip_e = max(0.0, eave_xe - ridge_x_end_override)
        elif ridge_length_override is not None:
            _hd = max(0.0, (span_x - ridge_length_override) / 2.0)
            d_hip_w = d_hip_e = _hd
        else:
            _hd = h / math.tan(math.radians(slope_ew))
            d_hip_w = d_hip_e = _hd
        actual_ew_w = math.degrees(math.atan(h / d_hip_w)) if d_hip_w > 0 else 90.0
        actual_ew_e = math.degrees(math.atan(h / d_hip_e)) if d_hip_e > 0 else 90.0
        ridge_length = max(0.0, span_x - d_hip_w - d_hip_e)
        d_hip = (d_hip_w + d_hip_e) / 2.0
        # For ridge_axis='x', map to same variable names used below.
        d_hip_n = d_hip_w  # dummy alias (unused in x-ridge path)
        d_hip_s = d_hip_e

        main_perp_h = h / math.sin(math.radians(slope_ns))
        main_slant_n = math.sqrt(d_hip_w ** 2 + main_perp_h ** 2)
        main_slant_s = math.sqrt(d_hip_e ** 2 + main_perp_h ** 2)
        main_slant = max(main_slant_n, main_slant_s)
        hip_perp_h_n = math.sqrt(d_hip_w ** 2 + h ** 2)
        hip_perp_h_s = math.sqrt(d_hip_e ** 2 + h ** 2)
        hip_slant_n = math.sqrt((span_y / 2.0) ** 2 + hip_perp_h_n ** 2)
        hip_slant_s = math.sqrt((span_y / 2.0) ** 2 + hip_perp_h_s ** 2)
        hip_perp_h = max(hip_perp_h_n, hip_perp_h_s)
        hip_slant = max(hip_slant_n, hip_slant_s)

        slopes = [
            {'code': 'N', 'title': 'NORTH SLOPE (main, trapezoid)',
             'base': span_x, 'top': ridge_length,
             'perp_h': main_perp_h, 'slant': main_slant,
             'pitch': slope_ns, 'is_tri': False,
             'd_hip_left': d_hip_w, 'd_hip_right': d_hip_e},
            {'code': 'S', 'title': 'SOUTH SLOPE (main, trapezoid)',
             'base': span_x, 'top': ridge_length,
             'perp_h': main_perp_h, 'slant': main_slant,
             'pitch': slope_ns, 'is_tri': False,
             'd_hip_left': d_hip_w, 'd_hip_right': d_hip_e},
            {'code': 'W', 'title': 'WEST SLOPE (hip end, triangle)',
             'base': span_y, 'top': 0.0,
             'perp_h': hip_perp_h_n, 'slant': hip_slant_n,
             'pitch': actual_ew_w, 'is_tri': True,
             'd_hip': d_hip_w},
            {'code': 'E', 'title': 'EAST SLOPE (hip end, triangle)',
             'base': span_y, 'top': 0.0,
             'perp_h': hip_perp_h_s, 'slant': hip_slant_s,
             'pitch': actual_ew_e, 'is_tri': True,
             'd_hip': d_hip_e},
        ]

    # ---------- Layout ----------
    panel_w = 850
    panel_h = 620
    inner_margin = 90            # room around the drawn shape for labels
    title_bar_h = 46
    canvas_title_h = 60
    outer_pad = 30
    col_gap = 24
    row_gap = 24
    framing_panel_h = 240
    # The eave close-up cross section is a hand-maintained standalone file
    # at docs/roof-cross-section.svg (297 × 210 mm A4 landscape). We embed
    # it verbatim as a panel here; height keeps the 297:210 aspect ratio.
    external_eave_svg_path = os.path.join(
        os.path.dirname(__file__) if '__file__' in globals() else '.',
        'docs', 'roof-cross-section.svg')
    external_eave_panel_w = None                # set once panel_w known
    external_eave_panel_h = None                # set once panel_w known
    materials_panel_h = 1180  # includes Pani Patti/L-ch/barge/angles/5 Fink + 6 long-truss rows
    consolidated_panel_h = 460  # procurement summary grouped by HSS/GI spec
    truss_panel_h = 400        # single Fink truss elevation (transverse, wall-to-wall)
    persp_row_h = 620            # perspective (left) + 2 stacked sections (right)
    section_h = (persp_row_h - row_gap) / 2  # 298
    top_view_h = 1080            # framing plan (top-down): tall to accommodate portrait roof
    # Structure: title(40) + area section (2 lines now, reaches y0+128),
    # table_y fixed at y0+240, headers + 4 data rows + 4 totals push
    # row_y to y0+466. Notes header at +14 = y0+480, +20 → y0+500.
    # Right column now has 25 lines (longest), 15u gap → last baseline at
    # y0+500+24×15 = y0+860. +5u descender +25u bottom padding = 890.
    tile_panel_h = 890

    canvas_w = outer_pad * 2 + 2 * panel_w + col_gap
    # External eave cross-section panel: A4 landscape aspect (297:210). We
    # span the full canvas width and derive height from that ratio.
    external_eave_panel_w = canvas_w - 2 * outer_pad
    external_eave_panel_h = external_eave_panel_w * (210.0 / 297.0)
    # Top view panel + single row of slope panels (one per identical pair).
    # Extra slope-panel row is inserted when the hip ends are asymmetric.
    _asym_extra_h = 0
    _hips_asym = (abs(slopes[2]['pitch'] - slopes[3]['pitch']) > 0.1)
    if _hips_asym:
        _asym_extra_h = panel_h + row_gap
    canvas_h = (canvas_title_h + outer_pad + top_view_h + row_gap +
                persp_row_h + row_gap +
                panel_h + row_gap + _asym_extra_h + framing_panel_h + row_gap +
                external_eave_panel_h + row_gap +
                truss_panel_h + row_gap +
                materials_panel_h + row_gap +
                consolidated_panel_h + row_gap +
                tile_panel_h + outer_pad)

    # Pick a scale so the largest slope shape fits within any panel's drawing area.
    max_base = max(s['base'] for s in slopes)
    max_h = max(s['perp_h'] for s in slopes)
    draw_w = panel_w - 2 * inner_margin
    draw_h = panel_h - title_bar_h - 2 * inner_margin
    scale = min(draw_w / max_base, draw_h / max_h) * 0.95

    def dim_text(val):
        return format_dimension(val)

    def slope_panel(x0, y0, slope):
        base = slope['base']
        top = slope['top']
        perp_h = slope['perp_h']
        slant = slope['slant']
        pitch = slope['pitch']
        is_tri = slope['is_tri']

        base_px = base * scale
        top_px = top * scale
        perp_h_px = perp_h * scale

        # Centre the shape within the panel's drawing area.
        area_x = x0 + inner_margin
        area_y = y0 + title_bar_h + inner_margin
        area_w = panel_w - 2 * inner_margin
        area_h = panel_h - title_bar_h - 2 * inner_margin
        cx = area_x + area_w / 2
        baseline_y = area_y + area_h - (area_h - perp_h_px) / 2  # bottom of shape
        # (baseline_y is the y coordinate of the eave line in the panel)
        top_y = baseline_y - perp_h_px

        bot_left = (cx - base_px / 2, baseline_y)
        bot_right = (cx + base_px / 2, baseline_y)
        if is_tri:
            top_left = (cx, top_y)
            top_right = (cx, top_y)
        else:
            # Asymmetric main slope: top corners inset by d_hip_left/right
            # (measured from bl/br in world units).
            _dL = slope.get('d_hip_left', (base - top) / 2.0)
            _dR = slope.get('d_hip_right', (base - top) / 2.0)
            top_left = (bot_left[0] + _dL * scale, top_y)
            top_right = (bot_right[0] - _dR * scale, top_y)

        s = ''
        # Panel background + border + title bar
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_w}" height="{panel_h}" '
              f'fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_w}" height="{title_bar_h}" '
              f'fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n')
        s += (f'<text x="{x0 + panel_w / 2}" y="{y0 + title_bar_h - 15}" '
              f'text-anchor="middle" font-size="18" font-weight="600" '
              f'fill="#222">{slope["title"]}</text>\n')

        # --- Purlins (draw first, so rafters overlay). Horizontal lines at
        # regular intervals from eave to ridge/apex. Clip endpoints to slants.
        def slant_x_at(y_pixels, side):
            """Return SVG x on a slant line at a given SVG y (with y_pixels in SVG frame)."""
            # Slants go from bot corner at baseline_y up to top corner at top_y.
            if perp_h_px <= 0:
                return bot_left[0] if side == 'left' else bot_right[0]
            frac = (baseline_y - y_pixels) / perp_h_px
            if side == 'left':
                x = bot_left[0] + (top_left[0] - bot_left[0]) * frac
            else:
                x = bot_right[0] + (top_right[0] - bot_right[0]) * frac
            return x

        # Purlin positions: y = 12", 24", …, floor(slope_L/12)·12".
        # First is at y=purlin_spacing (skip y=0 = eave-edge, counted separately).
        # For a 19' slope this gives 19 positions; for 20' it gives 20.
        n_purlins = int(perp_h / purlin_spacing_u)
        for i in range(1, n_purlins + 1):
            y_from_base = min(i * purlin_spacing_u, perp_h)
            y_p = baseline_y - y_from_base * scale
            xl = slant_x_at(y_p, 'left')
            xr = slant_x_at(y_p, 'right')
            if xr - xl <= 0.5:
                continue
            s += (f'<line x1="{xl:.2f}" y1="{y_p:.2f}" x2="{xr:.2f}" y2="{y_p:.2f}" '
                  f'stroke="#4a8fbf" stroke-width="0.7" opacity="0.75"/>\n')

        # --- Rafters. Parallel vertical lines from eave up, terminating at
        # either the top edge (ridge) or the corresponding slant.
        n_rafters = int(base / rafter_spacing_u) + 1
        # Centre the row of rafters along the eave: first rafter at half-spacing
        # from either end so both edges have equal margin.
        gap = base - (n_rafters - 1) * rafter_spacing_u
        first_offset = gap / 2.0 if gap > 0 else 0.0
        for i in range(n_rafters):
            x_from_left = first_offset + i * rafter_spacing_u
            x_r = bot_left[0] + x_from_left * scale
            # Rafter runs from (x_r, baseline_y) up until it hits either the
            # top edge (if x_r is within [top_left.x, top_right.x]) or a slant.
            if is_tri or top_px <= 0:
                # Triangle: rafter hits left or right slant depending on which
                # side of centre it's on.
                if x_r < cx:
                    # left slant: from bot_left to top_left (=cx, top_y)
                    frac = (x_r - bot_left[0]) / (cx - bot_left[0]) if cx != bot_left[0] else 1
                    y_top = baseline_y - frac * perp_h_px
                elif x_r > cx:
                    frac = (bot_right[0] - x_r) / (bot_right[0] - cx) if bot_right[0] != cx else 1
                    y_top = baseline_y - frac * perp_h_px
                else:
                    y_top = top_y
            else:
                if top_left[0] <= x_r <= top_right[0]:
                    y_top = top_y
                elif x_r < top_left[0]:
                    frac = (x_r - bot_left[0]) / (top_left[0] - bot_left[0]) if top_left[0] != bot_left[0] else 1
                    y_top = baseline_y - frac * perp_h_px
                else:
                    frac = (bot_right[0] - x_r) / (bot_right[0] - top_right[0]) if bot_right[0] != top_right[0] else 1
                    y_top = baseline_y - frac * perp_h_px
            s += (f'<line x1="{x_r:.2f}" y1="{baseline_y:.2f}" x2="{x_r:.2f}" y2="{y_top:.2f}" '
                  f'stroke="#666" stroke-width="0.9" opacity="0.9"/>\n')

        # --- Slope outline (thick brown, drawn last so it's on top)
        outline = (f'M {bot_left[0]:.2f} {baseline_y:.2f} '
                   f'L {bot_right[0]:.2f} {baseline_y:.2f} '
                   f'L {top_right[0]:.2f} {top_y:.2f} ')
        if not is_tri:
            outline += f'L {top_left[0]:.2f} {top_y:.2f} '
        outline += 'Z'
        s += f'<path d="{outline}" fill="none" stroke="#8B4513" stroke-width="3"/>\n'

        # --- Dimension lines (blue)
        # Base (eave) at the bottom
        dim_y = baseline_y + 42
        s += (f'<line x1="{bot_left[0]}" y1="{baseline_y}" '
              f'x2="{bot_left[0]}" y2="{dim_y + 8}" '
              f'stroke="#0066cc" stroke-width="0.6"/>\n')
        s += (f'<line x1="{bot_right[0]}" y1="{baseline_y}" '
              f'x2="{bot_right[0]}" y2="{dim_y + 8}" '
              f'stroke="#0066cc" stroke-width="0.6"/>\n')
        s += (f'<line x1="{bot_left[0]}" y1="{dim_y}" '
              f'x2="{bot_right[0]}" y2="{dim_y}" stroke="#0066cc" '
              f'stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
        s += (f'<text x="{cx}" y="{dim_y - 6}" text-anchor="middle" '
              f'font-size="12" fill="#0066cc">eave = {dim_text(base)}</text>\n')

        # Top (ridge) for trapezoid only
        if not is_tri and top > 0:
            tdim_y = top_y - 24
            s += (f'<line x1="{top_left[0]}" y1="{top_y}" '
                  f'x2="{top_left[0]}" y2="{tdim_y - 8}" '
                  f'stroke="#0066cc" stroke-width="0.6"/>\n')
            s += (f'<line x1="{top_right[0]}" y1="{top_y}" '
                  f'x2="{top_right[0]}" y2="{tdim_y - 8}" '
                  f'stroke="#0066cc" stroke-width="0.6"/>\n')
            s += (f'<line x1="{top_left[0]}" y1="{tdim_y}" '
                  f'x2="{top_right[0]}" y2="{tdim_y}" stroke="#0066cc" '
                  f'stroke-width="1" marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
            s += (f'<text x="{cx}" y="{tdim_y - 6}" text-anchor="middle" '
                  f'font-size="12" fill="#0066cc">ridge = {dim_text(top)}</text>\n')

        # Perp height (eave-to-ridge on slope face) on the right
        h_dim_x = bot_right[0] + 32
        s += (f'<line x1="{bot_right[0]}" y1="{baseline_y}" '
              f'x2="{h_dim_x + 8}" y2="{baseline_y}" stroke="#0066cc" '
              f'stroke-width="0.6" stroke-dasharray="3,3"/>\n')
        s += (f'<line x1="{top_right[0]}" y1="{top_y}" '
              f'x2="{h_dim_x + 8}" y2="{top_y}" stroke="#0066cc" '
              f'stroke-width="0.6" stroke-dasharray="3,3"/>\n')
        s += (f'<line x1="{h_dim_x}" y1="{baseline_y}" x2="{h_dim_x}" y2="{top_y}" '
              f'stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" '
              f'marker-end="url(#arr)"/>\n')
        s += (f'<text x="{h_dim_x + 6}" y="{(baseline_y + top_y) / 2}" '
              f'text-anchor="start" font-size="11" fill="#0066cc">'
              f'height = {dim_text(perp_h)}</text>\n')

        # Slant (hip rafter) length label along the left slant
        mid_slant_x = (bot_left[0] + top_left[0]) / 2 - 8
        mid_slant_y = (baseline_y + top_y) / 2
        s += (f'<text x="{mid_slant_x}" y="{mid_slant_y}" text-anchor="end" '
              f'font-size="10" fill="#555">hip = {dim_text(slant)}</text>\n')

        # Interior corner angles of the unfolded flat shape.
        # Triangle: base_corner = atan(perp_h / (base/2)); apex = 180 - 2*base_corner.
        # Trapezoid: base_corner = atan(perp_h / d_hip); top_corner = 180 - base_corner.
        if perp_h > 0:
            if is_tri:
                base_corner_deg = math.degrees(math.atan(perp_h / (base / 2.0)))
                apex_deg = 180.0 - 2.0 * base_corner_deg
                top_corner_deg = 0.0
                base_corner_deg_L = base_corner_deg_R = base_corner_deg
                top_corner_deg_L = top_corner_deg_R = top_corner_deg
            else:
                _dL = slope.get('d_hip_left', (base - top) / 2.0)
                _dR = slope.get('d_hip_right', (base - top) / 2.0)
                base_corner_deg_L = (math.degrees(math.atan(perp_h / _dL))
                                     if _dL > 0 else 90.0)
                base_corner_deg_R = (math.degrees(math.atan(perp_h / _dR))
                                     if _dR > 0 else 90.0)
                base_corner_deg = (base_corner_deg_L + base_corner_deg_R) / 2.0
                top_corner_deg_L = 180.0 - base_corner_deg_L
                top_corner_deg_R = 180.0 - base_corner_deg_R
                top_corner_deg = (top_corner_deg_L + top_corner_deg_R) / 2.0
                apex_deg = 0.0
        else:
            base_corner_deg = apex_deg = top_corner_deg = 0.0
            base_corner_deg_L = base_corner_deg_R = 0.0
            top_corner_deg_L = top_corner_deg_R = 0.0

        # Corner angle labels (interior angles of the drawn shape).
        s += (f'<text x="{bot_left[0] + 8}" y="{baseline_y - 6}" '
              f'text-anchor="start" font-size="11" fill="#333">'
              f'{base_corner_deg_L:.1f}°</text>\n')
        s += (f'<text x="{bot_right[0] - 8}" y="{baseline_y - 6}" '
              f'text-anchor="end" font-size="11" fill="#333">'
              f'{base_corner_deg_R:.1f}°</text>\n')
        if is_tri:
            s += (f'<text x="{top_left[0]}" y="{top_y + 15}" '
                  f'text-anchor="middle" font-size="11" fill="#333">'
                  f'{apex_deg:.1f}°</text>\n')
        else:
            s += (f'<text x="{top_left[0] + 6}" y="{top_y + 14}" '
                  f'text-anchor="start" font-size="11" fill="#333">'
                  f'{top_corner_deg_L:.1f}°</text>\n')
            s += (f'<text x="{top_right[0] - 6}" y="{top_y + 14}" '
                  f'text-anchor="end" font-size="11" fill="#333">'
                  f'{top_corner_deg_R:.1f}°</text>\n')

        # Roof pitch — angle of the roof surface with the horizontal in 3D.
        # NOT an interior angle of the drawing; label prominently near the top.
        pitch_label_y = y0 + title_bar_h + 20
        s += (f'<text x="{cx}" y="{pitch_label_y}" text-anchor="middle" '
              f'font-size="15" font-weight="600" fill="#8B4513">'
              f'ROOF PITCH: {pitch:.1f}°</text>\n')

        # Face area (of ONE face; the panel represents an identical pair).
        # Units → sft: 10 units = 1 ft → 100 units² = 1 sft.
        if is_tri:
            face_area_sft = 0.5 * base * perp_h / 100.0
        else:
            face_area_sft = 0.5 * (base + top) * perp_h / 100.0
        s += (f'<text x="{cx}" y="{pitch_label_y + 18}" text-anchor="middle" '
              f'font-size="13" fill="#333">'
              f'AREA: {face_area_sft:.0f} sft per face   '
              f'(× 2 = {face_area_sft * 2:.0f} sft)</text>\n')

        # Framing counts (small note top-right of panel)
        note_x = x0 + panel_w - 10
        note_y = y0 + title_bar_h + 20
        s += (f'<text x="{note_x}" y="{note_y}" text-anchor="end" font-size="11" '
              f'fill="#333">{n_rafters} rafters @ {rafter_spacing_in}" OC</text>\n')
        s += (f'<text x="{note_x}" y="{note_y + 15}" text-anchor="end" '
              f'font-size="11" fill="#333">'
              f'{n_purlins} purlins @ {purlin_spacing_in}" OC</text>\n')

        return s

    # Framing detail panel at the bottom: rafter and purlin cross-sections
    def framing_detail_panel(x0, y0):
        detail_scale = 8.0  # 1 inch drawn as 8 SVG px
        title_h = 40
        panel_full_w = canvas_w - 2 * outer_pad
        area_y = y0 + title_h + 30
        cross_baseline = area_y + 130

        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{framing_panel_h}" fill="#ffffff" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{title_h}" fill="#f2f2f2" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<text x="{x0 + panel_full_w / 2}" y="{y0 + title_h - 12}" '
              f'text-anchor="middle" font-size="18" font-weight="600" fill="#222">'
              f'FRAMING DETAIL — Metal Pipe Cross Sections</text>\n')

        # Draw one cross-section (width × depth in inches) at the given x centre.
        # Returns the SVG string.
        def draw_member(cx_px, size_in, fill_color, stroke_color, label, spec_line,
                        wall_mm=None, is_angle=False, angle_thk_mm=None):
            w_in, d_in = size_in
            w_px = w_in * detail_scale
            d_px = d_in * detail_scale
            rx = cx_px - w_px / 2
            ry = cross_baseline - d_px
            out = ''
            if is_angle:
                # Solid L-angle profile: horizontal leg at the bottom,
                # vertical leg on the right (matches the eave L-channel's
                # in-use orientation on top of the Pani Patti).
                t_mm = angle_thk_mm if angle_thk_mm else 3.0
                t_px = (t_mm / 25.4) * detail_scale
                # Polygon points (SVG y grows down)
                #   ry ────────────────────
                #                        │█│  vertical leg
                #                        │█│
                #   ───────┬─────────────┤█│  inside corner
                #     horizontal leg      █
                #   ─────────────────────────
                pts = [
                    (rx,          cross_baseline),         # bottom-left outer
                    (rx + w_px,   cross_baseline),         # bottom-right outer
                    (rx + w_px,   ry),                     # top-right outer
                    (rx + w_px - t_px, ry),                # top-right inner (top of vertical leg)
                    (rx + w_px - t_px, cross_baseline - t_px),  # inside corner
                    (rx,          cross_baseline - t_px),  # top-left inner
                ]
                pts_str = ' '.join(f'{px:.1f},{py:.1f}' for px, py in pts)
                out += (f'<polygon points="{pts_str}" fill="{fill_color}" '
                        f'stroke="{stroke_color}" stroke-width="2" '
                        f'stroke-linejoin="miter"/>\n')
            else:
                out += (f'<rect x="{rx}" y="{ry}" width="{w_px}" height="{d_px}" '
                        f'fill="{fill_color}" stroke="{stroke_color}" stroke-width="2"/>\n')
            # Hollow pipe wall: draw the inside as a thin white rectangle offset
            # by the wall thickness. Only draw if the section is thick enough
            # for the wall to be visible at the current detail_scale.
            if wall_mm and wall_mm > 0 and not is_angle:
                t_in = wall_mm / 25.4          # mm → inches
                t_px = t_in * detail_scale
                if w_px > 4 * t_px and d_px > 4 * t_px:
                    out += (f'<rect x="{rx + t_px}" y="{ry + t_px}" '
                            f'width="{w_px - 2*t_px}" height="{d_px - 2*t_px}" '
                            f'fill="white" stroke="{stroke_color}" '
                            f'stroke-width="0.8"/>\n')
            out += (f'<text x="{cx_px}" y="{cross_baseline + 60}" text-anchor="middle" '
                    f'font-size="14" font-weight="600" fill="#222">{label}</text>\n')
            out += (f'<text x="{cx_px}" y="{cross_baseline + 78}" text-anchor="middle" '
                    f'font-size="12" fill="#333">{spec_line}</text>\n')
            # Width dimension (below)
            wdy = cross_baseline + 15
            out += (f'<line x1="{rx}" y1="{cross_baseline}" x2="{rx}" y2="{wdy + 6}" '
                    f'stroke="#0066cc" stroke-width="0.5"/>\n')
            out += (f'<line x1="{rx + w_px}" y1="{cross_baseline}" x2="{rx + w_px}" '
                    f'y2="{wdy + 6}" stroke="#0066cc" stroke-width="0.5"/>\n')
            out += (f'<line x1="{rx}" y1="{wdy}" x2="{rx + w_px}" y2="{wdy}" '
                    f'stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" '
                    f'marker-end="url(#arr)"/>\n')
            out += (f'<text x="{cx_px}" y="{wdy - 4}" text-anchor="middle" '
                    f'font-size="10" fill="#0066cc">{w_in}"</text>\n')
            # Depth dimension (left)
            ddx = rx - 15
            out += (f'<line x1="{rx}" y1="{ry}" x2="{ddx - 6}" y2="{ry}" '
                    f'stroke="#0066cc" stroke-width="0.5"/>\n')
            out += (f'<line x1="{rx}" y1="{cross_baseline}" x2="{ddx - 6}" '
                    f'y2="{cross_baseline}" stroke="#0066cc" stroke-width="0.5"/>\n')
            out += (f'<line x1="{ddx}" y1="{ry}" x2="{ddx}" y2="{cross_baseline}" '
                    f'stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" '
                    f'marker-end="url(#arr)"/>\n')
            out += (f'<text x="{ddx - 6}" y="{ry + d_px / 2}" text-anchor="end" '
                    f'font-size="10" fill="#0066cc">{d_in}"</text>\n')
            return out

        # 6 members evenly spaced across the panel. Each spec line notes
        # the HSS wall thickness (mm) along with the outer dimensions.
        # New members (barge pipe, eave L-channel) added per site video.
        barge_size_in     = framing.get('barge_pipe_size_in', [3, 1])
        barge_wall_mm     = framing.get('barge_pipe_wall_mm', 1.6)
        L_ch_size_in      = framing.get('eave_L_channel_size_in', [1, 1])
        L_ch_wall_mm      = framing.get('eave_L_channel_wall_mm', 3)
        centres = [x0 + panel_full_w * frac
                    for frac in (0.12, 0.28, 0.44, 0.60, 0.76, 0.92)]
        pp_cfg = framing.get('pani_patti', {})
        pp_h_in = pp_cfg.get('height_in', 6)
        pp_thk_mm = pp_cfg.get('thickness_mm', 1.2)
        s += draw_member(centres[0], rafter_size_in, '#c8a377', '#8B4513', 'RAFTER',
                         f'{rafter_size_in[0]}"×{rafter_size_in[1]}"×{rafter_wall_mm}mm '
                         f'@ {rafter_spacing_in}" OC',
                         wall_mm=rafter_wall_mm)
        s += draw_member(centres[1], purlin_size_in, '#a8c9e0', '#4a8fbf', 'PURLIN',
                         f'{purlin_size_in[0]}"×{purlin_size_in[1]}"×{purlin_wall_mm}mm '
                         f'@ {purlin_spacing_in}" OC (flat)',
                         wall_mm=purlin_wall_mm)
        s += draw_member(centres[2], ridge_size_in, '#a6764a', '#5a3a17', 'RIDGE',
                         f'{ridge_size_in[0]}"×{ridge_size_in[1]}"×{ridge_wall_mm}mm '
                         f'(central + 4 hip)',
                         wall_mm=ridge_wall_mm)
        # Pani Patti as an upright thin GI strip: draw at [width_thin, height]
        s += draw_member(centres[3], [0.05, pp_h_in], '#a8c9e0', '#4a8fbf', 'PANI PATTI',
                         f'{pp_h_in:.0f}" × {pp_thk_mm} mm GI strip '
                         f'(bottom flush with rafter bottom)',
                         wall_mm=None)
        s += draw_member(centres[4], L_ch_size_in, '#7a7a80', '#404040', 'EAVE L-CHANNEL',
                         f'{L_ch_size_in[0]}"×{L_ch_size_in[1]}"×{L_ch_wall_mm}mm '
                         f'on top of Pani Patti',
                         wall_mm=None,
                         is_angle=True, angle_thk_mm=L_ch_wall_mm)
        s += draw_member(centres[5], barge_size_in, '#a6764a', '#5a3a17', 'BARGE PIPE',
                         f'{barge_size_in[0]}"×{barge_size_in[1]}"×{barge_wall_mm}mm '
                         f'welded to purlin ends',
                         wall_mm=barge_wall_mm)

        return s

    # ---------- Eave close-up: purlins + tiles + eave edge ----------
    # Draws a cross section cut PARALLEL to a rafter (perpendicular to the
    # purlins), looking along the ridge. Shows three regular flat purlins, the
    # rotated upright eave-edge purlin, the rafter beneath, and three Mangalore
    # tile courses laid across them so the 4" overlap and the eave lift read
    # clearly.
    def eave_detail_panel(x0, y0):
        panel_full_w = canvas_w - 2 * outer_pad
        title_h = 40
        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{eave_detail_h}" fill="#ffffff" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{title_h}" fill="#f2f2f2" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<text x="{x0 + panel_full_w / 2}" y="{y0 + title_h - 12}" '
              f'text-anchor="middle" font-size="18" font-weight="600" fill="#222">'
              f'DOUBLE-TILE ASSEMBLY — Ceiling tile + Roof tile Cross Section at the Eave</text>\n')

        # ------ Geometry (in inches, projected onto slope-aligned axes) ------
        # X grows DOWN-slope (right = eave). Y grows UP (above rafter top).
        # We show 3 regular flat purlins + 1 upright eave-edge purlin, and
        # three tile courses (top-hooked on the three regular purlins). The
        # bottom-most tile course also rests on the upright eave-edge purlin.
        px_scale = 15                        # SVG px per inch
        purlin_spacing_in = 12
        tile_len_in = 16
        tile_overlap_in = 4
        tile_thk_in = 0.55                   # ~14 mm — exaggerated slightly
        rafter_h_in = 2                      # rafter side-profile: 2" tall
        purlin_w_in, purlin_h_in = 2, 1      # flat purlin
        eave_w_in, eave_h_in = 1, 2          # upright eave-edge purlin

        # Positions along the slope: P3 (topmost) → P2 → P1 → eave
        # X measured from the up-slope end of the drawing.
        x_p3 = 6                             # leave 6" of rafter past the last purlin (up-slope side)
        x_p2 = x_p3 + purlin_spacing_in
        x_p1 = x_p2 + purlin_spacing_in
        x_eave = x_p1 + purlin_spacing_in
        x_overhang = x_eave + 4              # tile bottom hangs 4" past eave

        # Total drawing extent in inches (add 4" left for label margin)
        draw_w_in = x_overhang + 4
        draw_w_px = draw_w_in * px_scale
        # Drawing origin (top-left of a bounding rectangle that includes labels)
        drawing_x0 = x0 + (panel_full_w - draw_w_px) / 2
        # Vertical layout inside the panel
        top_dim_band = 60                    # room for top dimension callouts
        y_rafter_top = y0 + title_h + top_dim_band + 90
        y_rafter_bot = y_rafter_top + rafter_h_in * px_scale

        # Helper: convert (in_x from left of drawing, height_in above rafter top) → svg
        def P(ix, h_in):
            return (drawing_x0 + ix * px_scale,
                    y_rafter_top - h_in * px_scale)

        # ------ Rafter (long horizontal beam, side profile) ------
        # The rafter STOPS at the eave (x_eave); it doesn't extend past. The
        # Pani Patti is welded to the rafter's end face and hangs the fascia
        # protection down below.
        rx1, ry1 = P(0, 0)
        rx2, ry2 = P(x_eave, -rafter_h_in)
        s += (f'<rect x="{rx1:.1f}" y="{y_rafter_top:.1f}" '
              f'width="{(rx2 - rx1):.1f}" height="{rafter_h_in * px_scale:.1f}" '
              f'fill="#c8a377" stroke="#8B4513" stroke-width="1.5"/>\n')
        # Rafter hollow interior hint (2 mm wall)
        wall_px = (2 / 25.4) * px_scale
        s += (f'<rect x="{rx1 + wall_px:.1f}" y="{y_rafter_top + wall_px:.1f}" '
              f'width="{(rx2 - rx1) - 2 * wall_px:.1f}" '
              f'height="{rafter_h_in * px_scale - 2 * wall_px:.1f}" '
              f'fill="none" stroke="#8B4513" stroke-width="0.6" '
              f'stroke-dasharray="3,2" opacity="0.6"/>\n')

        # ------ Flat purlins (P3, P2, P1) on top of rafter ------
        def draw_flat_purlin(x_centre_in):
            hw = purlin_w_in / 2
            x1, ytop = P(x_centre_in - hw, purlin_h_in)
            x2, ybot = P(x_centre_in + hw, 0)
            out = (f'<rect x="{x1:.1f}" y="{ytop:.1f}" '
                   f'width="{(x2 - x1):.1f}" height="{(ybot - ytop):.1f}" '
                   f'fill="#a8c9e0" stroke="#4a8fbf" stroke-width="1.5"/>\n')
            # Hollow wall hint (1.5 mm)
            t = (1.5 / 25.4) * px_scale
            out += (f'<rect x="{x1 + t:.1f}" y="{ytop + t:.1f}" '
                    f'width="{(x2 - x1) - 2 * t:.1f}" '
                    f'height="{(ybot - ytop) - 2 * t:.1f}" '
                    f'fill="none" stroke="#4a8fbf" stroke-width="0.5" '
                    f'stroke-dasharray="2,2" opacity="0.6"/>\n')
            return out
        s += draw_flat_purlin(x_p3)
        s += draw_flat_purlin(x_p2)
        s += draw_flat_purlin(x_p1)

        # ------ Eave assembly: Pani Patti + 1×1 L-channel ------
        # Per site video (and the hand-corrected drawing):
        #   PANI PATTI — an upright GI water-protector strip. Face is 6" tall
        #       × ~1" wide (in cross-section), positioned at the outer face
        #       of the rafter with its BOTTOM aligned to the rafter bottom.
        #       Its vertical face reads as the eave's water shield and its
        #       top rises past the purlin level.
        #   L-CHANNEL — 1"×1"×3mm angle welded to the Pani Patti's face. Its
        #       horizontal leg lays on the rafter TOP (inboard); its vertical
        #       leg extends UP from the rafter top to purlin-top level so the
        #       bottom tile course seats at the correct height.
        pani_patti_h_in = 6.0            # total height of Pani Patti face
        pani_patti_w_in = 1.0            # cross-section width (thin strip)
        L_ch_leg_in = 1.0                # 1" leg length
        L_ch_thk_in = 3.0 / 25.4         # 3 mm wall
        pani_stroke = '#4a8fbf'
        pani_fill   = '#a8c9e0'
        L_stroke    = '#404040'
        L_fill      = '#7a7a80'

        # PANI PATTI — upright rectangle 6" tall × 1" wide, bottom aligned to
        # the rafter bottom (h = -rafter_h_in). Positioned at the outer edge
        # of the rafter so its outer face is at x = x_eave + pani_patti_w_in/2.
        pp_x_c = x_eave                                             # centre x
        pp_y_bot = -rafter_h_in                                     # rafter bottom
        pp_y_top = pp_y_bot + pani_patti_h_in                       # 6" tall total
        pp_x_left = pp_x_c - pani_patti_w_in / 2
        pp_x_right = pp_x_c + pani_patti_w_in / 2
        pani_verts = [
            (pp_x_left,  pp_y_top),
            (pp_x_right, pp_y_top),
            (pp_x_right, pp_y_bot),
            (pp_x_left,  pp_y_bot),
        ]
        pp_pts = ' '.join(f'{p[0]:.1f},{p[1]:.1f}'
                            for p in (P(*v) for v in pani_verts))
        s += (f'<polygon points="{pp_pts}" fill="{pani_fill}" '
              f'stroke="{pani_stroke}" stroke-width="1.5" '
              f'stroke-linejoin="round"/>\n')

        # L-CHANNEL — flipped orientation from the earlier draft. Horizontal
        # leg on the rafter top; vertical leg extending UP from horizontal
        # leg to purlin-top level. Right edge of vertical leg butts against
        # the Pani Patti's inner face.
        L_x_right = pp_x_left                                       # sits inside Pani Patti face
        L_x_left  = L_x_right - L_ch_leg_in                         # horizontal leg extends 1" inboard
        L_y_bot   = 0                                                # bottom of horizontal leg = rafter top
        L_y_top   = purlin_h_in                                     # top of vertical leg = purlin top
        L_verts = [
            (L_x_right,               L_y_top),                     # top-R of vertical leg
            (L_x_right,               L_y_bot),                     # bottom-R (outer corner)
            (L_x_left,                L_y_bot),                     # bottom-L of horizontal leg
            (L_x_left,                L_y_bot + L_ch_thk_in),       # inner edge of horizontal leg (top surface)
            (L_x_right - L_ch_thk_in, L_y_bot + L_ch_thk_in),       # inner corner
            (L_x_right - L_ch_thk_in, L_y_top),                     # inner edge of vertical leg (left face)
        ]
        L_pts = ' '.join(f'{p[0]:.1f},{p[1]:.1f}'
                            for p in (P(*v) for v in L_verts))
        s += (f'<polygon points="{L_pts}" fill="{L_fill}" '
              f'stroke="{L_stroke}" stroke-width="1" '
              f'stroke-linejoin="round"/>\n')

        # ------ Lower CEILING tiles (double-tile system) ------
        # A Nutical-plain ceiling tile sits BETWEEN each pair of adjacent
        # purlins: its 12×8 body fills the 10" gap between purlin faces at
        # the same level as the purlins, and small up-turned tabs at each
        # end rest ON TOP of the purlin, catching over the corner.
        ceiling_body_h_in = 1.0            # tile plane sits at the same level as the purlins
        ceiling_tab_up_in = 0.7            # tabs rise 0.7" above body top
        ceiling_tab_x_in  = 1.2            # tabs are ~1.2" long along-slope
        ceiling_fill     = '#f0e6d2'
        ceiling_stroke   = '#8a6f3f'

        def draw_ceiling_tile(x_left_purlin_c, x_right_purlin_c, right_upright=False):
            body_left  = x_left_purlin_c + purlin_w_in / 2
            # For the eave-edge bay, the ceiling body butts against the
            # INNER edge of the 1×1 L-channel (whose horizontal leg starts
            # 1" inboard of the Pani Patti face at x_right_purlin_c).
            body_right = x_right_purlin_c - (L_ch_leg_in if right_upright else purlin_w_in / 2)
            if not right_upright:
                body_right = x_right_purlin_c - purlin_w_in / 2
            body_h     = ceiling_body_h_in
            tab_h_top  = body_h + ceiling_tab_up_in
            half_tab   = ceiling_tab_x_in / 2

            # SINGLE polygon: body rectangle + two up-tabs (one over each
            # end-purlin junction), traced clockwise in screen space.
            verts = [
                (body_left  - half_tab, tab_h_top),                                 # 1. L tab top-L
                (body_left  + half_tab, tab_h_top),                                 # 2. L tab top-R
                (body_left  + half_tab, body_h),                                    # 3. L tab meets body top
                (body_right - half_tab, body_h),                                    # 4. body top to R tab base-L
                (body_right - half_tab, tab_h_top),                                 # 5. R tab top-L
                (body_right + half_tab, tab_h_top),                                 # 6. R tab top-R
                (body_right + half_tab, body_h),                                    # 7. R tab meets body top (extends past body)
                (body_right,            body_h),                                    # 8. back to body's R edge
                (body_right,            0),                                          # 9. body bottom-R
                (body_left,             0),                                          # 10. body bottom-L
                (body_left,             body_h),                                    # 11. body's L edge back up to top
                (body_left  - half_tab, body_h),                                    # 12. tab bottom extends past body L
                # Close back up to V1
            ]
            pts = ' '.join(f'{p[0]:.1f},{p[1]:.1f}'
                            for p in (P(*v) for v in verts))
            return (f'<polygon points="{pts}" fill="{ceiling_fill}" '
                    f'stroke="{ceiling_stroke}" stroke-width="1" '
                    f'stroke-linejoin="round"/>\n')

        s += draw_ceiling_tile(x_p3, x_p2)
        s += draw_ceiling_tile(x_p2, x_p1)
        s += draw_ceiling_tile(x_p1, x_eave, right_upright=True)

        # ------ Thermal + waterproof membrane ------
        # Silver aluminium-butyl / RBD-sealed sheet laid over the ceiling
        # tiles. Follows the profile of the ceiling assembly: HIGH over each
        # ceiling-tile tab, LOW across each ceiling body, and DIPS DOWN into
        # each purlin gap (between the two adjacent tabs) so the Mangalore
        # tile's drip lip can seat into the depression.
        membrane_stroke = '#8a9099'
        membrane_dip_h = 1.35        # depth of dip at each purlin gap (relative to h=0)
        membrane_tab_h = ceiling_body_h_in + ceiling_tab_up_in  # 1.7 over tabs
        membrane_body_h = ceiling_body_h_in                     # 1.0 over ceiling body

        def tab_range(centre_x):
            return (centre_x - ceiling_tab_x_in / 2,
                    centre_x + ceiling_tab_x_in / 2)

        # Tab centres by ceiling tile:
        # ceiling 1 (P3-P2): tabs at x_p3+1  and x_p2-1
        # ceiling 2 (P2-P1): tabs at x_p2+1  and x_p1-1
        # ceiling 3 (P1-eave): tabs at x_p1+1 and x_eave-L_ch_leg_in
        tab_centres = [
            x_p3 + 1, x_p2 - 1,        # tile 1 tabs
            x_p2 + 1, x_p1 - 1,        # tile 2 tabs
            x_p1 + 1, x_eave - L_ch_leg_in,  # tile 3 tabs (right one sits against L-channel)
        ]

        # Build a polyline path.
        mem_pts = []
        # start just LEFT of the first tab at membrane_tab_h
        first_l, first_r = tab_range(tab_centres[0])
        mem_pts.append((first_l - 1.0, membrane_tab_h))
        for i, cx in enumerate(tab_centres):
            l, r = tab_range(cx)
            # OVER the tab: two points at high h at the tab's L and R edges
            mem_pts.append((l, membrane_tab_h))
            mem_pts.append((r, membrane_tab_h))
            # After each PAIR of tabs (odd i in 1,3,5), we're at a purlin gap
            # and the membrane DIPS into it before rising to the next tab.
            if i % 2 == 1 and i < len(tab_centres) - 1:
                # gap centre between this tab-r and the next tab (which is on
                # the OTHER side of the same purlin)
                next_l, _ = tab_range(tab_centres[i + 1])
                gap_c = (r + next_l) / 2
                # dip: r → gap centre (down) → next_l (up)
                mem_pts.append((gap_c - 0.3, membrane_dip_h))
                mem_pts.append((gap_c + 0.3, membrane_dip_h))
            # After each EVEN tab (last-tab-of-a-tile), we drop to body h
            # and stay there until the NEXT tab (which is the first tab of
            # the next ceiling tile, i+1). This is only relevant if we AREN'T
            # already handling a gap.
            if i % 2 == 0 and i + 1 < len(tab_centres):
                nxt_l, _ = tab_range(tab_centres[i + 1])
                mem_pts.append((r + 0.2, membrane_body_h))
                mem_pts.append((nxt_l - 0.2, membrane_body_h))
        # Finish past the last tab (at the eave-side L-channel)
        last_l, last_r = tab_range(tab_centres[-1])
        mem_pts.append((last_r + 0.5, membrane_tab_h))
        # Then drop down onto the L-channel top (which is at h=pani_patti_h_in=2)
        mem_pts.append((x_eave, pani_patti_h_in + 0.05))

        # Emit as a polyline
        pts_str = ' '.join(f'{px:.1f},{py:.1f}'
                            for px, py in (P(mx, mh) for mx, mh in mem_pts))
        s += (f'<polyline points="{pts_str}" fill="none" '
              f'stroke="{membrane_stroke}" stroke-width="2" '
              f'stroke-linejoin="round" stroke-linecap="round"/>\n')

        # Membrane callout — leader from a depression DOWN to a label below
        # the drawing (P1 gap chosen; below the rafter and clear of other labels)
        p1_gap_svg_x, p1_gap_svg_y = P(x_p1, membrane_dip_h)
        mem_label_y = y_rafter_bot + 88
        s += (f'<line x1="{p1_gap_svg_x:.1f}" y1="{p1_gap_svg_y:.1f}" '
              f'x2="{p1_gap_svg_x:.1f}" y2="{mem_label_y - 6:.1f}" '
              f'stroke="{membrane_stroke}" stroke-width="0.6"/>\n')
        s += (f'<text x="{p1_gap_svg_x:.1f}" y="{mem_label_y:.1f}" '
              f'text-anchor="middle" font-size="11" font-weight="600" '
              f'fill="{membrane_stroke}">'
              f'MEMBRANE — depression pressed into gap so tile lip seats</text>\n')

        # ------ Tiles (three courses) ------
        # Mangalore tile profile: main body plus TWO downward features on
        # the underside — a top HOOK behind the leading edge (catches on
        # the up-slope face of a purlin, preventing slide-down) and a
        # bottom drip LIP at the trailing edge (closes the water joint
        # over the tile below). Both project BELOW the tile body.
        tile_hook_down_in = 1.4      # top hook drops this far below body BOTTOM
        tile_hook_x_in    = 1.4      # top hook length UP-SLOPE of leading edge
        tile_lip_down_in  = 1.0      # bottom drip lip drops this far below body BOTTOM
        tile_lip_x_in     = 0.6      # bottom drip lip length along slope

        def draw_tile(x_top_in, hook_h_in, tail_h_in, colour, lip_at_tail=False):
            # Tile body spans x_a → x_b (16" total) along slope. The
            # underside is a linear ramp from hook_h_in (at x_a) to tail_h_in
            # (at x_b). Body top follows at underside + tile_thk_in.
            # DRIP LIP is at x_a + purlin_spacing (=next purlin down-slope),
            # so it drops INTO the ceiling-tile gap around that purlin. The
            # remaining (tile_len − purlin_spacing) = 4" of tile past the lip
            # is the OVERLAP that rides on top of the tile-below.
            # For the BOTTOM tile, lip_at_tail=True moves the lip to the very
            # end so it drips past the eave-edge purlin (into free air) instead
            # of sinking into the upright purlin's body.
            x_a = x_top_in
            x_b = x_top_in + tile_len_in
            if lip_at_tail:
                x_lip_c = x_b - tile_lip_x_in / 2
            else:
                x_lip_c = x_top_in + purlin_spacing_in    # next purlin
            thk = tile_thk_in
            span = x_b - x_a
            slope_per_in = (tail_h_in - hook_h_in) / span if span else 0.0

            def h_under(x):
                return hook_h_in + slope_per_in * (x - x_a)
            def h_top(x):
                return h_under(x) + thk

            lip_l = x_lip_c - tile_lip_x_in / 2
            lip_r = x_lip_c + tile_lip_x_in / 2

            # SINGLE polygon covering body + drip lip + top hook. Traversed
            # clockwise (in screen space). Closing edge goes diagonally from
            # hook top-L back up to body top-L, so the outline stays simple
            # (no T-intersections at the leading edge).
            verts = [
                (x_a,                    h_top(x_a)),                              # 1. body top-L
                (x_b,                    h_top(x_b)),                              # 2. body top-R
                (x_b,                    h_under(x_b)),                            # 3. underside at tail
                (lip_r,                  h_under(lip_r)),                          # 4. underside at lip R
                (lip_r,                  h_under(lip_r) - tile_lip_down_in),        # 5. lip bottom-R
                (lip_l,                  h_under(lip_l) - tile_lip_down_in),        # 6. lip bottom-L
                (lip_l,                  h_under(lip_l)),                          # 7. underside at lip L
                (x_a,                    h_under(x_a)),                            # 8. underside at leading edge
                (x_a,                    h_under(x_a) - tile_hook_down_in),        # 9. hook bottom-R
                (x_a - tile_hook_x_in,   h_under(x_a) - tile_hook_down_in),        # 10. hook bottom-L
                (x_a - tile_hook_x_in,   h_under(x_a)),                            # 11. hook top-L
                # Close diagonally back to V1
            ]
            pts = ' '.join(f'{p[0]:.1f},{p[1]:.1f}'
                            for p in (P(*v) for v in verts))
            return (f'<polygon points="{pts}" fill="{colour}" '
                    f'stroke="#8B4513" stroke-width="1" stroke-linejoin="round"/>\n')

        # Tile heights (underside) at each end of each course. Each course is
        # a rigid plane resting on TWO supports; we compute the underside
        # slope from those supports and then extrapolate to the tile's tail
        # (which overhangs past the second support by tile_len − purlin_spacing).
        # In the DOUBLE tile system, the upper tile sits on the ceiling
        # tile's TOP TAB (h = purlin_h + ceiling_tab_up), not directly on
        # the purlin top. The hook then reaches DOWN past the tab to catch
        # on the purlin's up-slope face.
        h_flat = purlin_h_in + ceiling_tab_up_in   # 1.4" — upper tile underside at hook
        overhang_in = tile_len_in - purlin_spacing_in   # 4"

        # Bottom course C: hooks on P1 (h=1"), rests on eave-edge purlin (h=2").
        # Support spacing = purlin_spacing_in (12"). Tile continues 4" past
        # eave-edge as an overhang.
        tile_c_hook = h_flat
        c_slope = (eave_h_in - h_flat) / purlin_spacing_in
        tile_c_tail = h_flat + tile_len_in * c_slope   # 2.333"

        # Middle course B: hooks on P2, tail rests on Tile C's TOP surface at
        # x_p2 + tile_len_in = x_p1 + overhang_in. C's underside there is
        # h_flat + overhang_in * c_slope; C's TOP is that plus tile_thk_in.
        b_tail_support_h = h_flat + overhang_in * c_slope + tile_thk_in
        b_slope = (b_tail_support_h - h_flat) / tile_len_in
        tile_b_hook = h_flat
        tile_b_tail = b_tail_support_h

        # Top course A: same pattern — tail rests on Tile B's TOP surface
        # at x_p3 + tile_len_in = x_p2 + overhang_in.
        a_tail_support_h = h_flat + overhang_in * b_slope + tile_thk_in
        a_slope = (a_tail_support_h - h_flat) / tile_len_in
        tile_a_hook = h_flat
        tile_a_tail = a_tail_support_h

        # Draw C first (bottom), then B, then A on top so overlaps read correctly.
        s += draw_tile(x_p1, tile_c_hook, tile_c_tail, '#d8bb94', lip_at_tail=True)
        s += draw_tile(x_p2, tile_b_hook, tile_b_tail, '#e0c6a3')
        s += draw_tile(x_p3, tile_a_hook, tile_a_tail, '#d8bb94')

        # Convenient aliases used by the dimension code below.
        tile_bot_top = tile_c_tail
        tile_mid_top = tile_b_tail
        tile_top_top = tile_a_tail

        # ------ Dimension callouts ------
        blue = '#0066cc'
        # Top dim band: three "12" spacing" arrows above the tiles.
        # Pick a baseline safely above the top-most tile top surface.
        top_tile_top_h = tile_top_top + tile_thk_in  # highest y in the drawing
        dim_y_top = y_rafter_top - (top_tile_top_h * px_scale) - 40
        # Extension lines from each purlin centre up to the dim band
        for cx_in in [x_p3, x_p2, x_p1, x_eave]:
            cx, _ = P(cx_in, 0)
            s += (f'<line x1="{cx:.1f}" y1="{dim_y_top + 6:.1f}" '
                  f'x2="{cx:.1f}" y2="{y_rafter_top - top_tile_top_h * px_scale - 8:.1f}" '
                  f'stroke="{blue}" stroke-width="0.5" stroke-dasharray="3,2"/>\n')
        for a, b in [(x_p3, x_p2), (x_p2, x_p1), (x_p1, x_eave)]:
            xa, _ = P(a, 0)
            xb, _ = P(b, 0)
            s += (f'<line x1="{xa:.1f}" y1="{dim_y_top:.1f}" '
                  f'x2="{xb:.1f}" y2="{dim_y_top:.1f}" '
                  f'stroke="{blue}" stroke-width="1" '
                  f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
            s += (f'<text x="{(xa + xb) / 2:.1f}" y="{dim_y_top - 5:.1f}" '
                  f'text-anchor="middle" font-size="11" fill="{blue}">'
                  f'12" (305 mm) purlin OC</text>\n')

        # Tile length dim (16") along the topmost tile
        tile_top_y = y_rafter_top - (top_tile_top_h * px_scale) - 22
        xta, _ = P(x_p3, 0)
        xtb, _ = P(x_p3 + tile_len_in, 0)
        s += (f'<line x1="{xta:.1f}" y1="{tile_top_y:.1f}" '
              f'x2="{xtb:.1f}" y2="{tile_top_y:.1f}" '
              f'stroke="#8B4513" stroke-width="0.8" '
              f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
        s += (f'<text x="{(xta + xtb) / 2:.1f}" y="{tile_top_y - 4:.1f}" '
              f'text-anchor="middle" font-size="11" font-weight="600" fill="#8B4513">'
              f'Tile length 16" (406 mm) — Indicotto 16×10</text>\n')

        # 4" overlap arrow inside the middle-top overlap zone
        xoa, _ = P(x_p2, 0)                      # top of B
        xob, _ = P(x_p3 + tile_len_in, 0)        # bottom of A
        overlap_y = y_rafter_top - (tile_mid_top + tile_thk_in) * px_scale - 8
        s += (f'<line x1="{xoa:.1f}" y1="{overlap_y:.1f}" '
              f'x2="{xob:.1f}" y2="{overlap_y:.1f}" '
              f'stroke="{blue}" stroke-width="1" '
              f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
        s += (f'<text x="{(xoa + xob) / 2:.1f}" y="{overlap_y - 4:.1f}" '
              f'text-anchor="middle" font-size="11" fill="{blue}">'
              f'4" (100 mm) overlap</text>\n')

        # ----- Bottom dim / callouts -----
        # Rafter section callout
        rafter_dy = y_rafter_bot + 22
        rlx, _ = P(0, 0)
        rrx, _ = P(4, 0)
        s += (f'<line x1="{rlx:.1f}" y1="{rafter_dy:.1f}" '
              f'x2="{rrx:.1f}" y2="{rafter_dy:.1f}" '
              f'stroke="{blue}" stroke-width="1" '
              f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
        s += (f'<text x="{(rlx + rrx) / 2:.1f}" y="{rafter_dy + 14:.1f}" '
              f'text-anchor="middle" font-size="11" fill="{blue}">'
              f'RAFTER 4"×2" × 2 mm HSS (side profile)</text>\n')

        # 2" purlin cross-section callout under P2
        p2_cx, _ = P(x_p2, 0)
        p2_lx, _ = P(x_p2 - purlin_w_in / 2, 0)
        p2_rx, _ = P(x_p2 + purlin_w_in / 2, 0)
        pdim_y = y_rafter_bot + 44
        s += (f'<line x1="{p2_lx:.1f}" y1="{pdim_y:.1f}" '
              f'x2="{p2_rx:.1f}" y2="{pdim_y:.1f}" '
              f'stroke="{blue}" stroke-width="1" '
              f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
        s += (f'<text x="{p2_cx:.1f}" y="{pdim_y + 14:.1f}" '
              f'text-anchor="middle" font-size="11" fill="{blue}">'
              f'2" wide flat purlin ({purlin_size_in[0]}×{purlin_size_in[1]}×{purlin_wall_mm} mm HSS)</text>\n')

        # 1" tall purlin height dim (left of P3)
        p3_cx, _ = P(x_p3, 0)
        p3_top, _ = P(x_p3 - purlin_w_in / 2 - 1, 0), 0
        # Use vertical dim on the left face of P3
        v_x = p3_cx - purlin_w_in / 2 * px_scale - 22
        v_yb = y_rafter_top
        v_yt = y_rafter_top - purlin_h_in * px_scale
        s += (f'<line x1="{v_x:.1f}" y1="{v_yb:.1f}" '
              f'x2="{v_x:.1f}" y2="{v_yt:.1f}" '
              f'stroke="{blue}" stroke-width="1" '
              f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
        s += (f'<text x="{v_x - 6:.1f}" y="{(v_yb + v_yt) / 2 + 4:.1f}" '
              f'text-anchor="end" font-size="11" fill="{blue}">1"</text>\n')

        # Ceiling tile callout — leader from middle ceiling body down to a label
        ceiling_mid_x_in = (x_p2 + x_p1) / 2
        ceiling_body_svg_cx, _ = P(ceiling_mid_x_in, 0.5)
        ceiling_label_y = y_rafter_bot + 110
        s += (f'<line x1="{ceiling_body_svg_cx:.1f}" y1="{y_rafter_bot:.1f}" '
              f'x2="{ceiling_body_svg_cx:.1f}" y2="{ceiling_label_y - 6:.1f}" '
              f'stroke="#8a6f3f" stroke-width="0.6"/>\n')
        s += (f'<text x="{ceiling_body_svg_cx:.1f}" y="{ceiling_label_y:.1f}" '
              f'text-anchor="middle" font-size="11" font-weight="600" fill="#8a6f3f">'
              f'CEILING TILE — Nutical Plain 12×8 (between purlins, tabs curl over purlin tops)</text>\n')

        # Upper tile callout — leader from middle of tile B down to a label above the tile
        upper_tile_x_in = x_p2 + 5              # some x mid-tile-B
        upper_tile_h = h_flat + 5 * b_slope + tile_thk_in    # top surface of tile B at that x
        u_cx, u_cy = P(upper_tile_x_in, upper_tile_h)
        u_label_y = y0 + title_h + 40
        s += (f'<line x1="{u_cx:.1f}" y1="{u_cy:.1f}" '
              f'x2="{u_cx:.1f}" y2="{u_label_y + 6:.1f}" '
              f'stroke="#8B4513" stroke-width="0.6"/>\n')
        s += (f'<text x="{u_cx:.1f}" y="{u_label_y:.1f}" '
              f'text-anchor="middle" font-size="11" font-weight="600" fill="#8B4513">'
              f'UPPER TILE — Indicotto 16×10 (top HOOK ↓ behind purlin, DRIP LIP ↓ over tile below)</text>\n')

        # Pani Patti height dim on the right — 6" tall × 1" wide upright strip,
        # bottom aligned to rafter bottom (h = -rafter_h_in)
        e_cx, _ = P(x_eave, 0)
        e_dim_x = e_cx + 28
        pp_dim_top_y = y_rafter_top - pani_patti_h_in * px_scale + rafter_h_in * px_scale
        pp_dim_bot_y = y_rafter_bot                     # rafter bottom (= Pani Patti bottom)
        s += (f'<line x1="{e_dim_x:.1f}" y1="{pp_dim_bot_y:.1f}" '
              f'x2="{e_dim_x:.1f}" y2="{pp_dim_top_y:.1f}" '
              f'stroke="{blue}" stroke-width="1" '
              f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
        s += (f'<text x="{e_dim_x + 6:.1f}" y="{(pp_dim_top_y + pp_dim_bot_y) / 2 + 4:.1f}" '
              f'text-anchor="start" font-size="11" fill="{blue}">'
              f'{pani_patti_h_in:.0f}" × {pani_patti_w_in:.0f}" Pani Patti '
              f'(bottom aligned to rafter)</text>\n')
        # Eave assembly label — leader down to below the drawing
        elabel_y = y_rafter_bot + 66
        s += (f'<line x1="{e_cx:.1f}" y1="{y_rafter_bot + 20:.1f}" '
              f'x2="{e_cx:.1f}" y2="{elabel_y - 6:.1f}" '
              f'stroke="#666666" stroke-width="0.6"/>\n')
        s += (f'<text x="{e_cx:.1f}" y="{elabel_y:.1f}" '
              f'text-anchor="middle" font-size="11" font-weight="600" fill="#404040">'
              f'EAVE ASSEMBLY — {pani_patti_h_in:.0f}"×{pani_patti_w_in:.0f}" upright '
              f'Pani Patti (bottom flush with rafter bottom) + 1"×1"×3 mm L-channel '
              f'(horizontal leg on rafter top, vertical leg up to purlin top)</text>\n')

        # ------ Up-slope / eave direction indicators (kept above dim band) ------
        direction_y = y0 + title_h + 30
        s += (f'<text x="{drawing_x0:.1f}" y="{direction_y:.1f}" '
              f'text-anchor="start" font-size="12" font-weight="600" fill="#333">'
              f'↖ up-slope (ridge)</text>\n')
        s += (f'<text x="{drawing_x0 + draw_w_in * px_scale:.1f}" y="{direction_y:.1f}" '
              f'text-anchor="end" font-size="12" font-weight="600" fill="#333">'
              f'eave ↘</text>\n')
        s += (f'<text x="{drawing_x0 + draw_w_in * px_scale / 2:.1f}" y="{direction_y:.1f}" '
              f'text-anchor="middle" font-size="11" fill="#666">'
              f'drawn slope-flat for clarity  •  actual pitch '
              f'{slopes[0]["pitch"]:.1f}° (main slope)</text>\n')

        # ------ Notes at bottom ------
        note_x = x0 + 40
        note_y_start = y0 + eave_detail_h - 138
        notes = [
            'DOUBLE-TILE ASSEMBLY (per Santosh Roofing video):',
            '• LOWER CEILING TILE (Nutical Plain 12×8, beige) sits BETWEEN each pair of purlins at the purlin level. Its two up-turned tabs curl over each purlin from either side, leaving a small gap at each purlin between the two tabs.',
            '• THERMAL + WATERPROOF MEMBRANE (silver, aluminium-butyl faced) is laid over the ceiling tiles. Horizontal courses lap 12", vertical joints lap 8", every overlap sealed with RBD tape; fabric extends 2" past ceiling tiles at barges. A DEPRESSION is pressed into the membrane at each ceiling-tile gap so the roof tile drip lip seats down into it.',
            '• UPPER ROOF TILE (Indicotto 16×10, brown): top HOOK curls DOWN behind the purlin\'s up-slope face at the hook end. The DRIP LIP drops DOWN 12" from the hook (at the next purlin) into the membrane depression in the ceiling-tile gap — this is the water-tight joint.',
            '• Each upper course extends 4" past its drip lip, and that 4" tail rests on top of the tile course below (the 4" overlap). Purlins at 12" OC = 16" tile length − 4" overlap.',
            '• At the EAVE, a folded GI PANI PATTI (water-protector strip) runs along the eave with a 1"×1"×3 mm L-CHANNEL welded on top. The L-channel top is aligned to the top of the purlins so the bottom tile course sits at the correct level; the Pani Patti vertical face runs down past the rafter to shed water clear of the fascia.',
        ]
        for i, ln in enumerate(notes):
            weight = ' font-weight="600"' if i == 0 else ''
            s += (f'<text x="{note_x}" y="{note_y_start + i * 16}" '
                  f'font-size="12" fill="#333"{weight}>{ln}</text>\n')

        return s

    # ---------- Quantity computation ----------
    # Compute per-slope rafter and purlin subtotals using the same positional
    # logic as the drawing (so contractor's cross-check matches what is drawn).
    def compute_slope_qty(slope):
        base = slope['base']
        top = slope['top']
        perp_h = slope['perp_h']
        is_tri = slope['is_tri']
        # Asymmetric main-slope trapezoids expose d_hip_left / d_hip_right;
        # fall back to symmetric (base - top) / 2 if absent.
        if is_tri:
            d_hip_L = slope.get('d_hip', base / 2.0)
            d_hip_R = d_hip_L
        else:
            d_hip_L = slope.get('d_hip_left', (base - top) / 2.0)
            d_hip_R = slope.get('d_hip_right', (base - top) / 2.0)

        # Rafters — same offset/count as the drawing loop
        n_r = int(base / rafter_spacing_u) + 1
        gap = base - (n_r - 1) * rafter_spacing_u
        first_off = gap / 2.0 if gap > 0 else 0.0
        rafter_lens = []
        for i in range(n_r):
            xf = first_off + i * rafter_spacing_u
            if is_tri or top <= 0:
                if perp_h <= 0 or d_hip_L <= 0:
                    L = 0.0
                elif xf < base / 2.0:
                    L = perp_h * xf / (base / 2.0)
                elif xf > base / 2.0:
                    L = perp_h * (base - xf) / (base / 2.0)
                else:
                    L = perp_h
            else:
                # Trapezoid main slope with potentially asymmetric hip
                # cutoffs on left/right.
                if perp_h <= 0 or (d_hip_L <= 0 and d_hip_R <= 0):
                    L = perp_h
                elif d_hip_L <= xf <= (base - d_hip_R):
                    L = perp_h
                elif xf < d_hip_L:
                    L = perp_h * xf / d_hip_L if d_hip_L > 0 else perp_h
                else:
                    L = perp_h * (base - xf) / d_hip_R if d_hip_R > 0 else perp_h
            rafter_lens.append(L)

        # Purlins — same y positions as the drawing loop. Skip i=0 (that row
        # is the eave-edge timber, counted separately as "Eave edge").
        n_p = int(perp_h / purlin_spacing_u)
        purlin_lens = []
        for i in range(1, n_p + 1):
            y = min(i * purlin_spacing_u, perp_h)
            if perp_h <= 0:
                L = base
            elif is_tri or top <= 0:
                L = base * (1 - y / perp_h)
            else:
                # Asymmetric taper: left/right insets grow independently
                L = base - (d_hip_L + d_hip_R) * y / perp_h
            if L > 0.5:
                purlin_lens.append(L)

        return {
            'rafter_count': len(rafter_lens),
            'rafter_total': sum(rafter_lens),
            'rafter_max': max(rafter_lens) if rafter_lens else 0.0,
            # Purlin count is the NOMINAL slot count = floor(slope_L / spacing);
            # matches "19 rows @ 12"" on a 19-ft slope and 20 on a 20-ft slope.
            # (On the hip-end triangle the topmost slot lands at the apex with
            # zero length — physically absorbed by the ridge cap.)
            'purlin_count': n_p,
            'purlin_total': sum(purlin_lens),
            'purlin_max': max(purlin_lens) if purlin_lens else 0.0,
        }

    slope_qty = {sl['code']: compute_slope_qty(sl) for sl in slopes}

    totals = {
        'rafter_count': sum(q['rafter_count'] for q in slope_qty.values()),
        'rafter_total': sum(q['rafter_total'] for q in slope_qty.values()),
        'rafter_max': max(q['rafter_max'] for q in slope_qty.values()) if slope_qty else 0,
        'purlin_count': sum(q['purlin_count'] for q in slope_qty.values()),
        'purlin_total': sum(q['purlin_total'] for q in slope_qty.values()),
        'purlin_max': max(q['purlin_max'] for q in slope_qty.values()) if slope_qty else 0,
    }
    # Hip ridges: 2 diagonals go from each ridge endpoint down to the two
    # corresponding eave corners. For an asymmetric roof N and S hips have
    # different lengths.
    hip_slant_n_val = hip_slant_n
    hip_slant_s_val = hip_slant_s
    hip_slant = max(hip_slant_n_val, hip_slant_s_val)   # legacy alias
    hip_ridges_total = 2 * hip_slant_n_val + 2 * hip_slant_s_val
    central_ridge_total = ridge_length
    # Use the SAME rounded display value as the individual dimensions —
    # ensures that 2·(span_x + span_y) on the sheet adds up when a reader
    # takes the printed 34'2" and 52'2" values and computes by hand.
    def _sum_consistent_units(u):
        """Round units so dim_text(u) equals the value used in sums."""
        ft = u / 10.0
        feet = int(ft)
        inch = round((ft - feet) * 12)
        if inch >= 12:
            feet += 1
            inch -= 12
        return (feet * 12 + inch) / 1.2  # back to display-units
    eave_perim_total = 2 * (_sum_consistent_units(span_x) +
                            _sum_consistent_units(span_y))

    # ---------- House footprint (walls) — inset from eave ----------
    # The Fink truss bottom chord sits on the ring beam that sits on top of
    # the walls. This gives the truss a smaller effective span than the eave.
    house_ft = framing.get('house_footprint_ft', [span_x * 1.2 / 12.0,
                                                    span_y * 1.2 / 12.0])
    # Convert ft → world units (1 unit = 0.1 ft)
    house_trans_u = house_ft[0] * 10.0
    house_long_u = house_ft[1] * 10.0
    # Inset from eave on each side. Transverse (W/E) stays symmetric; the
    # longitudinal (N/S) side can be asymmetric — house origin sits at the
    # N wall (ridge_axis='y') or W wall (ridge_axis='x').
    if ridge_axis == 'y':
        wall_inset_trans = (span_x - house_trans_u) / 2.0
        wall_inset_long_n = -eave_yn                  # N wall at world_y=0
        wall_inset_long_s = eave_ys - house_long_u    # S wall at world_y=house_long_u
        wall_inset_long = (wall_inset_long_n + wall_inset_long_s) / 2.0
    else:
        wall_inset_trans = (span_y - house_trans_u) / 2.0
        wall_inset_long_n = -eave_xw
        wall_inset_long_s = eave_xe - house_long_u
        wall_inset_long = (wall_inset_long_n + wall_inset_long_s) / 2.0
    # wall_top_above_eave is now DERIVED (see roof_geometry). Kept on the
    # roof dict by derive_for_house; fall back to legacy framing key.
    wall_top_above_eave_ft = roof.get(
        'wall_top_above_eave_ft',
        framing.get('wall_top_above_eave_ft', 1.333))
    wall_top_u = wall_top_above_eave_ft * 10.0
    # Central ridge beam depth (vertical dimension). The truss sits BELOW the
    # ridge — its peak meets the ridge beam's bottom face, not the roof peak.
    ridge_depth_u = ridge_size_in[1] / IN_PER_UNIT
    ridge_width_u = ridge_size_in[0] / IN_PER_UNIT
    # Effective truss geometry (bottom chord sits on ring beam at wall top,
    # peak sits at ridge_beam_bottom = h − ridge_depth):
    truss_effective_span_u = house_trans_u          # 27 ft in world units
    truss_effective_rise_u = h - wall_top_u - ridge_depth_u

    # ---------- Fink trusses on the ring beam ----------
    # Truss config now lives directly on the hip_roof (trusses are part of
    # the roof structure). Fall back to legacy `framing.truss` for
    # backward compat during migration.
    truss_cfg = roof.get('trusses') or framing.get('truss', {})
    truss_count = int(truss_cfg.get('count', len(truss_cfg.get('positions', []))))
    if truss_count > 0 and truss_effective_rise_u > 0:
        _panel_ratio = truss_cfg.get('panel_ratio_bottom', 0.25)
        # Per-truss member lengths — using the WALL-level span and
        # ridge-height-above-wall-top rise.
        _tspan = truss_effective_span_u
        _trise = truss_effective_rise_u
        truss_top_chord_len = math.sqrt((_tspan / 2.0) ** 2 + _trise ** 2)
        truss_bottom_chord_len = _tspan
        truss_king_post_len = _trise
        _dx = _tspan * (0.5 - _panel_ratio)
        truss_diag_len = math.sqrt(_dx ** 2 + _trise ** 2)
        truss_vert_len = _trise / 2.0
        truss_chord_total_each = 2 * truss_top_chord_len + truss_bottom_chord_len
        truss_web_total_each = (truss_king_post_len + 2 * truss_diag_len +
                                2 * truss_vert_len)
    else:
        truss_top_chord_len = 0.0
        truss_bottom_chord_len = 0.0
        truss_king_post_len = 0.0
        truss_diag_len = 0.0
        truss_vert_len = 0.0
        truss_chord_total_each = 0.0
        truss_web_total_each = 0.0

    # Truss positions along the ridge. Config `positions` may be a list of
    # either named strings ('n_ridge_end', 'ridge_center', 's_ridge_end')
    # or absolute world-Y (or world-X) coords — the numeric form lets us
    # align trusses with pillar rows independently of the ridge geometry.
    truss_positions_cfg = truss_cfg.get('positions', [])
    if ridge_axis == 'y':
        _n_ridge_end = eave_yn + d_hip_n
        _s_ridge_end = eave_ys - d_hip_s
    else:
        _n_ridge_end = eave_xw + d_hip_w
        _s_ridge_end = eave_xe - d_hip_e
    _ridge_center = (_n_ridge_end + _s_ridge_end) / 2.0
    _pos_map = {
        'n_ridge_end': _n_ridge_end,
        'ridge_center': _ridge_center,
        's_ridge_end': _s_ridge_end,
    }

    def _resolve_pos(p):
        if isinstance(p, (int, float)):
            return float(p)
        return _pos_map.get(p, _ridge_center)

    if truss_positions_cfg and len(truss_positions_cfg) == truss_count:
        truss_y_positions = [_resolve_pos(p) for p in truss_positions_cfg]
    else:
        # Fallback: even spacing across the ridge
        if truss_count > 1:
            _step = ridge_length / (truss_count - 1)
            truss_y_positions = [_n_ridge_end + i * _step for i in range(truss_count)]
        elif truss_count == 1:
            truss_y_positions = [_ridge_center]
        else:
            truss_y_positions = []

    # ---------- Ring beam (rectangular frame at wall level) ----------
    # Rectangular perimeter tie beam sitting on top of the walls. Aligns to
    # the house footprint (27' × 45') inset from the eave outline.
    ring_beam_cfg = framing.get('ring_beam', {})
    ring_beam_size = ring_beam_cfg.get('size_in', [4, 2])
    ring_beam_wall = ring_beam_cfg.get('wall_mm', 3)
    # Perimeter of the ring beam (world units)
    ring_beam_total = 2 * (house_trans_u + house_long_u)

    # ---------- Hip-end beams ----------
    # 3 beams at each hip end running longitudinally from the corresponding
    # corner truss down to the N (or S) wall of the ring frame. Length =
    # distance from ridge endpoint (truss position) to the wall inset.
    hip_beam_cfg = framing.get('hip_end_beam', {})
    hip_beam_count_per_end = int(hip_beam_cfg.get('count_per_end', 3))
    hip_beam_size = hip_beam_cfg.get('size_in', [4, 2])
    hip_beam_wall = hip_beam_cfg.get('wall_mm', 2)
    hip_beam_between_trusses = bool(
        hip_beam_cfg.get('extend_between_trusses', False))
    # Sum of ridge-zone bay lengths (T1→T2, T2→T3, …) — only used when
    # `extend_between_trusses` is on; the same `count_per_end` beams are
    # replicated at each bx position across every gap.
    hip_beam_bay_total_len = 0.0
    hip_beam_bay_count = 0
    if truss_count >= 2 and ridge_axis == 'y':
        # Distance from N corner truss (T1) to N wall of ring frame
        _n_wall_y = eave_yn + wall_inset_long_n
        _s_wall_y = eave_ys - wall_inset_long_s
        _t1_y = truss_y_positions[0]
        _tN_y = truss_y_positions[-1]
        hip_beam_n_len = abs(_t1_y - _n_wall_y)   # ridge-endpoint down to N wall
        hip_beam_s_len = abs(_tN_y - _s_wall_y)
        hip_beam_avg_len = (hip_beam_n_len + hip_beam_s_len) / 2.0
        if hip_beam_between_trusses:
            _bay_span = sum(abs(truss_y_positions[j + 1] - truss_y_positions[j])
                            for j in range(len(truss_y_positions) - 1))
            hip_beam_bay_total_len = _bay_span * hip_beam_count_per_end
            hip_beam_bay_count = (len(truss_y_positions) - 1) * hip_beam_count_per_end
    elif truss_count >= 2:  # ridge_axis == 'x'
        _w_wall_x = eave_xw + wall_inset_long_n
        _e_wall_x = eave_xe - wall_inset_long_s
        _t1_x = truss_y_positions[0]
        _tN_x = truss_y_positions[-1]
        hip_beam_n_len = abs(_t1_x - _w_wall_x)
        hip_beam_s_len = abs(_tN_x - _e_wall_x)
        hip_beam_avg_len = (hip_beam_n_len + hip_beam_s_len) / 2.0
        if hip_beam_between_trusses:
            _bay_span = sum(abs(truss_y_positions[j + 1] - truss_y_positions[j])
                            for j in range(len(truss_y_positions) - 1))
            hip_beam_bay_total_len = _bay_span * hip_beam_count_per_end
            hip_beam_bay_count = (len(truss_y_positions) - 1) * hip_beam_count_per_end
    else:
        hip_beam_n_len = 0.0
        hip_beam_s_len = 0.0
        hip_beam_avg_len = 0.0
    # Total hip beam material = both ends × count-per-end × individual length,
    # plus the between-truss bays if that flag is on.
    hip_beam_total_len = ((hip_beam_n_len + hip_beam_s_len) * hip_beam_count_per_end
                         + hip_beam_bay_total_len)
    hip_beam_total_count = 2 * hip_beam_count_per_end + hip_beam_bay_count

    # ---- Longitudinal-truss compatibility stubs ----
    # The longitudinal truss concept was replaced by the ring beam + hip
    # beams. Set stubs so pre-existing code paths that check
    # `long_truss_count > 0` skip cleanly.
    long_truss_cfg = {}
    long_truss_count = 0
    long_truss_positions = []
    long_bottom_chord_len = 0.0
    long_top_chord_len = 0.0
    long_side_chord_len = 0.0
    long_kingpost_len = 0.0
    long_ridge_end_vert_len = 0.0
    long_diag_len = 0.0
    long_diag_count_per_truss = 0
    long_chord_total_each = 0.0
    long_web_total_each = 0.0

    # ---------- Fink truss elevation detail panel ----------
    def truss_elevation_panel(x0, y0):
        panel_full_w = canvas_w - 2 * outer_pad
        title_h = 40
        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{truss_panel_h}" fill="#ffffff" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{title_h}" fill="#f2f2f2" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<text x="{x0 + panel_full_w / 2}" y="{y0 + title_h - 12}" '
              f'text-anchor="middle" font-size="18" font-weight="600" fill="#222">'
              f'FINK TRUSS ELEVATION — bottom chord on ring beam '
              f'(× {truss_count} identical trusses)</text>\n')

        if truss_count == 0:
            s += (f'<text x="{x0 + panel_full_w / 2}" y="{y0 + truss_panel_h / 2}" '
                  f'text-anchor="middle" font-size="14" fill="#666">'
                  f'(no trusses configured)</text>\n')
            return s

        # ---- Helper: draw ONE Fink truss elevation ----
        chord_stroke = '#8b0000'
        web_stroke   = '#c25050'
        blue         = '#0066cc'

        def _draw_fink(origin_x, origin_y, ft_scale, chord_w, web_w,
                       show_dims, label, span_ft=None, rise_ft=None):
            """Draw one Fink truss at (origin_x, origin_y) = bottom-left of
            bottom chord, scaled by ft_scale (px per foot). Returns the SVG
            string fragment. If span_ft/rise_ft omitted, uses the configured
            truss geometry (bottom-chord and king-post lengths)."""
            def _P(fx, fy):
                return (origin_x + fx * ft_scale, origin_y - fy * ft_scale)
            base_ft_ = span_ft if span_ft is not None else (truss_bottom_chord_len * 1.2 / 12.0)
            h_ft_    = rise_ft if rise_ft is not None else (truss_king_post_len * 1.2 / 12.0)
            B0 = _P(0, 0)
            B1 = _P(base_ft_ * 0.25, 0)
            B2 = _P(base_ft_ * 0.5, 0)
            B3 = _P(base_ft_ * 0.75, 0)
            B4 = _P(base_ft_, 0)
            T1 = _P(base_ft_ * 0.25, h_ft_ * 0.5)
            Tpk = _P(base_ft_ * 0.5, h_ft_)
            T3 = _P(base_ft_ * 0.75, h_ft_ * 0.5)
            out = ''
            # Chords
            out += (f'<line x1="{B0[0]:.1f}" y1="{B0[1]:.1f}" x2="{Tpk[0]:.1f}" y2="{Tpk[1]:.1f}" '
                    f'stroke="{chord_stroke}" stroke-width="{chord_w}"/>\n')
            out += (f'<line x1="{Tpk[0]:.1f}" y1="{Tpk[1]:.1f}" x2="{B4[0]:.1f}" y2="{B4[1]:.1f}" '
                    f'stroke="{chord_stroke}" stroke-width="{chord_w}"/>\n')
            out += (f'<line x1="{B0[0]:.1f}" y1="{B0[1]:.1f}" x2="{B4[0]:.1f}" y2="{B4[1]:.1f}" '
                    f'stroke="{chord_stroke}" stroke-width="{chord_w}"/>\n')
            # King post
            out += (f'<line x1="{Tpk[0]:.1f}" y1="{Tpk[1]:.1f}" x2="{B2[0]:.1f}" y2="{B2[1]:.1f}" '
                    f'stroke="{web_stroke}" stroke-width="{web_w}"/>\n')
            # W diagonals from peak
            out += (f'<line x1="{Tpk[0]:.1f}" y1="{Tpk[1]:.1f}" x2="{B1[0]:.1f}" y2="{B1[1]:.1f}" '
                    f'stroke="{web_stroke}" stroke-width="{web_w}"/>\n')
            out += (f'<line x1="{Tpk[0]:.1f}" y1="{Tpk[1]:.1f}" x2="{B3[0]:.1f}" y2="{B3[1]:.1f}" '
                    f'stroke="{web_stroke}" stroke-width="{web_w}"/>\n')
            # Verticals from top-chord midpoints
            out += (f'<line x1="{T1[0]:.1f}" y1="{T1[1]:.1f}" x2="{B1[0]:.1f}" y2="{B1[1]:.1f}" '
                    f'stroke="{web_stroke}" stroke-width="{web_w}"/>\n')
            out += (f'<line x1="{T3[0]:.1f}" y1="{T3[1]:.1f}" x2="{B3[0]:.1f}" y2="{B3[1]:.1f}" '
                    f'stroke="{web_stroke}" stroke-width="{web_w}"/>\n')
            # Joint dots
            dot_r = max(chord_w * 0.9, 2.0)
            for p in (B0, B1, B2, B3, B4, T1, Tpk, T3):
                out += (f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="{dot_r:.1f}" '
                        f'fill="{chord_stroke}"/>\n')
            # Label centred below the bottom chord
            if label:
                out += (f'<text x="{(B0[0]+B4[0])/2:.1f}" y="{B0[1] + 18:.1f}" '
                        f'text-anchor="middle" font-size="12" font-weight="700" '
                        f'fill="{chord_stroke}">{label}</text>\n')
            if show_dims:
                # Bottom chord dim
                dim_y = B0[1] + 40
                out += (f'<line x1="{B0[0]:.1f}" y1="{dim_y:.1f}" x2="{B4[0]:.1f}" y2="{dim_y:.1f}" '
                        f'stroke="{blue}" stroke-width="1" '
                        f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                out += (f'<text x="{(B0[0]+B4[0])/2:.1f}" y="{dim_y - 6:.1f}" '
                        f'text-anchor="middle" font-size="12" fill="{blue}">'
                        f'Bottom chord = {dim_text(truss_bottom_chord_len)}</text>\n')
                # Peak height dim
                out += (f'<line x1="{Tpk[0] - 30:.1f}" y1="{Tpk[1]:.1f}" '
                        f'x2="{Tpk[0] - 30:.1f}" y2="{B2[1]:.1f}" '
                        f'stroke="{blue}" stroke-width="1" '
                        f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                out += (f'<text x="{Tpk[0] - 36:.1f}" y="{(Tpk[1]+B2[1])/2 + 4:.1f}" '
                        f'text-anchor="end" font-size="11" fill="{blue}">'
                        f'h = {dim_text(truss_king_post_len)}</text>\n')
                # Top chord dim (near left top chord)
                tc_mid_x = (B0[0] + Tpk[0]) / 2
                tc_mid_y = (B0[1] + Tpk[1]) / 2
                out += (f'<text x="{tc_mid_x - 20:.1f}" y="{tc_mid_y - 8:.1f}" '
                        f'text-anchor="middle" font-size="12" fill="{chord_stroke}" '
                        f'font-weight="600">'
                        f'Top chord {dim_text(truss_top_chord_len)}</text>\n')
                # King post length label
                out += (f'<text x="{Tpk[0] + 10:.1f}" y="{(Tpk[1]+B2[1])/2 + 4:.1f}" '
                        f'text-anchor="start" font-size="11" fill="{web_stroke}">'
                        f'King post {dim_text(truss_king_post_len)}</text>\n')
                # Diagonal length label
                out += (f'<text x="{(B1[0]+Tpk[0])/2 - 8:.1f}" y="{(B1[1]+Tpk[1])/2 + 4:.1f}" '
                        f'text-anchor="end" font-size="10" fill="{web_stroke}">'
                        f'diag {dim_text(truss_diag_len)}</text>\n')
                # Vertical (top-chord midpoint) length label
                out += (f'<text x="{T1[0] + 6:.1f}" y="{(T1[1]+B1[1])/2 + 4:.1f}" '
                        f'text-anchor="start" font-size="10" fill="{web_stroke}">'
                        f'vert {dim_text(truss_vert_len)}</text>\n')
                # Pitch angle
                out += (f'<text x="{B0[0] + 25:.1f}" y="{B0[1] - 6:.1f}" '
                        f'text-anchor="start" font-size="11" fill="#444">'
                        f'{slope_ew:.0f}°</text>\n')
            return out

        # ---- Helper: draw ONE trapezoidal Howe truss ----
        long_stroke = '#005a55'
        long_web_stroke = '#3a8a83'

        def _draw_trapezoid(origin_x, origin_y, ft_scale,
                            base_ft, top_ft, h_ft, chord_w, web_w, show_dims):
            """Draw a trapezoidal Howe truss with king post, ridge-end
            verticals, and Warren-style interior diagonals. origin at
            bottom-left of bottom chord."""
            def _P(fx, fy):
                return (origin_x + fx * ft_scale, origin_y - fy * ft_scale)
            top_start_ft = (base_ft - top_ft) / 2.0
            top_end_ft = top_start_ft + top_ft
            BL  = _P(0, 0)
            BR  = _P(base_ft, 0)
            TL  = _P(top_start_ft, h_ft)
            TR  = _P(top_end_ft, h_ft)
            CX  = _P(base_ft / 2, 0)
            KPT = _P(base_ft / 2, h_ft)
            # Below-ridge-end points on the bottom chord (helps Warren layout)
            BL_TL = _P(top_start_ft, 0)
            BR_TR = _P(top_end_ft, 0)
            # Midpoints for Warren diagonals in the middle rectangular portion
            ML_BOT = _P((top_start_ft + base_ft / 2) / 2, 0)
            MR_BOT = _P((top_end_ft + base_ft / 2) / 2, 0)
            # Midpoints between BL and BL_TL (for outer Warren)
            OL_BOT = _P(top_start_ft / 2, 0)
            OR_BOT = _P((top_end_ft + base_ft) / 2, 0)
            out = ''
            # Chords
            # Bottom
            out += (f'<line x1="{BL[0]:.1f}" y1="{BL[1]:.1f}" x2="{BR[0]:.1f}" y2="{BR[1]:.1f}" '
                    f'stroke="{long_stroke}" stroke-width="{chord_w}"/>\n')
            # Top (horizontal ridge)
            out += (f'<line x1="{TL[0]:.1f}" y1="{TL[1]:.1f}" x2="{TR[0]:.1f}" y2="{TR[1]:.1f}" '
                    f'stroke="{long_stroke}" stroke-width="{chord_w}"/>\n')
            # Left sloping chord
            out += (f'<line x1="{BL[0]:.1f}" y1="{BL[1]:.1f}" x2="{TL[0]:.1f}" y2="{TL[1]:.1f}" '
                    f'stroke="{long_stroke}" stroke-width="{chord_w}"/>\n')
            # Right sloping chord
            out += (f'<line x1="{BR[0]:.1f}" y1="{BR[1]:.1f}" x2="{TR[0]:.1f}" y2="{TR[1]:.1f}" '
                    f'stroke="{long_stroke}" stroke-width="{chord_w}"/>\n')
            # King post
            out += (f'<line x1="{KPT[0]:.1f}" y1="{KPT[1]:.1f}" x2="{CX[0]:.1f}" y2="{CX[1]:.1f}" '
                    f'stroke="{long_web_stroke}" stroke-width="{web_w}"/>\n')
            # Ridge-endpoint verticals (TL, TR → bottom chord)
            out += (f'<line x1="{TL[0]:.1f}" y1="{TL[1]:.1f}" x2="{BL_TL[0]:.1f}" y2="{BL_TL[1]:.1f}" '
                    f'stroke="{long_web_stroke}" stroke-width="{web_w}"/>\n')
            out += (f'<line x1="{TR[0]:.1f}" y1="{TR[1]:.1f}" x2="{BR_TR[0]:.1f}" y2="{BR_TR[1]:.1f}" '
                    f'stroke="{long_web_stroke}" stroke-width="{web_w}"/>\n')
            # Interior Warren diagonals
            # Middle rectangle: TL → ML_BOT, KPT → BL_TL (left half); mirror right half
            out += (f'<line x1="{TL[0]:.1f}" y1="{TL[1]:.1f}" x2="{ML_BOT[0]:.1f}" y2="{ML_BOT[1]:.1f}" '
                    f'stroke="{long_web_stroke}" stroke-width="{web_w}"/>\n')
            out += (f'<line x1="{KPT[0]:.1f}" y1="{KPT[1]:.1f}" x2="{ML_BOT[0]:.1f}" y2="{ML_BOT[1]:.1f}" '
                    f'stroke="{long_web_stroke}" stroke-width="{web_w}"/>\n')
            out += (f'<line x1="{TR[0]:.1f}" y1="{TR[1]:.1f}" x2="{MR_BOT[0]:.1f}" y2="{MR_BOT[1]:.1f}" '
                    f'stroke="{long_web_stroke}" stroke-width="{web_w}"/>\n')
            out += (f'<line x1="{KPT[0]:.1f}" y1="{KPT[1]:.1f}" x2="{MR_BOT[0]:.1f}" y2="{MR_BOT[1]:.1f}" '
                    f'stroke="{long_web_stroke}" stroke-width="{web_w}"/>\n')
            # Panel-point dots
            for p in (BL, BR, TL, TR, KPT, CX, ML_BOT, MR_BOT, BL_TL, BR_TR):
                out += (f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="2.4" '
                        f'fill="{long_stroke}"/>\n')
            if show_dims:
                blue = '#0066cc'
                # Bottom chord dim
                dim_y = BL[1] + 40
                out += (f'<line x1="{BL[0]:.1f}" y1="{dim_y:.1f}" x2="{BR[0]:.1f}" y2="{dim_y:.1f}" '
                        f'stroke="{blue}" stroke-width="1" '
                        f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                out += (f'<text x="{(BL[0]+BR[0])/2:.1f}" y="{dim_y - 6:.1f}" '
                        f'text-anchor="middle" font-size="12" fill="{blue}">'
                        f'Bottom = {dim_text(long_bottom_chord_len)}</text>\n')
                # Top chord dim (ridge)
                dim_y_top = TL[1] - 22
                out += (f'<line x1="{TL[0]:.1f}" y1="{dim_y_top:.1f}" x2="{TR[0]:.1f}" y2="{dim_y_top:.1f}" '
                        f'stroke="{blue}" stroke-width="1" '
                        f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                out += (f'<text x="{(TL[0]+TR[0])/2:.1f}" y="{dim_y_top - 4:.1f}" '
                        f'text-anchor="middle" font-size="11" fill="{blue}">'
                        f'ridge = {dim_text(long_top_chord_len)}</text>\n')
                # Sloping chord label (LEFT)
                sc_mid_x = (BL[0] + TL[0]) / 2
                sc_mid_y = (BL[1] + TL[1]) / 2
                out += (f'<text x="{sc_mid_x - 8:.1f}" y="{sc_mid_y - 6:.1f}" '
                        f'text-anchor="middle" font-size="11" fill="{long_stroke}" '
                        f'font-weight="600">'
                        f'slope {dim_text(long_side_chord_len)}</text>\n')
                # King post
                out += (f'<text x="{KPT[0] + 6:.1f}" y="{(KPT[1]+CX[1])/2 + 4:.1f}" '
                        f'text-anchor="start" font-size="11" fill="{long_web_stroke}">'
                        f'king h = {dim_text(long_kingpost_len)}</text>\n')
                # Diagonal
                out += (f'<text x="{(TL[0]+ML_BOT[0])/2 - 6:.1f}" '
                        f'y="{(TL[1]+ML_BOT[1])/2 + 4:.1f}" '
                        f'text-anchor="end" font-size="10" fill="{long_web_stroke}">'
                        f'diag {dim_text(long_diag_len)}</text>\n')
            return out

        # ---- Single detailed Fink truss elevation ----
        inner_pad = 30
        avail_w = panel_full_w - 2 * inner_pad - 320   # reserve right column for BOM
        avail_h = truss_panel_h - title_h - 80
        base_ft = truss_bottom_chord_len * 1.2 / 12.0        # 27' 0"
        h_ft = truss_king_post_len * 1.2 / 12.0              # 7' 0"
        scale = min(avail_w / (base_ft + 4), avail_h / (h_ft + 3))
        origin_x = x0 + inner_pad + (avail_w - base_ft * scale) / 2
        origin_y = y0 + title_h + 40 + h_ft * scale
        # Section title
        s += (f'<text x="{origin_x + (base_ft * scale) / 2:.1f}" '
              f'y="{y0 + title_h + 18:.1f}" '
              f'text-anchor="middle" font-size="13" font-weight="600" fill="#8b0000">'
              f'FINK TRUSS × {truss_count} — transverse, spans '
              f'{dim_text(truss_bottom_chord_len)} × rise {dim_text(truss_king_post_len)}</text>\n')
        # Draw Fink truss (using our helper); need to override the base_ft/h_ft
        # references since _draw_fink uses span_x/h — refactor to accept them.
        s += _draw_fink(origin_x, origin_y, scale,
                        chord_w=3.0, web_w=1.8, show_dims=True,
                        label=None, span_ft=base_ft, rise_ft=h_ft)

        # BOM callout (right side) — Fink truss + ring beam + hip beams
        bom_x = x0 + panel_full_w - 290
        bom_y = y0 + title_h + 20
        line_h = 16
        tc_sz = truss_cfg.get('chord_size_in', [2, 4])
        tc_wall = truss_cfg.get('chord_wall_mm', 3)
        tw_sz = truss_cfg.get('web_size_in', [2, 2])
        tw_wall = truss_cfg.get('web_wall_mm', 2)
        bom_lines = [
            (f'FINK TRUSS × {truss_count} (identical)',
             '#8b0000', True),
            (f'Chord ({tc_sz[0]}"×{tc_sz[1]}"×{tc_wall} mm) each: '
             f'{dim_text(truss_chord_total_each)}', '#333', False),
            (f'Web ({tw_sz[0]}"×{tw_sz[1]}"×{tw_wall} mm) each: '
             f'{dim_text(truss_web_total_each)}', '#333', False),
            ('', '#333', False),
            (f'Total for {truss_count} trusses:', '#8b0000', True),
            (f'Chord total: {dim_text(truss_count * truss_chord_total_each)}', '#333', False),
            (f'Web total: {dim_text(truss_count * truss_web_total_each)}', '#333', False),
            ('', '#333', False),
            (f'RING BEAM ({house_ft[0]:.0f}\'×{house_ft[1]:.0f}\')',
             '#1e5aa6', True),
            (f'{ring_beam_size[0]}"×{ring_beam_size[1]}"×{ring_beam_wall} mm '
             f'perimeter: {dim_text(ring_beam_total)}', '#333', False),
            ('', '#333', False),
            (f'HIP-END BEAMS × {hip_beam_total_count}',
             '#8a4a1a', True),
            (f'{hip_beam_size[0]}"×{hip_beam_size[1]}"×{hip_beam_wall} mm total: '
             f'{dim_text(hip_beam_total_len)}', '#333', False),
        ]
        for i, (text, colour, bold) in enumerate(bom_lines):
            weight = ' font-weight="600"' if bold else ''
            s += (f'<text x="{bom_x}" y="{bom_y + i * line_h}" font-size="11" '
                  f'fill="{colour}"{weight}>{text}</text>\n')

        return s

    # ---------- Materials takeoff panel ----------
    def materials_takeoff_panel(x0, y0):
        panel_full_w = canvas_w - 2 * outer_pad
        title_h = 40
        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{materials_panel_h}" fill="#ffffff" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{title_h}" fill="#f2f2f2" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<text x="{x0 + panel_full_w / 2}" y="{y0 + title_h - 12}" '
              f'text-anchor="middle" font-size="18" font-weight="600" fill="#222">'
              f'MATERIALS TAKEOFF — Verification of Quantities</text>\n')

        # ------ Table ------
        table_y = y0 + title_h + 30
        row_h = 24
        # Column x offsets from x0
        col_x = {
            'member': 40,
            'section': 260,
            'count': 470,
            'total': 620,
            'max': 780,
            'notes': 920,
        }

        # Header row
        s += (f'<line x1="{x0 + 30}" y1="{table_y}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{table_y}" '
              f'stroke="#333" stroke-width="1"/>\n')
        header_y = table_y + 18
        headers = [
            ('Member', col_x['member']),
            ('HSS section × wall', col_x['section']),
            ('Pieces', col_x['count']),
            ('Total linear', col_x['total']),
            ('Max piece', col_x['max']),
            ('Notes', col_x['notes']),
        ]
        for label, cx in headers:
            s += (f'<text x="{x0 + cx}" y="{header_y}" font-size="12" '
                  f'font-weight="600" fill="#222">{label}</text>\n')
        s += (f'<line x1="{x0 + 30}" y1="{table_y + row_h}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{table_y + row_h}" '
              f'stroke="#333" stroke-width="1"/>\n')

        def _sect(size, wall):
            return f'{size[0]}"×{size[1]}"×{wall}mm'
        rows = [
            ('Rafter', _sect(rafter_size_in, rafter_wall_mm),
             f'{totals["rafter_count"]}',
             f'{dim_text(totals["rafter_total"])}',
             f'{dim_text(totals["rafter_max"])}',
             f'@ {rafter_spacing_in}" OC, sum of individual lengths'),
            ('Purlin', _sect(purlin_size_in, purlin_wall_mm),
             f'{totals["purlin_count"]}',
             f'{dim_text(totals["purlin_total"])}',
             f'{dim_text(totals["purlin_max"])}',
             f'@ {purlin_spacing_in}" OC, sum of individual lengths'),
            ('Central ridge', _sect(ridge_size_in, ridge_wall_mm),
             '1',
             f'{dim_text(central_ridge_total)}',
             f'{dim_text(central_ridge_total)}',
             'Top ridge = configured ridge_length'),
            ('Hip ridges (N)', _sect(ridge_size_in, ridge_wall_mm),
             '2',
             f'{dim_text(2 * hip_slant_n_val)}',
             f'{dim_text(hip_slant_n_val)}',
             '2 diagonals from N ridge endpoint to N eave corners'),
            ('Hip ridges (S)', _sect(ridge_size_in, ridge_wall_mm),
             '2',
             f'{dim_text(2 * hip_slant_s_val)}',
             f'{dim_text(hip_slant_s_val)}',
             '2 diagonals from S ridge endpoint to S eave corners'),
        ]

        # ---- Eave assembly members (Pani Patti + L-channel + optional) ----
        # All follow the eave perimeter (hip roof, no free edges).
        pp_cfg = framing.get('pani_patti', {})
        pp_h_in = pp_cfg.get('height_in', 6)
        pp_thk_mm = pp_cfg.get('thickness_mm', 1.2)
        L_ch_sz = framing.get('eave_L_channel_size_in', [1, 1])
        L_ch_wall = framing.get('eave_L_channel_wall_mm', 3)
        barge_sz = framing.get('barge_pipe_size_in', [3, 1])
        barge_wall = framing.get('barge_pipe_wall_mm', 1.6)
        ridge_ang_sz = framing.get('ridge_angle_size_in', [1, 1])
        ridge_ang_wall = framing.get('ridge_angle_wall_mm', 3)
        corner_ang_sz = framing.get('corner_double_angle_size_in', [1, 1])
        corner_ang_wall = framing.get('corner_double_angle_wall_mm', 3)
        rows += [
            ('Pani Patti', f'{pp_h_in:.0f}"×{pp_thk_mm} mm GI',
             '4',
             f'{dim_text(eave_perim_total)}',
             f'{dim_text(max(span_x, span_y))}',
             'Water-protector strip along entire eave perimeter'),
            ('Eave L-channel', _sect(L_ch_sz, L_ch_wall),
             '4',
             f'{dim_text(eave_perim_total)}',
             f'{dim_text(max(span_x, span_y))}',
             f'{L_ch_sz[0]}"×{L_ch_sz[1]}"×{L_ch_wall}mm angle on top of Pani Patti'),
            ('Barge pipe', _sect(barge_sz, barge_wall),
             '0',
             '0',
             '—',
             'N/A for hip roof (no free edges); include if adjacent to non-adjoining section'),
            ('Ridge angle', _sect(ridge_ang_sz, ridge_ang_wall),
             '—',
             '—',
             '—',
             'Only if roof width isn\'t a clean tile multiple (supports cut top tiles)'),
            ('Corner double angle', _sect(corner_ang_sz, corner_ang_wall),
             '4 × 2',
             f'{dim_text(2 * hip_ridges_total)}',
             f'{dim_text(hip_slant)}',
             'Doubled — 2 legs along each of the 4 hip ridges to support cut ceiling tiles'),
        ]

        # ---- Fink truss members (Section A-A shape) ----
        if truss_count > 0:
            tc_sz = truss_cfg.get('chord_size_in', [2, 4])
            tc_wall = truss_cfg.get('chord_wall_mm', 3)
            tw_sz = truss_cfg.get('web_size_in', [2, 2])
            tw_wall = truss_cfg.get('web_wall_mm', 2)
            rows += [
                ('Truss top chord', _sect(tc_sz, tc_wall),
                 f'{truss_count * 2}',
                 f'{dim_text(truss_count * 2 * truss_top_chord_len)}',
                 f'{dim_text(truss_top_chord_len)}',
                 f'Fink truss — 2 sloping top chords per truss × {truss_count} trusses'),
                ('Truss bottom chord', _sect(tc_sz, tc_wall),
                 f'{truss_count}',
                 f'{dim_text(truss_count * truss_bottom_chord_len)}',
                 f'{dim_text(truss_bottom_chord_len)}',
                 f'Horizontal tie beam × {truss_count} trusses'),
                ('Truss king post', _sect(tw_sz, tw_wall),
                 f'{truss_count}',
                 f'{dim_text(truss_count * truss_king_post_len)}',
                 f'{dim_text(truss_king_post_len)}',
                 'Central vertical post — peak to bottom-chord centre'),
                ('Truss web diagonals', _sect(tw_sz, tw_wall),
                 f'{truss_count * 2}',
                 f'{dim_text(truss_count * 2 * truss_diag_len)}',
                 f'{dim_text(truss_diag_len)}',
                 'Peak to bottom-chord panel points (2 per truss)'),
                ('Truss web verticals', _sect(tw_sz, tw_wall),
                 f'{truss_count * 2}',
                 f'{dim_text(truss_count * 2 * truss_vert_len)}',
                 f'{dim_text(truss_vert_len)}',
                 'Top-chord panel points to bottom-chord panel points (2 per truss)'),
            ]

        # ---- Ring beam (rectangular frame at wall level) ----
        rows += [
            ('Ring beam', _sect(ring_beam_size, ring_beam_wall),
             '4',
             f'{dim_text(ring_beam_total)}',
             f'{dim_text(max(house_trans_u, house_long_u))}',
             f'Perimeter tie at wall top ({house_ft[0]:.0f}\' × {house_ft[1]:.0f}\' frame, '
             f'{wall_top_above_eave_ft*12:.0f}" above eave)'),
        ]

        # ---- Hip-end beams ----
        if hip_beam_total_count > 0:
            _hb_note = f'{hip_beam_count_per_end} per hip end (× 2 ends) — corner truss to N/S wall'
            if hip_beam_between_trusses and hip_beam_bay_count > 0:
                _n_bays = len(truss_y_positions) - 1
                _hb_note += (f'; extended through {_n_bays} ridge-zone '
                             f'bay(s) — continuous N wall → S wall')
            rows += [
                ('Hip-end beam', _sect(hip_beam_size, hip_beam_wall),
                 f'{hip_beam_total_count}',
                 f'{dim_text(hip_beam_total_len)}',
                 f'{dim_text(max(hip_beam_n_len, hip_beam_s_len))}',
                 _hb_note),
            ]
        row_y = table_y + row_h + 18
        for row in rows:
            for (val, key) in zip(row, ['member', 'section', 'count', 'total', 'max', 'notes']):
                anchor = ''
                s += (f'<text x="{x0 + col_x[key]}" y="{row_y}" '
                      f'font-size="12" fill="#333"{anchor}>{val}</text>\n')
            row_y += row_h
        # Bottom border
        s += (f'<line x1="{x0 + 30}" y1="{row_y - 8}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{row_y - 8}" '
              f'stroke="#333" stroke-width="1"/>\n')

        # ------ Calculation description ------
        desc_y = row_y + 12
        s += (f'<text x="{x0 + 40}" y="{desc_y}" font-size="14" '
              f'font-weight="600" fill="#222">'
              f'How the quantities were computed</text>\n')
        desc_y += 22

        # Inputs
        line_gap = 15
        lines = []
        lines.append(('Inputs (from the config):', True))
        lines.append((f'  • Eave bounding box: {dim_text(span_x)} × {dim_text(span_y)} '
                      f'(perimeter {dim_text(eave_perim_total)})', False))
        lines.append((f'  • Main slope pitch: {slopes[0]["pitch"]:.1f}°   '
                      f'|   Hip-end pitch: {slopes[2]["pitch"]:.1f}°   '
                      f'|   Ridge height above eave h = {dim_text(h)}', False))
        lines.append((f'  • Rafter spacing: {rafter_spacing_in}"   '
                      f'|   Purlin spacing: {purlin_spacing_in}"', False))
        lines.append((f'  • Slope L (perpendicular height on the slope face): '
                      f'main = {dim_text(slopes[0]["perp_h"])}, '
                      f'hip end = {dim_text(slopes[2]["perp_h"])}', False))
        lines.append(('', False))
        lines.append(('Rafters — per slope, rafter count = floor(eave / spacing) + 1; each rafter\'s length',
                      False))
        lines.append(('is the perpendicular distance from its position on the eave up to either the top edge',
                      False))
        lines.append(('(central ridge, on the trapezoidal main slopes) or to a hip ridge (on the triangular',
                      False))
        lines.append(('hip ends, and near the corners of the main slopes).', False))
        for code in ['W', 'E', 'N', 'S']:
            q = slope_qty[code]
            lines.append((f'   {code} slope: {q["rafter_count"]} rafters, total '
                          f'{dim_text(q["rafter_total"])}  '
                          f'(longest {dim_text(q["rafter_max"])})', False))
        lines.append((f'   Total: {totals["rafter_count"]} rafters, {dim_text(totals["rafter_total"])}',
                      True))
        lines.append(('', False))
        lines.append(('Purlins — placed every {}" starting {}" above the eave (the y=0 row is the eave-edge'.format(purlin_spacing_in, purlin_spacing_in),
                      False))
        lines.append(('pipe, counted separately). At height y, each purlin spans between the two hip ridges:', False))
        lines.append(('L(y) = eave − 2·d_hip·y/height   (for the triangular hip ends, d_hip = eave/2).', False))
        for code in ['W', 'E', 'N', 'S']:
            q = slope_qty[code]
            lines.append((f'   {code} slope: {q["purlin_count"]} purlins, total '
                          f'{dim_text(q["purlin_total"])}  '
                          f'(longest {dim_text(q["purlin_max"])})', False))
        lines.append((f'   Total: {totals["purlin_count"]} purlins, {dim_text(totals["purlin_total"])}',
                      True))
        lines.append(('', False))
        lines.append((f'Central ridge — 1 piece, length = ridge_length = {dim_text(central_ridge_total)}.',
                      False))
        lines.append(('', False))
        lines.append(('Hip ridges — 4 pieces (one per corner). Each is the 3-D diagonal from a ridge',
                      False))
        lines.append(('endpoint to an eave corner:  L = √((eave_x_east−eave_x_west)/2)² + d_hip² + h²)', False))
        lines.append((f'   N pair: 2 × {dim_text(hip_slant_n_val)} = {dim_text(2 * hip_slant_n_val)}   '
                      f'|   S pair: 2 × {dim_text(hip_slant_s_val)} = {dim_text(2 * hip_slant_s_val)}   '
                      f'|   Total: {dim_text(hip_ridges_total)}',
                      True))
        lines.append(('', False))
        lines.append(('Eave edge — one continuous run around the eave bounding box:', False))
        lines.append((f'   2 × ({dim_text(span_x)} + {dim_text(span_y)}) = {dim_text(eave_perim_total)}',
                      True))

        for text, bold in lines:
            weight = ' font-weight="600"' if bold else ''
            s += (f'<text x="{x0 + 40}" y="{desc_y}" font-size="12" '
                  f'fill="#333"{weight}>{text}</text>\n')
            desc_y += line_gap

        return s

    # ---------- Consolidated procurement BOM ----------
    def consolidated_bom_panel(x0, y0):
        """Groups all frame members by (section spec) so total linear
        procurement for each unique HSS/GI/angle profile is visible at
        a glance. Same spec used by different members is summed."""
        panel_full_w = canvas_w - 2 * outer_pad
        title_h = 40
        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{consolidated_panel_h}" fill="#ffffff" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{title_h}" fill="#f2f2f2" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<text x="{x0 + panel_full_w / 2}" y="{y0 + title_h - 12}" '
              f'text-anchor="middle" font-size="18" font-weight="600" fill="#222">'
              f'CONSOLIDATED PROCUREMENT LIST — Totals by Material Spec</text>\n')

        # ---- Collect every frame member with its spec + qty + length ----
        pp_cfg = framing.get('pani_patti', {})
        pp_h_in = pp_cfg.get('height_in', 6)
        pp_thk_mm = pp_cfg.get('thickness_mm', 1.2)
        L_ch_sz = framing.get('eave_L_channel_size_in', [1, 1])
        L_ch_wall = framing.get('eave_L_channel_wall_mm', 3)
        corner_ang_sz = framing.get('corner_double_angle_size_in', [1, 1])
        corner_ang_wall = framing.get('corner_double_angle_wall_mm', 3)
        tc_sz = truss_cfg.get('chord_size_in', [2, 4]) if truss_count > 0 else None
        tc_wall = truss_cfg.get('chord_wall_mm', 3) if truss_count > 0 else None
        tw_sz = truss_cfg.get('web_size_in', [2, 2]) if truss_count > 0 else None
        tw_wall = truss_cfg.get('web_wall_mm', 2) if truss_count > 0 else None

        def _hss(size, wall):
            return f'HSS {size[0]}"×{size[1]}"×{wall} mm'
        def _gi(h_in, thk_mm):
            return f'GI strip {h_in:.0f}"×{thk_mm} mm'
        def _angle(size, wall):
            return f'L-angle {size[0]}"×{size[1]}"×{wall} mm'

        # Purlin section handling — width vs (size,wall) format may vary
        purlin_spec = _hss(purlin_size_in, purlin_wall_mm)

        # (spec, member_label, pieces, total_len)
        members = [
            (_hss(rafter_size_in, rafter_wall_mm), 'Rafters',
             totals['rafter_count'], totals['rafter_total']),
            (purlin_spec, 'Purlins',
             totals['purlin_count'], totals['purlin_total']),
            (_hss(ridge_size_in, ridge_wall_mm), 'Central ridge',
             1, central_ridge_total),
            (_hss(ridge_size_in, ridge_wall_mm), 'Hip ridges',
             4, hip_ridges_total),
            (_hss(ring_beam_size, ring_beam_wall), 'Ring beam',
             4, ring_beam_total),
        ]
        if hip_beam_total_count > 0:
            members.append((_hss(hip_beam_size, hip_beam_wall),
                            'Hip-end beams',
                            hip_beam_total_count, hip_beam_total_len))
        if truss_count > 0:
            members += [
                (_hss(tc_sz, tc_wall), 'Truss top chords',
                 truss_count * 2, truss_count * 2 * truss_top_chord_len),
                (_hss(tc_sz, tc_wall), 'Truss bottom chords',
                 truss_count, truss_count * truss_bottom_chord_len),
                (_hss(tw_sz, tw_wall), 'Truss king posts',
                 truss_count, truss_count * truss_king_post_len),
                (_hss(tw_sz, tw_wall), 'Truss web diagonals',
                 truss_count * 2, truss_count * 2 * truss_diag_len),
                (_hss(tw_sz, tw_wall), 'Truss web verticals',
                 truss_count * 2, truss_count * 2 * truss_vert_len),
            ]
        # Eave assembly (non-HSS)
        members += [
            (_gi(pp_h_in, pp_thk_mm), 'Pani Patti', 4, eave_perim_total),
            (_angle(L_ch_sz, L_ch_wall), 'Eave L-channel',
             4, eave_perim_total),
            (_angle(corner_ang_sz, corner_ang_wall),
             'Corner double angle (hips)',
             4 * 2, 2 * hip_ridges_total),
        ]

        # ---- Group by spec ----
        from collections import OrderedDict
        groups = OrderedDict()
        for spec, label, pcs, tot in members:
            g = groups.setdefault(
                spec, {'members': [], 'total_pcs': 0, 'total_len': 0.0})
            g['members'].append((label, pcs, tot))
            g['total_pcs'] += pcs
            g['total_len'] += tot

        # ---- Draw table ----
        table_y = y0 + title_h + 30
        row_h = 22
        col_x = {
            'spec': 40,
            'members': 350,
            'pieces': 900,
            'total': 1050,
        }
        s += (f'<line x1="{x0 + 30}" y1="{table_y}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{table_y}" '
              f'stroke="#333" stroke-width="1"/>\n')
        header_y = table_y + 18
        headers = [
            ('Material spec', col_x['spec']),
            ('Members using this spec', col_x['members']),
            ('Total pieces', col_x['pieces']),
            ('Total linear', col_x['total']),
        ]
        for label, cx in headers:
            s += (f'<text x="{x0 + cx}" y="{header_y}" font-size="12" '
                  f'font-weight="600" fill="#222">{label}</text>\n')
        s += (f'<line x1="{x0 + 30}" y1="{table_y + row_h}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{table_y + row_h}" '
              f'stroke="#333" stroke-width="1"/>\n')

        row_y = table_y + row_h + 16
        for spec, g in groups.items():
            mem_list = ', '.join(
                f'{lbl} ({pcs}× {dim_text(tot)})'
                for lbl, pcs, tot in g['members'])
            s += (f'<text x="{x0 + col_x["spec"]}" y="{row_y}" '
                  f'font-size="12" font-weight="600" fill="#222">{spec}</text>\n')
            s += (f'<text x="{x0 + col_x["members"]}" y="{row_y}" '
                  f'font-size="11" fill="#444">{mem_list}</text>\n')
            s += (f'<text x="{x0 + col_x["pieces"]}" y="{row_y}" '
                  f'font-size="12" fill="#333">{g["total_pcs"]}</text>\n')
            s += (f'<text x="{x0 + col_x["total"]}" y="{row_y}" '
                  f'font-size="12" font-weight="700" fill="#0a4">'
                  f'{dim_text(g["total_len"])}</text>\n')
            row_y += row_h
        s += (f'<line x1="{x0 + 30}" y1="{row_y - 8}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{row_y - 8}" '
              f'stroke="#333" stroke-width="1"/>\n')

        # ---- Grand totals per material family ----
        summary_y = row_y + 24
        s += (f'<text x="{x0 + 40}" y="{summary_y}" font-size="14" '
              f'font-weight="600" fill="#222">'
              f'Grand totals by material family</text>\n')
        summary_y += 20
        family_totals = {'HSS': 0.0, 'GI strip': 0.0, 'L-angle': 0.0}
        for spec, g in groups.items():
            for fam in family_totals:
                if spec.startswith(fam):
                    family_totals[fam] += g['total_len']
                    break
        for fam, tot in family_totals.items():
            s += (f'<text x="{x0 + 60}" y="{summary_y}" font-size="12" '
                  f'fill="#333">• {fam}: '
                  f'<tspan font-weight="700" fill="#0a4">{dim_text(tot)}</tspan></text>\n')
            summary_y += 18
        return s

    # ---------- Tile roofing panel ----------
    # Roof-surface area (per slope face) and actual procurement per Nuvocotto
    # Proforma Invoice #12 dated 27-Apr-2026.
    def slope_area_units2(sl):
        base = sl['base']
        top = sl['top']
        perp_h = sl['perp_h']
        if sl['is_tri']:
            return 0.5 * base * perp_h
        return 0.5 * (base + top) * perp_h

    slope_areas_sft = {sl['code']: slope_area_units2(sl) / 100.0 for sl in slopes}
    total_roof_area_sft = sum(slope_areas_sft.values())
    waste_pct = 0.10
    area_with_waste_sft = total_roof_area_sft * (1 + waste_pct)

    purlin_spacing_mm = purlin_spacing_in * 25.4

    # Procured items (per Proforma Invoice #12, 27-Apr-2026).
    # Coverage rates confirmed by Quote #92-2585 (15-Apr-2026):
    #   Indicotto 16×10 rooftile: 1.33 tiles/sft
    #   Ceiling Tile 12×8 (Nutical Plain): 1.5 tiles/sft
    #   Ridges: sold per running foot
    #   Semi glass tile 16×10: 1.33 tiles/sft
    procured = [
        {'name': 'Indicotto rooftile 16×10',            'qty': 4150, 'rate': 48.50,
         'unit': 'tiles', 'coverage': 1.33,
         'size': '406 × 254 mm', 'note': 'main pantile — 1.33 tiles/sft'},
        {'name': 'Ceiling Tile 12×8 (Nutical Plain)',   'qty': 4700, 'rate': 30.00,
         'unit': 'tiles', 'coverage': 1.5,
         'size': '305 × 203 mm', 'note': 'flat under-ceiling — 1.5 tiles/sft'},
        {'name': 'Ridge tiles',                          'qty': 100,  'rate': 70.00,
         'unit': 'run ft','coverage': 1.0,
         'size': 'per 1 running ft', 'note': 'central ridge + 4 hip diagonals'},
        {'name': 'Semi glass tile 16×10',                'qty': 12,   'rate': 220.00,
         'unit': 'tiles', 'coverage': 1.33,
         'size': '406 × 254 mm', 'note': 'specialty — small qty for details'},
    ]
    subtotal = sum(p['qty'] * p['rate'] for p in procured)
    delivery = 70000.0
    igst_rate = 0.12
    igst = round((subtotal + delivery) * igst_rate, 2)
    grand_total = subtotal + delivery + igst

    # Design cross-checks (using confirmed coverage rates)
    total_ridge_run_ft = (central_ridge_total + hip_ridges_total) / 10.0

    def need_for(coverage, waste=0.10):
        return int(round(area_with_waste_sft * coverage / (1 + waste_pct) * (1 + waste)))

    indicotto_need = int(round(total_roof_area_sft * 1.33 * 1.10))
    ceiling_need = int(round(total_roof_area_sft * 1.5 * 1.10))
    ridge_need = int(round(total_ridge_run_ft * 1.10))

    def delta_str(ordered, needed):
        d = ordered - needed
        pct = (d / needed * 100) if needed else 0
        if d >= 0:
            return f'+{d:,} (+{pct:.0f}% margin)', False
        return f'{d:,} ({pct:.0f}% SHORT)', True

    indicotto_delta, indicotto_short = delta_str(procured[0]['qty'], indicotto_need)
    ceiling_delta, ceiling_short = delta_str(procured[1]['qty'], ceiling_need)
    ridge_delta, ridge_short = delta_str(procured[2]['qty'], ridge_need)

    def tile_panel(x0, y0):
        panel_full_w = canvas_w - 2 * outer_pad
        title_h = 40
        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{tile_panel_h}" fill="#ffffff" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{panel_full_w}" '
              f'height="{title_h}" fill="#f2f2f2" stroke="#bbb" '
              f'stroke-width="1"/>\n')
        s += (f'<text x="{x0 + panel_full_w / 2}" y="{y0 + title_h - 12}" '
              f'text-anchor="middle" font-size="18" font-weight="600" fill="#222">'
              f'TILE ROOFING — Procured (Nuvocotto Invoice #12, 27-Apr-2026)</text>\n')

        # ---- Roof surface area breakdown (top left) ----
        area_x = x0 + 40
        area_y = y0 + title_h + 30
        s += (f'<text x="{area_x}" y="{area_y}" font-size="14" font-weight="600" '
              f'fill="#222">Roof surface area (measured on the slope face)</text>\n')
        area_y += 22
        # Formulas use live geometry — no hardcoded numbers.
        main_sl = slopes[0]  # W (or N for axis='x')
        hip_sl = slopes[2]   # N (or W for axis='x')
        area_lines = [
            (f'   Main slope (trapezoid): ½·({dim_text(main_sl["base"])} + '
             f'{dim_text(main_sl["top"])})·{dim_text(main_sl["perp_h"])} = '
             f'{slope_areas_sft[main_sl["code"]]:.0f} sft × 2 faces = '
             f'{slope_areas_sft[main_sl["code"]] * 2:.0f} sft'),
            (f'   Hip end   (triangle):  ½·{dim_text(hip_sl["base"])}·'
             f'{dim_text(hip_sl["perp_h"])} = '
             f'{slope_areas_sft[hip_sl["code"]]:.0f} sft × 2 faces = '
             f'{slope_areas_sft[hip_sl["code"]] * 2:.0f} sft'),
        ]
        for line in area_lines:
            s += (f'<text x="{area_x}" y="{area_y}" font-size="12" '
                  f'fill="#333">{line}</text>\n')
            area_y += 16
        area_y += 4
        s += (f'<text x="{area_x}" y="{area_y}" font-size="12" '
              f'font-weight="600" fill="#222">'
              f'   Total roof surface = {total_roof_area_sft:.0f} sft   '
              f'|   with {int(waste_pct * 100)}% waste allowance = '
              f'{area_with_waste_sft:.0f} sft</text>\n')

        # ---- Procured items table ----
        table_y = y0 + title_h + 200
        row_h = 22
        col_x = {
            'name': 40, 'size': 310, 'qty': 460, 'rate': 550,
            'amount': 660, 'note': 800,
        }
        s += (f'<text x="{x0 + col_x["name"]}" y="{table_y}" font-size="14" '
              f'font-weight="600" fill="#222">'
              f'Items procured — for the contractor to reconcile against site delivery</text>\n')
        table_y += 22
        s += (f'<line x1="{x0 + 30}" y1="{table_y}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{table_y}" '
              f'stroke="#333" stroke-width="1"/>\n')
        header_y = table_y + 16
        headers = [
            ('Item',            'name'),
            ('Tile size',       'size'),
            ('Qty (Nos)',       'qty'),
            ('Rate (₹)',        'rate'),
            ('Amount (₹)',      'amount'),
            ('Notes',           'note'),
        ]
        for label, key in headers:
            s += (f'<text x="{x0 + col_x[key]}" y="{header_y}" font-size="12" '
                  f'font-weight="600" fill="#222">{label}</text>\n')
        s += (f'<line x1="{x0 + 30}" y1="{table_y + row_h}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{table_y + row_h}" '
              f'stroke="#333" stroke-width="1"/>\n')

        row_y = table_y + row_h + 16
        for p in procured:
            amount = p['qty'] * p['rate']
            cells = [
                (p['name'],                     'name'),
                (p['size'],                     'size'),
                (f'{p["qty"]:,}',               'qty'),
                (f'{p["rate"]:.2f}',            'rate'),
                (f'{amount:,.2f}',              'amount'),
                (p['note'],                     'note'),
            ]
            for val, key in cells:
                s += (f'<text x="{x0 + col_x[key]}" y="{row_y}" font-size="12" '
                      f'fill="#333">{val}</text>\n')
            row_y += row_h

        # Totals footer
        s += (f'<line x1="{x0 + 30}" y1="{row_y - 6}" '
              f'x2="{x0 + panel_full_w - 30}" y2="{row_y - 6}" '
              f'stroke="#333" stroke-width="1"/>\n')
        row_y += 6
        totals_rows = [
            (f'Sub-total (8,962 items):',   f'{subtotal:,.2f}'),
            (f'Delivery charges:',           f'{delivery:,.2f}'),
            (f'IGST @ 12%:',                 f'{igst:,.2f}'),
            (f'GRAND TOTAL:',                f'{grand_total:,.2f}'),
        ]
        for label, amt in totals_rows:
            bold = 'font-weight="600"' if label.startswith('GRAND') else ''
            s += (f'<text x="{x0 + col_x["rate"]}" y="{row_y}" font-size="12" '
                  f'fill="#333" {bold}>{label}</text>\n')
            s += (f'<text x="{x0 + col_x["note"] - 30}" y="{row_y}" font-size="12" '
                  f'fill="#333" text-anchor="end" {bold}>₹ {amt}</text>\n')
            row_y += 18

        # ---- Design cross-check + notes ----
        note_y = row_y + 14
        s += (f'<text x="{x0 + 40}" y="{note_y}" font-size="14" font-weight="600" '
              f'fill="#222">Design cross-check &amp; contractor notes</text>\n')
        note_y += 20
        line_gap = 15

        # Explicit shortage figure (design need with 10% waste - ordered)
        ridge_short_ft = max(0, ridge_need - procured[2]['qty'])
        extra_ridge_cost = ridge_short_ft * procured[2]['rate']
        extra_ridge_total = extra_ridge_cost * (1 + igst_rate)

        # LEFT COLUMN — quantities and action items
        left_notes = [
            ('ASSUMPTIONS (per Quote #92-2585, 15-Apr-2026):', True),
            ('• Indicotto rooftile: 16" × 10" (406 × 254 mm), 1.33 tiles/sft.', False),
            ('  16" tile − 4" (100 mm) overlap = 12" purlin OC.', False),
            ('• Ceiling Tile 12×8 (Nutical Plain): 12" × 8" (305 × 203 mm),', False),
            ('  1.5 tiles/sft. 12" dim spans purlin-centre to purlin-centre.', False),
            ('• Ridge tiles: sold per 1 running foot of ridge.', False),
            ('', False),
            (f'• Indicotto: {total_roof_area_sft:.0f} sft × 1.33 × 10% waste = '
             f'{indicotto_need:,}. Ordered 4,150 → {indicotto_delta}.', indicotto_short),
            (f'• Ceiling: {total_roof_area_sft:.0f} sft × 1.5 × 10% waste = '
             f'{ceiling_need:,}. Ordered 4,700 → {ceiling_delta}.', ceiling_short),
            (f'• Ridge: {dim_text(central_ridge_total)} central + '
             f'4 × {dim_text(hip_slant)} hips = {total_ridge_run_ft:.0f} ft;',
             False),
            (f'   +10% waste = {ridge_need} ft. Ordered 100 ft → {ridge_delta}.', ridge_short),
            ('', False),
            (f'ACTION — order {ridge_short_ft} additional running feet of ridge cap:',
             True),
            (f'   {ridge_short_ft} × ₹{procured[2]["rate"]:.2f} = ₹{extra_ridge_cost:,.2f};  '
             f'with 12% IGST ≈ ₹{extra_ridge_total:,.2f}.', True),
            ('', False),
            ('• Order was originally sized for the earlier two-face gable design,',
             False),
            ('  which had a longer central ridge but no hip ridges. Moving to hip',
             False),
            ('  shortened the central ridge (55\'→15\') but added 4 hip ridges of', False),
            ('  ~26\' each. The 100 ft order is short by that delta.', False),
            (f'• Tile margins ({indicotto_delta}, {ceiling_delta}) also stem from the', False),
            ('  earlier larger gable surface. Confirm with contractor whether the', False),
            ('  surplus is for outbuildings or should be treated as excess.', False),
        ]

        # RIGHT COLUMN — framing verification and structural notes.
        # All frame elements are METAL PIPES. Nuvocotto's brochure lists
        # "Metal fabricated / concrete pitch roof" as the supported roof
        # type — the design uses that system.
        right_notes = [
            ('CONSTRUCTION DETAILS (per Santosh Roofing video):', True),
            ('• RIDGE: sealed with Top Flex UV tape, then ridge tiles laid without', False),
            ('  cement mortar — the sealed tape holds them and stays watertight.', False),
            ('• VALLEY: 3" gap held between the two tile fields (straight-line cut).', False),
            ('  Metal strip + cement seal the gap and channel water down; paint to match.', False),
            ('• BARGE: sealed with cement mortar for clean, waterproof edges.', False),
            ('• WALL JUNCTIONS: self-adhesive easy-flash ~5" up the wall and 5" onto', False),
            ('  the tile; silicone bead along the top edge of the flashing.', False),
            ('  Silicone at every gap around pipe penetrations.', False),
            ('• WATER CHANNELS: brackets sit in the gap above the Pani Patti, PVC', False),
            ('  channels drop into the brackets, downpipe carries water to ground.', False),
            ('', False),
            ('SITE RULES:', True),
            ('• NEVER step between two ceiling tiles — the tile has low strength on', False),
            ('  its own and will crack; step only where a purlin is underneath.', False),
            ('• Check every ceiling tile for cracks BEFORE the membrane goes on —', False),
            ('  a broken tile is hard to reach once membrane + top tile are down.', False),
            ('• Anchor bolts embedded 6–8" into footing; deeper footing = more stability.', False),
            ('• Column base plate welded onto the projecting rebar (2" projection)', False),
            ('  for a permanent, non-pull-out joint.', False),
            ('• Flood-test the whole roof at the end for leaks. Do NOT walk on wet', False),
            ('  tiles — they are extremely slippery when wet.', False),
            ('', False),
            (f'• Roof pitch: main slopes {slopes[0]["pitch"]:.1f}°, hip ends '
             f'{slopes[2]["pitch"]:.1f}° (both above 20° min).', False),
            ('• Hip-end pitch is shallow for Konkan monsoon intensity. Give flashing', False),
            ('  and underlay at the four hip ridges extra attention.', False),
        ]

        left_x = x0 + 40
        right_x = x0 + 40 + (canvas_w - 2 * outer_pad) / 2
        left_y = note_y
        right_y = note_y
        for text, bold in left_notes:
            weight = ' font-weight="600"' if bold else ''
            color = '#b00' if bold else '#333'
            s += (f'<text x="{left_x}" y="{left_y}" font-size="12" '
                  f'fill="{color}"{weight}>{text}</text>\n')
            left_y += line_gap
        for text, bold in right_notes:
            weight = ' font-weight="600"' if bold else ''
            color = '#b00' if bold else '#333'
            s += (f'<text x="{right_x}" y="{right_y}" font-size="12" '
                  f'fill="{color}"{weight}>{text}</text>\n')
            right_y += line_gap

        return s

    # ---------- Framing top view (roof plan showing rafters + purlins) ----------
    # Renders the four slope faces as clipped grids: rafters run perpendicular to
    # each eave, purlins run parallel to each eave. Hip ridges (diagonals) and
    # the central ridge are drawn on top as thick "spine" lines.
    def top_view_panel(x0, y0, w_p, h_p):
        title_h = 40
        inner_pad = 60
        label_col_w = 300         # right-side label column reserved from drawing area

        # Ridge endpoints and derived geometry in world coords
        eave_z_ref = roof.get('eave_z', 0)
        if ridge_axis == 'y':
            ridge_x_pos = (eave_xw + eave_xe) / 2.0
            r_y_start = eave_yn + d_hip_n
            r_y_end = eave_ys - d_hip_s
        else:
            ridge_y_pos = (eave_yn + eave_ys) / 2.0
            r_x_start = eave_xw + d_hip_w
            r_x_end = eave_xe - d_hip_e

        world_w = span_x
        world_h = span_y
        # Available drawing space (minus title, padding, and label column on right)
        avail_w = w_p - 2 * inner_pad - label_col_w
        avail_h = h_p - title_h - 2 * inner_pad
        s_scale = min(avail_w / world_w, avail_h / world_h) * 0.95
        # Centre the roof horizontally within the drawing area
        drawing_cx = x0 + inner_pad + avail_w / 2
        drawing_cy = y0 + title_h + inner_pad + avail_h / 2
        world_cx = (eave_xw + eave_xe) / 2.0
        world_cy = (eave_yn + eave_ys) / 2.0

        def T(wx, wy):
            return (drawing_cx + (wx - world_cx) * s_scale,
                    drawing_cy + (wy - world_cy) * s_scale)

        NW = T(eave_xw, eave_yn)
        NE = T(eave_xe, eave_yn)
        SE = T(eave_xe, eave_ys)
        SW = T(eave_xw, eave_ys)
        if ridge_axis == 'y':
            NR = T(ridge_x_pos, r_y_start)
            SR = T(ridge_x_pos, r_y_end)
        else:
            NR = T(r_x_start, ridge_y_pos)   # W ridge end
            SR = T(r_x_end, ridge_y_pos)     # E ridge end

        # Slope face polygons in svg-space for clipping
        if ridge_axis == 'y':
            faces = {
                'N': [NW, NE, NR],
                'S': [SW, SR, SE],
                'W': [NW, NR, SR, SW],
                'E': [NE, SE, SR, NR],
            }
        else:
            faces = {
                'W': [NW, NR, SW],
                'E': [NE, SE, SR],
                'N': [NW, NE, SR, NR],
                'S': [SW, NR, SR, SE],
            }

        # Unique clip-path id prefix so we can have multiple copies of this SVG
        # embedded on the same page without id collisions.
        cid = 'topfv'

        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{w_p}" height="{h_p}" '
              f'fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{w_p}" height="{title_h}" '
              f'fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n')
        s += (f'<text x="{x0 + w_p / 2}" y="{y0 + title_h - 13}" '
              f'text-anchor="middle" font-size="18" font-weight="600" fill="#222">'
              f'ROOF PLAN — Top View (framing layout)</text>\n')

        # Clip-paths for each face
        s += '<defs>\n'
        for code, poly in faces.items():
            pts = ' '.join(f'{px:.1f},{py:.1f}' for px, py in poly)
            s += f'<clipPath id="{cid}_{code}"><polygon points="{pts}"/></clipPath>\n'
        s += '</defs>\n'

        # Faint tint fill for slope faces so the drawing reads as roof surfaces
        for code, poly in faces.items():
            pts = ' '.join(f'{px:.1f},{py:.1f}' for px, py in poly)
            s += (f'<polygon points="{pts}" fill="#f8ecd8" fill-opacity="0.7" '
                  f'stroke="none"/>\n')

        # ---- Rafters (medium brown) — clipped per face ----
        # Stroke widths are DIMENSIONAL — each member is drawn at its actual
        # width in inches, so rafters read as 4" bands, purlins as 2", ridge
        # as 6", eave L-channel as 1" (all in the same s_scale as the roof).
        rafter_stroke = '#8B4513'
        # 1 world-unit = 1.2 inches (IN_PER_UNIT). Convert inches → world → px.
        def _in_to_px(inches):
            return (inches / IN_PER_UNIT) * s_scale
        rafter_w = max(_in_to_px(rafter_size_in[0]), 1.4)   # 4" wide face-down
        # First-offset and rafter spacing (same convention as compute_slope_qty)
        def rafter_positions(base_len):
            n_r = int(base_len / rafter_spacing_u) + 1
            gap = base_len - (n_r - 1) * rafter_spacing_u
            first_off = gap / 2.0 if gap > 0 else 0.0
            return [first_off + i * rafter_spacing_u for i in range(n_r)]

        # For each face, iterate rafter positions along the eave and draw a
        # line from the eave straight up to the opposite edge, clipped to face.
        if ridge_axis == 'y':
            # W main slope: rafters run in +X direction, spaced along Y
            for off in rafter_positions(span_y):
                y_r = eave_yn + off
                p1 = T(eave_xw, y_r)
                p2 = T(ridge_x_pos, y_r)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{rafter_stroke}" stroke-width="{rafter_w}" '
                      f'clip-path="url(#{cid}_W)"/>\n')
            # E main slope: rafters run in -X direction (from eave_xe to ridge)
            for off in rafter_positions(span_y):
                y_r = eave_yn + off
                p1 = T(eave_xe, y_r)
                p2 = T(ridge_x_pos, y_r)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{rafter_stroke}" stroke-width="{rafter_w}" '
                      f'clip-path="url(#{cid}_E)"/>\n')
            # N hip end: rafters run in +Y direction from N eave to apex
            for off in rafter_positions(span_x):
                x_r = eave_xw + off
                p1 = T(x_r, eave_yn)
                p2 = T(x_r, r_y_start)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{rafter_stroke}" stroke-width="{rafter_w}" '
                      f'clip-path="url(#{cid}_N)"/>\n')
            # S hip end: rafters run in -Y direction from S eave to apex
            for off in rafter_positions(span_x):
                x_r = eave_xw + off
                p1 = T(x_r, eave_ys)
                p2 = T(x_r, r_y_end)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{rafter_stroke}" stroke-width="{rafter_w}" '
                      f'clip-path="url(#{cid}_S)"/>\n')

        # ---- Purlins (thin blue) — clipped per face ----
        # Purlin spacing along the SLOPE = 12". In plan, that projects to
        # 12"·cos(pitch). Skip i=0 (that row is the eave-edge pipe).
        purlin_stroke = '#4a8fbf'
        purlin_w = max(_in_to_px(purlin_size_in[0]), 0.7)   # 2" wide (flat)

        if ridge_axis == 'y':
            # Main slope purlins: parallel to Y (vertical in plan), stepping
            # along X toward the central ridge.
            main_step_plan = purlin_spacing_u * math.cos(math.radians(slope_ew))
            half_span_x = span_x / 2.0
            n_main = int(half_span_x / main_step_plan)
            for i in range(1, n_main + 1):
                # W slope: x from eave_xw toward centre
                x_w = eave_xw + i * main_step_plan
                p1 = T(x_w, eave_yn)
                p2 = T(x_w, eave_ys)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{purlin_stroke}" stroke-width="{purlin_w}" '
                      f'clip-path="url(#{cid}_W)"/>\n')
                # E slope: mirror
                x_e = eave_xe - i * main_step_plan
                p1 = T(x_e, eave_yn)
                p2 = T(x_e, eave_ys)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{purlin_stroke}" stroke-width="{purlin_w}" '
                      f'clip-path="url(#{cid}_E)"/>\n')

            # Hip end purlins: parallel to X (horizontal in plan), stepping in Y.
            # N and S hip pitches may differ (asymmetric roof) — each side
            # gets its own step size and purlin count.
            hip_pitch_n = slopes[2]['pitch']
            hip_pitch_s = slopes[3]['pitch']
            hip_step_n = purlin_spacing_u * math.cos(math.radians(hip_pitch_n))
            hip_step_s = purlin_spacing_u * math.cos(math.radians(hip_pitch_s))
            n_hip_n = int(d_hip_n / hip_step_n) if hip_step_n > 0 else 0
            n_hip_s = int(d_hip_s / hip_step_s) if hip_step_s > 0 else 0
            for i in range(1, n_hip_n + 1):
                y_n = eave_yn + i * hip_step_n
                p1 = T(eave_xw, y_n)
                p2 = T(eave_xe, y_n)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{purlin_stroke}" stroke-width="{purlin_w}" '
                      f'clip-path="url(#{cid}_N)"/>\n')
            for i in range(1, n_hip_s + 1):
                y_s = eave_ys - i * hip_step_s
                p1 = T(eave_xw, y_s)
                p2 = T(eave_xe, y_s)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{purlin_stroke}" stroke-width="{purlin_w}" '
                      f'clip-path="url(#{cid}_S)"/>\n')

        # ---- Ridges: hip diagonals + central ridge (drawn on top) ----
        ridge_stroke = '#5a3a17'
        ridge_w = max(_in_to_px(ridge_size_in[0]), 2.6)   # 6" wide
        # Central ridge
        s += (f'<line x1="{NR[0]:.1f}" y1="{NR[1]:.1f}" '
              f'x2="{SR[0]:.1f}" y2="{SR[1]:.1f}" '
              f'stroke="{ridge_stroke}" stroke-width="{ridge_w}"/>\n')
        # Hip ridges from ridge endpoints to eave corners
        if ridge_axis == 'y':
            hips = [(NR, NW), (NR, NE), (SR, SW), (SR, SE)]
        else:
            hips = [(NR, NW), (NR, SW), (SR, NE), (SR, SE)]
        for a, b in hips:
            s += (f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" '
                  f'x2="{b[0]:.1f}" y2="{b[1]:.1f}" '
                  f'stroke="{ridge_stroke}" stroke-width="{ridge_w}"/>\n')

        # ---- Fink trusses in the ridge zone ----
        # Each common truss spans the full transverse eave-to-eave line at
        # its position within the ridge zone. Drawn as a distinct band
        # matching the truss bottom-chord width, plus labels (T1..Tn) and
        # a dimension chain showing the truss spacing.
        if truss_count > 0:
            truss_stroke = '#8b0000'
            truss_chord_size = truss_cfg.get('chord_size_in', [2, 4])
            truss_w_px = max(_in_to_px(truss_chord_size[0]), 2.2)
            blue = '#0066cc'
            # Draw each truss and its label
            for i, pos in enumerate(truss_y_positions):
                if ridge_axis == 'y':
                    p1 = T(eave_xw, pos)
                    p2 = T(eave_xe, pos)
                else:
                    p1 = T(pos, eave_yn)
                    p2 = T(pos, eave_ys)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{truss_stroke}" stroke-width="{truss_w_px:.1f}" '
                      f'opacity="0.85"/>\n')
                # Label at midspan (slightly offset)
                mid_x = (p1[0] + p2[0]) / 2
                mid_y = (p1[1] + p2[1]) / 2
                s += (f'<circle cx="{mid_x:.1f}" cy="{mid_y:.1f}" r="8" '
                      f'fill="white" stroke="{truss_stroke}" stroke-width="1.2"/>\n')
                s += (f'<text x="{mid_x:.1f}" y="{mid_y + 4:.1f}" '
                      f'text-anchor="middle" font-size="10" font-weight="700" '
                      f'fill="{truss_stroke}">T{i+1}</text>\n')

            # Spacing dimension chain (between adjacent trusses)
            if truss_count > 1 and ridge_axis == 'y':
                # Vertical dim chain on the RIGHT side of the roof.
                # Uses actual truss_y_positions differences (not spacing_ft),
                # so it stays correct when trusses are placed at ridge endpoints
                # + centre rather than at a fixed OC value.
                dim_x = T(eave_xe, 0)[0] + 26
                # Extension lines from each truss to the dim column
                for pos in truss_y_positions:
                    _, py = T(eave_xe, pos)
                    s += (f'<line x1="{T(eave_xe, pos)[0]:.1f}" y1="{py:.1f}" '
                          f'x2="{dim_x + 4:.1f}" y2="{py:.1f}" '
                          f'stroke="{blue}" stroke-width="0.5" '
                          f'stroke-dasharray="3,2"/>\n')
                for i in range(truss_count - 1):
                    _, py1 = T(eave_xe, truss_y_positions[i])
                    _, py2 = T(eave_xe, truss_y_positions[i+1])
                    _sp_u = abs(truss_y_positions[i+1] - truss_y_positions[i])
                    s += (f'<line x1="{dim_x:.1f}" y1="{py1:.1f}" '
                          f'x2="{dim_x:.1f}" y2="{py2:.1f}" '
                          f'stroke="{blue}" stroke-width="1" '
                          f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                    s += (f'<text x="{dim_x + 6:.1f}" y="{(py1+py2)/2 + 4:.1f}" '
                          f'text-anchor="start" font-size="11" fill="{blue}">'
                          f'{dim_text(_sp_u)}</text>\n')

        # ---- Ring beam (rectangular frame at wall level) ----
        # 27' × 45' rectangle inset from eave. Bottom-chords of the 3 Fink
        # trusses land on the two long edges of this frame.
        if ridge_axis == 'y':
            rb_xw = eave_xw + wall_inset_trans
            rb_xe = eave_xe - wall_inset_trans
            rb_yn = eave_yn + wall_inset_long_n
            rb_ys = eave_ys - wall_inset_long_s
        else:
            rb_xw = eave_xw + wall_inset_long_n
            rb_xe = eave_xe - wall_inset_long_s
            rb_yn = eave_yn + wall_inset_trans
            rb_ys = eave_ys - wall_inset_trans
        rb_nw = T(rb_xw, rb_yn)
        rb_ne = T(rb_xe, rb_yn)
        rb_se = T(rb_xe, rb_ys)
        rb_sw = T(rb_xw, rb_ys)
        ring_stroke = '#1e5aa6'  # blue-ish
        ring_w = max(_in_to_px(ring_beam_size[0]), 2.0)
        s += (f'<polygon points="{rb_nw[0]:.1f},{rb_nw[1]:.1f} '
              f'{rb_ne[0]:.1f},{rb_ne[1]:.1f} '
              f'{rb_se[0]:.1f},{rb_se[1]:.1f} '
              f'{rb_sw[0]:.1f},{rb_sw[1]:.1f}" '
              f'fill="none" stroke="{ring_stroke}" stroke-width="{ring_w:.1f}" '
              f'opacity="0.85"/>\n')
        # Ring beam label
        s += (f'<text x="{(rb_ne[0]+rb_se[0])/2 + 12:.1f}" y="{(rb_ne[1]+rb_se[1])/2:.1f}" '
              f'text-anchor="start" font-size="11" font-weight="600" fill="{ring_stroke}">'
              f'Ring beam ({house_ft[0]:.0f}\'×{house_ft[1]:.0f}\')</text>\n')

        # ---- Hip-end beams ----
        # 3 beams per hip end running N-S from corner truss to the N/S wall.
        # Spaced evenly across the 27' transverse width. When
        # `extend_between_trusses` is on, the same 3 beams also span each
        # ridge-zone bay (T1↔T2, T2↔T3, …) so the frame is continuously
        # braced from N wall to S wall.
        if hip_beam_total_count > 0 and ridge_axis == 'y' and truss_count >= 2:
            hip_beam_stroke = '#8a4a1a'  # dark brown to match user drawing
            hip_beam_w = max(_in_to_px(hip_beam_size[0]), 1.8)
            # E-W positions: evenly across the house width (rb_xw..rb_xe)
            for i in range(hip_beam_count_per_end):
                # Symmetric positions
                _frac = (i + 1) / (hip_beam_count_per_end + 1)
                bx_world = rb_xw + _frac * (rb_xe - rb_xw)
                # N hip end: from T1 (n ridge end) to N wall
                p_n_start = T(bx_world, truss_y_positions[0])
                p_n_end = T(bx_world, rb_yn)
                s += (f'<line x1="{p_n_start[0]:.1f}" y1="{p_n_start[1]:.1f}" '
                      f'x2="{p_n_end[0]:.1f}" y2="{p_n_end[1]:.1f}" '
                      f'stroke="{hip_beam_stroke}" stroke-width="{hip_beam_w:.1f}" '
                      f'opacity="0.85"/>\n')
                # S hip end: from T_last to S wall
                p_s_start = T(bx_world, truss_y_positions[-1])
                p_s_end = T(bx_world, rb_ys)
                s += (f'<line x1="{p_s_start[0]:.1f}" y1="{p_s_start[1]:.1f}" '
                      f'x2="{p_s_end[0]:.1f}" y2="{p_s_end[1]:.1f}" '
                      f'stroke="{hip_beam_stroke}" stroke-width="{hip_beam_w:.1f}" '
                      f'opacity="0.85"/>\n')
                # Ridge-zone bays between adjacent trusses (optional)
                if hip_beam_between_trusses:
                    for _j in range(len(truss_y_positions) - 1):
                        p_a = T(bx_world, truss_y_positions[_j])
                        p_b = T(bx_world, truss_y_positions[_j + 1])
                        s += (f'<line x1="{p_a[0]:.1f}" y1="{p_a[1]:.1f}" '
                              f'x2="{p_b[0]:.1f}" y2="{p_b[1]:.1f}" '
                              f'stroke="{hip_beam_stroke}" '
                              f'stroke-width="{hip_beam_w:.1f}" '
                              f'opacity="0.85"/>\n')

        # ---- Longitudinal trusses (removed — kept as no-op for compat) ----
        if long_truss_count > 0:
            long_truss_stroke = '#005a55'   # deep teal (contrasts with truss dark red)
            long_chord = long_truss_cfg.get('chord_size_in', [2, 4])
            long_w_px = max(_in_to_px(long_chord[0]), 2.2)
            for i, pos in enumerate(long_truss_positions):
                if ridge_axis == 'y':
                    p1 = T(pos, eave_yn)
                    p2 = T(pos, eave_ys)
                else:
                    p1 = T(eave_xw, pos)
                    p2 = T(eave_xe, pos)
                s += (f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" '
                      f'x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
                      f'stroke="{long_truss_stroke}" stroke-width="{long_w_px:.1f}" '
                      f'opacity="0.85"/>\n')
                # Label at midspan
                mid_x = (p1[0] + p2[0]) / 2
                mid_y = (p1[1] + p2[1]) / 2
                s += (f'<circle cx="{mid_x:.1f}" cy="{mid_y:.1f}" r="9" '
                      f'fill="white" stroke="{long_truss_stroke}" stroke-width="1.2"/>\n')
                s += (f'<text x="{mid_x:.1f}" y="{mid_y + 4:.1f}" '
                      f'text-anchor="middle" font-size="10" font-weight="700" '
                      f'fill="{long_truss_stroke}">L{i+1}</text>\n')

            # Spacing dimension chain BELOW the roof
            if long_truss_count > 1 and ridge_axis == 'y':
                lblue = '#0066cc'
                lsp_ft = long_truss_cfg.get('spacing_ft', 3)
                dim_y = T(0, eave_ys)[1] + 26
                # Extension lines from each long-truss down to dim row
                for pos in long_truss_positions:
                    px, py = T(pos, eave_ys)
                    s += (f'<line x1="{px:.1f}" y1="{py:.1f}" '
                          f'x2="{px:.1f}" y2="{dim_y + 4:.1f}" '
                          f'stroke="{lblue}" stroke-width="0.5" '
                          f'stroke-dasharray="3,2"/>\n')
                for i in range(long_truss_count - 1):
                    x1, _ = T(long_truss_positions[i], eave_ys)
                    x2, _ = T(long_truss_positions[i + 1], eave_ys)
                    s += (f'<line x1="{x1:.1f}" y1="{dim_y:.1f}" '
                          f'x2="{x2:.1f}" y2="{dim_y:.1f}" '
                          f'stroke="{lblue}" stroke-width="1" '
                          f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                    s += (f'<text x="{(x1+x2)/2:.1f}" y="{dim_y - 4:.1f}" '
                          f'text-anchor="middle" font-size="11" fill="{lblue}">'
                          f'{lsp_ft:.0f}\' OC</text>\n')

        # ---- Eave assembly bands: Pani Patti (outer) + L-channel (inner) ----
        # Both run along the entire eave perimeter of the hip roof. In plan
        # they read as two parallel bands hugging the eave edge:
        #   • PANI PATTI — 1" wide GI strip (drawn as a teal band at the very
        #     eave edge)
        #   • EAVE L-CHANNEL — 1"×1" angle sitting inboard of the Pani Patti
        pp_cfg_top = framing.get('pani_patti', {})
        pp_w_in = 1.0                            # 1" wide cross-section footprint
        pp_w_px = max(_in_to_px(pp_w_in), 2.0)
        eave_L_ch_size = framing.get('eave_L_channel_size_in', [1, 1])
        eave_L_w_px = max(_in_to_px(eave_L_ch_size[0]), 2.0)

        # OUTER band: Pani Patti along the eave (teal, matches cross-section)
        s += (f'<polygon points="{NW[0]:.1f},{NW[1]:.1f} {NE[0]:.1f},{NE[1]:.1f} '
              f'{SE[0]:.1f},{SE[1]:.1f} {SW[0]:.1f},{SW[1]:.1f}" '
              f'fill="none" stroke="#4a8fbf" stroke-width="{pp_w_px:.1f}" '
              f'opacity="0.55"/>\n')

        # INNER band: L-channel offset inboard from the eave by pp_w_in so
        # the two bands read as adjacent, not overlapping.
        offset_px = _in_to_px(pp_w_in)
        NW_L = (NW[0] + offset_px, NW[1] + offset_px)
        NE_L = (NE[0] - offset_px, NE[1] + offset_px)
        SE_L = (SE[0] - offset_px, SE[1] - offset_px)
        SW_L = (SW[0] + offset_px, SW[1] - offset_px)
        s += (f'<polygon points="{NW_L[0]:.1f},{NW_L[1]:.1f} {NE_L[0]:.1f},{NE_L[1]:.1f} '
              f'{SE_L[0]:.1f},{SE_L[1]:.1f} {SW_L[0]:.1f},{SW_L[1]:.1f}" '
              f'fill="none" stroke="#404040" stroke-width="{eave_L_w_px:.1f}" '
              f'opacity="0.55"/>\n')

        # ---- Eave outline (thin dark border on top of both bands) ----
        s += (f'<polygon points="{NW[0]:.1f},{NW[1]:.1f} {NE[0]:.1f},{NE[1]:.1f} '
              f'{SE[0]:.1f},{SE[1]:.1f} {SW[0]:.1f},{SW[1]:.1f}" '
              f'fill="none" stroke="#222" stroke-width="1.0"/>\n')

        # ---- Legend box in the empty area LEFT of the roof polygon ----
        # The roof spans SVG x roughly 455→1028; there's ~380 SVG units of
        # empty space to the left of the polygon. A compact legend there
        # avoids leader lines crossing the drawing entirely.
        west_eave_svg_x, _ = T(eave_xw, world_cy)
        legend_x = x0 + inner_pad + 10
        legend_y = y0 + title_h + inner_pad + 90    # below compass rose
        legend_w = min(370, west_eave_svg_x - legend_x - 20)
        row_h = 26
        # Legend rows: sample stroke widths match the DIMENSIONAL widths used
        # in the drawing (so the KEY sample line and the drawn member match).
        eave_L_ch_size = framing.get('eave_L_channel_size_in', [1, 1])
        eave_L_ch_wall = framing.get('eave_L_channel_wall_mm', 3)
        pp_cfg_leg = framing.get('pani_patti', {})
        pp_h_in_leg = pp_cfg_leg.get('height_in', 6)
        pp_thk_mm_leg = pp_cfg_leg.get('thickness_mm', 1.2)
        legend_rows = [
            ('rafter', rafter_stroke, rafter_w,
                f'{rafter_size_in[0]}"×{rafter_size_in[1]}"×{rafter_wall_mm} mm HSS RAFTER '
                f'@ {rafter_spacing_in}" OC'),
            ('purlin', purlin_stroke, purlin_w,
                f'{purlin_size_in[0]}"×{purlin_size_in[1]}"×{purlin_wall_mm} mm HSS PURLIN (flat) '
                f'@ {purlin_spacing_in}" OC'),
            ('ridge',  ridge_stroke,  ridge_w,
                f'{ridge_size_in[0]}"×{ridge_size_in[1]}"×{ridge_wall_mm} mm HSS RIDGE / HIP'),
            ('truss',  '#8b0000',
                max(_in_to_px(truss_cfg.get('chord_size_in', [2, 4])[0]), 2.2),
                f'FINK TRUSS × {truss_count} — '
                f'{truss_cfg.get("chord_size_in", [2,4])[0]}"×'
                f'{truss_cfg.get("chord_size_in", [2,4])[1]}"×'
                f'{truss_cfg.get("chord_wall_mm", 3)} mm HSS, '
                f'{house_ft[0]:.0f}\' span'),
            ('ring_beam', '#1e5aa6',
                max(_in_to_px(ring_beam_size[0]), 2.0),
                f'RING BEAM {house_ft[0]:.0f}\'×{house_ft[1]:.0f}\' — '
                f'{ring_beam_size[0]}"×{ring_beam_size[1]}"×{ring_beam_wall} mm '
                f'HSS @ wall top'),
            ('hip_beam', '#8a4a1a',
                max(_in_to_px(hip_beam_size[0]), 1.8),
                f'HIP-END BEAMS × {hip_beam_total_count} — '
                f'{hip_beam_size[0]}"×{hip_beam_size[1]}"×{hip_beam_wall} mm HSS'),
            ('pani',   '#4a8fbf',    max(_in_to_px(1.0), 1.8),
                f'{pp_h_in_leg:.0f}" × {pp_thk_mm_leg} mm GI PANI PATTI '
                f'(outer eave band)'),
            ('eave',   '#404040',    max(_in_to_px(eave_L_ch_size[0]), 1.8),
                f'{eave_L_ch_size[0]}"×{eave_L_ch_size[1]}"×{eave_L_ch_wall} mm L-CHANNEL '
                f'(inboard of Pani Patti)'),
            ('scale',  '#666', 0.0,
                f'(all widths drawn to scale — 1 pixel ≈ {(1.0/(s_scale/IN_PER_UNIT)):.2f}")'),
        ]
        n_rows = len(legend_rows)
        legend_h = 22 + n_rows * row_h + 12

        s += (f'<rect x="{legend_x}" y="{legend_y}" '
              f'width="{legend_w}" height="{legend_h}" '
              f'fill="#ffffff" fill-opacity="0.92" '
              f'stroke="#888" stroke-width="1"/>\n')
        s += (f'<text x="{legend_x + 10}" y="{legend_y + 16}" '
              f'font-size="12" font-weight="700" fill="#222">KEY</text>\n')
        sample_x1 = legend_x + 10
        sample_x2 = sample_x1 + 34
        text_x = sample_x2 + 8
        for i, (kind, color, sw, text) in enumerate(legend_rows):
            ry = legend_y + 22 + row_h * (i + 0.5) + 4
            if sw > 0:
                s += (f'<line x1="{sample_x1}" y1="{ry - 4}" '
                      f'x2="{sample_x2}" y2="{ry - 4}" '
                      f'stroke="{color}" stroke-width="{sw}"/>\n')
            s += (f'<text x="{text_x}" y="{ry}" text-anchor="start" '
                  f'font-size="12" fill="#222">{text}</text>\n')

        # Compass rose (small, top-left of drawing area)
        cx_n = x0 + inner_pad + 30
        cy_n = y0 + title_h + inner_pad + 30
        s += (f'<line x1="{cx_n}" y1="{cy_n + 22}" x2="{cx_n}" y2="{cy_n - 22}" '
              f'stroke="#333" stroke-width="1" marker-end="url(#arr)"/>\n')
        s += (f'<text x="{cx_n}" y="{cy_n - 26}" text-anchor="middle" '
              f'font-size="12" font-weight="600" fill="#222">N</text>\n')

        return s

    # ---------- Perspective panel (isometric view) ----------
    def perspective_panel(x0, y0, w_p, h_p):
        """Isometric view of the primary structural frame ONLY: ring beam,
        3 Fink trusses, and 6 hip-end beams. The roof shell edges (eave
        outline, ridge, hip ridges) are drawn as a faint wireframe backdrop
        for context but the tile/rafter/purlin faces are omitted."""
        title_h = 40
        inner_pad = 30
        cos30 = math.cos(math.radians(30))
        sin30 = math.sin(math.radians(30))

        # Compute ridge endpoints and absolute ridge z (relative to eave_z reference)
        eave_z_ref = roof.get('eave_z', 0)
        r_z = eave_z_ref + h
        wall_top_z = eave_z_ref + wall_top_u   # ring beam z-level
        if ridge_axis == 'y':
            r_x = (eave_xw + eave_xe) / 2.0
            r_y1 = eave_yn + d_hip_n
            r_y2 = eave_ys - d_hip_s
            R1 = (r_x, r_y1, r_z)  # north end
            R2 = (r_x, r_y2, r_z)  # south end
            # Ring beam corners (at wall-top level)
            rb_xw = eave_xw + wall_inset_trans
            rb_xe = eave_xe - wall_inset_trans
            rb_yn = eave_yn + wall_inset_long_n
            rb_ys = eave_ys - wall_inset_long_s
        else:
            r_y = (eave_yn + eave_ys) / 2.0
            r_x1 = eave_xw + d_hip_w
            r_x2 = eave_xe - d_hip_e
            R1 = (r_x1, r_y, r_z)
            R2 = (r_x2, r_y, r_z)
            rb_xw = eave_xw + wall_inset_long_n
            rb_xe = eave_xe - wall_inset_long_s
            rb_yn = eave_yn + wall_inset_trans
            rb_ys = eave_ys - wall_inset_trans

        def iso(pt):
            px, py, pz = pt
            wx = (px - py) * cos30
            wy = pz - (px + py) * sin30
            return (wx, wy)

        # Wall base level — visible walls extend from here up to the ring
        # beam (wall_top_z). Kept modest so the roof frame remains the
        # dominant content but the walls read as walls, not just a strip.
        wall_bot_z = eave_z_ref - 40
        # Collect all points that need to fit within the drawing area, so we
        # can autoscale — eave corners, ridge endpoints, ring-beam corners,
        # wall bases so walls stay inside the panel.
        anchor_pts = [
            iso((eave_xw, eave_yn, eave_z_ref)),
            iso((eave_xe, eave_yn, eave_z_ref)),
            iso((eave_xe, eave_ys, eave_z_ref)),
            iso((eave_xw, eave_ys, eave_z_ref)),
            iso(R1), iso(R2),
            iso((rb_xw, rb_yn, wall_top_z)),
            iso((rb_xe, rb_yn, wall_top_z)),
            iso((rb_xe, rb_ys, wall_top_z)),
            iso((rb_xw, rb_ys, wall_top_z)),
            iso((rb_xw, rb_yn, wall_bot_z)),
            iso((rb_xe, rb_yn, wall_bot_z)),
            iso((rb_xe, rb_ys, wall_bot_z)),
            iso((rb_xw, rb_ys, wall_bot_z)),
        ]
        xs = [v[0] for v in anchor_pts]
        ys = [v[1] for v in anchor_pts]
        minx, maxx = min(xs), max(xs)
        miny, maxy = min(ys), max(ys)
        world_w = max(maxx - minx, 1)
        world_h = max(maxy - miny, 1)
        draw_w = w_p - 2 * inner_pad
        draw_h = h_p - title_h - 2 * inner_pad
        ps = min(draw_w / world_w, draw_h / world_h) * 0.88
        tx = x0 + w_p / 2 - (minx + maxx) / 2 * ps
        ty = y0 + title_h + (h_p - title_h) / 2 + (miny + maxy) / 2 * ps

        def to_svg_pt(pt3d):
            vx, vy = iso(pt3d)
            return (tx + vx * ps, ty - vy * ps)

        def draw_line(pt_a, pt_b, stroke, stroke_w, opacity=1.0, dash=None):
            a = to_svg_pt(pt_a)
            b = to_svg_pt(pt_b)
            extra = f' stroke-dasharray="{dash}"' if dash else ''
            return (f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" '
                    f'x2="{b[0]:.1f}" y2="{b[1]:.1f}" '
                    f'stroke="{stroke}" stroke-width="{stroke_w}" '
                    f'opacity="{opacity}"{extra}/>\n')

        def draw_dot(pt3d, r, fill):
            a = to_svg_pt(pt3d)
            return (f'<circle cx="{a[0]:.1f}" cy="{a[1]:.1f}" r="{r}" '
                    f'fill="{fill}"/>\n')

        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{w_p}" height="{h_p}" '
              f'fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{w_p}" height="{title_h}" '
              f'fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n')
        s += (f'<text x="{x0 + w_p / 2}" y="{y0 + title_h - 13}" text-anchor="middle" '
              f'font-size="18" font-weight="600" fill="#222">'
              f'PERSPECTIVE — Structural frame (isometric)</text>\n')

        # ---- Roof shell wireframe (faint context) ----
        eave_corners = [
            (eave_xw, eave_yn, eave_z_ref),
            (eave_xe, eave_yn, eave_z_ref),
            (eave_xe, eave_ys, eave_z_ref),
            (eave_xw, eave_ys, eave_z_ref),
        ]
        # Eave perimeter (dashed light)
        for i in range(4):
            s += draw_line(eave_corners[i], eave_corners[(i + 1) % 4],
                            stroke='#b48a5a', stroke_w=0.8,
                            opacity=0.55, dash='4,3')
        # Central ridge
        s += draw_line(R1, R2, stroke='#a17545', stroke_w=1.0, opacity=0.7)
        # 4 hip ridges (dashed light)
        if ridge_axis == 'y':
            hip_pairs = [(R1, eave_corners[0]), (R1, eave_corners[1]),
                         (R2, eave_corners[2]), (R2, eave_corners[3])]
        else:
            hip_pairs = [(R1, eave_corners[0]), (R1, eave_corners[3]),
                         (R2, eave_corners[1]), (R2, eave_corners[2])]
        for a, b in hip_pairs:
            s += draw_line(a, b, stroke='#a17545', stroke_w=0.8,
                            opacity=0.55, dash='4,3')

        # ---- House walls (semi-transparent) ----
        # Four vertical panels around the house footprint, from wall_bot_z
        # up to wall_top_z. Ring beam sits on top of these walls, so they
        # are drawn first (ring beam and other frame members render over).
        wall_stroke = '#8a7f6d'
        wall_fill = '#e5dfd2'
        wall_quads = [
            # N wall
            [(rb_xw, rb_yn, wall_bot_z), (rb_xe, rb_yn, wall_bot_z),
             (rb_xe, rb_yn, wall_top_z), (rb_xw, rb_yn, wall_top_z), 'N'],
            # S wall
            [(rb_xw, rb_ys, wall_bot_z), (rb_xe, rb_ys, wall_bot_z),
             (rb_xe, rb_ys, wall_top_z), (rb_xw, rb_ys, wall_top_z), 'S'],
            # W wall
            [(rb_xw, rb_yn, wall_bot_z), (rb_xw, rb_ys, wall_bot_z),
             (rb_xw, rb_ys, wall_top_z), (rb_xw, rb_yn, wall_top_z), 'W'],
            # E wall
            [(rb_xe, rb_yn, wall_bot_z), (rb_xe, rb_ys, wall_bot_z),
             (rb_xe, rb_ys, wall_top_z), (rb_xe, rb_yn, wall_top_z), 'E'],
        ]

        def _avg_svg_y(pts):
            return sum(to_svg_pt(p)[1] for p in pts) / len(pts)
        # Paint back-to-front: larger svg_y means closer to viewer, drawn last.
        for quad in sorted(wall_quads, key=lambda q: _avg_svg_y(q[:4])):
            pts_str = ' '.join(
                f'{to_svg_pt(p)[0]:.1f},{to_svg_pt(p)[1]:.1f}' for p in quad[:4])
            s += (f'<polygon points="{pts_str}" fill="{wall_fill}" '
                  f'fill-opacity="0.55" stroke="{wall_stroke}" '
                  f'stroke-width="0.9" stroke-linejoin="round"/>\n')

        # ---- Pillars (vertical marks at each pillar position) ----
        pillar_stroke = '#3f2f1a'
        pillar_fill = '#7a6244'
        _pillar_positions = set()
        for _floor in house_config.get('floors', []):
            for _obj in _floor.get('objects', []):
                if _obj.get('type') == 'pillar':
                    _pillar_positions.add(
                        (_obj.get('x', 0.0), _obj.get('y', 0.0)))
        # House-coord origin (0,0) maps to (rb_xw, rb_yn).
        for _px, _py in sorted(_pillar_positions):
            _wx = rb_xw + _px
            _wy = rb_yn + _py
            # Skip pillars outside the ring beam (safety)
            if not (rb_xw <= _wx <= rb_xe and rb_yn <= _wy <= rb_ys):
                continue
            _bot = (_wx, _wy, wall_bot_z)
            _top = (_wx, _wy, wall_top_z + 4)
            s += draw_line(_bot, _top, stroke=pillar_stroke,
                            stroke_w=2.0, opacity=0.95)
            # Small dot at ring beam level (marker)
            _rb_pt = to_svg_pt((_wx, _wy, wall_top_z))
            s += (f'<circle cx="{_rb_pt[0]:.1f}" cy="{_rb_pt[1]:.1f}" '
                  f'r="2.4" fill="{pillar_fill}" '
                  f'stroke="{pillar_stroke}" stroke-width="0.7"/>\n')

        # ---- Ring beam (blue, wall-top level) ----
        rb_corners = [
            (rb_xw, rb_yn, wall_top_z),
            (rb_xe, rb_yn, wall_top_z),
            (rb_xe, rb_ys, wall_top_z),
            (rb_xw, rb_ys, wall_top_z),
        ]
        ring_stroke = '#1e5aa6'
        for i in range(4):
            s += draw_line(rb_corners[i], rb_corners[(i + 1) % 4],
                            stroke=ring_stroke, stroke_w=2.4, opacity=0.95)

        # ---- Hip-end beams (brown, at wall-top level) ----
        # + optional bay beams between adjacent trusses when
        # `extend_between_trusses` is set (continuous N wall → S wall).
        hip_beam_stroke = '#8a4a1a'
        if truss_count >= 2 and ridge_axis == 'y':
            # Beam endpoints in world coords
            for i in range(hip_beam_count_per_end):
                _frac = (i + 1) / (hip_beam_count_per_end + 1)
                bx_world = rb_xw + _frac * (rb_xe - rb_xw)
                # N end beam: from T1 bottom-chord point down to N wall
                s += draw_line((bx_world, truss_y_positions[0], wall_top_z),
                                (bx_world, rb_yn, wall_top_z),
                                stroke=hip_beam_stroke, stroke_w=1.6)
                # S end beam
                s += draw_line((bx_world, truss_y_positions[-1], wall_top_z),
                                (bx_world, rb_ys, wall_top_z),
                                stroke=hip_beam_stroke, stroke_w=1.6)
                # Ridge-zone bay segments (T1↔T2, T2↔T3, …)
                if hip_beam_between_trusses:
                    for _j in range(len(truss_y_positions) - 1):
                        s += draw_line(
                            (bx_world, truss_y_positions[_j], wall_top_z),
                            (bx_world, truss_y_positions[_j + 1], wall_top_z),
                            stroke=hip_beam_stroke, stroke_w=1.6)

        # ---- Ridge members: central ridge + 4 hip ridges (same HSS spec) ----
        # All 5 ridge members share the same 6"×3"×2mm HSS section so they
        # are drawn with identical stroke weight and colour to read as one
        # structural family. They sit on top of the dashed roof-shell
        # wireframe.
        hip_ridge_stroke = '#6b4423'
        # Central ridge (R1 → R2) — the horizontal top line
        s += draw_line(R1, R2, stroke=hip_ridge_stroke,
                        stroke_w=2.0, opacity=0.95)
        # Four hip ridges (ridge endpoint → eave corners)
        if ridge_axis == 'y':
            hip_ridge_pairs = [
                (R1, eave_corners[0]),   # R1 → NW eave corner
                (R1, eave_corners[1]),   # R1 → NE
                (R2, eave_corners[2]),   # R2 → SE
                (R2, eave_corners[3]),   # R2 → SW
            ]
        else:
            hip_ridge_pairs = [
                (R1, eave_corners[0]),   # R1 → NW
                (R1, eave_corners[3]),   # R1 → SW
                (R2, eave_corners[1]),   # R2 → NE
                (R2, eave_corners[2]),   # R2 → SE
            ]
        for _a, _b in hip_ridge_pairs:
            s += draw_line(_a, _b, stroke=hip_ridge_stroke,
                            stroke_w=2.0, opacity=0.95)

        # ---- 3 Fink trusses ----
        # Each truss lives in a vertical plane at y = truss_y_positions[i].
        # Bottom chord: horizontal at wall_top_z, from x=rb_xw to x=rb_xe.
        # Peak: at ridge beam BOTTOM (= r_z − ridge_depth), not the roof
        # apex — the ridge beam sits between truss peaks and the roof
        # surface.
        truss_stroke = '#8b0000'
        web_stroke = '#c25050'
        truss_peak_z = r_z - ridge_depth_u
        if truss_count > 0 and ridge_axis == 'y':
            ridge_x_p = (eave_xw + eave_xe) / 2.0
            for i, ty_pos in enumerate(truss_y_positions):
                B0 = (rb_xw, ty_pos, wall_top_z)
                B4 = (rb_xe, ty_pos, wall_top_z)
                B1 = (rb_xw + 0.25 * (rb_xe - rb_xw), ty_pos, wall_top_z)
                B2 = (ridge_x_p, ty_pos, wall_top_z)
                B3 = (rb_xw + 0.75 * (rb_xe - rb_xw), ty_pos, wall_top_z)
                Tpk = (ridge_x_p, ty_pos, truss_peak_z)
                T1 = (rb_xw + 0.25 * (rb_xe - rb_xw), ty_pos,
                      (wall_top_z + truss_peak_z) / 2)
                T3 = (rb_xw + 0.75 * (rb_xe - rb_xw), ty_pos,
                      (wall_top_z + truss_peak_z) / 2)
                # Chords (thicker)
                s += draw_line(B0, Tpk, stroke=truss_stroke, stroke_w=2.4)
                s += draw_line(Tpk, B4, stroke=truss_stroke, stroke_w=2.4)
                s += draw_line(B0, B4, stroke=truss_stroke, stroke_w=2.4)
                # Web (thinner)
                for a, b in [(Tpk, B2), (Tpk, B1), (Tpk, B3),
                              (T1, B1), (T3, B3)]:
                    s += draw_line(a, b, stroke=web_stroke, stroke_w=1.2)
                # Joint dots
                for jp in (B0, B1, B2, B3, B4, T1, Tpk, T3):
                    s += draw_dot(jp, r=2.0, fill=truss_stroke)
                # Label (T1/T2/T3) at the peak
                pk_svg = to_svg_pt(Tpk)
                s += (f'<circle cx="{pk_svg[0]:.1f}" cy="{pk_svg[1]:.1f}" r="9" '
                      f'fill="white" stroke="{truss_stroke}" stroke-width="1.2"/>\n')
                s += (f'<text x="{pk_svg[0]:.1f}" y="{pk_svg[1] + 4:.1f}" '
                      f'text-anchor="middle" font-size="10" font-weight="700" '
                      f'fill="{truss_stroke}">T{i + 1}</text>\n')

        # ---- Compass labels at eave midpoints ----
        eave_pairs = [
            ('N', eave_corners[0], eave_corners[1]),
            ('S', eave_corners[2], eave_corners[3]),
            ('W', eave_corners[3], eave_corners[0]),
            ('E', eave_corners[1], eave_corners[2]),
        ]
        for label, a, b in eave_pairs:
            ap = to_svg_pt(a)
            bp = to_svg_pt(b)
            mx = (ap[0] + bp[0]) / 2
            my = (ap[1] + bp[1]) / 2 + 15
            s += (f'<text x="{mx:.1f}" y="{my:.1f}" text-anchor="middle" '
                  f'font-size="13" font-weight="600" fill="#333">{label}</text>\n')

        # ---- Small legend inside the panel ----
        lg_x = x0 + inner_pad
        lg_y = y0 + title_h + inner_pad
        s += (f'<text x="{lg_x}" y="{lg_y}" font-size="11" font-weight="600" '
              f'fill="{truss_stroke}">■ Fink truss × {truss_count}</text>\n')
        s += (f'<text x="{lg_x}" y="{lg_y + 16}" font-size="11" font-weight="600" '
              f'fill="{ring_stroke}">■ Ring beam ({house_ft[0]:.0f}\' × {house_ft[1]:.0f}\')</text>\n')
        s += (f'<text x="{lg_x}" y="{lg_y + 32}" font-size="11" font-weight="600" '
              f'fill="{hip_beam_stroke}">■ Hip-end beams × {hip_beam_total_count}</text>\n')
        s += (f'<text x="{lg_x}" y="{lg_y + 48}" font-size="11" font-weight="600" '
              f'fill="{hip_ridge_stroke}">■ Ridges × 5 (1 central + 4 hip)</text>\n')
        s += (f'<text x="{lg_x}" y="{lg_y + 64}" font-size="11" font-weight="600" '
              f'fill="{wall_stroke}">■ House walls (4)</text>\n')
        s += (f'<text x="{lg_x}" y="{lg_y + 80}" font-size="11" font-weight="600" '
              f'fill="{pillar_stroke}">■ Pillars × {len(_pillar_positions)}</text>\n')
        s += (f'<text x="{lg_x}" y="{lg_y + 96}" font-size="10" fill="#666">'
              f'(roof shell dashed for context)</text>\n')

        return s

    # ---------- Cross-section panels ----------
    def section_panel_generic(x0, y0, w_p, h_p, title, is_trapezoid,
                              base_span, top_span, height_val, angle_val,
                              return_geom=False,
                              top_offset_left=None, top_offset_right=None,
                              angle_left=None, angle_right=None,
                              skip_base_corners=False):
        """Draws a simple dimensioned cross-section (triangle or trapezoid).
        For asymmetric trapezoids, pass top_offset_left/right (world units
        measured from bl / br) and angle_left/right to override the
        symmetric layout. If return_geom is True, returns (svg_str,
        geom_dict) exposing drawing coordinates for callers to overlay."""
        title_h = 36
        inner_pad = 40
        draw_w = w_p - 2 * inner_pad
        draw_h = h_p - title_h - 2 * inner_pad
        s_scale = min(draw_w / max(base_span, 1),
                      draw_h / max(height_val, 1)) * 0.75

        base_px = base_span * s_scale
        top_px = top_span * s_scale
        h_px = height_val * s_scale
        cx = x0 + w_p / 2
        _bottom_reserve = 60
        baseline_y = y0 + title_h + inner_pad + draw_h - _bottom_reserve
        t_y = baseline_y - h_px
        bl = (cx - base_px / 2, baseline_y)
        br = (cx + base_px / 2, baseline_y)
        if is_trapezoid:
            if top_offset_left is not None and top_offset_right is not None:
                tl = (bl[0] + top_offset_left * s_scale, t_y)
                tr = (br[0] - top_offset_right * s_scale, t_y)
            else:
                tl = (cx - top_px / 2, t_y)
                tr = (cx + top_px / 2, t_y)
        else:
            tl = tr = (cx, t_y)

        s = ''
        s += (f'<rect x="{x0}" y="{y0}" width="{w_p}" height="{h_p}" '
              f'fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n')
        s += (f'<rect x="{x0}" y="{y0}" width="{w_p}" height="{title_h}" '
              f'fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n')
        s += (f'<text x="{x0 + w_p / 2}" y="{y0 + title_h - 12}" '
              f'text-anchor="middle" font-size="16" font-weight="600" fill="#222">'
              f'{title}</text>\n')

        # Roof shell outline drawn as a dashed reference line (no fill) so
        # the structural elements (trusses, ridge beam, ring beam) read as
        # the primary content and the roof is context.
        if is_trapezoid:
            outline = (f'M {bl[0]:.1f} {bl[1]:.1f} L {br[0]:.1f} {br[1]:.1f} '
                       f'L {tr[0]:.1f} {tr[1]:.1f} L {tl[0]:.1f} {tl[1]:.1f} Z')
        else:
            outline = (f'M {bl[0]:.1f} {bl[1]:.1f} L {br[0]:.1f} {br[1]:.1f} '
                       f'L {tl[0]:.1f} {tl[1]:.1f} Z')
        s += (f'<path d="{outline}" fill="none" stroke="#8B4513" '
              f'stroke-width="1.2" stroke-dasharray="6,4" opacity="0.55"/>\n')

        # Height dim on the left
        h_dim_x = bl[0] - 30
        s += (f'<line x1="{bl[0]}" y1="{baseline_y}" x2="{h_dim_x - 6}" y2="{baseline_y}" '
              f'stroke="#0066cc" stroke-width="0.5" stroke-dasharray="3,3"/>\n')
        s += (f'<line x1="{cx}" y1="{t_y}" x2="{h_dim_x - 6}" y2="{t_y}" '
              f'stroke="#0066cc" stroke-width="0.5" stroke-dasharray="3,3"/>\n')
        s += (f'<line x1="{h_dim_x}" y1="{baseline_y}" x2="{h_dim_x}" y2="{t_y}" '
              f'stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" '
              f'marker-end="url(#arr)"/>\n')
        s += (f'<text x="{h_dim_x - 6}" y="{(baseline_y + t_y) / 2}" text-anchor="end" '
              f'font-size="11" fill="#0066cc">h = {dim_text(height_val)}</text>\n')

        # Base dim below
        b_dim_y = baseline_y + 32
        s += (f'<line x1="{bl[0]}" y1="{baseline_y}" x2="{bl[0]}" y2="{b_dim_y + 6}" '
              f'stroke="#0066cc" stroke-width="0.5"/>\n')
        s += (f'<line x1="{br[0]}" y1="{baseline_y}" x2="{br[0]}" y2="{b_dim_y + 6}" '
              f'stroke="#0066cc" stroke-width="0.5"/>\n')
        s += (f'<line x1="{bl[0]}" y1="{b_dim_y}" x2="{br[0]}" y2="{b_dim_y}" '
              f'stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" '
              f'marker-end="url(#arr)"/>\n')
        s += (f'<text x="{cx}" y="{b_dim_y - 5}" text-anchor="middle" '
              f'font-size="11" fill="#0066cc">{dim_text(base_span)}</text>\n')

        # Top dim (for trapezoid only). Placed high enough that a caller
        # can add an intermediate dimension chain (e.g. truss spacing)
        # between the ridge line and this dim without overlapping.
        if is_trapezoid and top_span > 0:
            t_dim_y = t_y - 48
            s += (f'<line x1="{tl[0]}" y1="{t_y}" x2="{tl[0]}" y2="{t_dim_y - 6}" '
                  f'stroke="#0066cc" stroke-width="0.5" stroke-dasharray="3,3"/>\n')
            s += (f'<line x1="{tr[0]}" y1="{t_y}" x2="{tr[0]}" y2="{t_dim_y - 6}" '
                  f'stroke="#0066cc" stroke-width="0.5" stroke-dasharray="3,3"/>\n')
            s += (f'<line x1="{tl[0]}" y1="{t_dim_y}" x2="{tr[0]}" y2="{t_dim_y}" '
                  f'stroke="#0066cc" stroke-width="1" marker-start="url(#arr)" '
                  f'marker-end="url(#arr)"/>\n')
            s += (f'<text x="{cx}" y="{t_dim_y - 5}" text-anchor="middle" '
                  f'font-size="11" fill="#0066cc">ridge = {dim_text(top_span)}</text>\n')

        # Interior corner angles. Asymmetric hips have different pitches
        # on the two sloping sides; angle_left/angle_right override
        # symmetric angle_val when supplied.
        base_corner_L = angle_left if angle_left is not None else angle_val
        base_corner_R = angle_right if angle_right is not None else angle_val
        if is_trapezoid:
            top_corner_L = 180.0 - base_corner_L
            top_corner_R = 180.0 - base_corner_R
        else:
            apex_angle = 180.0 - base_corner_L - base_corner_R

        # Base corner angles at the bottom corners of the shape. When the
        # caller draws content that would cover these labels (e.g. section
        # B-B draws wall rectangles that sit on top of the labels), it can
        # pass skip_base_corners=True and re-draw the labels itself AFTER
        # the walls so the labels end up on top.
        if not skip_base_corners:
            s += (f'<text x="{bl[0] + 8}" y="{baseline_y - 6}" text-anchor="start" '
                  f'font-size="11" fill="#333">{base_corner_L:.1f}°</text>\n')
            s += (f'<text x="{br[0] - 8}" y="{baseline_y - 6}" text-anchor="end" '
                  f'font-size="11" fill="#333">{base_corner_R:.1f}°</text>\n')
        # Top corners / apex — kept inside the trapezoid, they don't clash
        # with anything up there.
        if is_trapezoid:
            s += (f'<text x="{tl[0] + 6}" y="{t_y + 14}" text-anchor="start" '
                  f'font-size="11" fill="#333">{top_corner_L:.1f}°</text>\n')
            s += (f'<text x="{tr[0] - 6}" y="{t_y + 14}" text-anchor="end" '
                  f'font-size="11" fill="#333">{top_corner_R:.1f}°</text>\n')
        else:
            s += (f'<text x="{tl[0]}" y="{t_y + 15}" text-anchor="middle" '
                  f'font-size="11" fill="#333">{apex_angle:.1f}°</text>\n')

        # Pitch label (may show two pitches for asymmetric case)
        if angle_left is not None and angle_right is not None and \
           abs(angle_left - angle_right) > 0.1:
            _pitch_lbl = f'PITCH: N {angle_left:.1f}° / S {angle_right:.1f}°'
        else:
            _pitch_lbl = f'PITCH: {angle_val:.1f}°'
        s += (f'<text x="{x0 + w_p - 12}" y="{y0 + title_h + 18}" text-anchor="end" '
              f'font-size="12" font-weight="600" fill="#8B4513">'
              f'{_pitch_lbl}</text>\n')

        if return_geom:
            return s, {
                'bl': bl, 'br': br, 'tl': tl, 'tr': tr,
                'baseline_y': baseline_y, 't_y': t_y,
                's_scale': s_scale, 'cx': cx,
                'base_span': base_span, 'top_span': top_span,
                'height_val': height_val,
            }
        return s

    def section_aa_panel(x0, y0, w_p, h_p):
        # Transverse: perpendicular to ridge → E-W cross section for axis='y'
        # Triangle: base = span_x, height = h (vertical ridge height above eave)
        if ridge_axis == 'y':
            base_span = span_x
            angle_val = slope_ew
        else:
            base_span = span_y
            angle_val = slope_ns
        s, geom = section_panel_generic(x0, y0, w_p, h_p,
                                        'SECTION A–A : TRANSVERSE (perpendicular to ridge) — TRUSS PROFILE',
                                        is_trapezoid=False,
                                        base_span=base_span, top_span=0.0,
                                        height_val=h, angle_val=angle_val,
                                        return_geom=True)
        # ---- Rafters + purlins on both main slopes ----
        # In Section A-A (cut perpendicular to the ridge) rafters run in the
        # plane of the cut. Draw one rafter on each slope from eave to
        # ridge-beam side. Purlins are welded ON TOP of the rafters; their
        # cross-section is drawn as a rotated rectangle whose bottom face
        # aligns with the rafter's top face.
        bl_ = geom['bl']; br_ = geom['br']
        baseline_y_ = geom['baseline_y']; t_y_ = geom['t_y']
        cx_ = geom['cx']; s_scale_ = geom['s_scale']
        rafter_stroke_sec = '#8B4513'
        rafter_fill_sec = '#c8a377'
        purlin_fill_sec = '#a8c9e0'
        purlin_stroke_sec = '#4a8fbf'
        _rd_w_px_a = max(6.0, ridge_width_u * s_scale_)
        _rd_h_px_a = max(4.0, ridge_depth_u * s_scale_)
        raft_top_L = (cx_ - _rd_w_px_a / 2, t_y_)
        raft_top_R = (cx_ + _rd_w_px_a / 2, t_y_)
        _raft_line_w = max(2.4, rafter_size_in[1] / IN_PER_UNIT * s_scale_ * 0.55)
        s += (f'<line x1="{bl_[0]:.1f}" y1="{baseline_y_:.1f}" '
              f'x2="{raft_top_L[0]:.1f}" y2="{raft_top_L[1]:.1f}" '
              f'stroke="{rafter_stroke_sec}" stroke-width="{_raft_line_w:.1f}" '
              f'stroke-linecap="round"/>\n')
        s += (f'<line x1="{br_[0]:.1f}" y1="{baseline_y_:.1f}" '
              f'x2="{raft_top_R[0]:.1f}" y2="{raft_top_R[1]:.1f}" '
              f'stroke="{rafter_stroke_sec}" stroke-width="{_raft_line_w:.1f}" '
              f'stroke-linecap="round"/>\n')
        # Rotated purlin cross-sections along each rafter at 12" OC.
        # Positions are computed using the SAME convention as the top view
        # (horizontal step = slope-spacing × cos(pitch)) so purlin count
        # and x-positions match between the two views.
        _purlin_w_px = max(3.0, purlin_size_in[0] / IN_PER_UNIT * s_scale_)
        _purlin_d_px = max(2.0, purlin_size_in[1] / IN_PER_UNIT * s_scale_)
        _pitch = angle_val
        _purlin_step_slope_u = purlin_spacing_in / IN_PER_UNIT
        _purlin_step_horiz_u = _purlin_step_slope_u * math.cos(math.radians(_pitch))
        _half_span_u = base_span / 2
        _n_purl = int(_half_span_u / _purlin_step_horiz_u)
        # Rafter slope (pixels per world unit horizontal). Rafter goes from
        # BL (baseline, at eave) up to raft_top_L (at ridge beam side).
        _raft_run_L_u = (raft_top_L[0] - bl_[0]) / s_scale_
        _raft_rise_L_px = raft_top_L[1] - baseline_y_  # negative (upward in SVG)
        _raft_run_R_u = (br_[0] - raft_top_R[0]) / s_scale_
        _raft_rise_R_px = raft_top_R[1] - baseline_y_
        for i in range(1, _n_purl + 1):
            _dx_u = i * _purlin_step_horiz_u  # horizontal distance from eave
            _dx_px = _dx_u * s_scale_
            # Left slope: move RIGHT from BL toward apex
            pxL = bl_[0] + _dx_px
            # Purlin sits on rafter line — clip to drawn rafter length.
            _t_L = min(1.0, _dx_u / _raft_run_L_u) if _raft_run_L_u > 0 else 1.0
            pyL = baseline_y_ + _t_L * _raft_rise_L_px
            s += (f'<g transform="translate({pxL:.1f},{pyL:.1f}) '
                  f'rotate({-_pitch:.1f})">'
                  f'<rect x="{-_purlin_w_px/2:.1f}" y="{-_purlin_d_px:.1f}" '
                  f'width="{_purlin_w_px:.1f}" height="{_purlin_d_px:.1f}" '
                  f'fill="{purlin_fill_sec}" stroke="{purlin_stroke_sec}" '
                  f'stroke-width="0.6"/></g>\n')
            # Right slope: move LEFT from BR toward apex
            pxR = br_[0] - _dx_px
            _t_R = min(1.0, _dx_u / _raft_run_R_u) if _raft_run_R_u > 0 else 1.0
            pyR = baseline_y_ + _t_R * _raft_rise_R_px
            s += (f'<g transform="translate({pxR:.1f},{pyR:.1f}) '
                  f'rotate({_pitch:.1f})">'
                  f'<rect x="{-_purlin_w_px/2:.1f}" y="{-_purlin_d_px:.1f}" '
                  f'width="{_purlin_w_px:.1f}" height="{_purlin_d_px:.1f}" '
                  f'fill="{purlin_fill_sec}" stroke="{purlin_stroke_sec}" '
                  f'stroke-width="0.6"/></g>\n')

        # Overlay Fink truss INSET (bottom chord on ring beam at wall top,
        # smaller span than the roof outline). Also overlay the ring beam.
        if truss_count > 0:
            bl = geom['bl']; br = geom['br']
            baseline_y = geom['baseline_y']; t_y = geom['t_y']
            cx = geom['cx']; s_scale = geom['s_scale']
            web_stroke = '#8b0000'
            web_w = 1.4
            chord_w = 2.4
            ring_stroke_sec = '#1e5aa6'
            # Truss geometry in world units → convert to svg px inside section
            _truss_span_px = truss_effective_span_u * s_scale
            _truss_rise_px = truss_effective_rise_u * s_scale
            _wall_top_px = wall_top_u * s_scale
            # Truss bottom-chord y-position (raised above baseline by wall_top)
            _tbot_y = baseline_y - _wall_top_px
            _t_ttop_y = _tbot_y - _truss_rise_px
            # X positions: centred on the section
            _tbot_left = cx - _truss_span_px / 2
            _tbot_right = cx + _truss_span_px / 2
            _tbot_q1 = cx - _truss_span_px / 4
            _tbot_q3 = cx + _truss_span_px / 4
            _tmid_l = cx - _truss_span_px / 4
            _tmid_r = cx + _truss_span_px / 4
            _tmid_top_y = (_tbot_y + _t_ttop_y) / 2
            # Draw truss chord outline
            # Top chords (2)
            s += (f'<line x1="{_tbot_left:.1f}" y1="{_tbot_y:.1f}" '
                  f'x2="{cx:.1f}" y2="{_t_ttop_y:.1f}" '
                  f'stroke="{web_stroke}" stroke-width="{chord_w}"/>\n')
            s += (f'<line x1="{cx:.1f}" y1="{_t_ttop_y:.1f}" '
                  f'x2="{_tbot_right:.1f}" y2="{_tbot_y:.1f}" '
                  f'stroke="{web_stroke}" stroke-width="{chord_w}"/>\n')
            # Bottom chord
            s += (f'<line x1="{_tbot_left:.1f}" y1="{_tbot_y:.1f}" '
                  f'x2="{_tbot_right:.1f}" y2="{_tbot_y:.1f}" '
                  f'stroke="{web_stroke}" stroke-width="{chord_w}"/>\n')
            # Web: king post + diagonals + verticals
            web_lines = [
                ((cx, _t_ttop_y), (cx, _tbot_y)),
                ((cx, _t_ttop_y), (_tbot_q1, _tbot_y)),
                ((cx, _t_ttop_y), (_tbot_q3, _tbot_y)),
                ((_tmid_l, _tmid_top_y), (_tbot_q1, _tbot_y)),
                ((_tmid_r, _tmid_top_y), (_tbot_q3, _tbot_y)),
            ]
            for a, b in web_lines:
                s += (f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" '
                      f'x2="{b[0]:.1f}" y2="{b[1]:.1f}" '
                      f'stroke="{web_stroke}" stroke-width="{web_w}" '
                      f'opacity="0.9"/>\n')
            # Panel-point dots
            for p in [(_tbot_left, _tbot_y), (_tbot_q1, _tbot_y),
                       (cx, _tbot_y), (_tbot_q3, _tbot_y),
                       (_tbot_right, _tbot_y),
                       (_tmid_l, _tmid_top_y), (cx, _t_ttop_y),
                       (_tmid_r, _tmid_top_y)]:
                s += (f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="2.0" '
                      f'fill="{web_stroke}"/>\n')

            # Ring beam markers — small squares at the truss bottom chord ends
            # (representing the ring beam cross-section, into the page)
            _rb_sz = max(4.0, _in_to_px_generic(ring_beam_size[1], s_scale))
            for xr, yr in [(_tbot_left, _tbot_y), (_tbot_right, _tbot_y)]:
                s += (f'<rect x="{xr - _rb_sz/2:.1f}" y="{yr - _rb_sz/2:.1f}" '
                      f'width="{_rb_sz:.1f}" height="{_rb_sz:.1f}" '
                      f'fill="{ring_stroke_sec}" stroke="{ring_stroke_sec}"/>\n')

            # ---- Central ridge beam cross-section at the roof apex ----
            # In Section A-A (cut perpendicular to the ridge) we see the
            # ridge beam end-on. Draw it as a rectangle at the apex, sitting
            # between the truss peak and the roof surface.
            ridge_stroke_sec = '#5a3a17'
            ridge_fill_sec = '#a6764a'
            _rd_w_px = max(6.0, ridge_width_u * s_scale)
            _rd_h_px = max(4.0, ridge_depth_u * s_scale)
            _rd_x = cx - _rd_w_px / 2
            _rd_y = geom['t_y']  # roof peak (top of ridge)
            s += (f'<rect x="{_rd_x:.1f}" y="{_rd_y:.1f}" '
                  f'width="{_rd_w_px:.1f}" height="{_rd_h_px:.1f}" '
                  f'fill="{ridge_fill_sec}" stroke="{ridge_stroke_sec}" '
                  f'stroke-width="1.4"/>\n')
            s += (f'<text x="{_rd_x + _rd_w_px + 6:.1f}" y="{_rd_y + _rd_h_px/2 + 4:.1f}" '
                  f'text-anchor="start" font-size="10" fill="{ridge_stroke_sec}" '
                  f'font-weight="600">Ridge beam '
                  f'{ridge_size_in[0]}"×{ridge_size_in[1]}"</text>\n')

            # ---- House wall parapet upstands aligned with the ring beam ----
            # Walls at ±house_trans_u/2 from centre, extending from the eave
            # baseline up to wall_top. The rafters visibly rest on the walls
            # (which carry the ring beam at wall top).
            wall_fill = '#eeeeee'
            wall_stroke = '#666'
            _wall_thk_u = 8.0 / IN_PER_UNIT   # 8" nominal wall thickness
            _wall_thk_px = _wall_thk_u * s_scale
            _wall_top_svg_y_a = baseline_y - wall_top_u * s_scale
            _wall_L_cx = cx - (house_trans_u / 2) * s_scale
            _wall_R_cx = cx + (house_trans_u / 2) * s_scale
            s += (f'<rect x="{_wall_L_cx - _wall_thk_px/2:.1f}" '
                  f'y="{_wall_top_svg_y_a:.1f}" '
                  f'width="{_wall_thk_px:.1f}" '
                  f'height="{baseline_y - _wall_top_svg_y_a:.1f}" '
                  f'fill="{wall_fill}" stroke="{wall_stroke}" '
                  f'stroke-width="0.9"/>\n')
            s += (f'<rect x="{_wall_R_cx - _wall_thk_px/2:.1f}" '
                  f'y="{_wall_top_svg_y_a:.1f}" '
                  f'width="{_wall_thk_px:.1f}" '
                  f'height="{baseline_y - _wall_top_svg_y_a:.1f}" '
                  f'fill="{wall_fill}" stroke="{wall_stroke}" '
                  f'stroke-width="0.9"/>\n')
            s += (f'<text x="{_wall_L_cx:.1f}" y="{baseline_y + 12:.1f}" '
                  f'text-anchor="middle" font-size="10" fill="{wall_stroke}" '
                  f'font-weight="600">Wall</text>\n')
            s += (f'<text x="{_wall_R_cx:.1f}" y="{baseline_y + 12:.1f}" '
                  f'text-anchor="middle" font-size="10" fill="{wall_stroke}" '
                  f'font-weight="600">Wall</text>\n')

            # Notes about wall level and truss dimensions
            s += (f'<text x="{x0 + w_p - 12:.1f}" y="{y0 + 36 + 32:.1f}" '
                  f'text-anchor="end" font-size="11" fill="{web_stroke}">'
                  f'Fink × {truss_count} — {dim_text(truss_bottom_chord_len)} × '
                  f'{dim_text(truss_king_post_len)} rise, bottom chord on ring beam</text>\n')
            s += (f'<text x="{x0 + w_p - 12:.1f}" y="{y0 + 36 + 46:.1f}" '
                  f'text-anchor="end" font-size="11" fill="{ring_stroke_sec}">'
                  f'Ring beam at wall top ({wall_top_above_eave_ft*12:.0f}" above eave)</text>\n')
        return s

    def _in_to_px_generic(inches, scale_):
        """Local helper for section overlays — converts inches to SVG px
        using the given world-unit scale (px per world unit)."""
        return (inches / IN_PER_UNIT) * scale_

    def section_bb_panel(x0, y0, w_p, h_p):
        # Longitudinal: along ridge → N-S cross section for axis='y'.
        # Trapezoid can be asymmetric (d_hip_n != d_hip_s).
        if ridge_axis == 'y':
            base_span = span_y
            _pitch_L = slopes[2]['pitch']   # N hip pitch
            _pitch_R = slopes[3]['pitch']   # S hip pitch
            _tol_L = d_hip_n                # offset from bl to tl
            _tol_R = d_hip_s                # offset from br to tr
        else:
            base_span = span_x
            _pitch_L = slopes[2]['pitch']
            _pitch_R = slopes[3]['pitch']
            _tol_L = d_hip_w
            _tol_R = d_hip_e
        angle_val = (_pitch_L + _pitch_R) / 2.0
        s, geom = section_panel_generic(x0, y0, w_p, h_p,
                                        'SECTION B–B : LONGITUDINAL (along ridge) — TRUSS LOCATIONS',
                                        is_trapezoid=True,
                                        base_span=base_span, top_span=ridge_length,
                                        height_val=h, angle_val=angle_val,
                                        return_geom=True,
                                        top_offset_left=_tol_L,
                                        top_offset_right=_tol_R,
                                        angle_left=_pitch_L,
                                        angle_right=_pitch_R,
                                        skip_base_corners=True)

        # ---- Rafters + purlins on the two HIP-END slopes ----
        # In Section B-B (cut along the ridge) the trapezoid's two slanted
        # sides ARE the hip-end slope profiles. Draw one rafter along each
        # slanted side, with purlins rotated to sit on top — mirroring how
        # Section A-A treats the two main slopes. Purlin count and spacing
        # match the top view's hip-end convention.
        bl_b = geom['bl']; br_b = geom['br']
        tl_b = geom['tl']; tr_b = geom['tr']
        baseline_y_b = geom['baseline_y']; t_y_b = geom['t_y']
        cx_b = geom['cx']; s_scale_b = geom['s_scale']
        rafter_stroke_sec = '#8B4513'
        purlin_fill_sec = '#a8c9e0'
        purlin_stroke_sec = '#4a8fbf'
        hip_pitch_n = slopes[2]['pitch']
        hip_pitch_s = slopes[3]['pitch']
        # Rafter along each hip slope (dashed roof outline already drawn
        # underneath as context). Draw the rafter as a solid thick line so
        # its cross-section reads at a glance.
        _raft_line_w_b = max(2.4, rafter_size_in[1] / IN_PER_UNIT * s_scale_b * 0.55)
        # N hip end: bl_b (N eave) → tl_b (N ridge endpoint)
        s += (f'<line x1="{bl_b[0]:.1f}" y1="{bl_b[1]:.1f}" '
              f'x2="{tl_b[0]:.1f}" y2="{tl_b[1]:.1f}" '
              f'stroke="{rafter_stroke_sec}" stroke-width="{_raft_line_w_b:.1f}" '
              f'stroke-linecap="round"/>\n')
        # S hip end: br_b (S eave) → tr_b (S ridge endpoint)
        s += (f'<line x1="{br_b[0]:.1f}" y1="{br_b[1]:.1f}" '
              f'x2="{tr_b[0]:.1f}" y2="{tr_b[1]:.1f}" '
              f'stroke="{rafter_stroke_sec}" stroke-width="{_raft_line_w_b:.1f}" '
              f'stroke-linecap="round"/>\n')
        # Rotated purlin cross-sections along each hip-end rafter. Same
        # horizontal-step convention as the top view; N and S hips may
        # have different pitches (asymmetric roof) so each side uses its
        # own step and count.
        _purlin_w_px_b = max(3.0, purlin_size_in[0] / IN_PER_UNIT * s_scale_b)
        _purlin_d_px_b = max(2.0, purlin_size_in[1] / IN_PER_UNIT * s_scale_b)
        _purlin_step_slope_u_b = purlin_spacing_in / IN_PER_UNIT
        _hip_step_n_u = _purlin_step_slope_u_b * math.cos(math.radians(hip_pitch_n))
        _hip_step_s_u = _purlin_step_slope_u_b * math.cos(math.radians(hip_pitch_s))
        _n_hip_purl_n = int(d_hip_n / _hip_step_n_u) if _hip_step_n_u > 0 else 0
        _n_hip_purl_s = int(d_hip_s / _hip_step_s_u) if _hip_step_s_u > 0 else 0
        # Rafter slopes (rise/run in svg coords)
        _hipL_run_u = (tl_b[0] - bl_b[0]) / s_scale_b
        _hipL_rise_px = tl_b[1] - bl_b[1]  # negative (upward)
        _hipR_run_u = (br_b[0] - tr_b[0]) / s_scale_b
        _hipR_rise_px = tr_b[1] - br_b[1]
        for i in range(1, _n_hip_purl_n + 1):
            _dx_u = i * _hip_step_n_u
            _dx_px = _dx_u * s_scale_b
            pxN = bl_b[0] + _dx_px
            _t_N = min(1.0, _dx_u / _hipL_run_u) if _hipL_run_u > 0 else 1.0
            pyN = bl_b[1] + _t_N * _hipL_rise_px
            s += (f'<g transform="translate({pxN:.1f},{pyN:.1f}) '
                  f'rotate({-hip_pitch_n:.1f})">'
                  f'<rect x="{-_purlin_w_px_b/2:.1f}" y="{-_purlin_d_px_b:.1f}" '
                  f'width="{_purlin_w_px_b:.1f}" height="{_purlin_d_px_b:.1f}" '
                  f'fill="{purlin_fill_sec}" stroke="{purlin_stroke_sec}" '
                  f'stroke-width="0.6"/></g>\n')
        for i in range(1, _n_hip_purl_s + 1):
            _dx_u = i * _hip_step_s_u
            _dx_px = _dx_u * s_scale_b
            pxS = br_b[0] - _dx_px
            _t_S = min(1.0, _dx_u / _hipR_run_u) if _hipR_run_u > 0 else 1.0
            pyS = br_b[1] + _t_S * _hipR_rise_px
            s += (f'<g transform="translate({pxS:.1f},{pyS:.1f}) '
                  f'rotate({hip_pitch_s:.1f})">'
                  f'<rect x="{-_purlin_w_px_b/2:.1f}" y="{-_purlin_d_px_b:.1f}" '
                  f'width="{_purlin_w_px_b:.1f}" height="{_purlin_d_px_b:.1f}" '
                  f'fill="{purlin_fill_sec}" stroke="{purlin_stroke_sec}" '
                  f'stroke-width="0.6"/></g>\n')

        # Overlay truss LOCATIONS: each truss appears as a vertical line from
        # ridge line down to eave (bottom-chord) level, at its longitudinal
        # position within the ridge zone.
        if truss_count > 0:
            bl = geom['bl']; br = geom['br']
            tl = geom['tl']; tr = geom['tr']
            baseline_y = geom['baseline_y']; t_y = geom['t_y']
            s_scale = geom['s_scale']
            # Map a world y (longitudinal) to SVG x on this section
            # bl is at world y = eave_yn (for axis='y') or eave_xw (axis='x'),
            # br is at world y = eave_ys or eave_xe
            if ridge_axis == 'y':
                world_start = eave_yn
                world_end = eave_ys
            else:
                world_start = eave_xw
                world_end = eave_xe
            def _world_to_sx(wy):
                return bl[0] + (wy - world_start) / (world_end - world_start) * (br[0] - bl[0])
            truss_stroke = '#8b0000'
            ring_stroke_sec = '#1e5aa6'
            ridge_stroke_sec = '#5a3a17'
            ridge_fill_sec = '#a6764a'
            truss_svg_xs = [_world_to_sx(wy) for wy in truss_y_positions]
            # Wall-top y level in svg coords (bottom-chord line for trusses,
            # ring beam runs horizontally across at this level).
            _wall_top_svg_y = baseline_y - wall_top_u * s_scale
            # Ridge beam sits at the roof peak; its bottom is where the
            # truss peaks meet it.
            _ridge_bot_svg_y = t_y + ridge_depth_u * s_scale

            # ---- Central ridge beam along the top of the trapezoid ----
            # In Section B-B the ridge beam is seen in side profile: it runs
            # the full length of the ridge (tl → tr) with depth = ridge_depth.
            s += (f'<rect x="{tl[0]:.1f}" y="{t_y:.1f}" '
                  f'width="{(tr[0] - tl[0]):.1f}" '
                  f'height="{ridge_depth_u * s_scale:.1f}" '
                  f'fill="{ridge_fill_sec}" stroke="{ridge_stroke_sec}" '
                  f'stroke-width="1.4"/>\n')
            s += (f'<text x="{tl[0] + 8:.1f}" y="{t_y + ridge_depth_u * s_scale / 2 + 4:.1f}" '
                  f'text-anchor="start" font-size="10" fill="#ffffff" '
                  f'font-weight="700">Ridge beam '
                  f'{ridge_size_in[0]}"×{ridge_size_in[1]}"</text>\n')

            # ---- Ring beam horizontal line at wall-top level ----
            # In section B-B (longitudinal), the ring beam runs from the N
            # wall (world y = world_start + wall_inset_long_n) to the S wall
            # (world y = world_end − wall_inset_long_s).
            _rb_start_sx = _world_to_sx(world_start + wall_inset_long_n)
            _rb_end_sx = _world_to_sx(world_end - wall_inset_long_s)
            s += (f'<line x1="{_rb_start_sx:.1f}" y1="{_wall_top_svg_y:.1f}" '
                  f'x2="{_rb_end_sx:.1f}" y2="{_wall_top_svg_y:.1f}" '
                  f'stroke="{ring_stroke_sec}" stroke-width="2.6" '
                  f'opacity="0.95"/>\n')
            # Small ring beam label at the left end
            s += (f'<text x="{_rb_start_sx + 8:.1f}" y="{_wall_top_svg_y - 4:.1f}" '
                  f'text-anchor="start" font-size="10" fill="{ring_stroke_sec}" '
                  f'font-weight="600">Ring beam</text>\n')

            # Draw vertical truss markers from the RIDGE BEAM BOTTOM down to
            # wall-top (truss peak meets ridge underside, bottom chord meets
            # the ring beam).
            for i, sx in enumerate(truss_svg_xs):
                s += (f'<line x1="{sx:.1f}" y1="{_ridge_bot_svg_y:.1f}" '
                      f'x2="{sx:.1f}" y2="{_wall_top_svg_y:.1f}" '
                      f'stroke="{truss_stroke}" stroke-width="2.0" '
                      f'opacity="0.85"/>\n')
                # Dot at peak (below ridge) and wall-top (bottom-chord)
                s += (f'<circle cx="{sx:.1f}" cy="{_ridge_bot_svg_y:.1f}" r="2.8" '
                      f'fill="{truss_stroke}"/>\n')
                s += (f'<circle cx="{sx:.1f}" cy="{_wall_top_svg_y:.1f}" r="2.8" '
                      f'fill="{truss_stroke}"/>\n')
                # Label above (T1..Tn)
                s += (f'<text x="{sx:.1f}" y="{t_y - 6:.1f}" '
                      f'text-anchor="middle" font-size="10" font-weight="700" '
                      f'fill="{truss_stroke}">T{i+1}</text>\n')

            # Truss rise dimension (from ring beam up to ridge beam bottom)
            _rise_dim_x = truss_svg_xs[-1] + 20
            s += (f'<line x1="{_rise_dim_x:.1f}" y1="{_ridge_bot_svg_y:.1f}" '
                  f'x2="{_rise_dim_x:.1f}" y2="{_wall_top_svg_y:.1f}" '
                  f'stroke="#0066cc" stroke-width="1" '
                  f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                  # Extension lines from ridge and wall-top to the dim
            s += (f'<text x="{_rise_dim_x + 4:.1f}" '
                  f'y="{(_ridge_bot_svg_y + _wall_top_svg_y) / 2 + 4:.1f}" '
                  f'text-anchor="start" font-size="10" fill="#0066cc">'
                  f'rise {dim_text(truss_king_post_len)}</text>\n')
            # Wall-top-above-eave dim
            s += (f'<line x1="{_rise_dim_x:.1f}" y1="{_wall_top_svg_y:.1f}" '
                  f'x2="{_rise_dim_x:.1f}" y2="{baseline_y:.1f}" '
                  f'stroke="#0066cc" stroke-width="0.7" '
                  f'stroke-dasharray="3,2"/>\n')
            s += (f'<text x="{_rise_dim_x + 4:.1f}" '
                  f'y="{(_wall_top_svg_y + baseline_y) / 2 + 4:.1f}" '
                  f'text-anchor="start" font-size="9" fill="#666">'
                  f'wall top {wall_top_above_eave_ft*12:.0f}"</text>\n')

            # Dimension chain above ridge showing spacing between trusses
            if truss_count >= 2:
                dim_y = t_y - 22
                blue = '#0066cc'
                # Extension lines from each truss up to dim_y
                for sx in truss_svg_xs:
                    s += (f'<line x1="{sx:.1f}" y1="{t_y - 14:.1f}" '
                          f'x2="{sx:.1f}" y2="{dim_y + 4:.1f}" '
                          f'stroke="{blue}" stroke-width="0.5" '
                          f'stroke-dasharray="2,2"/>\n')
                for i in range(truss_count - 1):
                    x1, x2 = truss_svg_xs[i], truss_svg_xs[i + 1]
                    # Compute actual spacing dimension in world units
                    _spacing_u = abs(truss_y_positions[i + 1] - truss_y_positions[i])
                    s += (f'<line x1="{x1:.1f}" y1="{dim_y:.1f}" '
                          f'x2="{x2:.1f}" y2="{dim_y:.1f}" '
                          f'stroke="{blue}" stroke-width="1" '
                          f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                    s += (f'<text x="{(x1+x2)/2:.1f}" y="{dim_y - 4:.1f}" '
                          f'text-anchor="middle" font-size="10" fill="{blue}">'
                          f'{dim_text(_spacing_u)}</text>\n')

            # ---- House wall parapet upstands aligned with the ring beam ----
            # Walls at ±house_long_u/2 from centre; both walls sit under the
            # ring beam. In B-B (longitudinal cut) we see the N and S walls
            # in true elevation.
            wall_fill_b = '#eeeeee'
            wall_stroke_b = '#666'
            _wall_thk_u_b = 8.0 / IN_PER_UNIT
            _wall_thk_px_b = _wall_thk_u_b * s_scale
            _wall_N_cx = _world_to_sx(world_start + wall_inset_long_n)
            _wall_S_cx = _world_to_sx(world_end - wall_inset_long_s)
            for _wcx in (_wall_N_cx, _wall_S_cx):
                s += (f'<rect x="{_wcx - _wall_thk_px_b/2:.1f}" '
                      f'y="{_wall_top_svg_y:.1f}" '
                      f'width="{_wall_thk_px_b:.1f}" '
                      f'height="{baseline_y - _wall_top_svg_y:.1f}" '
                      f'fill="{wall_fill_b}" stroke="{wall_stroke_b}" '
                      f'stroke-width="0.9"/>\n')
            s += (f'<text x="{_wall_N_cx:.1f}" y="{baseline_y + 12:.1f}" '
                  f'text-anchor="middle" font-size="10" fill="{wall_stroke_b}" '
                  f'font-weight="600">N wall</text>\n')
            s += (f'<text x="{_wall_S_cx:.1f}" y="{baseline_y + 12:.1f}" '
                  f'text-anchor="middle" font-size="10" fill="{wall_stroke_b}" '
                  f'font-weight="600">S wall</text>\n')

            # ---- Base corner angles (drawn ON TOP of the walls) ----
            # section_panel_generic was called with skip_base_corners=True
            # so the labels can be drawn here in SVG source order AFTER
            # the wall rectangles, making them visible on top.
            s += (f'<text x="{bl[0] + 8}" y="{baseline_y - 6}" '
                  f'text-anchor="start" font-size="11" fill="#333">'
                  f'{_pitch_L:.1f}°</text>\n')
            s += (f'<text x="{br[0] - 8}" y="{baseline_y - 6}" '
                  f'text-anchor="end" font-size="11" fill="#333">'
                  f'{_pitch_R:.1f}°</text>\n')

            # ---- Truss position chain (wall-relative) + overhang dims ----
            # Main chain measures from N wall → T1 → T2 → T3 → S wall (so
            # spacings can be used directly for setting out trusses on the
            # ring beam). Below that, two small overhang dims mark the
            # roof extension past each wall.
            _pos_dim_y = baseline_y + 62
            _n_wall_world = world_start + wall_inset_long_n
            _s_wall_world = world_end - wall_inset_long_s
            _pos_pts = ([_wall_N_cx] + list(truss_svg_xs) + [_wall_S_cx])
            _pos_worlds = ([_n_wall_world] + list(truss_y_positions)
                           + [_s_wall_world])
            # Extension ticks down to the dim level (from wall_top)
            for _px in _pos_pts:
                s += (f'<line x1="{_px:.1f}" y1="{baseline_y + 40:.1f}" '
                      f'x2="{_px:.1f}" y2="{_pos_dim_y + 4:.1f}" '
                      f'stroke="#0066cc" stroke-width="0.5" '
                      f'stroke-dasharray="2,2"/>\n')
            for _i in range(len(_pos_pts) - 1):
                _x1 = _pos_pts[_i]; _x2 = _pos_pts[_i + 1]
                _dist_u = abs(_pos_worlds[_i + 1] - _pos_worlds[_i])
                s += (f'<line x1="{_x1:.1f}" y1="{_pos_dim_y:.1f}" '
                      f'x2="{_x2:.1f}" y2="{_pos_dim_y:.1f}" '
                      f'stroke="#0066cc" stroke-width="1" '
                      f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
                s += (f'<text x="{(_x1 + _x2) / 2:.1f}" y="{_pos_dim_y - 4:.1f}" '
                      f'text-anchor="middle" font-size="10" fill="#0066cc">'
                      f'{dim_text(_dist_u)}</text>\n')
            _lbls = ['N wall'] + [f'T{i+1}' for i in range(truss_count)] + ['S wall']
            for _px, _lbl in zip(_pos_pts, _lbls):
                s += (f'<text x="{_px:.1f}" y="{_pos_dim_y + 16:.1f}" '
                      f'text-anchor="middle" font-size="10" '
                      f'fill="#0066cc">{_lbl}</text>\n')

            # ---- Overhang dims (roof extension past each wall) ----
            _ovh_dim_y = _pos_dim_y + 34
            _oh_stroke = '#8B4513'
            # N overhang: N eave → N wall
            s += (f'<line x1="{bl[0]:.1f}" y1="{baseline_y + 40:.1f}" '
                  f'x2="{bl[0]:.1f}" y2="{_ovh_dim_y + 4:.1f}" '
                  f'stroke="{_oh_stroke}" stroke-width="0.5" '
                  f'stroke-dasharray="2,2"/>\n')
            s += (f'<line x1="{_wall_N_cx:.1f}" y1="{_pos_dim_y + 20:.1f}" '
                  f'x2="{_wall_N_cx:.1f}" y2="{_ovh_dim_y + 4:.1f}" '
                  f'stroke="{_oh_stroke}" stroke-width="0.5" '
                  f'stroke-dasharray="2,2"/>\n')
            s += (f'<line x1="{bl[0]:.1f}" y1="{_ovh_dim_y:.1f}" '
                  f'x2="{_wall_N_cx:.1f}" y2="{_ovh_dim_y:.1f}" '
                  f'stroke="{_oh_stroke}" stroke-width="1" '
                  f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
            s += (f'<text x="{(bl[0] + _wall_N_cx) / 2:.1f}" '
                  f'y="{_ovh_dim_y - 4:.1f}" text-anchor="middle" '
                  f'font-size="10" fill="{_oh_stroke}">'
                  f'N overhang {dim_text(wall_inset_long_n)}</text>\n')
            # S overhang: S wall → S eave
            s += (f'<line x1="{br[0]:.1f}" y1="{baseline_y + 40:.1f}" '
                  f'x2="{br[0]:.1f}" y2="{_ovh_dim_y + 4:.1f}" '
                  f'stroke="{_oh_stroke}" stroke-width="0.5" '
                  f'stroke-dasharray="2,2"/>\n')
            s += (f'<line x1="{_wall_S_cx:.1f}" y1="{_pos_dim_y + 20:.1f}" '
                  f'x2="{_wall_S_cx:.1f}" y2="{_ovh_dim_y + 4:.1f}" '
                  f'stroke="{_oh_stroke}" stroke-width="0.5" '
                  f'stroke-dasharray="2,2"/>\n')
            s += (f'<line x1="{_wall_S_cx:.1f}" y1="{_ovh_dim_y:.1f}" '
                  f'x2="{br[0]:.1f}" y2="{_ovh_dim_y:.1f}" '
                  f'stroke="{_oh_stroke}" stroke-width="1" '
                  f'marker-start="url(#arr)" marker-end="url(#arr)"/>\n')
            s += (f'<text x="{(_wall_S_cx + br[0]) / 2:.1f}" '
                  f'y="{_ovh_dim_y - 4:.1f}" text-anchor="middle" '
                  f'font-size="10" fill="{_oh_stroke}">'
                  f'S overhang {dim_text(wall_inset_long_s)}</text>\n')

            # Note about truss count in top-right corner (below the pitch label)
            s += (f'<text x="{x0 + w_p - 12:.1f}" y="{y0 + 36 + 32:.1f}" '
                  f'text-anchor="end" font-size="11" fill="{truss_stroke}">'
                  f'{truss_count} common (Fink) trusses shown</text>\n')

        # Overlay the LONGITUDINAL trapezoidal truss profile INSIDE the trapezoid.
        # This truss shape IS the Section B-B outline, so we draw its interior
        # web members (king post + ridge-end verticals + Warren diagonals).
        if long_truss_count > 0:
            bl = geom['bl']; br = geom['br']
            tl = geom['tl']; tr = geom['tr']
            baseline_y = geom['baseline_y']; t_y = geom['t_y']
            cx = geom['cx']
            long_stroke = '#005a55'
            long_w = 1.6
            # Chord points already covered by the trapezoid outline.
            # King post at centre:
            s += (f'<line x1="{cx:.1f}" y1="{t_y:.1f}" x2="{cx:.1f}" y2="{baseline_y:.1f}" '
                  f'stroke="{long_stroke}" stroke-width="{long_w}" opacity="0.85"/>\n')
            # Ridge-endpoint verticals (tl-to-directly-below-on-baseline, and tr):
            s += (f'<line x1="{tl[0]:.1f}" y1="{tl[1]:.1f}" '
                  f'x2="{tl[0]:.1f}" y2="{baseline_y:.1f}" '
                  f'stroke="{long_stroke}" stroke-width="{long_w}" opacity="0.85"/>\n')
            s += (f'<line x1="{tr[0]:.1f}" y1="{tr[1]:.1f}" '
                  f'x2="{tr[0]:.1f}" y2="{baseline_y:.1f}" '
                  f'stroke="{long_stroke}" stroke-width="{long_w}" opacity="0.85"/>\n')
            # Interior Warren diagonals (4 total: LEFT trapezoid & RIGHT trapezoid
            # each split into 2 diagonals by a bottom-chord midpoint)
            # Left half: bl → tl-directly-below-baseline midpoint → tl
            bl_below = (tl[0], baseline_y)
            br_below = (tr[0], baseline_y)
            left_mid_bot = ((bl[0] + bl_below[0]) / 2, baseline_y)
            right_mid_bot = ((br[0] + br_below[0]) / 2, baseline_y)
            # Left: from left mid-bot to tl
            s += (f'<line x1="{left_mid_bot[0]:.1f}" y1="{left_mid_bot[1]:.1f}" '
                  f'x2="{tl[0]:.1f}" y2="{tl[1]:.1f}" '
                  f'stroke="{long_stroke}" stroke-width="{long_w}" opacity="0.85"/>\n')
            # Right: from right mid-bot to tr
            s += (f'<line x1="{right_mid_bot[0]:.1f}" y1="{right_mid_bot[1]:.1f}" '
                  f'x2="{tr[0]:.1f}" y2="{tr[1]:.1f}" '
                  f'stroke="{long_stroke}" stroke-width="{long_w}" opacity="0.85"/>\n')
            # Central Warren diagonals across the rectangular middle
            mid_left_top = ((tl[0] + cx) / 2, t_y)
            mid_right_top = ((cx + tr[0]) / 2, t_y)
            mid_left_bot = ((bl_below[0] + cx) / 2, baseline_y)
            mid_right_bot = ((cx + br_below[0]) / 2, baseline_y)
            s += (f'<line x1="{tl[0]:.1f}" y1="{tl[1]:.1f}" '
                  f'x2="{mid_left_bot[0]:.1f}" y2="{mid_left_bot[1]:.1f}" '
                  f'stroke="{long_stroke}" stroke-width="{long_w}" opacity="0.85"/>\n')
            s += (f'<line x1="{tr[0]:.1f}" y1="{tr[1]:.1f}" '
                  f'x2="{mid_right_bot[0]:.1f}" y2="{mid_right_bot[1]:.1f}" '
                  f'stroke="{long_stroke}" stroke-width="{long_w}" opacity="0.85"/>\n')
            # Note in top-right corner
            s += (f'<text x="{x0 + w_p - 12:.1f}" y="{y0 + 36 + 46:.1f}" '
                  f'text-anchor="end" font-size="11" fill="{long_stroke}">'
                  f'{long_truss_count} longitudinal (⊥) trusses — profile matches this section</text>\n')

        return s

    # ---------- Compose SVG ----------
    svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{canvas_w}" height="{canvas_h}" viewBox="0 0 {canvas_w} {canvas_h}">
<title>Hip Roof — Slope Views &amp; Framing</title>
<defs>
  <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#0066cc"/>
  </marker>
  <style>text {{ font-family: -apple-system, Arial, sans-serif; }}</style>
</defs>
<rect width="{canvas_w}" height="{canvas_h}" fill="#fafafa"/>
<text x="{canvas_w / 2}" y="34" text-anchor="middle" font-size="22" font-weight="bold" fill="#222">Hip Roof — Slope Views &amp; Framing</text>
'''
    # Row 0: top view (roof plan showing rafters + purlins)
    top_view_y0 = canvas_title_h + outer_pad
    svg += top_view_panel(outer_pad, top_view_y0,
                          canvas_w - 2 * outer_pad, top_view_h)

    # Row 1: perspective on the left, two cross sections stacked on the right
    persp_y0 = top_view_y0 + top_view_h + row_gap
    svg += perspective_panel(outer_pad, persp_y0, panel_w, persp_row_h)
    right_col_x = outer_pad + panel_w + col_gap
    svg += section_aa_panel(right_col_x, persp_y0, panel_w, section_h)
    svg += section_bb_panel(right_col_x, persp_y0 + section_h + row_gap,
                            panel_w, section_h)

    # Row 2: one MAIN slope + N hip. Main slopes W/E are still identical.
    # For asymmetric roofs the N and S hip ends differ — S is drawn on a
    # new row 3 below.
    grid_y0 = persp_y0 + persp_row_h + row_gap
    main_repr = dict(slopes[0])   # W (or N for axis='x')
    hip_n_repr = dict(slopes[2])  # N (or W for axis='x')
    hip_s_repr = dict(slopes[3])  # S (or E for axis='x')
    main_repr['title'] = (f'MAIN SLOPES — {slopes[0]["code"]} &amp; {slopes[1]["code"]} '
                          '(trapezoid, identical pair)')
    # Asymmetric-aware titles
    _hips_are_identical = abs(hip_n_repr['pitch'] - hip_s_repr['pitch']) < 0.1
    if _hips_are_identical:
        hip_n_repr['title'] = (f'HIP ENDS — {slopes[2]["code"]} &amp; {slopes[3]["code"]} '
                               '(triangle, identical pair)')
    else:
        hip_n_repr['title'] = (f'HIP END — {slopes[2]["code"]} '
                               f'(triangle, {hip_n_repr["pitch"]:.1f}°)')
        hip_s_repr['title'] = (f'HIP END — {slopes[3]["code"]} '
                               f'(triangle, {hip_s_repr["pitch"]:.1f}°)')
    svg += slope_panel(outer_pad, grid_y0, main_repr)
    svg += slope_panel(outer_pad + panel_w + col_gap, grid_y0, hip_n_repr)
    # Row 2b: S hip panel when hips are asymmetric
    if not _hips_are_identical:
        grid_y0_s = grid_y0 + panel_h + row_gap
        svg += slope_panel(outer_pad + panel_w + col_gap, grid_y0_s, hip_s_repr)
        framing_y0 = grid_y0_s + panel_h + row_gap
    else:
        framing_y0 = grid_y0 + panel_h + row_gap
    svg += framing_detail_panel(outer_pad, framing_y0)

    # ---- Embed hand-maintained eave cross-section ----
    # docs/roof-cross-section.svg is A4-landscape (viewBox 297 × 210 mm).
    # Read it at generation time and drop the inner content into a nested
    # <svg> element sized to our panel, preserving the aspect ratio.
    eave_y0 = framing_y0 + framing_panel_h + row_gap
    svg += (f'<rect x="{outer_pad}" y="{eave_y0}" '
            f'width="{external_eave_panel_w}" height="{external_eave_panel_h:.1f}" '
            f'fill="#ffffff" stroke="#bbb" stroke-width="1"/>\n')
    svg += (f'<rect x="{outer_pad}" y="{eave_y0}" '
            f'width="{external_eave_panel_w}" height="40" '
            f'fill="#f2f2f2" stroke="#bbb" stroke-width="1"/>\n')
    svg += (f'<text x="{outer_pad + external_eave_panel_w / 2}" y="{eave_y0 + 27}" '
            f'text-anchor="middle" font-size="18" font-weight="600" fill="#222">'
            f'EAVE CROSS SECTION — hand-drawn detail '
            f'(docs/roof-cross-section.svg)</text>\n')
    try:
        with open(external_eave_svg_path, 'r', encoding='utf-8') as _ef:
            _external = _ef.read()
        # Strip the XML declaration and outer <svg ...> wrapper; keep only
        # the inner content between opening <svg ...> and </svg>.
        import re as _re
        _m = _re.search(r'<svg\b[^>]*>(.*)</svg>', _external, flags=_re.DOTALL)
        _inner = _m.group(1) if _m else ''
        # Extract the source viewBox so we can preserve it
        _vb = _re.search(r'viewBox\s*=\s*"([^"]+)"', _external)
        _view_box = _vb.group(1) if _vb else '0 0 297 210'
        # Wrap the inner content in a nested <svg> positioned as a panel.
        # A small vertical offset accounts for our 40 px title bar.
        _title_bar = 40
        svg += (f'<svg x="{outer_pad}" y="{eave_y0 + _title_bar}" '
                f'width="{external_eave_panel_w}" '
                f'height="{external_eave_panel_h - _title_bar:.1f}" '
                f'viewBox="{_view_box}" '
                f'preserveAspectRatio="xMidYMid meet">\n')
        svg += _inner
        svg += '</svg>\n'
    except FileNotFoundError:
        # Fallback message if the standalone file is missing.
        svg += (f'<text x="{outer_pad + external_eave_panel_w / 2}" '
                f'y="{eave_y0 + external_eave_panel_h / 2}" '
                f'text-anchor="middle" font-size="14" fill="#b00">'
                f'(docs/roof-cross-section.svg not found — panel skipped)</text>\n')

    # Truss elevation detail panel (after the eave cross-section)
    truss_panel_y0 = eave_y0 + external_eave_panel_h + row_gap
    svg += truss_elevation_panel(outer_pad, truss_panel_y0)
    materials_y0 = truss_panel_y0 + truss_panel_h + row_gap
    svg += materials_takeoff_panel(outer_pad, materials_y0)
    consolidated_y0 = materials_y0 + materials_panel_h + row_gap
    svg += consolidated_bom_panel(outer_pad, consolidated_y0)
    tile_y0 = consolidated_y0 + consolidated_panel_h + row_gap
    svg += tile_panel(outer_pad, tile_y0)
    svg += '</svg>\n'

    output_path = os.path.join(output_dir, 'roof_plan.svg')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(svg)
    print(f"✓ Roof slope drawings + framing detail saved to: {output_path}")
    return output_path
