// ── Client portal: what a client is allowed to upload ─────────────────────
// Shared by the client Document Upload screens so the file picker, the drag &
// drop validation and the small print under the drop zone never drift apart.
// Extensions are listed alongside the MIME types on purpose: browsers report
// .zip inconsistently (application/zip, application/x-zip-compressed, and on
// some machines application/octet-stream), so the extension is what reliably
// lets a ZIP through.
import type { Accept } from "react-dropzone";

export const CLIENT_UPLOAD_ACCEPT: Accept = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/csv": [".csv"],
  "image/*": [".png", ".jpg", ".jpeg", ".tif", ".tiff"],
  "application/zip": [".zip"],
  "application/x-zip-compressed": [".zip"],
};

/** Small print under the drop zone — also reused in the validation message. */
export const CLIENT_UPLOAD_HINT = "Upload claim documents (PDF, DOC, Images, or ZIP files)";
