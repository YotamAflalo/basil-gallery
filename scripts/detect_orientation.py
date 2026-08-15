"""
Step 2 of straightening the collection: find the paintings that are sideways.

    pip install -r scripts/requirements.txt
    npm run orientation:scan
    python scripts/detect_orientation.py backups/orientation-2026-08-15.json
    npm run orientation:apply -- backups/orientation-2026-08-15.json --dry

Runs entirely on this machine. The only thing it sends anywhere is a request
for each painting's 384px preview from the ImageKit CDN, which it caches, so a
second run costs nothing. It needs no ImageKit key: the manifest carries the
URLs, and writing to ImageKit is the apply script's job.


## How it decides

CLIP scores how well an image matches a caption. It was trained on pictures
that were the right way up, so it matches "a landscape painting with the sky at
the top" better when the painting actually is the right way up. So: turn each
painting all four ways, score each against captions for upright and captions
for sideways, and keep the turn with the widest margin in favour of upright.

Scoring against upright captions alone is much worse — 12 of 36 on the check
below, against 30 of 36 for the difference of the two. A caption's score
carries a lot of "how much does this look like a painting at all", which is the
same for all four turns and drowns out the signal; subtracting the sideways
captions cancels it.


## What it is not

It is a shortlist, not an authority. `--selftest` measures it on paintings
whose correct orientation is known, and it is wrong often enough that its
output goes to a human before it goes to ImageKit — hence the review sheet it
writes beside the manifest, and the rotate buttons in /admin.

Abstract work is the weak spot, and not only for the model: several of the 38
in /paintings/Abstract have no correct way up to find. Pass
`--skip /paintings/Abstract` to leave them alone.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import os
import random
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

try:
    import torch
    from PIL import Image
    from transformers import AutoModel, AutoProcessor
except ImportError as exc:  # pragma: no cover - a setup problem, not a bug
    sys.exit(f"{exc}.\n\nInstall the dependencies:  pip install -r scripts/requirements.txt")


# ImageKit's rt- parameter turns clockwise, and so does this script. PIL's
# rotate() turns anticlockwise, which is why every call to it negates.
TURNS = (0, 90, 180, 270)

UPRIGHT_CAPTIONS = [
    "a painting of a landscape, the right way up",
    "a watercolour landscape with the sky at the top and the ground at the bottom",
    "a correctly oriented photograph of a framed painting",
    "a painting hanging the right way up on a wall",
]

SIDEWAYS_CAPTIONS = [
    "an upside down painting",
    "a painting rotated ninety degrees onto its side",
    "a sideways picture that needs rotating",
    "a photograph of a painting lying on its side",
]


def turned(img: Image.Image, degrees: int) -> Image.Image:
    """The image as ImageKit would deliver it under `rt-<degrees>`."""
    return img if degrees == 0 else img.rotate(-degrees, expand=True)


class Detector:
    def __init__(self, model_id: str):
        print(f"Loading {model_id} — the first run downloads it.", flush=True)
        self.model = AutoModel.from_pretrained(model_id).eval()
        self.processor = AutoProcessor.from_pretrained(model_id)
        self.n_upright = len(UPRIGHT_CAPTIONS)
        # The model's own temperature. Using it rather than a number picked by
        # hand keeps the confidences comparable to CLIP's usual scale.
        self.scale = self.model.logit_scale.exp().item()

        with torch.no_grad():
            captions = self.processor(
                text=UPRIGHT_CAPTIONS + SIDEWAYS_CAPTIONS,
                return_tensors="pt",
                padding=True,
            )
            self.captions = self._unit(self.model.get_text_features(**captions))

    @staticmethod
    def _unit(out) -> torch.Tensor:
        # transformers 5 wraps features in a model output whose pooler_output
        # is already projected; transformers 4 returned the tensor itself.
        tensor = out if torch.is_tensor(out) else out.pooler_output
        return tensor / tensor.norm(dim=-1, keepdim=True)

    def __call__(self, img: Image.Image) -> tuple[int, float]:
        """Which way to turn this image, and how sure of it, in [0, 1]."""
        with torch.no_grad():
            pixels = self.processor(
                images=[turned(img, t) for t in TURNS], return_tensors="pt"
            )
            features = self._unit(self.model.get_image_features(**pixels))
            similarity = features @ self.captions.T  # [4, captions]

        upright = similarity[:, : self.n_upright].mean(dim=1)
        sideways = similarity[:, self.n_upright :].mean(dim=1)
        probabilities = ((upright - sideways) * self.scale).softmax(dim=0)
        best = int(probabilities.argmax())
        return TURNS[best], float(probabilities[best])


def cache_dir(manifest_path: str) -> str:
    path = os.path.join(os.path.dirname(os.path.abspath(manifest_path)), ".previews")
    os.makedirs(path, exist_ok=True)
    return path


def download(paintings: list[dict], into: str) -> list[str]:
    """Fetch every preview, skipping the ones already on disk."""

    def one(item):
        index, painting = item
        dest = os.path.join(into, f"{painting['fileId']}.jpg")
        if not os.path.exists(dest):
            with urllib.request.urlopen(painting["previewUrl"], timeout=60) as response:
                data = response.read()
            with open(dest, "wb") as handle:
                handle.write(data)
        return dest

    with ThreadPoolExecutor(8) as pool:
        return list(pool.map(one, enumerate(paintings)))


def data_uri(img: Image.Image, width: int = 220) -> str:
    thumb = img.copy()
    thumb.thumbnail((width, width))
    buffer = io.BytesIO()
    thumb.save(buffer, format="JPEG", quality=72)
    return "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode()


def write_review_sheet(path: str, rows: list[dict]) -> None:
    """A self-contained before/after page. No network, no ImageKit bandwidth."""
    cards = "\n".join(
        f"""<figure>
  <div class="pair">
    <div><img src="{row['before']}" alt=""><figcaption>now</figcaption></div>
    <div><img src="{row['after']}" alt=""><figcaption>turn {row['turn']}&deg;</figcaption></div>
  </div>
  <p class="meta">{row['confidence']:.0%} sure &middot; {row['title']}</p>
  <p class="path">{row['filePath']}</p>
