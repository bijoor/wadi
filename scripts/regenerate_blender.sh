#!/bin/bash
# Regenerate the photoreal perspective PNGs (Cycles renders + auto-crop).
# This is the ONLY thing Blender is still needed for — the interactive 3D
# model and every 2D SVG are generated in-browser from house_config.json
# by the editor/viewer TypeScript code.
#
# Requires Blender installed at /Applications/Blender.app and python3 +
# Pillow for the cropping step.

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"
BLEND_FILE="$PROJECT_ROOT/house-model.blend"

if [ ! -f "$BLENDER" ]; then
    echo "Error: Blender not found at $BLENDER"
    exit 1
fi

if [ ! -f "$BLEND_FILE" ]; then
    echo "Error: Blend file not found at $BLEND_FILE"
    exit 1
fi

echo "=========================================="
echo "Regenerating photoreal perspectives"
echo "=========================================="

echo ""
echo "[1/2] Rendering realistic perspectives (Blender headless)..."
"$BLENDER" --background "$BLEND_FILE" --python "$SCRIPT_DIR/render_all_final.py"

echo ""
echo "[2/2] Auto-cropping rendered perspectives..."
python3 "$SCRIPT_DIR/auto_crop_perspectives.py"

echo ""
echo "=========================================="
echo "Done."
echo "  PNGs: docs/3d/perspectives/*.png"
echo "=========================================="
