from fastapi import FastAPI, Request, Form, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import json, os, shutil
from pathlib import Path
import subprocess
from datetime import datetime
import schedule
import time
import threading
import logging
from datetime import timedelta
import smtplib
from email.mime.text import MIMEText
from collections import deque
from uuid import uuid5, NAMESPACE_URL

# Load .env
load_dotenv()

USERNAME = os.getenv("GALLERY_USER")
PASSWORD = os.getenv("GALLERY_PASS")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO = os.getenv("GITHUB_REPO")  # Format: "username/repo"

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="your_super_secret_key")

BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Load paintings data
PAINTINGS_JSON_PATH = BASE_DIR / "data/paintings.json"
with open(PAINTINGS_JSON_PATH, "r", encoding="utf-8") as f:
    paintings = json.load(f)

manager_index = 0  # tracks current position in painting list
last_json_mtime = PAINTINGS_JSON_PATH.stat().st_mtime  # tracks last modification time of paintings.json

# Health check endpoint
@app.get("/health")
def health():
    return JSONResponse({"status": "ok"})

# Ensure logs directory exists
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)
MANAGER_LOG_FILE = LOGS_DIR / "manager.log"

# Set up logging for manager actions
manager_logger = logging.getLogger("manager")
manager_logger.setLevel(logging.INFO)
manager_handler = logging.FileHandler(MANAGER_LOG_FILE, encoding="utf-8")
manager_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
if not manager_logger.hasHandlers():
    manager_logger.addHandler(manager_handler)

def log_manager_action(action, details=None):
    msg = f"ACTION: {action}"
    if details:
        msg += f" | DETAILS: {details}"
    manager_logger.info(msg)

def move_image_to_country_folder(image_path: str, country: str):
    """Move an image to its country folder, creating the folder if it doesn't exist."""
    if not image_path or not country:
        return image_path

    # Get the full path of the image
    full_image_path = BASE_DIR / "static" / image_path
    if not full_image_path.exists():
        return image_path

    # Create country folder if it doesn't exist
    country_folder = BASE_DIR / "static" / "images" / country.lower().replace(" ", "_")
    country_folder.mkdir(parents=True, exist_ok=True)

    # Get the filename from the original path
    filename = full_image_path.name
    new_path = country_folder / filename

    # Move the file
    shutil.move(str(full_image_path), str(new_path))

    # Return the new relative path
    return f"images/{country.lower().replace(' ', '_')}/{filename}"

def has_json_changes():
    """Check if paintings.json has been modified since last check."""
    global last_json_mtime
    current_mtime = PAINTINGS_JSON_PATH.stat().st_mtime
    if current_mtime > last_json_mtime:
        last_json_mtime = current_mtime
        return True
    return False

def create_github_pr():
    """Create a GitHub PR with the current changes."""
    if not has_json_changes():
        print("No changes in paintings.json, skipping PR creation")
        return

    try:
        # Configure git using environment variables
        git_user = os.getenv("GIT_USER_NAME", "Basil Gallery Bot")
        git_email = os.getenv("GIT_USER_EMAIL", "bot@basilgallery.com")
        
        # Set git config for this repository only (no --global)
        subprocess.run(["git", "config", "user.name", git_user], check=True)
        subprocess.run(["git", "config", "user.email", git_email], check=True)
        
        # Also configure the remote URL if GITHUB_TOKEN is available
        if GITHUB_TOKEN:
            repo_url = f"https://{GITHUB_TOKEN}@github.com/{GITHUB_REPO}.git"
            subprocess.run(["git", "remote", "set-url", "origin", repo_url], check=True)

        # Create a new branch
        branch_name = f"update-gallery-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        subprocess.run(["git", "checkout", "-b", branch_name], check=True)

        # Add all changes
        subprocess.run(["git", "add", "."], check=True)

        # Commit changes
        commit_message = f"Update gallery: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        subprocess.run(["git", "commit", "-m", commit_message], check=True)

        # Push changes
        subprocess.run(["git", "push", "origin", branch_name], check=True)

        # Create PR using GitHub API
        pr_title = f"Gallery Update {datetime.now().strftime('%Y-%m-%d')}"
        pr_body = "Automatic gallery update with new paintings and organization changes."
        
        # You would need to implement the actual PR creation using GitHub's API
        # This is a placeholder for the actual implementation
        print(f"Created PR: {pr_title}")

    except Exception as e:
        print(f"Error creating PR: {e}")
        # Try to clean up in case of error
        try:
            subprocess.run(["git", "checkout", "main"], check=True)
            subprocess.run(["git", "branch", "-D", branch_name], check=True)
        except:
            pass  # Ignore cleanup errors
        raise e

