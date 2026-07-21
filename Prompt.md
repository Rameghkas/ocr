# Role & Goal
You are a senior full-stack software architect. Your goal is to scaffold and generate the foundational code for a modern, multi-tier web application consisting of a mobile-first React frontend, a Node.js API Gateway with built-in CPU-based OCR, and a secondary FastAPI Python server for downstream processing.

# System Architecture & Boundaries

1. **Frontend (Mobile Web App):**
   - **Stack:** React, Vite, Tailwind CSS, Lucide Icons.
   - **Design:** Mobile-first, responsive, touch-friendly UI. Must include a clean document/image upload interface (supporting mobile camera capture and file drag-and-drop) to trigger OCR workflows.
   - **Communication:** Communicates EXCLUSIVELY with the Node.js API Gateway via REST/JSON.

2. **Backend 1: Node.js API Gateway & OCR Engine:**
   - **Stack:** Node.js, Express (or Fastify), Mongoose (MongoDB), `tesseract.js` (or native CPU `tesseract` execution), `axios` / `node-fetch`.
   - **Responsibilities:**
     - Acts as the primary backend interface for the React app.
     - Connects to a managed or local **MongoDB** database to store user records, raw extracted OCR text, and processing metadata.
     - Performs **CPU-based OCR** locally using `tesseract.js` inside worker threads so it does not block the main Node event loop.
     - Manages secure authentication and credential verification.
     - Proxies validated requests and passes credentials (via encrypted headers or shared Bearer tokens) to the FastAPI server for downstream tasks.

3. **Backend 2: FastAPI Processing Server:**
   - **Stack:** Python 3.11+, FastAPI, Pydantic, Uvicorn.
   - **Responsibilities:**
     - Runs on a separate port (e.g., `:8000`) as an internal service.
     - Implements a dependency-injection authentication guard (`HTTPBearer` or API Key header check) to verify credentials sent by the Node.js gateway before processing requests.
     - Exposes structured REST endpoints designed to receive the text extracted from the Node OCR engine for secondary Python-based data analysis or formatting.

# Core Technical Requirements & Best Practices

- **Security & Credentials:** Use `.env` files for all secrets. The Node server must authenticate with FastAPI using a shared `FASTAPI_SECRET_KEY` or signed JWTs passed in the `Authorization` header. Do not expose FastAPI directly to the frontend.
- **CPU OCR Optimization:** Configure the Node OCR service to process images asynchronously and return clear error messaging if image resolution is too low for CPU recognition.
- **Vite Configuration:** Configure `vite.config.js` to proxy API requests during local development cleanly.
- **MongoDB Schema:** Create a clean Mongoose schema for `Document` containing fields for: `filename`, `uploadDate`, `rawText` (from OCR), `fastApiProcessedData` (JSON payload from FastAPI), and `status` (`processing`, `completed`, `failed`).

# Deliverables & Execution Plan

Please scaffold the project step-by-step in the following order:

1. **Project Directory Structure:** Output a clean ASCII tree showing how the monorepo/multi-folder workspace is organized (`/frontend`, `/node-backend`, `/python-service`).
2. **Environment Setup:** Provide the exact `.env.example` files needed for all three layers.
3. **Node.js Gateway & OCR Implementation:** Provide the server setup code, the MongoDB Mongoose schema, the worker-thread CPU OCR service using `tesseract.js`, and the proxy routing middleware to FastAPI.
4. **FastAPI Server Implementation:** Provide the `main.py` entry point, Pydantic data validation schemas, and the security dependency check to validate incoming Node credentials.
5. **React Mobile UI:** Provide the main image upload component using Tailwind CSS styled for a native mobile feel, showing upload progress, OCR extraction status, and the final processed results.
6. **Run Instructions:** Give clear terminal commands to start all three services concurrently for development.

Start by presenting the directory structure and the environment variables, then pause and ask me if I want to adjust any stack configurations before writing the service code.
