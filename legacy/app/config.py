import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    SESSION_SECRET: str
    GALLERY_USER: str
    GALLERY_PASS: str
    GITHUB_TOKEN: str
    GITHUB_REPO: str
    GMAIL_USER: str
    GMAIL_PASS: str
    ALERT_EMAIL: str
    IMAGEKIT_PUBLIC_KEY: str
    IMAGEKIT_PRIVATE_KEY: str
    IMAGEKIT_URL_ENDPOINT: str

    def __init__(self):
        self.SESSION_SECRET = os.getenv("SESSION_SECRET", "your_super_secret_key")
        self.GALLERY_USER = os.getenv("GALLERY_USER", "admin")
        self.GALLERY_PASS = os.getenv("GALLERY_PASS", "password")
        self.GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
        self.GITHUB_REPO = os.getenv("GITHUB_REPO", "")
        self.GMAIL_USER = os.getenv("GMAIL_USER", "")
        self.GMAIL_PASS = os.getenv("GMAIL_PASS", "")
        self.ALERT_EMAIL = os.getenv("ALERT_EMAIL", "")
        # kitgekit_* are the original names in .env; keep reading them as a fallback.
        self.IMAGEKIT_PUBLIC_KEY = os.getenv("IMAGEKIT_PUBLIC_KEY") or os.getenv("kitgekit_public_key", "")
        self.IMAGEKIT_PRIVATE_KEY = os.getenv("IMAGEKIT_PRIVATE_KEY") or os.getenv("kitgekit_private_key", "")
        self.IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT", "")

def get_settings():
    return Settings() 