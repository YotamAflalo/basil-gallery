import json
from pathlib import Path
import re
import uuid
from uuid import uuid5, NAMESPACE_URL

BASE_DIR = Path(__file__).resolve().parent.parent
images_dir = BASE_DIR / "static" / "images"
output_file = BASE_DIR / "data" / "paintings.json"

# Load existing data as a dictionary
existing_paintings_dict = {}
if output_file.exists() and output_file.stat().st_size > 0:
    try:
        with open(output_file, "r", encoding="utf-8") as f:
            loaded_data = json.load(f)
        # If the loaded data is a list (older format), convert it to a dictionary
        if isinstance(loaded_data, list):
            # When converting from a list, key by image_path for consistency with the new dict structure
            existing_paintings_dict = {p.get("image_path"): p for p in loaded_data if isinstance(p, dict) and p.get("image_path")}
        elif isinstance(loaded_data, dict):
            existing_paintings_dict = loaded_data
        else:
            print(f"Warning: Unexpected data format in {output_file}. Starting with an empty dictionary.")
            existing_paintings_dict = {}
    except json.JSONDecodeError:
        print(f"Error decoding JSON from {output_file}. Starting with an empty dictionary.")
        existing_paintings_dict = {}

# Create a temporary lookup by filename from existing data
existing_paintings_by_filename = {}
for painting_id, painting in existing_paintings_dict.items():
    if "image_path" in painting and painting["image_path"]:
        filename = Path(painting["image_path"]).name
        existing_paintings_by_filename[filename] = painting


new_paintings = {}

# Helper to generate a unique ID for each painting based on its current image_path
def get_painting_id(image_path):
    return str(uuid5(NAMESPACE_URL, image_path))

# Collect current images from filesystem
for country_folder in images_dir.iterdir():
    if not country_folder.is_dir():
        continue
    country = country_folder.name

    for img_file in country_folder.glob("*.[jp][pn]g"):  # supports .jpg, .jpeg, .png
        filename = img_file.name
        image_path = f"/static/images/{country}/{filename}"
        painting_id = get_painting_id(image_path) # Use new image_path for ID

        # Check if a painting with this filename already exists in the old data
        existing_painting = existing_paintings_by_filename.get(filename)

        if existing_painting:
            # If found by filename, update with new path and country, preserve other data
            new_entry = existing_painting.copy()
            new_entry["image_path"] = image_path
            new_entry["country"] = country # Update country based on current folder
            # Ensure year is correctly typed if it was previously a string
            if isinstance(new_entry.get("year"), str) and new_entry["year"].isdigit():
                new_entry["year"] = int(new_entry["year"])
            new_paintings[painting_id] = new_entry
        else:
            # If no existing entry by filename, create a new one
            match = re.search(r"year=(\d{4})", filename)
            year = int(match.group(1)) if match else "unsorted yet"

            new_paintings[painting_id] = {
                "title": filename.rsplit(".", 1)[0].replace("_", " "),
                "image_path": image_path,
                "year": year,
                "country": country,
                "location": "unsorted yet",
                "current_location": "unsorted yet",
                "technique": "unsorted yet",
                "description": "unsorted yet"
            }

# Write as a dict (not a list)
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(new_paintings, f, ensure_ascii=False, indent=2)

print(f"✅ Updated paintings.json with {len(new_paintings)} entries (dict with unique IDs as keys).")
