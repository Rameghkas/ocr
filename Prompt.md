# Role & Goal
You are a senior full-stack software architect. Your goal is to scaffold and generate the foundational code for a modern, two-tier web application consisting of a mobile-first React frontend and a unified Python FastAPI backend that handles API routing, authentication, asynchronous MongoDB persistence, and local CPU-based OCR processing.

# System Architecture & Boundaries

1. **Frontend (Mobile Web App):**
   - **Stack:** React, Vite, Tailwind CSS, Lucide Icons.
   - **Design:** Mobile-first, responsive, touch-friendly UI. Must feature a clean document/image upload interface (supporting native mobile camera capture and file drag-and-drop) to trigger OCR workflows.
   - **Communication:** Communicates with the FastAPI backend via REST/JSON, utilizing JWT Bearer tokens for authenticated endpoints.

2. **Backend: Python FastAPI & OCR Engine:**
   - **Stack:** Python 3.11+, FastAPI, Uvicorn, `motor` (async MongoDB driver), `beanie` or `pydantic` for data modeling, `pytesseract` (or `easyocr`), `Pillow` (PIL), `python-jose`, `passlib[bcrypt]`.
   - **Responsibilities:**
     - Acts as the sole backend server and REST API for the React application.
     - Manages secure OAuth2 user authentication (login, registration, password hashing) and issues JWT access tokens.
     - Connects asynchronously to a managed or local **MongoDB** database using `Motor` to store user credentials, document metadata, raw extracted OCR text, and processing status.
     - Performs **CPU-based OCR** locally using `pytesseract` and `Pillow`. 
     - **CRITICAL ASYNC REQUIREMENT:** Because OCR is a CPU-bound operation, it must NEVER run directly on the main async event loop. You must execute the OCR processing function inside a separate thread or process pool using `asyncio.to_thread()` or `concurrent.futures.ProcessPoolExecutor` so the FastAPI server remains responsive.
     - Parses, cleans, and structures the raw OCR text using Pydantic schemas before persisting to MongoDB and returning the payload to the client.

# Core Technical Requirements & Best Practices

- **Security & Configuration:** Use `pydantic-settings` to manage environment variables (`.env` files) for database URIs, secret keys, and OCR configurations. Implement FastAPI's `OAuth2PasswordBearer` for secure route protection.
- **CPU OCR Optimization:** Implement basic image pre-processing using `Pillow` or `OpenCV` (e.g., converting to grayscale, contrast enhancement) inside the background task to improve CPU OCR accuracy on mobile photos before passing it to Tesseract.
- **Vite Configuration:** Configure `vite.config.js` with an API proxy pointing to the FastAPI server port (default `:8000`) during local development to eliminate CORS friction.
- **MongoDB Models (Pydantic / Beanie):** Create strict async models:
  - `User`: `email`, `hashed_password`, `created_at`.
  - `Document`: `user_id`, `filename`, `upload_date`, `raw_text` (extracted from OCR), `status` (`queued`, `processing`, `completed`, `failed`), and `error_message`.

# Deliverables & Execution Plan

Please scaffold the project step-by-step in the following order:

1. **Project Directory Structure:** Output a clean ASCII tree showing how the workspace is organized (e.g., `/frontend` and `/backend`).
2. **Environment & Dependencies:** Provide the `.env.example` files and the backend `requirements.txt` / `pyproject.toml` including all required async and imaging packages.
3. **FastAPI Bootstrap & Auth:** Provide the database connection setup using `Motor`, Pydantic user models, password hashing utilities, and the OAuth2 authentication routes/dependencies.
4. **Python CPU OCR Service:** Write the dedicated OCR processing module (including image pre-processing and `asyncio.to_thread` execution), along with the authenticated `UploadFile` endpoint that handles multipart form data, triggers the OCR pipeline, and updates MongoDB asynchronously.
5. **React Mobile UI:** Provide the main document processing view using Tailwind CSS styled for a native mobile feel—showing camera/file selection, real-time OCR extraction status, and the final structured text display.
6. **Run Instructions:** Give clear terminal commands to set up the Python virtual environment, install dependencies, and start both the frontend and backend servers concurrently for local development.

Start by presenting the directory structure and the environment variables, then pause and ask me if I want to adjust any Pydantic schema structures or database naming conventions before writing the application code.