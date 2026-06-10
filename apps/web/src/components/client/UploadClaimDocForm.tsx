import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useHasPermission } from "@/hooks/usePermission";
import { claimDocStore, docTypeFromName } from "@/mock/clientData";
import type { Project } from "@/types";

/**
 * Upload a claim-related document against a project. Stored in-memory (mock).
 * Only rendered/enabled when the client holds `client.documents.upload`.
 */
export function UploadClaimDocForm({ project }: { project: Project }) {
  const user = useAuthStore((s) => s.user);
  const canUpload = useHasPermission("client.documents.upload");

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [claimRef, setClaimRef] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!canUpload) {
    return (
      <div className="px-5 py-6 text-sm text-muted">
        You do not have permission to upload documents. Contact your administrator.
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }
    setBusy(true);
    // Mock persistence: record metadata in the in-memory store.
    claimDocStore.add({
      id: `doc-${Date.now()}`,
      projectId: project.id,
      name: file.name,
      type: docTypeFromName(file.name),
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      uploadedAt: new Date().toISOString(),
      uploadedBy: user?.name ?? "Client",
      claimRef: claimRef.trim() || undefined,
      note: note.trim() || undefined,
      status: "Uploaded",
    });
    setBusy(false);
    setDone(true);
    setFile(null);
    setClaimRef("");
    setNote("");
    if (fileRef.current) fileRef.current.value = "";
    window.setTimeout(() => setDone(false), 3000);
  }

  return (
    <form onSubmit={onSubmit} className="px-5 py-4 space-y-4">
      <div>
        <label className="label" htmlFor="claim-doc-file">Document</label>
        <input
          id="claim-doc-file"
          ref={fileRef}
          type="file"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-navy-800 hover:file:bg-navy-100"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-faint">PDF, DOCX, XLSX, P6, images. Max 15 MB.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="claim-ref">Related claim ref (optional)</label>
          <input
            id="claim-ref"
            className="input"
            placeholder="e.g. EOT-2026-014"
            value={claimRef}
            onChange={(e) => setClaimRef(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="claim-note">Note (optional)</label>
          <input
            id="claim-note"
            className="input"
            placeholder="Short description"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2">{error}</p>}
      {done && (
        <p className="text-sm text-success bg-success-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
          <CheckCircle2 className="size-4" /> Document uploaded.
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
        {busy ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
