from contextlib import asynccontextmanager
from datetime import datetime
from typing import List
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from bson import ObjectId

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.models import UserCreate, UserResponse, Token, DocumentResponse
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.ocr_service import run_ocr_task

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup DB connection
    await connect_to_mongo()
    yield
    # Shutdown DB connection
    await close_mongo_connection()

app = FastAPI(
    title="Lumina OCR API",
    description="Mobile-first OCR backend with FastAPI, Motor MongoDB, and CPU-offloaded Tesseract processing",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AUTH ROUTES ---

@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    db = get_database()
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    hashed_password = get_password_hash(user_data.password)
    user_doc = {
        "email": user_data.email,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    return {
        "id": str(result.inserted_id),
        "email": user_data.email,
        "created_at": user_doc["created_at"]
    }

@app.post("/api/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_database()
    user = await db.users.find_one({"email": form_data.username})
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}


# --- BACKGROUND OCR PROCESSOR ---

async def process_document_ocr(document_id: str, file_bytes: bytes):
    db = get_database()
    try:
        # Update status to processing
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {"status": "processing"}}
        )

        # Execute OCR offloaded to background thread
        extracted_text = await run_ocr_task(file_bytes)

        # Update status to completed with raw text
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {
                "status": "completed",
                "raw_text": extracted_text,
                "error_message": None
            }}
        )
    except Exception as e:
        # Mark as failed on error
        await db.documents.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": {
                "status": "failed",
                "error_message": str(e)
            }}
        )


# --- DOCUMENT ROUTES ---

@app.post("/api/documents/upload", response_model=DocumentResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    contents = await file.read()
    db = get_database()

    doc_entry = {
        "user_id": current_user["id"],
        "filename": file.filename,
        "upload_date": datetime.utcnow(),
        "raw_text": "",
        "status": "queued",
        "error_message": None
    }
    result = await db.documents.insert_one(doc_entry)
    doc_id = str(result.inserted_id)

    # Trigger async OCR background task
    background_tasks.add_task(process_document_ocr, doc_id, contents)

    return {
        "id": doc_id,
        "user_id": current_user["id"],
        "filename": file.filename,
        "upload_date": doc_entry["upload_date"],
        "raw_text": "",
        "status": "queued",
        "error_message": None
    }

@app.get("/api/documents", response_model=List[DocumentResponse])
async def list_documents(current_user: dict = Depends(get_current_user)):
    db = get_database()
    cursor = db.documents.find({"user_id": current_user["id"]}).sort("upload_date", -1)
    documents = []
    async for doc in cursor:
        documents.append({
            "id": str(doc["_id"]),
            "user_id": doc["user_id"],
            "filename": doc["filename"],
            "upload_date": doc["upload_date"],
            "raw_text": doc.get("raw_text", ""),
            "status": doc.get("status", "queued"),
            "error_message": doc.get("error_message")
        })
    return documents

@app.get("/api/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id), "user_id": current_user["id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Document ID format")
        
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {
        "id": str(doc["_id"]),
        "user_id": doc["user_id"],
        "filename": doc["filename"],
        "upload_date": doc["upload_date"],
        "raw_text": doc.get("raw_text", ""),
        "status": doc.get("status", "queued"),
        "error_message": doc.get("error_message")
    }

@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    try:
        result = await db.documents.delete_one({"_id": ObjectId(document_id), "user_id": current_user["id"]})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Document ID format")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
        
    return {"message": "Document deleted successfully"}
