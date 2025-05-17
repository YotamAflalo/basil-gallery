import json
from pathlib import Path
import re
import uuid
from uuid import uuid5, NAMESPACE_URL

BASE_DIR = Path(__file__).resolve().parent.parent
images_dir = BASE_DIR / "static" / "images"
output_file = BASE_DIR / "data" / "paintings.json"

# Load existing data
if output_file.exists():
    with open(output_file, "r", encoding="utf-8") as f:
        existing_paintings = json.load(f)
else:
    existing_paintings = []

# Index existing paintings by image_path for quick lookup
existing_dict = {p["image_path"]: p for p in existing_paintings}
new_paintings = {}

# Helper to generate a unique ID for each painting
# We'll use a UUID5 based on the image_path for stability
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
        painting_id = get_painting_id(image_path)

        # If exists, preserve full data
        if image_path in existing_dict:
            new_paintings[painting_id] = existing_dict[image_path]
            continue

        # Else, create new painting entry
        match = re.search(r"year=(\\d{4})", filename)
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
