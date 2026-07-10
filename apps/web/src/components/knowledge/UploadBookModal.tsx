import { useRef, useState } from "react";
import { BookUp, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { apiErrorMessage } from "@/api/client";
import { useUploadBook } from "@/hooks/useKnowledge";

/** Common standard forms, offered as one-tap presets so names stay consistent
 * across the library (searching by book only works if they're spelled alike). */
const PRESETS = [
  "FIDIC Red Book",
  "FIDIC Yellow Book",
  "FIDIC Silver Book",
  "FIDIC Green Book",
  "NEC4",
  "CPWD",
];

const ACCEPT = ".pdf,.doc,.docx,.txt,.md,.rtf";

/** Upload a standard contract book into the Knowledge Center. Claude reads it in
 * the background, so this closes as soon as the file is stored. */
export function UploadBookModal({ onClose }: { onClose: () => void }) {
  const upload = useUploadBook();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [edition, setEdition] = useState("");
  const [publisher, setPublisher] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function pickFile(next: File | null) {
    if (!next) return;
    setFile(next);
    // Offer the filename (minus extension) as the book name if none is set yet.
    if (!name.trim()) setName(next.name.replace(/\.[^.]+$/, ""));
  }

  async function onSubmit() {
    setError("");
    if (!file) return setError("Choose a contract book file to upload.");
    if (!name.trim()) return setError("Book name is required.");

    try {
      await upload.mutateAsync({
        file,
        name: name.trim(),
        edition: edition.trim(),
        publisher: publisher.trim(),
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Upload failed — is the backend running?"));
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card w-full max-w-lg p-6 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-ink inline-flex items-center gap-2">
              <BookUp className="size-4.5 text-navy-700" /> Upload contract book
            </h3>
            <p className="text-xs text-muted mt-1">
              Claude reads the book and extracts every clause into the library.
            </p>
          </div>
          <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin -mx-1 px-1 space-y-4">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={[
              "rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors cursor-pointer",
              dragging
                ? "border-emerald-400 bg-emerald-500/5"
                : "border-border hover:border-navy-300 hover:bg-navy-50/40",
            ].join(" ")}
          >
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="size-4 text-navy-700 shrink-0" />
                <span className="font-medium text-ink truncate">{file.name}</span>
                <span className="text-faint shrink-0">
                  {Math.max(1, Math.round(file.size / 1024))} KB
                </span>
              </div>
            ) : (
              <>
                <UploadCloud className="size-6 mx-auto text-faint mb-2" />
                <p className="text-sm text-muted">
                  Drop the book here, or <span className="text-navy-700 font-medium">browse</span>
                </p>
                <p className="text-xs text-faint mt-1">PDF, Word or text · text-based, not scanned</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1" htmlFor="book-name">
              Book name
            </label>
            <input
              id="book-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="FIDIC Red Book"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setName(p)}
                  className="text-[11px] px-2 py-1 rounded-md bg-navy-50 text-muted hover:bg-navy-100 hover:text-navy-800 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1" htmlFor="book-edition">
                Edition
              </label>
              <input
                id="book-edition"
                className="input"
                value={edition}
                onChange={(e) => setEdition(e.target.value)}
                placeholder="2017"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1" htmlFor="book-publisher">
                Publisher <span className="text-faint font-normal">(optional)</span>
              </label>
              <input
                id="book-publisher"
                className="input"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                placeholder="FIDIC"
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-4 mt-2 border-t border-border">
          <button className="btn btn-outline" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={upload.isPending}>
            {upload.isPending && <Loader2 className="size-4 animate-spin" />}
            {upload.isPending ? "Uploading…" : "Upload & extract"}
          </button>
        </div>
      </div>
    </div>
  );
}
