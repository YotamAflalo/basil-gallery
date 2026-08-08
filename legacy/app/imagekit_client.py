"""ImageKit client for the gallery.

Credentials come from .env. The canonical names are IMAGEKIT_PUBLIC_KEY /
IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT; the older kitgekit_* names are
still read so nothing breaks before .env is renamed.
"""
import os
from functools import lru_cache

from dotenv import load_dotenv
from imagekitio import ImageKit

load_dotenv()


def _env(*names, default=""):
    for name in names:
        value = os.getenv(name)
        if value:
            return value.strip()
    return default


# The public key is only needed to authenticate uploads made from the browser.
# Every server-side call in this project authenticates with the private key.
IMAGEKIT_PUBLIC_KEY = _env("IMAGEKIT_PUBLIC_KEY", "kitgekit_public_key")
IMAGEKIT_PRIVATE_KEY = _env("IMAGEKIT_PRIVATE_KEY", "kitgekit_private_key")
IMAGEKIT_URL_ENDPOINT = _env("IMAGEKIT_URL_ENDPOINT", "kitgekit_url_endpoint")


@lru_cache(maxsize=1)
def get_imagekit() -> ImageKit:
    if not IMAGEKIT_PRIVATE_KEY:
        raise RuntimeError(
            "No ImageKit private key. Set IMAGEKIT_PRIVATE_KEY in .env"
        )
    if not IMAGEKIT_PRIVATE_KEY.startswith("private_"):
        raise RuntimeError(
            "IMAGEKIT_PRIVATE_KEY does not look like a private key "
            "(expected it to start with 'private_') — the public and private "
            "keys may be swapped in .env"
        )
    return ImageKit(private_key=IMAGEKIT_PRIVATE_KEY)


@lru_cache(maxsize=1)
def get_url_endpoint() -> str:
    """The https://ik.imagekit.io/<id> base every delivery URL hangs off.

    Uses IMAGEKIT_URL_ENDPOINT when set, otherwise asks the account for its
    default endpoint so the app still works before .env is filled in.
    """
    if IMAGEKIT_URL_ENDPOINT:
        return IMAGEKIT_URL_ENDPOINT.rstrip("/")

    client = get_imagekit()

    # Listing endpoints needs a master key, so fall back to reading the
    # endpoint off any existing asset URL.
    try:
        for endpoint in client.accounts.url_endpoints.list():
            url = getattr(endpoint, "url", "") or ""
            if url:
                return url.rstrip("/")
    except Exception:
        pass

    try:
        for asset in client.assets.list(limit=1):
            url = getattr(asset, "url", "") or ""
            file_path = getattr(asset, "file_path", "") or ""
            if url and file_path and file_path in url:
                return url.split(file_path)[0].rstrip("/")
    except Exception:
        pass

    return ""


def build_url(src: str, transformation: list[dict] | None = None) -> str:
    """Delivery URL for a media-library path, e.g. "/Switzerland/bridge.jpg"."""
    endpoint = get_url_endpoint()
    if not endpoint:
        raise RuntimeError(
            "No ImageKit URL endpoint. Set IMAGEKIT_URL_ENDPOINT in .env"
        )
    return get_imagekit().helper.build_url(
        url_endpoint=endpoint,
        src=src if src.startswith("/") else f"/{src}",
        transformation=transformation or [],
    )
