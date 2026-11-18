# Guideline library (RAG)

Upload published guidelines and your own protocols; Augi retrieves cited passages from them.

## Architecture
- **Separate database.** Vectors live in their own Postgres with pgvector (Supabase works) set by `GUIDELINES_DATABASE_URL`. It never holds patient data, and patient text is never embedded: Augi's queries are generic clinical questions.
- **Embeddings.** AWS Bedrock Titan Text Embeddings v2 (`EMBED_PROVIDER=bedrock`, 1024 dims by default). One function (`makeEmbedder`) hides the provider. The model name is stored per document and search only matches vectors from the current model.
- **Pipeline.** upload → extract (PDF/DOCX/MD/TXT) → heading-aware chunks (~320 words, 40 overlap, section path + page range kept) → embed → store as **draft**.
- **Search.** Hybrid: vector similarity + full-text, merged by reciprocal-rank fusion. Returns excerpts with title, version, section, pages.
- **Governance.** Only **active** documents are searched. Activating records who did it. A new version of the same title retires the old one but keeps it on file. Everything is audited (`guideline_audit`).
- **Scope.** Super admin uploads platform-wide guidelines; an org admin uploads that org's protocols, visible only to that org. The org filter is applied in SQL from the signed-in user, never from a model-supplied value.
- **Agent.** Augi's `search_guidelines` tool (optional `wound_type`). Falls back to a "not configured" note if the library is off; the built-in `search_clinical_kb` remains.

## Setup
1. Create a Supabase project (or any Postgres with pgvector). Use the **session pooler** connection string.
2. Render env: `GUIDELINES_DATABASE_URL`, `EMBED_PROVIDER=bedrock`, `AWS_REGION`, optionally `EMBED_MODEL` / `EMBED_DIMS` (256, 512 or 1024). The server creates the tables on boot.
3. Give the Render service AWS credentials that allow `bedrock:InvokeModel` on the Titan model, and enable model access in the Bedrock console.
4. Sign in as super admin → **Guidelines** → upload → check the draft with "Try a search" → Activate.

## Changing the embedding model or dimensions
The vector column is sized at table creation. Changing `EMBED_DIMS` or the model means a new column size and re-uploading the documents (the table can be dropped and rebuilt; originals aren't stored, so keep your source files).

## Limits
- Scanned PDFs are rejected (no OCR). Run OCR first.
- Tables in PDFs are extracted as running text, so dosing/threshold tables can lose structure. Spot-check them with "Try a search".
- Heading detection for PDFs is heuristic (numbered or ALL-CAPS lines); weak headings only make citations less precise.
- Original files are not kept, only extracted text and chunks. Only upload text you are licensed to store.
- Retrieval quality is not measured yet: build a small question set per guideline and check the right passage comes back after each upload or model change.
