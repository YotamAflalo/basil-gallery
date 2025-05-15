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

    def __init__(self):
        self.SESSION_SECRET = os.getenv("SESSION_SECRET", "your_super_secret_key")
        self.GALLERY_USER = os.getenv("GALLERY_USER", "admin")
        self.GALLERY_PASS = os.getenv("GALLERY_PASS", "password")
        self.GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
        self.GITHUB_REPO = os.getenv("GITHUB_REPO", "")
        self.GMAIL_USER = os.getenv("GMAIL_USER", "")
        self.GMAIL_PASS = os.getenv("GMAIL_PASS", "")
        self.ALERT_EMAIL = os.getenv("ALERT_EMAIL", "")

def get_settings():
    return Settings() 