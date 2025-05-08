from fastapi import FastAPI, Request, Form
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
import json, os
from pathlib import Path

# Load .env
load_dotenv()

USERNAME = os.getenv("GALLERY_USER")
PASSWORD = os.getenv("GALLERY_PASS")
print(USERNAME,PASSWORD)
app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="your_super_secret_key")

BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Load paintings data
with open(BASE_DIR / "data/paintings.json", "r", encoding="utf-8") as f:
    paintings = json.load(f)

manager_index = 0  # tracks current position in painting list

@app.get("/")
def home(request: Request):
    import random
    
    countries = sorted(set(p.get("country", "Unsorted yet") for p in paintings))
    years = sorted(set(
        int(p["year"]) for p in paintings 
        if isinstance(p.get("year"), int) or (isinstance(p.get("year"), str) and p["year"].isdigit())
    ))
    locations_now = sorted(set(p.get("current_location", "Unknown") for p in paintings))
    techniques = sorted(set(p.get("technique", "Unsorted yet") for p in paintings))
    
    # Get a sample of paintings for the mosaic (max 6)
    # Filter out paintings without image_path
    valid_paintings = [p for p in paintings if p.get("image_path")]
    
    # If fewer than 6 paintings are available, use all of them
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
@app.get("/galleries/{country}")
def gallery_by_country(country: str, request: Request):
    filtered = [p for p in paintings if p.get("country", "").lower() == country.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": country.title(),
        "paintings": filtered
    })

@app.get("/galleries/year/{year}")
def gallery_by_year(year: int, request: Request):
    filtered = [p for p in paintings if str(p.get("year")) == str(year)]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": str(year),
        "paintings": filtered
    })

@app.get("/locations/{location}")
def gallery_by_current_location(location: str, request: Request):
    filtered = [p for p in paintings if p.get("current_location", "").lower() == location.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": location.title(),
        "paintings": filtered
    })

@app.get("/techniques/{technique}")
def gallery_by_technique(technique: str, request: Request):
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
        return RedirectResponse("/manage", status_code=303)
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

    with open(BASE_DIR / "data/paintings.json", "r", encoding="utf-8") as f:
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
    description: str = Form(...)
):
    global manager_index

    with open(BASE_DIR / "data/paintings.json", "r", encoding="utf-8") as f:
        paintings_data = json.load(f)

    for painting in paintings_data:
        if painting["image_path"] == image_path:
            painting.update({
                "title": title,
                "year": int(year) if year.isdigit() else year,
                "location": location,
                "current_location": current_location,
                "technique": technique,
                "description": description
            })
            break

    with open(BASE_DIR / "data/paintings.json", "w", encoding="utf-8") as f:
        json.dump(paintings_data, f, indent=4, ensure_ascii=False)

    manager_index += 1
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
