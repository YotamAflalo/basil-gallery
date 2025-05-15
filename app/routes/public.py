from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from pathlib import Path

router = APIRouter()
BASE_DIR = Path(__file__).resolve().parent.parent.parent
TEMPLATES = Jinja2Templates(directory=str(BASE_DIR / "templates"))

@router.get("/health")
def health():
    return JSONResponse({"status": "ok"})

@router.get("/")
def home(request: Request):
    # ... logic will be moved here ...
    pass

@router.get("/painting/{image_path:path}")
def view_painting(request: Request, image_path: str):
    # ... logic will be moved here ...
    pass

@router.get("/galleries/{country}")
def gallery_by_country(country: str, request: Request):
    # ... logic will be moved here ...
    pass

@router.get("/galleries/year/{year}")
def gallery_by_year(year: int, request: Request):
    # ... logic will be moved here ...
    pass

@router.get("/locations/{location}")
def gallery_by_current_location(location: str, request: Request):
    # ... logic will be moved here ...
    pass

@router.get("/techniques/{technique}")
def gallery_by_technique(technique: str, request: Request):
    # ... logic will be moved here ...
    pass 