import numpy as np
import cv2
import matplotlib.pyplot as plt
from skimage.filters import threshold_local
from PIL import Image
import os
import sys
# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)

# --- Painting Perspective Correction ---

def opencv_resize(image, ratio):
    width = int(image.shape[1] * ratio)
    height = int(image.shape[0] * ratio)
    dim = (width, height)
    return cv2.resize(image, dim, interpolation = cv2.INTER_AREA)

# Try to find a 4-point contour (rectangle), otherwise fallback to largest contour

def get_painting_contour(contours):    
    for c in contours:
        approx = approximate_contour(c)
        if len(approx) == 4:
            return approx
    # Fallback: return the largest contour (convex hull)
    if contours:
        return cv2.convexHull(contours[0])
    return None

# approximate the contour by a more primitive polygon shape
def approximate_contour(contour):
    peri = cv2.arcLength(contour, True)
    return cv2.approxPolyDP(contour, 0.032 * peri, True)

def find_painting(image, verb=False, debug=False):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    preprocesses = preprocess_methods(gray)
    all_candidates = []
    debug_imgs = []
    for name, bin_img in preprocesses.items():
        blurred = cv2.GaussianBlur(bin_img, (5, 5), 0)
        rectKernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
        dilated = cv2.dilate(blurred, rectKernel)
        edged = cv2.Canny(dilated, 50, 150, apertureSize=3)
        candidates = find_4point_candidates(image, edged, debug=debug)
        all_candidates.append((name, candidates, edged))
        if debug:
            # Draw all 4-point candidates for this method
            img_dbg = image.copy()
            for _, _, approx in candidates:
                cv2.drawContours(img_dbg, [approx], -1, (0,0,255), 2)
            debug_imgs.append((name, img_dbg, edged))
    # Choose the best candidate (largest area)
    best = None
    for name, candidates, _ in all_candidates:
        if candidates:
            best = (name, candidates[0][2])
            break
    if verb or debug:
        # For debug: return all debug images and the best candidate
        return debug_imgs, best[1] if best else None
    return best[1] if best else None

def getresize_ratio(image):
    return 500 / image.shape[0]

def contour_to_rect(contour, resize_ratio):
    pts = contour.reshape(-1, 2)
    if pts.shape[0] != 4:
        # fallback: use bounding box
        x, y, w, h = cv2.boundingRect(contour)
        rect = np.array([
            [x, y],
            [x + w, y],
            [x + w, y + h],
            [x, y + h]
        ], dtype="float32")
    else:
        rect = np.zeros((4, 2), dtype="float32")
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]
        rect[3] = pts[np.argmax(diff)]
    return rect / resize_ratio

def wrap_perspective(img, rect):
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    maxHeight = max(int(heightA), int(heightB))
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(img, M, (maxWidth, maxHeight))

def find_4point_candidates(image, edged, min_area=0.2, aspect_lo=0.6, aspect_hi=1.7, debug=False):
    img_h, img_w = image.shape[:2]
    img_area = img_h * img_w
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for c in contours:
        approx = approximate_contour(c)
        if len(approx) == 4:
            area = cv2.contourArea(approx)
            if area < min_area * img_area:
                continue
            x, y, w, h = cv2.boundingRect(approx)
            aspect = w / h if h > 0 else 0
            if aspect_lo <= aspect <= aspect_hi:
                candidates.append((area, aspect, approx))
    if debug:
        print(f"Found {len(candidates)} 4-point candidates.")
        for i, (area, aspect, approx) in enumerate(sorted(candidates, reverse=True)):
            print(f"  Candidate {i+1}: area={area:.0f}, aspect={aspect:.2f}")
    return sorted(candidates, reverse=True)  # largest area first

def preprocess_methods(gray):
    methods = {}
    # 1. Adaptive threshold (skimage)
    T = threshold_local(gray, 21, offset=10, method="gaussian")
    methods['adaptive'] = (gray > T).astype("uint8") * 255
    # 2. Otsu threshold
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    methods['otsu'] = otsu
    # 3. CLAHE (Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl1 = clahe.apply(gray)
    _, cl1_bin = cv2.threshold(cl1, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    methods['clahe'] = cl1_bin
    # 4. Histogram equalization
    eq = cv2.equalizeHist(gray)
    _, eq_bin = cv2.threshold(eq, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    methods['equalized'] = eq_bin
    return methods

# --- Main function for CLI usage ---
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Auto-crop and fix painting perspective in an image.")
    parser.add_argument("input", help="Path to input image")
    parser.add_argument("output", help="Path to save the corrected image")
    parser.add_argument("--show", action="store_true", help="Show before/after images")
    parser.add_argument("--debug", action="store_true", help="Show contour debug images and print candidates")
    args = parser.parse_args()

    image = cv2.imread(args.input)
    if image is None:
        print(f"Failed to load image: {args.input}")
        exit(1)
    ratio = getresize_ratio(image)
    small = opencv_resize(image, ratio)
    if args.debug:
        debug_imgs, painting_contour = find_painting(small, verb=True, debug=True)
        # Show all debug images for each method
        plt.figure(figsize=(16, 4*len(debug_imgs)))
        for i, (name, img_dbg, edged) in enumerate(debug_imgs):
            plt.subplot(len(debug_imgs), 2, 2*i+1)
            plt.title(f'{name} - Candidates')
            plt.imshow(cv2.cvtColor(img_dbg, cv2.COLOR_BGR2RGB))
            plt.subplot(len(debug_imgs), 2, 2*i+2)
            plt.title(f'{name} - Edges')
            plt.imshow(edged, cmap='gray')
        plt.tight_layout()
        plt.show()
    else:
        painting_contour = find_painting(small)
    if painting_contour is None:
        print("Could not find painting contour!")
        exit(1)
    rect = contour_to_rect(painting_contour, ratio)
    warped = wrap_perspective(image, rect)
    cv2.imwrite(args.output, warped)
    print(f"Saved corrected image to {args.output}")

    if args.show:
        plt.figure(figsize=(12, 6))
        plt.subplot(1,2,1)
        plt.title('Original')
        plt.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        plt.subplot(1,2,2)
        plt.title('Corrected')
        plt.imshow(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))
        plt.show()