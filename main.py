from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import json
from pathlib import Path

app = FastAPI()

# Set up templates and static directory
BASE_DIR = Path(__file__).resolve().parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Load paintings data
with open(BASE_DIR / "data/paintings.json", "r", encoding="utf-8") as f:
    paintings = json.load(f)

@app.get("/")
def home(request: Request):
    countries = sorted(set(p["country"] for p in paintings))
    years = sorted(set(p["year"] for p in paintings if isinstance(p["year"], int)))
    locations_now = sorted(set(p["current_location"] for p in paintings))
    return templates.TemplateResponse("index.html", {
        "request": request,
        "countries": countries,
        "years": years,
        "locations_now": locations_now
    })

@app.get("/galleries/{country}")
def gallery_by_country(country: str, request: Request):
    filtered = [p for p in paintings if p["country"].lower() == country.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": country.title(),
        "paintings": filtered
    })

@app.get("/paintings/{year}")
def gallery_by_year(year: int, request: Request):
    filtered = [p for p in paintings if p["year"] == year]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": str(year),
        "paintings": filtered
    })

@app.get("/locations/{location}")
def gallery_by_current_location(location: str, request: Request):
    filtered = [p for p in paintings if p["current_location"].lower() == location.lower()]
    return templates.TemplateResponse("gallery.html", {
        "request": request,
        "title": location.title(),
        "paintings": filtered
    })
