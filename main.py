from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import json
from pathlib import Path

app = FastAPI()

# Set up paths
BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Load paintings data
with open(BASE_DIR / "data/paintings.json", "r", encoding="utf-8") as f:
    paintings = json.load(f)

@app.get("/")
def home(request: Request):
    countries = sorted(set(p.get("country", "Unsorted yet") for p in paintings))
    years = sorted(set(
        int(p["year"]) for p in paintings 
        if isinstance(p.get("year"), int) or (isinstance(p.get("year"), str) and p["year"].isdigit())
    ))
    locations_now = sorted(set(p.get("current_location", "Unknown") for p in paintings))
    techniques = sorted(set(p.get("technique", "Unsorted yet") for p in paintings))
    
    return templates.TemplateResponse("index.html", {
        "request": request,
        "countries": countries,
        "years": years,
        "locations_now": locations_now,
        "techniques": techniques
    })

@app.get("/techniques/{technique}")
def gallery_by_technique(technique: str, request: Request):
    filtered = [p for p in paintings if p.get("technique", "").lower() == technique.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": technique.title(),
        "paintings": filtered
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
