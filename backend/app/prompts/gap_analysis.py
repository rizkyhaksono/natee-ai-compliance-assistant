GAP_ANALYSIS_PROMPT = """Lakukan analisis gap (gap analysis) antara regulasi dan dokumen internal berikut.

REGULASI (Dokumen Acuan):
{regulation_context}

DOKUMEN INTERNAL:
{internal_context}

INSTRUKSI:
1. Identifikasi setiap ketentuan penting dalam regulasi
2. Bandingkan dengan dokumen internal
3. Tentukan status compliance setiap ketentuan: "compliant", "partial", "non_compliant", atau "not_found"
4. Berikan risk level: "high", "medium", "low", atau "compliant"
5. Rekomendasikan tindakan perbaikan yang spesifik

OUTPUT harus dalam format JSON array seperti berikut:
{{
    "summary": "ringkasan keseluruhan analisis gap",
    "overall_risk": "high/medium/low/compliant",
    "gaps": [
        {{
            "regulation_clause": "Pasal/Section yang dianalisis",
            "regulation_text": "Kutipan teks regulasi",
            "internal_reference": "Referensi di dokumen internal (jika ada)",
            "internal_text": "Kutipan teks internal (jika ada)",
            "status": "compliant/partial/non_compliant/not_found",
            "risk_level": "high/medium/low/compliant",
            "gap_description": "Deskripsi gap yang ditemukan",
            "recommended_action": "Tindakan perbaikan yang direkomendasikan"
        }}
    ]
}}

Jawab HANYA dalam format JSON valid. Tidak perlu penjelasan tambahan di luar JSON.
"""


def build_gap_analysis_prompt(regulation_chunks: list, internal_chunks: list) -> str:
    reg_parts = []
    for i, chunk in enumerate(regulation_chunks, 1):
        header = f"[Section: {chunk.get('section', 'N/A')} | Page: {chunk.get('page_number', 'N/A')}]"
        reg_parts.append(f"{header}\n{chunk['content']}")

    int_parts = []
    for i, chunk in enumerate(internal_chunks, 1):
        header = f"[Section: {chunk.get('section', 'N/A')} | Page: {chunk.get('page_number', 'N/A')}]"
        int_parts.append(f"{header}\n{chunk['content']}")

    return GAP_ANALYSIS_PROMPT.format(
        regulation_context="\n\n".join(reg_parts),
        internal_context="\n\n".join(int_parts),
    )
