import asyncio
import io
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
from app.config import settings

if settings.TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

def preprocess_and_ocr(image_bytes: bytes) -> str:
    """
    Synchronous CPU-bound function to process image and extract text.
    Applies grayscale conversion and contrast enhancement.
    """
    try:
        # Open image with Pillow
        image = Image.open(io.BytesIO(image_bytes))

        # Image Preprocessing: Convert to Grayscale
        image = image.convert('L')

        # Increase contrast for better OCR readability on mobile photos
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)

        # Run Tesseract OCR
        raw_text = pytesseract.image_to_string(image)
        return raw_text.strip()
    except Exception as e:
        raise RuntimeError(f"OCR execution error: {str(e)}")

async def run_ocr_task(image_bytes: bytes) -> str:
    """
    Asynchronous wrapper that executes the CPU-bound OCR task
    in a separate thread to keep the main FastAPI event loop non-blocking.
    """
    return await asyncio.to_thread(preprocess_and_ocr, image_bytes)
