#!/usr/bin/env python3
"""
Simple script to add images to the gallery
Usage: python3 add_gallery_image.py path/to/image.jpg "Image Title" "Description"
"""

import sys
import os
import shutil
from pathlib import Path

def add_gallery_image(image_path, title, description="", meta="Gallery • 2024"):
    # Create images/gallery directory if it doesn't exist
    gallery_dir = Path("images/gallery")
    gallery_dir.mkdir(parents=True, exist_ok=True)
    
    # Get the filename and extension
    source_path = Path(image_path)
    if not source_path.exists():
        print(f"Error: Image file {image_path} not found")
        return False
    
    # Copy image to gallery directory
    dest_path = gallery_dir / source_path.name
    shutil.copy2(source_path, dest_path)
    
    print(f"✅ Added {source_path.name} to gallery")
    print(f"   Title: {title}")
    print(f"   Description: {description}")
    print(f"   Path: {dest_path}")
    print()
    print("Next steps:")
    print("1. Update gallery.html to include this image in the imageData array")
    print(f"2. Add: {{ src: 'images/gallery/{source_path.name}', title: '{title}', meta: '{meta}', description: '{description}' }}")
    
    return True

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 add_gallery_image.py <image_path> <title> [description]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    title = sys.argv[2]
    description = sys.argv[3] if len(sys.argv) > 3 else ""
    
    add_gallery_image(image_path, title, description)
