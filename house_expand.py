"""Room-nested-walls → flat-objects expansion helper.

The house_config schema is being migrated so that walls, doors and windows
can be nested inside the rooms (or the standalone walls) they belong to,
with positions given as offsets along a wall rather than absolute
coordinates. This module contains the one-way translation from the new
nested schema back to the flat top-level schema that the Blender builders
and SVG generators already understand.

Design goals
------------
* **Backward-compatible.** Rooms with the old list-form `walls: ['north',
  'east', ...]` and flat top-level `door` / `window` / `wall` objects pass
  through unchanged. Only nested dict-form walls or standalone walls with
  an `openings` list get rewritten.
* **Idempotent.** `expand_room_walls(cfg)` marks the returned dict with
  `_walls_expanded: True` and short-circuits on the next call. Safe to
  call from every entry point.
* **Non-destructive.** The input dict is never mutated; the helper deep-
  copies before rewriting. Callers can rebind their local reference to the
  returned dict.
* **Validating.** Overlapping openings, out-of-range offsets, and diagonal
  standalone walls without a `facing` hint raise ValueError with a message
  identifying the offending room/wall so migration mistakes are caught at
  config-load time rather than as a mysterious render glitch.
"""

from __future__ import annotations

import copy
import math
from typing import Any, Dict, Iterable, List, Optional


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def expand_room_walls(house_config: Dict[str, Any],
                      wall_thickness: Optional[float] = None) -> Dict[str, Any]:
    """Return a copy of `house_config` with every floor's `objects` list
    expanded so any nested walls / openings become the flat schema the
    downstream builders already consume.

    `wall_thickness` — the world-unit thickness used by `create_room` to
    inset wall centerlines from the room's outer edge. Needed to compute
    the `x`/`y` values the existing `create_door`/`create_window`
    builders expect: for south and east walls the flat opening `y`/`x`
    lands `wall_thickness` inside the room's outer edge, so an offset of
    e.g. 110 along Verandah's north wall maps to `(y=0)` but an offset
    of 98.5 along Living_Kitchen's south wall maps to `(y=length - t)`.

    When called without an explicit value the helper reads
    `config.GLOBAL_CONFIG['wall_thickness']` — the same default the
    Blender builders fall back to. A caller in a test / SVG context that
    wants to use a per-room override can pass it in directly.

    Idempotent — if the config already carries the `_walls_expanded`
    marker the input is returned unchanged.
    """
    if house_config.get('_walls_expanded'):
        return house_config
    if wall_thickness is None:
        try:
            from config import GLOBAL_CONFIG as _GC
            wall_thickness = _GC.get('wall_thickness', 8)
        except Exception:
            wall_thickness = 8
    hc = copy.deepcopy(house_config)
    for floor in hc.get('floors', []):
        objs = floor.get('objects', [])
        # Expand each object in place, but keep the openings a room /
        # standalone wall generates apart from its parent — the original
        # flat schema groups rooms → walls → doors → windows, and we
        # reattach the expanded openings at the end of the floor's list
        # (doors first, then windows) so downstream draw-order (and the
        # SVG bytes) match what a hand-written flat config would produce.
        head: List[Dict[str, Any]] = []
        deferred_doors: List[Dict[str, Any]] = []
        deferred_windows: List[Dict[str, Any]] = []
        for obj in objs:
            first, extras = _expand_object(obj, wall_thickness)
            head.append(first)
            for e in extras:
                bucket = deferred_doors if e['type'] == 'door' else deferred_windows
                bucket.append(e)
        floor['objects'] = head + deferred_doors + deferred_windows
    hc['_walls_expanded'] = True
    return hc


# ---------------------------------------------------------------------------
# Per-object expansion
# ---------------------------------------------------------------------------

def _expand_object(obj: Dict[str, Any], wall_thickness: float) -> tuple:
    """Return (parent_obj, [child_openings]) for a top-level object.

    The parent goes in the "head" list at the original position; child
    openings are collected and deferred to the end of the floor's object
    list by the caller.
    """
    obj_type = obj.get('type')
    if obj_type == 'room':
        return _expand_room(obj, wall_thickness)
    if obj_type == 'wall':
        return _expand_wall(obj)
    return obj, []


