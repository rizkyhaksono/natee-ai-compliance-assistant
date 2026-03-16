import re
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)

# Patterns that indicate prompt injection attempts
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"disregard\s+(all\s+)?previous",
    r"forget\s+(all\s+)?(your\s+)?instructions",
    r"you\s+are\s+now\s+a",
    r"pretend\s+you\s+are",
    r"act\s+as\s+if",
    r"new\s+instructions:",
    r"system\s*:\s*you",
    r"override\s+(previous|system)",
]

# Topics the compliance assistant should not address
OFF_TOPIC_PATTERNS = [
    r"(write|create|generate)\s+(me\s+)?(a\s+)?(poem|story|song|joke|code|script)",
    r"(hack|exploit|attack|bypass|crack)",
    r"personal\s+(advice|opinion|recommendation)\s+(?!compliance|regulation)",
]

# Patterns indicating legal conclusions in output
LEGAL_CONCLUSION_PATTERNS = [
    r"(this\s+is\s+|ini\s+)(legally|secara\s+hukum)\s+(binding|mengikat)",
    r"(definitive|pasti)\s+(legal|hukum)\s+(conclusion|kesimpulan)",
    r"(kami|we)\s+(memutuskan|decide|conclude)\s+(bahwa|that)",
]

# Sensitive data patterns to redact
SENSITIVE_PATTERNS = [
    (r"\b\d{16}\b", "[REDACTED-CARD]"),
    (r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED-SSN]"),
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "[REDACTED-EMAIL]"),
]


class GuardrailsService:
    """Input and output guardrails for the compliance assistant."""

    def check_input(self, query: str) -> Dict:
        flags = []
        query_lower = query.lower()

        # Check prompt injection
        for pattern in INJECTION_PATTERNS:
            if re.search(pattern, query_lower):
                logger.warning(f"Prompt injection detected: {pattern}")
                flags.append("prompt_injection_detected")
                return {"blocked": True, "flags": flags}

        # Check off-topic
        for pattern in OFF_TOPIC_PATTERNS:
            if re.search(pattern, query_lower):
                flags.append("off_topic_query")
                return {"blocked": True, "flags": flags}

        if len(query) > 5000:
            flags.append("query_too_long")

        return {"blocked": False, "flags": flags}

    def check_output(self, response: str) -> Dict:
        flags = []

        # Check for ungrounded legal conclusions
        for pattern in LEGAL_CONCLUSION_PATTERNS:
            if re.search(pattern, response, re.IGNORECASE):
                flags.append("contains_legal_conclusion")

        # Check if response lacks source references
        source_indicators = [
            "sumber", "source", "dokumen", "document",
            "pasal", "article", "section", "halaman", "page",
        ]
        has_source = any(ind in response.lower() for ind in source_indicators)
        if not has_source and len(response) > 200:
            flags.append("missing_source_citation")

        return {"flags": flags}

    def sanitize_output(self, response: str, flags: List[str]) -> str:
        sanitized = response

        if "contains_legal_conclusion" in flags:
            sanitized += "\n\n⚠️ DISCLAIMER: Jawaban ini bukan merupakan pendapat hukum yang mengikat. Konsultasikan dengan tim legal untuk keputusan final."

        if "missing_source_citation" in flags:
            sanitized += "\n\n⚠️ PERHATIAN: Jawaban ini mungkin tidak sepenuhnya berdasarkan dokumen yang tersedia. Verifikasi manual disarankan."

        # Redact sensitive data
        for pattern, replacement in SENSITIVE_PATTERNS:
            sanitized = re.sub(pattern, replacement, sanitized)

        return sanitized
