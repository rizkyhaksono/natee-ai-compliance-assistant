CHECKLIST_PROMPT = """Berdasarkan dokumen regulasi/kebijakan berikut, buat checklist implementasi compliance.

DOKUMEN:
{context}

{focus_instruction}

INSTRUKSI:
1. Identifikasi setiap requirement/ketentuan yang memerlukan tindakan
2. Buat checklist item yang spesifik dan actionable
3. Tentukan prioritas: "critical", "high", "medium", atau "low"
4. Sertakan saran pihak yang bertanggung jawab dan timeline jika memungkinkan

OUTPUT harus dalam format JSON seperti berikut:
{{
    "summary": "ringkasan checklist",
    "items": [
        {{
            "item_number": 1,
            "requirement": "Deskripsi requirement dari regulasi",
            "source_clause": "Pasal/Section sumber",
            "priority": "critical/high/medium/low",
            "action_needed": "Tindakan spesifik yang harus dilakukan",
            "responsible_party": "Pihak yang bertanggung jawab (saran)",
            "deadline_suggestion": "Saran timeline",
            "notes": "Catatan tambahan"
        }}
    ]
}}

Jawab HANYA dalam format JSON valid.
"""


def build_checklist_prompt(context_chunks: list, focus_area: str = None) -> str:
    context_parts = []
    for chunk in context_chunks:
        header = f"[Section: {chunk.get('section', 'N/A')} | Page: {chunk.get('page_number', 'N/A')}]"
        context_parts.append(f"{header}\n{chunk['content']}")

    focus_instruction = ""
    if focus_area:
        focus_instruction = f"FOKUS AREA: {focus_area}\nFokuskan checklist pada area ini."

    return CHECKLIST_PROMPT.format(
        context="\n\n".join(context_parts),
        focus_instruction=focus_instruction,
    )