# ---------------------------------------------------------------------------
# Room walls
# ---------------------------------------------------------------------------

_SIDES = ('north', 'south', 'east', 'west')


def _expand_room(room: Dict[str, Any], wall_thickness: float) -> tuple:
    walls = room.get('walls')

    # Old list form or absent → pass through. `create_room` already handles
    # both. Nothing to expand because there are no openings to hoist.
    if walls is None or isinstance(walls, list):
        return room, []

    if not isinstance(walls, dict):
        raise ValueError(
            f"Room '{room.get('name')}': `walls` must be a list, a dict "
            f"of {{side: config}}, or omitted (got {type(walls).__name__})."
        )

    rname = room.get('name', 'Room')
    for side in walls:
        if side not in _SIDES:
            raise ValueError(
                f"Room '{rname}': unknown wall side '{side}' — expected one "
                f"of {_SIDES}."
            )
        if not isinstance(walls[side], dict):
            raise ValueError(
                f"Room '{rname}': walls['{side}'] must be a dict "
                f"(got {type(walls[side]).__name__})."
            )

    # Prepare the room object without the nested walls dict. Downstream
    # create_room consumes `walls` as a list of side names + an optional
    # `wall_heights` dict; we rebuild both from the nested config.
    new_room = {k: v for k, v in room.items() if k != 'walls'}
    new_room['walls'] = list(walls.keys())

    # Merge per-wall heights into `wall_heights` while preserving anything
    # the room already set explicitly (nested overrides win).
    merged_heights = dict(room.get('wall_heights') or {})
    for side, wall_cfg in walls.items():
        h_cfg: Dict[str, Any] = {}
        if 'height' in wall_cfg:
            h_cfg['height'] = wall_cfg['height']
        if 'height_end' in wall_cfg:
            h_cfg['height_end'] = wall_cfg['height_end']
        if h_cfg:
            # create_room expects wall_heights entries to be dicts with
            # `height` and optionally `height_end`. Keep existing keys
            # from any pre-set wall_heights (they win over the shortcut).
            existing = dict(merged_heights.get(side) or {})
            for k, v in h_cfg.items():
                existing.setdefault(k, v)
            merged_heights[side] = existing
    if merged_heights:
        new_room['wall_heights'] = merged_heights

    extras: List[Dict[str, Any]] = []

    # Per-wall thickness override (rare); fall back to the room's, then
    # the module-level wall_thickness. Keep whatever numeric type the
    # source config uses so downstream numeric formatting stays stable
    # (int in → int out means '110' stays '110', not '110.0').
    room_thickness = room.get('wall_thickness', wall_thickness)

    # Emit an equivalent flat door / window for every opening. Doors are
    # emitted first (in room-side order) then windows so the final list
    # matches the original hand-written flat schema ordering.
    rx = room['x']; ry = room['y']
    rw = room['width']; rl = room['length']
    door_extras: List[Dict[str, Any]] = []
    window_extras: List[Dict[str, Any]] = []
    for side, wall_cfg in walls.items():
        openings = wall_cfg.get('openings', []) or []
        if not openings:
            continue
        wall_length = rw if side in ('north', 'south') else rl
        _validate_openings(openings, ctx=f"Room '{rname}' {side} wall",
                           wall_length=wall_length)
        side_thickness = wall_cfg.get('thickness', room_thickness)
        for i, op in enumerate(openings):
            flat = _room_opening_to_flat(rname, side, side_thickness,
                                         rx, ry, rw, rl, op, i)
            (door_extras if flat['type'] == 'door' else window_extras).append(flat)
    extras.extend(door_extras)
    extras.extend(window_extras)

    return new_room, extras


