import io
import logging
from PyPDF2 import PdfReader
from docx import Document as DocxDocument

logger = logging.getLogger(__name__)


class DocumentParser:
    """Extracts text from PDF and DOCX files."""

    @staticmethod
    async def parse(file_content: bytes, mime_type: str) -> str:
        if mime_type == "application/pdf":
            return DocumentParser._parse_pdf(file_content)
        elif mime_type in (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ):
            return DocumentParser._parse_docx(file_content)
        elif mime_type and mime_type.startswith("text/"):
            return file_content.decode("utf-8", errors="replace")
        else:
            raise ValueError(f"Unsupported file type: {mime_type}")

    @staticmethod
    def _parse_pdf(content: bytes) -> str:
        reader = PdfReader(io.BytesIO(content))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            pages.append(f"[Page {i + 1}]\n{text}")
        return "\n\n".join(pages)

    @staticmethod
    def _parse_docx(content: bytes) -> str:
        doc = DocxDocument(io.BytesIO(content))
        paragraphs = []
        for para in doc.paragraphs:
            if para.text.strip():
                paragraphs.append(para.text)
        return "\n\n".join(paragraphs)
