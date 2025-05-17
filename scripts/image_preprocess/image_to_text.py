import requests
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration
from loguru import logger
import json
from pathlib import Path

# Get the project root directory (2 levels up from this file)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
logger.add(PROJECT_ROOT / "logs/image_to_text.log")

class ImageToText:
    def __init__(self):
        self.processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        self.model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
        self.paintings_json = json.load(open(PROJECT_ROOT / "data/paintings.json"))
        logger.info("Image to text model initialized")

    def image_to_text(self, image_path):
        # Convert the image path to be relative to project root
        if image_path.startswith('/'):
            image_path = image_path[1:]  # Remove leading slash
        full_image_path = PROJECT_ROOT / image_path
        
        try:
            raw_image = Image.open(full_image_path).convert('RGB')
        except FileNotFoundError:
            logger.error(f"Image file not found: {full_image_path}")
            raise

        # conditional image captioning
        text = "a painting of"
        inputs = self.processor(raw_image, text, return_tensors="pt")

        out = self.model.generate(**inputs)
        # unconditional image captioning
        caption = self.processor.decode(out[0], skip_special_tokens=True)
        logger.info(f"Generated caption: {caption}")
        return caption

    def update_image_name_and_description(self, image_id):
        if image_id in self.paintings_json.keys():
            image_path = self.paintings_json[image_id]["image_path"]
            try:
                image_description = self.image_to_text(image_path)
                self.paintings_json[image_id]["description"] = image_description
                self.paintings_json[image_id]["title"] = image_description
                return image_description
            except Exception as e:
                logger.error(f"Error updating image name and description: {e}")
                return None
        else:
            logger.error(f"Image id {image_id} not found in paintings json")
            return None

    def update_paintings_json(self):
        try:    
            with open(PROJECT_ROOT / "data/paintings.json", "w") as f:
                json.dump(self.paintings_json, f, indent=4) 
            logger.info("Paintings json updated")
        except Exception as e:
            logger.error(f"Error updating paintings json: {e}")

        
    
