# How to Download and Use Texture Images

The rendering script now supports image-based textures for even more realistic results!

## Quick Start

The script will work immediately with **enhanced procedural materials** even without texture images. But for maximum realism, follow these steps to add photo textures:

## Step 1: Create Textures Folder

The folder has already been created at:
```
/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/textures/
```

## Step 2: Download Laterite Stone Texture

### Recommended Source: **3D Textures** (Free, High Quality)
1. Visit: https://3dtextures.me
2. Search for "stone wall" or "brick"
3. Choose a reddish-brown stone texture
4. Download the Base Color/Diffuse map (usually 1024x1024 or higher)
5. Download the Normal map if available
6. Save as:
   - `textures/laterite_wall.jpg` (base color)
   - `textures/laterite_wall_normal.jpg` (normal map, optional)

### Alternative Sources:
- **TextureCan**: https://www.texturecan.com/tag/Stone/
- **Freepik**: https://www.freepik.com/free-photos-vectors/laterite-stone-texture
- **Poliigon**: https://www.poliigon.com/textures/stone (some free textures)

### What to Look For:
- Reddish-brown color (laterite is naturally this color)
- Rough, porous stone appearance
- Seamless/tileable texture (if possible)
- Resolution: 1024x1024 minimum, 2048x2048 or 4K preferred

## Step 3: Download Terracotta Roof Tile Texture

### Recommended Source: **3D Textures** (Free, High Quality)
1. Visit: https://3dtextures.me/category/roof/
2. Look for "Roof Tiles Terracotta"
3. Download Base Color/Diffuse map
4. Download Normal map if available
5. Save as:
   - `textures/terracotta_roof.jpg` (base color)
   - `textures/terracotta_roof_normal.jpg` (normal map, optional)

### Alternative Sources:
- **TextureCan**: https://www.texturecan.com/tag/Terracotta/
- **Architextures**: https://architextures.org/textures/951
- **SketchUp Texture Club**: https://www.sketchuptextureclub.com/textures/architecture/roofings/clay-roofs/

### What to Look For:
- Orange-red terracotta tiles
- Shows tile ridges and overlap patterns
- Weathered/realistic appearance
- Seamless/tileable
- Resolution: 1024x1024 minimum, 2048x2048 preferred

## Step 4: File Formats

Supported formats (script auto-detects):
- `.webp` ✓ (modern, efficient compression - **recommended!**)
- `.jpg` or `.jpeg` (good for photos)
- `.png` (good for textures with transparency)
- `.tga`, `.tiff`, `.bmp` (also supported)

**WebP is fully supported and recommended** for its excellent compression and quality!

## Step 5: Check File Names

The script auto-detects file extensions! Just use these base names:
```
textures/
├── laterite_wall.webp (or .jpg, .png - required for laterite texture)
├── laterite_wall_normal.webp (or .jpg, .png - optional, for bump detail)
├── terracotta_roof.webp (or .jpg, .png - required for roof texture)
└── terracotta_roof_normal.webp (or .jpg, .png - optional, for tile ridges)
```

**Examples of valid names:**
- `laterite_wall.webp` ✓
- `laterite_wall.jpg` ✓
- `laterite_wall.png` ✓
- `terracotta_roof.webp` ✓
- `terracotta_roof.jpeg` ✓

The script will automatically find whichever format you use!

## Step 6: Run the Render

Once textures are in place, run:
```bash
/Applications/Blender.app/Contents/MacOS/Blender house-model.blend \
  --background --python render_with_textures.py
```

The script will automatically:
- ✓ Use your texture images if found
- ✓ Fall back to enhanced procedural materials if not found
- ✓ Report which textures are being used

## Tips for Best Results

1. **Seamless Textures**: Look for seamless/tileable textures to avoid visible seams
2. **High Resolution**: 2048x2048 or higher looks better, especially for close-up views
3. **PBR Textures**: If available, download full PBR texture sets:
   - Base Color (diffuse)
   - Normal Map (surface detail)
   - Roughness Map (shininess variation)
   - Displacement Map (3D depth)

4. **Normal Maps**: These add realistic surface detail without extra geometry
   - Make sure they're saved in the "Non-Color" color space (script handles this automatically)

## Example: Downloading from 3D Textures

1. Go to: https://3dtextures.me/category/roof/
2. Find "Roof Tiles Terracotta 008" or similar
3. Click on the texture
4. Click "Download" (free textures available)
5. Unzip the downloaded file
6. Find the file ending in `_col.jpg` (color/diffuse)
7. Rename it to `terracotta_roof.jpg`
8. Find the file ending in `_nrm.jpg` (normal)
9. Rename it to `terracotta_roof_normal.jpg`
10. Copy both to the `textures/` folder

## Current Status

The render script will show you which textures it's using:
- ✓ = Using texture image
- ⚠ = Using enhanced procedural material (texture not found)

## Need Help?

If you have texture images but the script isn't finding them:
1. Check the file names match exactly (case-sensitive)
2. Check they're in the right folder
3. Try absolute paths in the script
4. Check the file format is supported
