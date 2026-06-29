# Using BlenderKit Materials

## Option 1: Manual Application (Recommended)

1. **Open Blender UI**:
   ```bash
   open "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/house-model.blend"
   ```

2. **Download Materials** (if not already downloaded):
   - Open BlenderKit panel (N key > BlenderKit tab)
   - Search for "Mangalore tiles" or paste asset ID: `85da6529-fc03-41c0-abd7-7af3718356b5`
   - Click download
   - Search for "Laterite" or paste asset ID: `db3c8151-c1ad-4c8e-9033-6638b53af132`
   - Click download

3. **Apply Materials**:
   - Select all wall objects (search for "wall" in outliner)
   - Assign the laterite material
   - Select all roof objects (search for "roof" in outliner)
   - Assign the Mangalore tile material

4. **Save the file** with materials applied

5. **Run the render script**:
   ```bash
   cd "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender"
   ./apply_materials.sh
   ```

## Option 2: Quick Alternative

If BlenderKit materials are difficult to work with, I can create high-quality procedural materials that mimic:
- Laterite stone blocks with realistic mortar joints
- Mangalore clay tiles with curved ridges

These will render reliably without external dependencies.

## What I Recommend:

Since we've had challenges with texture mapping, let's use **solid, well-designed procedural materials** that will:
- Work consistently on all surfaces
- Render quickly
- Look professional and clean
- No external dependencies

Would you like me to create enhanced procedural materials that specifically mimic:
1. Laterite stone (reddish-brown with texture)
2. Mangalore tiles (terracotta with tile pattern)

Or would you prefer to:
1. Manually apply BlenderKit materials in the UI first
2. Use simple solid colors for a clean architectural look