def _room_opening_to_flat(rname: str, side: str, wall_thickness: float,
                          rx: float, ry: float,
                          rw: float, rl: float,
                          op: Dict[str, Any], index: int) -> Dict[str, Any]:
    kind = op.get('kind')
    if kind not in ('door', 'window'):
        raise ValueError(
            f"Room '{rname}' {side} opening #{index}: `kind` must be "
            f"'door' or 'window' (got {kind!r})."
        )
    # No float() coercion — preserve the numeric type the source config
    # uses so `offset: 110` stays `x: 110`, not `x: 110.0`. Downstream
    # SVG formatting emits `.0` for float values.
    offset = op['offset']
    width = op['width']
    height = op['height']
    t = wall_thickness

    # create_room places each wall's centerline INSIDE the room by
    # t/2 from the outer edge; create_door/window expect (x, y) at the
    # opening's outer-most corner, which lands at the room's outer edge
    # for N and W but inset by `t` for S and E.
    if side == 'north':
        x, y, direction = rx + offset, ry, 'north'
    elif side == 'south':
        x, y, direction = rx + offset, ry + rl - t, 'south'
    elif side == 'west':
        x, y, direction = rx, ry + offset, 'west'
    else:  # east
        x, y, direction = rx + rw - t, ry + offset, 'east'

    # Explicit override — used e.g. for a door that physically pierces
    # Bedroom_3's south wall but opens *into* Bathroom_2 (facing north).
    if 'direction' in op:
        direction = op['direction']

    name = op.get('name') or f"{rname}_{side.capitalize()}_{kind.capitalize()}_{index + 1}"
    flat: Dict[str, Any] = {
        'type':      kind,
        'name':      name,
        'x':         x,
        'y':         y,
        'width':     width,
        'height':    height,
        'direction': direction,
        'room':      rname,
    }
    if kind == 'window':
        flat['sill_height'] = float(op.get('sill_height', 0))
    if 'material' in op:
        flat['material'] = op['material']
    # Preserve any other custom fields the user may have added.
    for k, v in op.items():
        if k in ('kind', 'name', 'offset', 'width', 'height',
                 'sill_height', 'material'):
            continue
        flat.setdefault(k, v)
    return flat


# ---------------------------------------------------------------------------
# Standalone walls
# ---------------------------------------------------------------------------

def _expand_wall(wall: Dict[str, Any]) -> tuple:
    openings = wall.get('openings')
    if not openings:
        # Strip a trailing empty `openings: []` for cleanliness. Pass
        # everything else through so height overrides / facing hints
        # survive round-trip.
        if 'openings' in wall:
            new_wall = {k: v for k, v in wall.items() if k != 'openings'}
            return new_wall, []
        return wall, []

    # Preserve numeric type (int if the config used ints) so downstream
    # SVG output stays byte-identical — `y="442"` not `y="442.0"`.
    sx = wall['start_x']; sy = wall['start_y']
    ex = wall['end_x'];   ey = wall['end_y']
    dx, dy = ex - sx, ey - sy
    length = math.sqrt(dx * dx + dy * dy)
    wall_name = wall.get('name', 'Wall')
    if length <= 0:
        raise ValueError(
            f"Wall '{wall_name}' has zero length — cannot host openings."
        )
    ux, uy = dx / length, dy / length

    # Determine which of the four cardinal facings the openings pierce.
    # We accept an override on the wall itself; otherwise infer from the
    # dominant axis of the wall vector. Diagonal walls without an
    # override are rejected.
    default_facing = _infer_default_facing(dx, dy, wall_name,
                                           explicit=wall.get('facing'))

    _validate_openings(openings, ctx=f"Wall '{wall_name}'", wall_length=length)

    # Standalone walls carry their own thickness override; fall back to
    # the module-level default the caller resolved from GLOBAL_CONFIG.
    wall_t = wall.get('thickness', _default_wall_thickness())

    new_wall = {k: v for k, v in wall.items() if k != 'openings'}
    door_extras: List[Dict[str, Any]] = []
    window_extras: List[Dict[str, Any]] = []
    for i, op in enumerate(openings):
        flat = _wall_opening_to_flat(wall_name, sx, sy, ux, uy, wall_t,
                                     op.get('facing') or default_facing,
                                     op, i)
        (door_extras if flat['type'] == 'door' else window_extras).append(flat)
    return new_wall, door_extras + window_extras


def _default_wall_thickness() -> float:
    try:
        from config import GLOBAL_CONFIG as _GC
        return _GC.get('wall_thickness', 8)
    except Exception:
        return 8


