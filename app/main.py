from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from pathlib import Path
from app.routes import public, manager
from app.error_handlers import register_error_handlers
from app.config import get_settings

settings = get_settings()

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=settings.SESSION_SECRET)

BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

# Include routers
def include_routers(app):
    app.include_router(public.router)
    app.include_router(manager.router)

include_routers(app)
register_error_handlers(app) 