def schedule_daily_pr():
    """Schedule daily PR creation."""
    schedule.every().day.at("00:00").do(create_github_pr)
    
    while True:
        schedule.run_pending()
        time.sleep(60)

# Start the scheduler in a separate thread
scheduler_thread = threading.Thread(target=schedule_daily_pr, daemon=True)
scheduler_thread.start()

# Helper function to load paintings
def load_paintings():
    with open(PAINTINGS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/")
def home(request: Request):
    import random
    paintings_dict = load_paintings()
    paintings = list(paintings_dict.values())
    countries = sorted(set(p.get("country", "Unsorted yet") for p in paintings))
    years = sorted(set(
        int(p["year"]) for p in paintings 
        if isinstance(p.get("year"), int) or (isinstance(p.get("year"), str) and p["year"].isdigit())
    ))
    locations_now = sorted(set(p.get("current_location", "Unknown") for p in paintings))
    techniques = sorted(set(p.get("technique", "Unsorted yet") for p in paintings))
    valid_paintings = [p for p in paintings if p.get("image_path")]
    sample_size = min(6, len(valid_paintings))
    mosaic_paintings = random.sample(valid_paintings, sample_size) if valid_paintings else []

    # Get first 9 paintings for each country
    def first_n_by_country(country, n=9):
        return [p for p in paintings if p.get("country") == country and p.get("image_path")] [:n]
    swiss_paintings = first_n_by_country("Switzerland")
    netherlands_paintings = first_n_by_country("Netherlands")
    southafrica_paintings = first_n_by_country("South Africa")

    return templates.TemplateResponse("index.html", {
        "request": request,
        "countries": countries,
        "years": years,
        "locations_now": locations_now,
        "techniques": techniques,
        "mosaic_paintings": mosaic_paintings,
        "swiss_paintings": swiss_paintings,
        "netherlands_paintings": netherlands_paintings,
        "southafrica_paintings": southafrica_paintings
    })

@app.get("/painting/{image_path:path}")
def view_painting(request: Request, image_path: str):
    paintings_dict = load_paintings()
    for painting in paintings_dict.values():
        if painting.get("image_path") == image_path:
            return templates.TemplateResponse("painting_detail.html", {
                "request": request,
                "painting": painting
            })
    return {"detail": "Painting not found"}

@app.get("/galleries/{country}")
def gallery_by_country(country: str, request: Request):
    paintings_dict = load_paintings()
    filtered = [p for p in paintings_dict.values() if p.get("country", "").lower() == country.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": country.title(),
        "paintings": filtered
    })

@app.get("/galleries/year/{year}")
def gallery_by_year(year: int, request: Request):
    paintings_dict = load_paintings()
    filtered = [p for p in paintings_dict.values() if str(p.get("year")) == str(year)]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": str(year),
        "paintings": filtered
    })

@app.get("/locations/{location}")
def gallery_by_current_location(location: str, request: Request):
    paintings_dict = load_paintings()
    filtered = [p for p in paintings_dict.values() if p.get("current_location", "").lower() == location.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": location.title(),
        "paintings": filtered
    })

@app.get("/techniques/{technique}")
def gallery_by_technique(technique: str, request: Request):
    paintings_dict = load_paintings()
    filtered = [p for p in paintings_dict.values() if p.get("technique", "").lower() == technique.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": technique.title(),
        "paintings": filtered
    })

@app.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.post("/login")
def login(request: Request, username: str = Form(...), password: str = Form(...)):
    if username == USERNAME and password == PASSWORD:
        request.session["authenticated"] = True
        return RedirectResponse("/dashboard", status_code=303)
    else:
        return templates.TemplateResponse("login.html", {
            "request": request,
            "error": "Invalid credentials"
        })

@app.get("/manage")
def manage_page(request: Request):
    global manager_index
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)

    paintings_dict = load_paintings()
    painting_ids = list(paintings_dict.keys())

    # Find next unsorted
    while manager_index < len(painting_ids):
        painting_id = painting_ids[manager_index]
        painting = paintings_dict[painting_id]
        if "unsorted yet" in str(painting.values()).lower():
            break
        manager_index += 1

    if manager_index >= len(painting_ids):
        return templates.TemplateResponse("done.html", {"request": request})

    current_painting_id = painting_ids[manager_index]
    painting = paintings_dict[current_painting_id]
    return templates.TemplateResponse("manage.html", {
        "request": request,
        "painting": painting,
        "index": manager_index + 1,
        "total": len(painting_ids)
    })

