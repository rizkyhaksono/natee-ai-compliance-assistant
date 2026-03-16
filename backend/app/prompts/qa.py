QA_PROMPT_TEMPLATE = """Berdasarkan dokumen-dokumen berikut, jawab pertanyaan user.

DOKUMEN KONTEKS:
{context}

PERTANYAAN:
{query}

INSTRUKSI:
1. Jawab berdasarkan HANYA konteks dokumen di atas
2. Sebutkan sumber (nama dokumen, section/pasal, halaman) untuk setiap poin jawaban
3. Jika jawaban tidak ditemukan dalam konteks, katakan: "Tidak ditemukan dasar yang cukup dalam dokumen yang tersedia"
4. Berikan confidence level (high/medium/low) di akhir jawaban

FORMAT:
## Jawaban
[jawaban terstruktur dengan kutipan sumber]

## Sumber
- [daftar sumber yang digunakan]

## Confidence Level
[high/medium/low] - [alasan]
"""


def build_qa_prompt(context_chunks: list, query: str) -> str:
    context_parts = []
    for i, chunk in enumerate(context_chunks, 1):
        source_info = f"Dokumen: {chunk['document_name']}"
        if chunk.get("section"):
            source_info += f" | Section: {chunk['section']}"
        if chunk.get("page_number"):
            source_info += f" | Halaman: {chunk['page_number']}"
        context_parts.append(f"--- Sumber {i} ({source_info}) ---\n{chunk['content']}")

    context = "\n\n".join(context_parts)
    return QA_PROMPT_TEMPLATE.format(context=context, query=query)
