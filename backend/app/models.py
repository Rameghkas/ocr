from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class StructuredChallan(BaseModel):
    challan_date: Optional[str] = None
    source_address: Optional[str] = None
    destination_address: Optional[str] = None
    total_kg: Optional[float] = None
    total_cost: Optional[float] = None

class DocumentResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    upload_date: datetime
    raw_text: str = ""
    status: str = "queued"  # queued, processing, completed, failed
    error_message: Optional[str] = None
    structured_data: Optional[StructuredChallan] = None

