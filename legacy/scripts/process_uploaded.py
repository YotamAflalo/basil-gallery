import sys
import os
import fitz  # PyMuPDF
from PIL import Image

def process_uploaded(input_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    filename = os.path.basename(input_path)
    name, ext = os.path.splitext(filename)
    ext = ext.lower()
    if ext == '.pdf':
        # Convert first page of PDF to PNG
        doc = fitz.open(input_path)
        if len(doc) == 0:
            raise ValueError('PDF has no pages')
        page = doc.load_page(0)
        pix = page.get_pixmap()
        output_path = os.path.join(output_dir, f'{name}.png')
        pix.save(output_path)
        return output_path
    else:
        # If not PDF, just copy the file to output_dir
        output_path = os.path.join(output_dir, filename)
        if input_path != output_path:
            with open(input_path, 'rb') as src, open(output_path, 'wb') as dst:
                dst.write(src.read())
        return output_path

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python process_uploaded.py <input_path> <output_dir>')
        sys.exit(1)
    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    result = process_uploaded(input_path, output_dir)
    print(result) 