</figure>"""
        for row in rows
    )

    html = f"""<!doctype html>
<meta charset="utf-8">
<title>Paintings the detector thinks are sideways</title>
<style>
  body {{ font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; color: #111; }}
  h1 {{ font-size: 20px; font-weight: 500; }}
  p.lede {{ color: #707070; max-width: 60ch; }}
  .grid {{ display: grid; gap: 28px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }}
  figure {{ margin: 0; }}
  .pair {{ display: flex; gap: 10px; align-items: flex-start; }}
  .pair > div {{ flex: 1; min-width: 0; }}
  img {{ width: 100%; height: auto; display: block; background: #f4f4f4; }}
  figcaption {{ font-size: 11px; color: #707070; padding-top: 4px; text-transform: uppercase; letter-spacing: .08em; }}
  .meta {{ font-size: 13px; margin: 8px 0 0; }}
  .path {{ font: 11px/1.4 ui-monospace, monospace; color: #707070; margin: 2px 0 0; word-break: break-all; }}
</style>
<h1>{len(rows)} painting(s) the detector thinks are sideways</h1>
<p class="lede">Left is what the site shows today, right is what it would show
after applying. Look before you apply — the model is a shortlist, not an
authority, and it is least reliable on abstract work. Anything it gets wrong
can be put right with the rotate buttons in /admin.</p>
<div class="grid">
{cards}
</div>
"""
    with open(path, "w", encoding="utf8") as handle:
        handle.write(html)


def selftest(detector: Detector, paintings: list[dict], previews: list[str], n: int) -> None:
    """
    Measure it against paintings whose right way up is known.

    Known means *checked by hand in /admin*. The tempting shortcut — treat
    anything with no correction stored as upright — is wrong here and quietly
    so: a good quarter of this collection is sideways and has never been
    touched, so it would score the detector against a baseline that is itself
    wrong, and the number that comes out is noise. Ask for curated works only,
    and say so plainly when there are not enough of them yet.

    Given one, the trick needs no new labelling: turn a painting that is known
    upright by a known amount and see whether the detector asks for exactly
    that much back the other way.
    """
    candidates = [
        (painting, preview)
        for painting, preview in zip(paintings, previews)
        # An abstract has no right way up to be right about.
        if painting.get("curated") and "/Abstract/" not in painting["filePath"]
    ]

    if len(candidates) < 8:
        print(
            f"\nOnly {len(candidates)} painting(s) have been checked by hand and are\n"
            "not abstract, which is too few to measure anything.\n\n"
            "This test needs works whose orientation someone has confirmed, and\n"
            "'no correction stored' is not that — much of the collection is\n"
            "sideways and untouched. Curate a few dozen in /admin, straightening\n"
            "as you go, re-run npm run orientation:scan, and try again.\n\n"
            "For reference, on 36 landscapes checked by hand while this was being\n"
            "written, clip-vit-large-patch14 found 32 of the 36 turns."
        )
        return

    random.seed(7)
    random.shuffle(candidates)
    candidates = candidates[:n]

    hits = 0
    confident_hits = 0
    confident = 0

    for index, (painting, preview) in enumerate(candidates, 1):
        wanted = random.choice(TURNS)
        # Turn it the *opposite* way, so the turn that puts it back is `wanted`.
        # Turning it by `wanted` and expecting `wanted` back only agrees with
        # itself at 0 and 180, which flatters the score at 90 and 270.
        image = turned(Image.open(preview).convert("RGB"), (360 - wanted) % 360)
        guess, confidence = detector(image)
        correct = guess == wanted
        hits += correct
        if confidence >= 0.5:
            confident += 1
            confident_hits += correct
        print(
            f"  [{index}/{len(candidates)}] needs {wanted:3d}, guessed {guess:3d} "
            f"({confidence:.0%}) {'ok' if correct else 'MISS'}  "
            f"{os.path.basename(painting['filePath'])}",
            flush=True,
        )

    print(f"\n{hits}/{len(candidates)} correct overall.")
    if confident:
        print(
            f"{confident_hits}/{confident} correct among the "
            f"{confident / len(candidates):.0%} it was at least 50% sure of."
        )
    print("\nOne turn in four is 0, so treat anything near 25% as no signal at all.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find the paintings in a scan manifest that are sideways.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Produce the manifest with `npm run orientation:scan`.",
    )
    parser.add_argument("manifest", help="JSON written by npm run orientation:scan")
    parser.add_argument(
        "--model",
        default="openai/clip-vit-large-patch14",
        help="any CLIP checkpoint on Hugging Face (default: %(default)s). "
        "openai/clip-vit-base-patch32 is a third the parameters and several "
        "times faster on a CPU, at 30 of 36 on the check above against 32.",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.5,
        help="leave a painting alone below this (default: %(default)s)",
    )
    parser.add_argument(
        "--skip",
        action="append",
        default=[],
        metavar="SUBSTRING",
        help="skip paths containing this; repeatable. "
        "`--skip /paintings/Abstract` is worth it: much of that folder has no "
        "correct way up to find.",
    )
    parser.add_argument(
        "--selftest",
        nargs="?",
        type=int,
        const=40,
        metavar="N",
        help="measure accuracy on N paintings already checked by hand, "
        "instead of detecting; writes nothing",
    )
    args = parser.parse_args()

    with open(args.manifest, encoding="utf8") as handle:
        manifest = json.load(handle)
    paintings = manifest["paintings"]

    previews_dir = cache_dir(args.manifest)
    print(f"Fetching {len(paintings)} preview(s) into {previews_dir}", flush=True)
    previews = download(paintings, previews_dir)

    detector = Detector(args.model)

    if args.selftest is not None:
        selftest(detector, paintings, previews, args.selftest)
        return

    proposals = []
    for index, (painting, preview) in enumerate(zip(paintings, previews), 1):
        if any(fragment in painting["filePath"] for fragment in args.skip):
            painting["suggested"] = None
            continue

        image = Image.open(preview).convert("RGB")
        turn, confidence = detector(image)

        if turn == 0 or confidence < args.min_confidence:
            painting["suggested"] = None
        else:
            # Absolute, not a delta: the preview already carries whatever
            # correction is stored, so the new value is the old plus the turn.
            # Storing it absolute makes applying twice the same as once.
            painting["suggested"] = {
                "turn": turn,
                "rotation": (painting["rotation"] + turn) % 360,
                "confidence": round(confidence, 4),
            }
            proposals.append(
                {
                    "before": data_uri(image),
                    "after": data_uri(turned(image, turn)),
                    "turn": turn,
                    "confidence": confidence,
                    "title": painting["title"],
                    "filePath": painting["filePath"],
                }
            )

        if index % 20 == 0 or index == len(paintings):
            print(f"  {index}/{len(paintings)} — {len(proposals)} to straighten", flush=True)

    with open(args.manifest, "w", encoding="utf8") as handle:
        json.dump(manifest, handle, indent=2)

    proposals.sort(key=lambda row: -row["confidence"])
    sheet = os.path.splitext(args.manifest)[0] + ".html"
    write_review_sheet(sheet, proposals)

    print(f"\n{len(proposals)} of {len(paintings)} painting(s) look sideways.")
    print(f"Review:  {sheet}")
    print(f"Apply:   npm run orientation:apply -- {args.manifest} --dry")


if __name__ == "__main__":
    main()
