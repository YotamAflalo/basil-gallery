from fastapi import FastAPI, Request, Form, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import json, os, shutil
from pathlib import Path
import subprocess
from datetime import datetime
import schedule
import time
import threading

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
    paintings = load_paintings()
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
    return templates.TemplateResponse("index.html", {
        "request": request,
        "countries": countries,
        "years": years,
        "locations_now": locations_now,
        "techniques": techniques,
        "mosaic_paintings": mosaic_paintings
    })

@app.get("/painting/{image_path:path}")
def view_painting(request: Request, image_path: str):
    paintings = load_paintings()
    for painting in paintings:
        if painting.get("image_path") == image_path:
            return templates.TemplateResponse("painting_detail.html", {
                "request": request,
                "painting": painting
            })
    return {"detail": "Painting not found"}

@app.get("/galleries/{country}")
def gallery_by_country(country: str, request: Request):
    paintings = load_paintings()
    filtered = [p for p in paintings if p.get("country", "").lower() == country.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": country.title(),
        "paintings": filtered
    })

@app.get("/galleries/year/{year}")
def gallery_by_year(year: int, request: Request):
    paintings = load_paintings()
    filtered = [p for p in paintings if str(p.get("year")) == str(year)]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": str(year),
        "paintings": filtered
    })

@app.get("/locations/{location}")
def gallery_by_current_location(location: str, request: Request):
    paintings = load_paintings()
    filtered = [p for p in paintings if p.get("current_location", "").lower() == location.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": location.title(),
        "paintings": filtered
    })

@app.get("/techniques/{technique}")
def gallery_by_technique(technique: str, request: Request):
    paintings = load_paintings()
    filtered = [p for p in paintings if p.get("technique", "").lower() == technique.lower()]
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

    with open(PAINTINGS_JSON_PATH, "r", encoding="utf-8") as f:
        paintings_data = json.load(f)

    # Find next unsorted
    while manager_index < len(paintings_data):
        p = paintings_data[manager_index]
        if "unsorted yet" in str(p.values()).lower():
            break
        manager_index += 1

    if manager_index >= len(paintings_data):
        return templates.TemplateResponse("done.html", {"request": request})

    painting = paintings_data[manager_index]
    return templates.TemplateResponse("manage.html", {
        "request": request,
        "painting": painting,
        "index": manager_index + 1,
        "total": len(paintings_data)
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

    with open(PAINTINGS_JSON_PATH, "r", encoding="utf-8") as f:
        paintings_data = json.load(f)

    for painting in paintings_data:
        if painting["image_path"] == image_path:
            # Move image to country folder if country is provided
            new_image_path = move_image_to_country_folder(image_path, country)
            
            painting.update({
                "title": title,
                "year": int(year) if year.isdigit() else year,
                "location": location,
                "current_location": current_location,
                "technique": technique,
                "description": description,
                "country": country,
                "image_path": new_image_path
            })
            break

    with open(PAINTINGS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(paintings_data, f, indent=4, ensure_ascii=False)

    manager_index += 1
    return RedirectResponse("/manage", status_code=303)

@app.get("/create_pr")
def create_pr(request: Request):
    """Manual trigger for creating a PR."""
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    
    create_github_pr()
    return RedirectResponse("/manage", status_code=303)

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
    paintings = load_paintings()
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
    paintings.append(new_entry)
    with open(PAINTINGS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(paintings, f, indent=4, ensure_ascii=False)
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
    paintings = load_paintings()
    return templates.TemplateResponse("edit_gallery.html", {"request": request, "paintings": paintings})

@app.post("/edit_gallery")
async def save_edit_gallery(request: Request):
    if not request.session.get("authenticated"):
        return RedirectResponse("/login", status_code=303)
    form = await request.form()
    paintings = load_paintings()
    # Update paintings with form data
    updated_paintings = []
    for i, painting in enumerate(paintings):
        updated_paintings.append({
            "title": form.get(f"title_{i}", painting["title"]),
            "image_path": painting["image_path"],
            "year": form.get(f"year_{i}", painting["year"]),
            "country": form.get(f"country_{i}", painting["country"]),
            "location": form.get(f"location_{i}", painting["location"]),
            "current_location": form.get(f"current_location_{i}", painting["current_location"]),
            "technique": form.get(f"technique_{i}", painting["technique"]),
            "description": form.get(f"description_{i}", painting["description"])
        })
    with open(PAINTINGS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(updated_paintings, f, indent=4, ensure_ascii=False)
    return RedirectResponse("/galleries/Netherlands", status_code=303)
