"""
Document Routes
File upload, download, and management with security checks
"""
import os
import uuid
import aiofiles
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Document, User, UserRole, DocumentType
from ..schemas.schemas import DocumentResponse
from ..middleware.rbac import require_any_authenticated, check_resource_access
from ..config import settings

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_TYPES = {
    "application/pdf", "image/jpeg", "image/png", "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db)
):
    """List documents (CLIENT: own; DIRECTEUR: all)"""
    query = db.query(Document)

    if current_user.role != UserRole.DIRECTEUR:
        query = query.filter(Document.owner_id == current_user.id)

    return query.all()


@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    name: str = Form(...),
    doc_type: DocumentType = Form(DocumentType.OTHER),
    description: str = Form(None),
    contract_id: str = Form(None),
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db)
):
    """Upload a document file"""

    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: PDF, JPEG, PNG, DOC, DOCX"
        )

    # Read file and check size
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE // 1024 // 1024}MB"
        )

    # Save file to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}{ext}")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Save record to DB
    document = Document(
        owner_id=current_user.id,
        contract_id=uuid.UUID(contract_id) if contract_id else None,
        name=name,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(content),
        mime_type=file.content_type,
        doc_type=doc_type,
        description=description
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("/{doc_id}/download")
def download_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db)
):
    """Download a document file"""
    document = db.query(Document).filter(Document.id == doc_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    check_resource_access(document.owner_id, current_user)

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=document.file_path,
        filename=document.original_filename,
        media_type=document.mime_type
    )


@router.delete("/{doc_id}", status_code=204)
def delete_document(
    doc_id: uuid.UUID,
    current_user: User = Depends(require_any_authenticated),
    db: Session = Depends(get_db)
):
    """Delete a document"""
    document = db.query(Document).filter(Document.id == doc_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    check_resource_access(document.owner_id, current_user)

    # Remove physical file
    if os.path.exists(document.file_path):
        os.remove(document.file_path)

    db.delete(document)
    db.commit()