def _infer_default_facing(dx: float, dy: float, wall_name: str,
                          explicit: Optional[str]) -> str:
    if explicit is not None:
        if explicit not in _SIDES:
            raise ValueError(
                f"Wall '{wall_name}': `facing` must be one of {_SIDES} "
                f"(got {explicit!r})."
            )
        return explicit
    axis_ratio = abs(dx) / max(abs(dy), 1e-9)
    if axis_ratio > 10:      # clearly east–west
        return 'north'
    if axis_ratio < 0.1:     # clearly north–south
        return 'east'
    raise ValueError(
        f"Wall '{wall_name}' is diagonal (dx={dx}, dy={dy}); its openings "
        f"need an explicit `facing` on the wall or on each opening — one "
        f"of {_SIDES}."
    )


def _wall_opening_to_flat(wall_name: str,
                          sx: float, sy: float, ux: float, uy: float,
                          wall_thickness: float,
                          direction: str,
                          op: Dict[str, Any], index: int) -> Dict[str, Any]:
    kind = op.get('kind')
    if kind not in ('door', 'window'):
        raise ValueError(
            f"Wall '{wall_name}' opening #{index}: `kind` must be 'door' "
            f"or 'window' (got {kind!r})."
        )
    offset = op['offset']
    width = op['width']
    height = op['height']

    # Standalone-wall start/end coords describe the wall CENTERLINE.
    # Flat-schema door/window coords sit at the wall's "inner" corner
    # along the wall-normal axis (t/2 back from centerline) — matching
    # what the room-side branch produces (rx+rw-t for east, ry+rl-t for
    # south, etc.). For the common axis-aligned case we do plain
    # arithmetic so int input stays int (avoids "y=442.0" drift in SVG).
    half_t = wall_thickness // 2 if isinstance(wall_thickness, int) else wall_thickness / 2
    if abs(uy) > abs(ux):        # N-S wall → offset along Y, shift X by -t/2
        step = 1 if uy > 0 else -1
        x = sx - half_t
        y = sy + offset * step
    elif abs(ux) > abs(uy):      # E-W wall → offset along X, shift Y by -t/2
        step = 1 if ux > 0 else -1
        x = sx + offset * step
        y = sy - half_t
    else:                        # diagonal — general form (rejected upstream unless facing given)
        x = sx + offset * ux
        y = sy + offset * uy

    name = op.get('name') or f"{wall_name}_{kind.capitalize()}_{index + 1}"
    flat: Dict[str, Any] = {
        'type':      kind,
        'name':      name,
        'x':         x,
        'y':         y,
        'width':     width,
        'height':    height,
        'direction': direction,
        'wall':      wall_name,
    }
    if kind == 'window':
        flat['sill_height'] = float(op.get('sill_height', 0))
    if 'material' in op:
        flat['material'] = op['material']
    for k, v in op.items():
        if k in ('kind', 'name', 'offset', 'width', 'height',
                 'sill_height', 'material', 'facing'):
            continue
        flat.setdefault(k, v)
    return flat


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def _validate_openings(openings: Iterable[Dict[str, Any]], ctx: str,
                       wall_length: float) -> None:
    seen: List[tuple] = []   # (start, end, name) for overlap detection
    for i, op in enumerate(openings):
        if not isinstance(op, dict):
            raise ValueError(
                f"{ctx}: opening #{i} must be a dict "
                f"(got {type(op).__name__})."
            )
        try:
            start = float(op['offset'])
            width = float(op['width'])
        except (KeyError, TypeError, ValueError) as e:
            raise ValueError(
                f"{ctx}: opening #{i} needs numeric `offset` and `width` "
                f"({e})."
            )
        end = start + width
        name = op.get('name') or f'#{i}'
        if start < -0.001:
            raise ValueError(
                f"{ctx}: opening '{name}' has negative offset {start}."
            )
        if end > wall_length + 0.001:
            raise ValueError(
                f"{ctx}: opening '{name}' ends at {end:.2f} but the wall "
                f"is only {wall_length:.2f} units long."
            )
        for other_start, other_end, other_name in seen:
            # Two intervals overlap unless one ends before the other begins.
            if not (end <= other_start + 0.001 or start >= other_end - 0.001):
                raise ValueError(
                    f"{ctx}: openings '{name}' ({start:.2f}–{end:.2f}) and "
                    f"'{other_name}' ({other_start:.2f}–{other_end:.2f}) "
                    f"overlap on the same wall."
                )
        seen.append((start, end, name))
