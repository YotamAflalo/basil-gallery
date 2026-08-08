"""Verify the ImageKit credentials in .env and report the account's URL endpoint.

Run from the project root:
    venv/Scripts/python.exe scripts/check_imagekit.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.imagekit_client import get_imagekit, get_url_endpoint, IMAGEKIT_PUBLIC_KEY


def main():
    if not IMAGEKIT_PUBLIC_KEY:
        print("warning: no public key set (only needed for browser-side uploads)")

    try:
        client = get_imagekit()
    except RuntimeError as exc:
        print(f"FAILED: {exc}")
        return 1

    # A private-key call that touches the Media Library: proves auth works.
    try:
        assets = client.assets.list(limit=5)
    except Exception as exc:
        print(f"FAILED: could not authenticate against ImageKit -> {exc}")
        return 1

    print(f"OK: authenticated. Media library returned {len(assets)} item(s).")

    endpoint = get_url_endpoint()
    if endpoint:
        print(f"URL endpoint: {endpoint}")
    else:
        print("Could not determine the URL endpoint automatically.")
        print("Find it at https://imagekit.io/dashboard/url-endpoints and add it to .env as")
        print("    IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/<your_imagekit_id>")

    for asset in assets:
        print(f"  - {getattr(asset, 'file_path', '?')}  {getattr(asset, 'url', '')}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