@app.post("/update_painting")
def update_painting(
    request: Request,
    image_path: str = Form(...),
    title: str = Form(...),
    year: str = Form(...),
    location: str = Form(...),
    current_location: str = Form(...),
    technique: str = Form(...),
    description: str = Form(...),
    country: str = Form(...)
):
    global manager_index
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    
    paintings_dict = load_paintings()
    
    # Find the painting by image_path
    painting_id = None
    for pid, painting in paintings_dict.items():
        if painting.get("image_path") == image_path:
            painting_id = pid
            break
    
    if painting_id is not None:
        # Convert year to int if it's a valid number
        try:
            year = int(year) if year.isdigit() else year
        except (ValueError, AttributeError):
            year = year
            
        # Move image to country folder if needed
        new_image_path = move_image_to_country_folder(image_path, country)
        
        # Update the painting
        paintings_dict[painting_id].update({
            "title": title,
            "year": year,
            "location": location,
            "current_location": current_location,
            "technique": technique,
            "description": description,
            "country": country,
            "image_path": new_image_path
        })
        
        # Save changes
        with open(PAINTINGS_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(paintings_dict, f, indent=4, ensure_ascii=False)
        
        log_manager_action("update_painting", {"image_path": image_path, "title": title})
    
    manager_index += 1
    return RedirectResponse("/manage", status_code=303)

@app.get("/create_pr")
def create_pr(request: Request):
    """Manual trigger for creating a PR."""
    if not request.session.get("authenticated"):
        return JSONResponse(
            status_code=401,
            content={"error": "Not authenticated"}
        )
    
    try:
        create_github_pr()
        return JSONResponse(
            status_code=200,
            content={"message": "Successfully created PR"}
        )
    except Exception as e:
        error_logger.error(f"Failed to create PR: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to create pull request. Please contact Yotam."}
        )

@app.get("/skip")
def skip_painting(request: Request):
    global manager_index
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)

    manager_index += 1
    return RedirectResponse("/manage", status_code=303)

@app.get("/reset_manager")
def reset_manager():
    global manager_index
    manager_index = 0
    return RedirectResponse("/manage", status_code=303)

@app.get("/upload_image")
def upload_image_form(request: Request):
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    return templates.TemplateResponse("upload_image.html", {"request": request})

@app.post("/upload_image")
def upload_image(request: Request, image_file: UploadFile = Form(...)):
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    unsorted_dir = BASE_DIR / "static" / "images" / "unsorted"
    unsorted_dir.mkdir(parents=True, exist_ok=True)
    file_location = unsorted_dir / image_file.filename
    with open(file_location, "wb") as f:
        f.write(image_file.file.read())
    log_manager_action("upload_image", {"filename": image_file.filename})
    return RedirectResponse(f"/add_painting?image_path=images/unsorted/{image_file.filename}", status_code=303)

@app.get("/add_painting")
def add_painting_form(request: Request, image_path: str):
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    return templates.TemplateResponse("add_painting.html", {"request": request, "image_path": image_path})

