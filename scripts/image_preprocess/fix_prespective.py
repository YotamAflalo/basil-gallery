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

def find_painting(image, verb=False):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # Use adaptive thresholding for better edge detection on paintings
    T = threshold_local(gray, 21, offset=10, method="gaussian")
    thresh = (gray > T).astype("uint8") * 255
    blurred = cv2.GaussianBlur(thresh, (5, 5), 0)
    rectKernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    dilated = cv2.dilate(blurred, rectKernel)
    edged = cv2.Canny(dilated, 50, 150, apertureSize=3)
    contours, hierarchy = cv2.findContours(edged, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    # Get 10 largest contours
    largest_contours = sorted(contours, key=cv2.contourArea, reverse=True)[:10]
    painting_contour = get_painting_contour(largest_contours)
    if verb:
        image_with_contours = cv2.drawContours(image.copy(), contours, -1, (0,255,0), 2)
        image_with_largest_contours = cv2.drawContours(image.copy(), largest_contours, -1, (0,255,0), 2)
        if painting_contour is not None:
            image_with_painting_contour = cv2.drawContours(image.copy(), [painting_contour], -1, (0, 0, 255), 2)
        else:
            image_with_painting_contour = image.copy()
        return image_with_painting_contour, image_with_largest_contours, image_with_contours, painting_contour
    return painting_contour


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

# --- Main function for CLI usage ---
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Auto-crop and fix painting perspective in an image.")
    parser.add_argument("input", help="Path to input image")
    parser.add_argument("output", help="Path to save the corrected image")
    parser.add_argument("--show", action="store_true", help="Show debug images")
    args = parser.parse_args()

    image = cv2.imread(args.input)
    if image is None:
        print(f"Failed to load image: {args.input}")
        exit(1)
    ratio = getresize_ratio(image)
    small = opencv_resize(image, ratio)
    painting_contour = find_painting(small)
    if painting_contour is None:
        print("Could not find painting contour!")
        exit(1)
    rect = contour_to_rect(painting_contour, ratio)
    warped = wrap_perspective(image, rect)
    cv2.imwrite(args.output, warped)
    print(f"Saved corrected image to {args.output}")
    if args.show:
        plt.subplot(1,2,1)
        plt.title('Original')
        plt.imshow(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        plt.subplot(1,2,2)
        plt.title('Corrected')
        plt.imshow(cv2.cvtColor(warped, cv2.COLOR_BGR2RGB))
        plt.show()