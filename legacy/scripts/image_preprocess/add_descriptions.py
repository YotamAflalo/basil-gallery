from image_to_text import ImageToText
from pathlib import Path
import json
import logging
from tqdm import tqdm
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(Path(__file__).resolve().parent.parent.parent / "logs/add_descriptions.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def needs_update(painting):
    """Check if a painting needs its title or description updated."""
    return (painting.get("title") == "unsorted yet" or 
            painting.get("description") == "unsorted yet" or
            not painting.get("title") or 
            not painting.get("description"))

def main():
    # Initialize the image to text model
    logger.info("Initializing ImageToText model...")
    image_to_text = ImageToText()
    
    # Find paintings that need updating
    paintings_to_update = {
        id: painting for id, painting in image_to_text.paintings_json.items() 
        if needs_update(painting)
    }
    
    if not paintings_to_update:
        logger.info("No paintings need updating!")
        return
    
    logger.info(f"Found {len(paintings_to_update)} paintings that need updating")
    
    # Update each painting
    for painting_id in tqdm(paintings_to_update.keys(), desc="Updating paintings"):
        try:
            # Use the built-in method to update the painting
            description = image_to_text.update_image_name_and_description(painting_id)
            if description:
                logger.info(f"Updated painting {painting_id}: {description[:100]}...")
                # Save changes using the built-in method
                image_to_text.update_paintings_json()
                # Add a small delay to avoid overwhelming the model
                time.sleep(1)
            else:
                logger.error(f"Failed to generate description for painting {painting_id}")
                
        except Exception as e:
            logger.error(f"Error processing painting {painting_id}: {str(e)}")
            continue
    
    logger.info("Finished updating paintings!")

if __name__ == "__main__":
    main() 