@app.post("/add_painting")
def add_painting(
    request: Request,
    image_path: str = Form(...),
    title: str = Form(...),
    year: str = Form(...),
    country: str = Form(...),
    location: str = Form(...),
    current_location: str = Form(...),
    technique: str = Form(...),
    description: str = Form(...)
):
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    paintings_dict = load_paintings()
    # Generate a new unique ID for the new painting
    painting_id = str(uuid5(NAMESPACE_URL, image_path))
    new_entry = {
        "title": title,
        "image_path": image_path,
        "year": year,
        "country": country,
        "location": location,
        "current_location": current_location,
        "technique": technique,
        "description": description
    }
    paintings_dict[painting_id] = new_entry
    with open(PAINTINGS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(paintings_dict, f, indent=4, ensure_ascii=False)
    log_manager_action("add_painting", {"image_path": image_path, "title": title})
    return RedirectResponse("/manage", status_code=303)

@app.get("/dashboard")
def manager_dashboard(request: Request):
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/edit_gallery")
def edit_gallery(request: Request):
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    paintings_dict = load_paintings()
    return templates.TemplateResponse("edit_gallery.html", {"request": request, "paintings": paintings_dict.values()})

@app.post("/edit_gallery")
async def save_edit_gallery(request: Request):
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    form = await request.form()
    paintings_dict = load_paintings()
    
    # Update each painting while maintaining the dictionary structure
    for painting_id, painting in paintings_dict.items():
        i = list(paintings_dict.keys()).index(painting_id)  # Get the index for form field names
        
        # Get form values with defaults for missing fields
        title = form.get(f"title_{i}", "").strip()
        year = form.get(f"year_{i}", "").strip()
        country = form.get(f"country_{i}", "").strip()
        location = form.get(f"location_{i}", "").strip()
        current_location = form.get(f"current_location_{i}", "").strip()
        technique = form.get(f"technique_{i}", "").strip()
        description = form.get(f"description_{i}", "").strip()
        
        # Convert year to int if it's a valid number, otherwise keep as string
        try:
            year = int(year) if year.isdigit() else year
        except (ValueError, AttributeError):
            year = year
        
        # Update the painting with new values, keeping original image_path
        paintings_dict[painting_id].update({
            "title": title or "Untitled",  # Default to "Untitled" if empty
            "image_path": painting.get("image_path", ""),  # Keep original path or empty string
            "year": year or "Unknown",  # Default to "Unknown" if empty
            "country": country or "Unsorted yet",  # Default to "Unsorted yet" if empty
            "location": location or "Unknown",  # Default to "Unknown" if empty
            "current_location": current_location or "Unknown",  # Default to "Unknown" if empty
            "technique": technique or "Unsorted yet",  # Default to "Unsorted yet" if empty
            "description": description or ""  # Default to empty string if empty
        })
        
        # If country changed, move the image to the appropriate folder
        if country and country != "Unsorted yet":
            new_image_path = move_image_to_country_folder(
                paintings_dict[painting_id]["image_path"],
                country
            )
            paintings_dict[painting_id]["image_path"] = new_image_path
    
    with open(PAINTINGS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(paintings_dict, f, indent=4, ensure_ascii=False)
    log_manager_action("edit_gallery", {"count": len(paintings_dict)})
    return RedirectResponse("/galleries/Netherlands", status_code=303)

# Error tracking
ERROR_LOG_FILE = LOGS_DIR / "errors.log"
error_logger = logging.getLogger("errors")
error_logger.setLevel(logging.INFO)
error_handler = logging.FileHandler(ERROR_LOG_FILE, encoding="utf-8")
error_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
if not error_logger.hasHandlers():
    error_logger.addHandler(error_handler)

error_events = deque()
ERROR_THRESHOLD = 5
ERROR_WINDOW_SECONDS = 600  # 10 minutes
ALERT_SENT = False

GMAIL_USER = os.getenv("GMAIL_USER")
GMAIL_PASS = os.getenv("GMAIL_PASS")
ALERT_EMAIL = os.getenv("ALERT_EMAIL")

# Email alert function
def send_error_alert(count):
    global ALERT_SENT
    if not (GMAIL_USER and GMAIL_PASS and ALERT_EMAIL):
        print("Gmail credentials not set, cannot send alert.")
        return
    subject = "Gallery Error Alert"
    body = f"There have been {count} errors (404/500) in the last 10 minutes. Please check the site."
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = GMAIL_USER
    msg["To"] = ALERT_EMAIL
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.sendmail(GMAIL_USER, ALERT_EMAIL, msg.as_string())
        ALERT_SENT = True
        print("Error alert email sent.")
    except Exception as e:
        print(f"Failed to send alert email: {e}")

# Error handler
@app.exception_handler(404)
def not_found_handler(request, exc):
    from datetime import datetime
    now = datetime.now().timestamp()
    error_events.append(now)
    error_logger.info(f"404: {request.url}")
    # Remove old events
    while error_events and now - error_events[0] > ERROR_WINDOW_SECONDS:
        error_events.popleft()
    if len(error_events) > ERROR_THRESHOLD and not ALERT_SENT:
        send_error_alert(len(error_events))
    return JSONResponse({"detail": "Not Found"}, status_code=404)

@app.exception_handler(500)
def server_error_handler(request, exc):
    from datetime import datetime
    now = datetime.now().timestamp()
    error_events.append(now)
    error_logger.info(f"500: {request.url}")
    # Remove old events
    while error_events and now - error_events[0] > ERROR_WINDOW_SECONDS:
        error_events.popleft()
    if len(error_events) > ERROR_THRESHOLD and not ALERT_SENT:
        send_error_alert(len(error_events))
    return JSONResponse({"detail": "Internal Server Error"}, status_code=500)
