/**
 * Attachment constants + server-side text extraction for chat file uploads.
 *
 * The composer lets the user attach one file per message:
 *   - Images (JPEG/PNG/GIF/WebP) → sent natively to Claude as an `image` block
 *     (vision). Great for menu photos, screenshots, food pics.
 *   - PDFs → sent natively as a `document` block.
 *   - DOC/DOCX/XLS/XLSX/CSV → extracted to text server-side and prefixed into
 *     the user's message inside <attachment> tags.
 */

/** Hard cap on a single uploaded file. Matches what the composer enforces. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB

/** Cap on extracted text injected into the prompt — keeps tokens bounded. */
export const MAX_EXTRACTED_CHARS = 50_000;

/** Image MIME types Claude vision accepts. */
export const ACCEPTED_IMAGE_MIME_TYPES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/** MIME types accepted by /api/chat. Anything else returns 415. */
export const ACCEPTED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/csv",
  "application/csv",
  ...ACCEPTED_IMAGE_MIME_TYPES,
]);

/** Human-friendly extension allowlist — used to label the `<input accept>`. */
export const ACCEPTED_EXTENSIONS =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp";

export type ImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

export type AttachmentKind =
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "csv"
  | "image";

export function classifyAttachment(
  mimeType: string,
  filename: string,
): AttachmentKind | null {
  const lower = filename.toLowerCase();
  if (
    ACCEPTED_IMAGE_MIME_TYPES.has(mimeType) ||
    /\.(jpe?g|png|gif|webp)$/i.test(lower)
  ) {
    return "image";
  }
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mimeType === "application/msword" || lower.endsWith(".doc")) return "doc";
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lower.endsWith(".xlsx")
  ) {
    return "xlsx";
  }
  if (mimeType === "application/vnd.ms-excel" || lower.endsWith(".xls")) {
    return "xls";
  }
  if (
    mimeType === "text/csv" ||
    mimeType === "application/csv" ||
    lower.endsWith(".csv")
  ) {
    return "csv";
  }
  return null;
}

/**
 * Map an uploaded image's MIME / filename to a Claude-accepted media type.
 * Returns null if it isn't a supported image. Falls back to extension when the
 * browser-reported MIME is missing/odd.
 */
export function imageMediaType(
  mimeType: string,
  filename: string,
): ImageMediaType | null {
  if (mimeType === "image/jpeg") return "image/jpeg";
  if (mimeType === "image/png") return "image/png";
  if (mimeType === "image/gif") return "image/gif";
  if (mimeType === "image/webp") return "image/webp";
  const lower = filename.toLowerCase();
  if (/\.jpe?g$/i.test(lower)) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

/** Format bytes for UI display ("482 KB", "1.4 MB"). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ExtractedAttachment {
  /** Extracted plain-text content (truncated to {@link MAX_EXTRACTED_CHARS}). */
  text: string;
  /** True when the content was truncated to fit the cap. */
  truncated: boolean;
}

/**
 * Extract text from DOC/DOCX/XLS/XLSX/CSV. NOT called for PDFs — those go
 * straight to Claude as a document content block. Throws on parse failure;
 * the caller surfaces the error to the user.
 */
export async function extractAttachmentText(
  kind: Exclude<AttachmentKind, "pdf">,
  buffer: Buffer,
): Promise<ExtractedAttachment> {
  let raw = "";

  if (kind === "doc" || kind === "docx") {
    // mammoth handles both .doc (best-effort) and .docx (full fidelity).
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    raw = result.value ?? "";
  } else if (kind === "xls" || kind === "xlsx") {
    // SheetJS — read every sheet, emit CSV-per-sheet.
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buffer, { type: "buffer" });
    const parts: string[] = [];
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      if (csv.trim().length === 0) continue;
      parts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
    }
    raw = parts.join("\n\n");
  } else if (kind === "csv") {
    raw = buffer.toString("utf8");
  }

  const trimmed = raw.trim();
  if (trimmed.length <= MAX_EXTRACTED_CHARS) {
    return { text: trimmed, truncated: false };
  }
  return {
    text: trimmed.slice(0, MAX_EXTRACTED_CHARS),
    truncated: true,
  };
}
