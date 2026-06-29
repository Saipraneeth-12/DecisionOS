"""
Document Service - handles file upload, parsing, and indexing
Supports: PDF, DOCX, TXT, CSV, XLSX
All heavy-parse imports are lazy to avoid startup errors.
"""
import os
import uuid
from typing import Dict, Any
from pathlib import Path
from app.core.config import settings
from app.core.logging import logger


class DocumentService:
    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def save_upload(self, file_bytes: bytes, original_name: str, conversation_id: str) -> Dict[str, Any]:
        ext = Path(original_name).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        save_path = self.upload_dir / unique_name

        # Write file sync-style (avoids aiofiles dependency at startup)
        save_path.write_bytes(file_bytes)

        content = self._extract_text(save_path, ext)
        doc_type = self._detect_doc_type(original_name, content)

        logger.info("document_saved", name=original_name, size=len(file_bytes), type=doc_type)

        return {
            "id": uuid.uuid4().hex,
            "filename": unique_name,
            "original_name": original_name,
            "file_type": ext.lstrip("."),
            "doc_type": doc_type,
            "file_size": len(file_bytes),
            "content": content[:5000],
            "conversation_id": conversation_id,
            "is_indexed": False,
            "path": str(save_path),
        }

    def _extract_text(self, path: Path, ext: str) -> str:
        try:
            if ext in (".txt", ".csv", ".md", ".eml"):
                return path.read_text(encoding="utf-8", errors="ignore")

            elif ext == ".pdf":
                try:
                    import fitz  # PyMuPDF
                    doc = fitz.open(str(path))
                    text = "\n".join(page.get_text() for page in doc)
                    doc.close()
                    return text
                except ImportError:
                    return "[PDF uploaded - install PyMuPDF to extract text: pip install pymupdf]"

            elif ext in (".docx", ".doc"):
                try:
                    from docx import Document
                    doc = Document(str(path))
                    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
                except ImportError:
                    return "[DOCX uploaded - install python-docx to extract text: pip install python-docx]"

            elif ext in (".xlsx", ".xls"):
                try:
                    import openpyxl
                    wb = openpyxl.load_workbook(str(path), read_only=True)
                    lines = []
                    for ws in wb.worksheets:
                        for row in ws.iter_rows(values_only=True):
                            line = ", ".join(str(c) for c in row if c is not None)
                            if line:
                                lines.append(line)
                    return "\n".join(lines[:300])
                except ImportError:
                    return "[Excel uploaded - install openpyxl to extract text: pip install openpyxl]"

            else:
                # Try reading as text
                try:
                    return path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    return "[Binary file - text extraction not supported]"

        except Exception as e:
            logger.warning("text_extraction_failed", path=str(path), error=str(e))
            return f"[Could not extract text: {e}]"

    def _detect_doc_type(self, filename: str, content: str) -> str:
        name_lower = filename.lower()
        content_lower = content.lower()[:500]

        if any(w in name_lower for w in ["crm", "salesforce", "account", "opportunity", "hubspot"]):
            return "crm"
        if any(w in name_lower for w in ["transcript", "meeting", "call", "recording", "notes"]):
            return "transcript"
        if any(w in name_lower for w in ["playbook", "runbook", "procedure", "sop"]):
            return "playbook"
        if any(w in name_lower for w in ["contract", "agreement", "sow", "msa", "nda"]):
            return "contract"
        if any(w in name_lower for w in ["email", "mail", "correspondence"]):
            return "email"
        if any(w in name_lower for w in ["usage", "metric", "analytics", "report", "dashboard"]):
            return "usage"
        if any(w in name_lower for w in ["policy", "rule", "compliance", "guideline"]):
            return "policy"

        if any(w in content_lower for w in ["arr", "mrr", "renewal date", "contract value", "account health"]):
            return "crm"
        if any(w in content_lower for w in ["discussed", "action item", "follow up", "attendees", "meeting"]):
            return "transcript"
        if any(w in content_lower for w in ["step 1", "best practice", "framework", "methodology"]):
            return "playbook"

        return "document"


document_service = DocumentService()
