import asyncio
import io
import pytesseract
import google.generativeai as genai
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

def ocr_via_gemini(image_bytes: bytes) -> str:
    """
    Synchronous call to Gemini 1.5 Pro to extract text from the image.
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in settings/environment.")
    
    # Configure Gemini SDK
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(settings.OCR_MODEL)
    
    # Open image with PIL
    image = Image.open(io.BytesIO(image_bytes))
    
    # Request text extraction
    prompt = "Read and extract all text from this document image. Return only the extracted text. Do not add comments, markdown formatting, or descriptions. Just output the text characters found on the image."
    response = model.generate_content([image, prompt])
    
    return response.text.strip() if response.text else ""

async def run_ocr_task(image_bytes: bytes) -> str:
    """
    Asynchronous wrapper that executes the OCR task
    in a separate thread to keep the main FastAPI event loop non-blocking.
    """
    if settings.OCR_PROVIDER == "gemini":
        return await asyncio.to_thread(ocr_via_gemini, image_bytes)
    else:
        return await asyncio.to_thread(preprocess_and_ocr, image_bytes)

