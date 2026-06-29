#!/usr/bin/env python3
"""
Debug crop detection
"""

import os
from PIL import Image

def test_crop(image_path, edge_threshold=150, content_ratio=0.02):
    img = Image.open(image_path)

    if img.mode != 'RGB':
        img = img.convert('RGB')

    width, height = img.size
    pixels = img.load()

    print(f"Image size: {width}×{height}")

    # Sample edges
    edge_samples = []
    for x in range(0, width, 10):
        edge_samples.append(pixels[x, 0])
        edge_samples.append(pixels[x, height-1])
    for y in range(0, height, 10):
        edge_samples.append(pixels[0, y])
        edge_samples.append(pixels[width-1, y])

    bg_r = sum(c[0] for c in edge_samples) / len(edge_samples)
    bg_g = sum(c[1] for c in edge_samples) / len(edge_samples)
    bg_b = sum(c[2] for c in edge_samples) / len(edge_samples)

    print(f"Background color: RGB({bg_r:.1f}, {bg_g:.1f}, {bg_b:.1f})")
    print(f"Threshold: {edge_threshold}")
    print(f"Content ratio: {content_ratio:.2%}")

    # Sample some middle pixels to see building colors
    print("\nSample pixels from center of image:")
    center_x, center_y = width // 2, height // 2
    for test_x in [center_x - 200, center_x, center_x + 200]:
        for test_y in [center_y - 100, center_y, center_y + 100]:
            if 0 <= test_x < width and 0 <= test_y < height:
                r, g, b = pixels[test_x, test_y]
                diff = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
                print(f"  ({test_x}, {test_y}): RGB({r}, {g}, {b}), diff={diff:.1f}")

    # Scan from left
    print("\nScanning from left...")
    for x in range(0, width, 50):
        content_pixels = 0
        max_diff = 0
        for y in range(height):
            r, g, b = pixels[x, y]
            diff = abs(r - bg_r) + abs(g - bg_g) + abs(b - bg_b)
            max_diff = max(max_diff, diff)
            if diff > edge_threshold:
                content_pixels += 1

        ratio = content_pixels / height
        print(f"  x={x}: {content_pixels} content pixels ({ratio:.2%}), max_diff={max_diff:.1f}")
        if ratio > content_ratio:
            print(f"  -> Found content boundary at x={x}")
            break

# Test with actual file
test_file = "/Users/ashutoshbijoor/Documents/Personal/Aatley Home Construction/New House/blender/docs/realistic_perspectives/front_left_corner.png"
print("Testing with default settings:")
test_crop(test_file)

print("\n" + "="*70)
print("Testing with stricter threshold (200):")
test_crop(test_file, edge_threshold=200)

print("\n" + "="*70)
print("Testing with much stricter threshold (300) and lower ratio (0.01):")
test_crop(test_file, edge_threshold=300, content_ratio=0.01)
