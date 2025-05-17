from PIL import Image, ImageDraw
import os
from pathlib import Path

def create_favicon():
    # Get the project root directory
    project_root = Path(__file__).resolve().parent.parent
    
    # Load the portrait image
    portrait_path = project_root / "static" / "images" / "dubi.jpg"
    if not portrait_path.exists():
        print(f"Error: Portrait image not found at {portrait_path}")
        return
        
    # Open and resize the portrait image
    img = Image.open(portrait_path)
    
    # Convert to RGBA if not already
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Resize to 32x32 pixels (favicon size)
    img = img.resize((32, 32), Image.Resampling.LANCZOS)
    
    # Create a circular mask
    mask = Image.new('L', (32, 32), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((0, 0, 32, 32), fill=255)
    
    # Apply the mask
    output = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    output.paste(img, (0, 0), mask)
    
    # Save as ICO
    favicon_path = project_root / "static" / "favicon.ico"
    
    # Ensure the static directory exists
    favicon_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Save the image
    output.save(favicon_path, format='ICO')
    print(f"Favicon created at: {favicon_path}")

if __name__ == "__main__":
    create_favicon() 