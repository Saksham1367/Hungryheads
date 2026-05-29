-- ─────────────────────────────────────────────────────────────────────────────
-- HungryHeads — chat_messages.attachment column.
--
-- Stores metadata for a file the user attached to a message (PDF, DOC/DOCX,
-- XLS/XLSX, CSV). Shape: { filename: string, mime_type: string, size_bytes: number }.
--
-- We do NOT store the file itself — only the metadata needed to re-render a
-- "file sent" pill in chat history. The extracted text was already prefixed
-- into chat_messages.content at send time and passed to the model there.
--
-- Idempotent. No data migration needed.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.chat_messages
  add column if not exists attachment jsonb;
