#!/usr/bin/env python3
"""One-shot extractor: HOUSE_CONFIG (Python dict) → house_config.json.

Loads the current house_config.py the same way `regenerate_combined_svgs.py`
does (exec, no Blender required), then serializes the resulting dict to
JSON. Numeric types are preserved as-is — Python int stays int (writes as
`110`), Python float stays float (writes as `110.5`) — so any downstream
SVG code that formats `110` vs `110.0` stays byte-stable.

Tuples in the config (e.g. RGB material tuples inside GLOBAL_CONFIG) are
converted to lists — HOUSE_CONFIG itself has no tuple values, so this is
a no-op for the extraction target. If tuples ever appear inside
HOUSE_CONFIG the encoder raises so we notice.
"""
from __future__ import annotations

import json
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "python"))

from config import GLOBAL_CONFIG  # noqa: E402

# Run house_config.py under exec so we don't need Blender for the import.
config_code = (REPO / 'python' / 'house_config.py').read_text()
config_code = config_code.replace(
    'from wadi_lib import GLOBAL_CONFIG',
    '# GLOBAL_CONFIG imported by the extractor',
)
namespace: dict = {
    'GLOBAL_CONFIG': GLOBAL_CONFIG,
    # inject __file__ so house_config.py's JSON loader resolves the
    # json path relative to python/, not to this extractor script.
    '__file__': str(REPO / 'python' / 'house_config.py'),
}
exec(config_code, namespace)
HOUSE_CONFIG = namespace['HOUSE_CONFIG']


class StrictEncoder(json.JSONEncoder):
    """Fails loudly on unexpected types instead of silently coercing."""

    def default(self, obj):  # noqa: D401
        if isinstance(obj, tuple):
            raise TypeError(
                f"HOUSE_CONFIG contains a tuple {obj!r} — the JSON round-trip "
                f"would drop it to a list. Convert to a list in house_config.py "
                f"or extend this encoder if the tuple is intentional."
            )
        return super().default(obj)


out = REPO / 'house_config.json'
out.write_text(json.dumps(HOUSE_CONFIG, indent=2, cls=StrictEncoder) + '\n')
print(f"Wrote {out} ({out.stat().st_size:,} bytes)")
