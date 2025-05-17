# Basil Gallery

A modern web gallery for managing, describing, and sharing paintings and images, with automated GitHub PR integration and PDF/image upload support.

## Features
- **Image Gallery**: Browse, search, and filter paintings by country, year, location, and technique.
- **Manager Dashboard**: Upload images (JPG, PNG, PDF), edit metadata, and manage the gallery from a secure dashboard.
- **PDF Support**: Upload PDF files—first page is automatically converted to PNG for gallery use.
- **Automated GitHub PRs**: All changes to paintings and new images are committed and pushed to a GitHub repository via a single button.
- **Error Logging & Alerts**: Tracks errors and can send email alerts for repeated issues.
- **Modern UI**: Responsive, clean, and user-friendly interface.

## Setup

### 1. Clone the Repository
```bash
git clone https://github.com/YotamAflalo/basil-gallery.git
cd basil-gallery
```

### 2. Install Python Dependencies
```bash
pip install -r scripts/image_preprocess/requirements.txt
```

### 3. Install Additional Project Dependencies
```bash
pip install pymupdf Pillow
```

### 4. Environment Variables
Set the following environment variables (in `.env` or your deployment platform):
- `GALLERY_USER` and `GALLERY_PASS`: For manager authentication
- `GITHUB_TOKEN`: GitHub personal access token (for PR automation)
- `GITHUB_REPO`: GitHub repo in the format `username/repo`
- `GIT_USER_NAME` and `GIT_USER_EMAIL`: Git identity for PR commits
- `GMAIL_USER`, `GMAIL_PASS`, `ALERT_EMAIL`: For error alert emails (optional)

### 5. Run the App
```bash
uvicorn main:app --reload
```

## Usage
- **Manager Dashboard**: Log in and access `/dashboard` to upload images, edit metadata, or push changes to GitHub.
- **Image Upload**: Upload JPG, PNG, or PDF files. PDFs are converted to PNG automatically.
- **Edit Gallery**: Update painting details and descriptions.
- **Push to GitHub**: Use the dashboard button to create a PR with all new/edited data and images.

## PDF/Image Processing
- The script `scripts/process_uploaded.py` ensures all uploaded PDFs are converted to PNG before being added to the gallery.
- Only the first page of a PDF is used.

## Contributing
1. Fork the repo and create a feature branch.
2. Make your changes and submit a PR.
3. For major changes, open an issue first to discuss.

## License
MIT

## Contact
For questions or support, contact [Yotam Aflalo](mailto:yotam.aflalo@gmail.com). 