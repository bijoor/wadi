#!/usr/bin/env python3
"""
Auto-crop all rendered perspective images to remove empty space
"""

import os
from PIL import Image

def auto_crop_image(image_path, output_path=None, edge_threshold=150, content_ratio=0.02):
    """
    Remove uniform background by scanning from edges inward

    edge_threshold: How different a pixel must be from edge average to count as content
    content_ratio: What fraction of a row/column must have content to not crop
    """
    if output_path is None:
        output_path = image_path

    img = Image.open(image_path)

    # Convert to RGB for processing
    if img.mode != 'RGB':
        img = img.convert('RGB')

    # Get image dimensions
    width, height = img.size
    pixels = img.load()

    # Sample edges to determine background color
    edge_samples = []

    # Top and bottom edges
    for x in range(0, width, 10):
        edge_samples.append(pixels[x, 0])
        edge_samples.append(pixels[x, height-1])

    # Left and right edges
    for y in range(0, height, 10):
        edge_samples.append(pixels[0, y])
        edge_samples.append(pixels[width-1, y])

    # Calculate average edge color
    bg_r = sum(c[0] for c in edge_samples) / len(edge_samples)
    bg_g = sum(c[1] for c in edge_samples) / len(edge_samples)
    bg_b = sum(c[2] for c in edge_samples) / len(edge_samples)

    # Find content boundaries by scanning from edges
    min_x, max_x = 0, width - 1
    min_y, max_y = 0, height - 1

    # Scan from left
    for x in range(width):
        content_pixels = 0
        for y in range(height):
            r, g, b = pixels[x, y]
            diff = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
            if diff > edge_threshold:
                content_pixels += 1

        if content_pixels / height > content_ratio:
            min_x = x
            break

    # Scan from right
    for x in range(width - 1, -1, -1):
        content_pixels = 0
        for y in range(height):
            r, g, b = pixels[x, y]
            diff = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
            if diff > edge_threshold:
                content_pixels += 1

        if content_pixels / height > content_ratio:
            max_x = x
            break

    # Scan from top
    for y in range(height):
        content_pixels = 0
        for x in range(width):
            r, g, b = pixels[x, y]
            diff = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
            if diff > edge_threshold:
                content_pixels += 1

        if content_pixels / width > content_ratio:
            min_y = y
            break

    # Scan from bottom
    for y in range(height - 1, -1, -1):
        content_pixels = 0
        for x in range(width):
            r, g, b = pixels[x, y]
            diff = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
            if diff > edge_threshold:
                content_pixels += 1

        if content_pixels / width > content_ratio:
            max_y = y
            break

    # Add padding (8% of content size or 60px minimum, with extra vertical padding)
    content_width = max_x - min_x
    content_height = max_y - min_y
    padding_horizontal = max(60, int(content_width * 0.08))
    padding_vertical = max(80, int(content_height * 0.12))  # More vertical padding to preserve roofs

    # Crop with padding (more vertical padding to preserve roofs)
    crop_box = (
        max(0, min_x - padding_horizontal),
        max(0, min_y - padding_vertical),
        min(width, max_x + padding_horizontal),
        min(height, max_y + padding_vertical)
    )

    cropped = img.crop(crop_box)

    # Save as PNG
    cropped.save(output_path, 'PNG')

    return True

def main():
    input_dir = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/realistic_perspectives"

    # List of rendered perspective views
    views = [
        "front_left_corner",
        "front_right_corner",
        "back_left_corner",
        "back_right_corner",
        "aerial",
        "eye_level_back",
        "eye_level_front"
    ]

    print("\n" + "="*70)
    print("AUTO-CROPPING PERSPECTIVE IMAGES")
    print("="*70)

    cropped_count = 0
    for view_name in views:
        input_path = os.path.join(input_dir, f"{view_name}.png")

        if not os.path.exists(input_path):
            print(f"⚠ Skipping {view_name}: file not found")
            continue

        print(f"\nProcessing {view_name}...")

        # Get original size
        img = Image.open(input_path)
        orig_width, orig_height = img.size
        orig_size_mb = os.path.getsize(input_path) / 1024 / 1024
        img.close()

        # Crop the image
        if auto_crop_image(input_path):
            # Get new size
            img = Image.open(input_path)
            new_width, new_height = img.size
            new_size_mb = os.path.getsize(input_path) / 1024 / 1024
            img.close()

            width_reduction = ((orig_width - new_width) / orig_width) * 100
            height_reduction = ((orig_height - new_height) / orig_height) * 100

            print(f"  ✓ Cropped: {orig_width}×{orig_height} → {new_width}×{new_height}")
            print(f"    Size reduction: {width_reduction:.1f}% width, {height_reduction:.1f}% height")
            print(f"    File size: {orig_size_mb:.2f} MB → {new_size_mb:.2f} MB")
            cropped_count += 1
        else:
            print(f"  ✗ Failed to crop (no content found)")

    print("\n" + "="*70)
    print(f"✓ COMPLETE! Cropped {cropped_count}/{len(views)} images")
    print("="*70)
    print(f"\nOutput directory: {input_dir}")
    print("\nThese cropped images are ready for the web viewer.")

if __name__ == "__main__":
    main()
