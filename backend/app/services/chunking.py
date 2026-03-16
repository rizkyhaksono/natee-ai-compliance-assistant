import re
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class ChunkMetadata:
    def __init__(
        self,
        content: str,
        chunk_index: int,
        section: Optional[str] = None,
        page_number: Optional[int] = None,
    ):
        self.content = content
        self.chunk_index = chunk_index
        self.section = section
        self.page_number = page_number


class ChunkingService:
    """Splits document text into overlapping chunks with metadata."""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def chunk_text(self, text: str) -> List[ChunkMetadata]:
        sections = self._detect_sections(text)
        if sections:
            return self._chunk_by_sections(sections)
        return self._chunk_by_size(text)

    def _detect_sections(self, text: str) -> List[dict]:
        """Try to detect sections/articles in the document."""
        section_patterns = [
            r"(?:^|\n)((?:Pasal|Article|Section|BAB|Chapter)\s+\d+[^\n]*)",
            r"(?:^|\n)(\d+\.\s+[A-Z][^\n]{5,})",
        ]
        sections = []
        for pattern in section_patterns:
            matches = list(re.finditer(pattern, text, re.IGNORECASE))
            if len(matches) >= 2:
                for i, match in enumerate(matches):
                    start = match.start()
                    end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                    sections.append({
                        "title": match.group(1).strip(),
                        "content": text[start:end].strip(),
                    })
                return sections
        return []

    def _chunk_by_sections(self, sections: List[dict]) -> List[ChunkMetadata]:
        chunks = []
        chunk_index = 0
        for section in sections:
            section_chunks = self._chunk_by_size(section["content"], section_title=section["title"])
            for sc in section_chunks:
                sc.chunk_index = chunk_index
                chunk_index += 1
            chunks.extend(section_chunks)
        return chunks

    def _chunk_by_size(self, text: str, section_title: Optional[str] = None) -> List[ChunkMetadata]:
        words = text.split()
        if not words:
            return []

        chunks = []
        chunk_index = 0
        i = 0
        while i < len(words):
            chunk_words = words[i : i + self.chunk_size]
            content = " ".join(chunk_words)

            page_number = self._extract_page_number(content)

            chunks.append(ChunkMetadata(
                content=content,
                chunk_index=chunk_index,
                section=section_title,
                page_number=page_number,
            ))
            chunk_index += 1
            i += self.chunk_size - self.chunk_overlap

        return chunks

    @staticmethod
    def _extract_page_number(text: str) -> Optional[int]:
        match = re.search(r"\[Page (\d+)\]", text)
        if match:
            return int(match.group(1))
        return None
