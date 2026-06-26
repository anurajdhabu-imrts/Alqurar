import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Mail,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import {
  downloadPortalDocApi,
  getPortalApi,
  listPortalDocsApi,
  requestOtpApi,
  uploadPortalDocApi,
  verifyOtpApi,
  type PortalData,
  type PortalProject,
} from "@/api/portal";
import { formatDate } from "@/lib/utils";

function sizeLabel(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

/**
 * Client Portal — a PUBLIC page reached via a secret link (/portal/:token).
 * Opening the link is NOT enough: the client must verify a one-time code emailed
 * to their registered address, which mints a verified session. Only then is the
 * upload area shown. The session means they aren't asked for OTP again until it
 * expires / they switch browser / the admin regenerates the link.
 */
export function ClientPortalPage() {
  const { token = "" } = useParams();
  const qc = useQueryClient();

  const portal = useQuery({
    queryKey: ["portal", token],
    queryFn: () => getPortalApi(token),
    enabled: !!token,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-navy-50/40">
      <header className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center gap-2.5">
          <div className="size-9 shrink-0 rounded-xl bg-linear-to-br from-navy-800 to-navy-950 text-amber-400 grid place-items-center font-extrabold font-display">
            AQ
          </div>
          <div className="leading-tight">
            <p className="font-bold font-display text-[15px] text-navy-900">Al Qarar</p>
            <p className="text-[11px] text-faint">Secure document upload</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {portal.isLoading ? (
          <div className="py-20 text-center text-muted inline-flex items-center justify-center gap-2 w-full">
            <Loader2 className="size-5 animate-spin" /> Opening your secure portal…
          </div>
        ) : portal.isError ? (
          <div className="card p-10 text-center">
            <span className="size-12 mx-auto rounded-xl bg-error-bg text-error grid place-items-center">
              <AlertTriangle className="size-6" />
            </span>
            <h2 className="mt-3 text-lg font-bold text-ink">Link not valid</h2>
            <p className="mt-1 text-sm text-muted max-w-md mx-auto">
              {portal.error instanceof Error ? portal.error.message : "This upload link is invalid or has expired."}{" "}
              Please contact Al Qarar for a new link.
            </p>
          </div>
        ) : portal.data?.verified ? (
          <VerifiedPortal token={token} data={portal.data} />
        ) : (
          <OtpGate
            token={token}
            maskedEmail={portal.data?.email ?? ""}
            onVerified={() => qc.invalidateQueries({ queryKey: ["portal", token] })}
          />
        )}
      </main>
    </div>
  );
}

// ── OTP verification gate ───────────────────────────────────────────────────
function OtpGate({
  token,
  maskedEmail,
  onVerified,
}: {
  token: string;
  maskedEmail: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [info, setInfo] = useState<string>("");
  const [error, setError] = useState<string>("");
  const sentOnce = useRef(false);

  const send = useMutation({
    mutationFn: () => requestOtpApi(token),
    onSuccess: (r) => {
      setError("");
      setInfo(`We sent a 6-digit code to ${r.email}. It expires in ${r.expiresInMinutes} minutes.`);
    },
    onError: (e) => setError(e instanceof Error ? e.message : "OTP could not be sent. Please contact admin."),
  });

  const verify = useMutation({
    mutationFn: () => verifyOtpApi(token, code.trim()),
    onSuccess: () => onVerified(),
    onError: (e) => setError(e instanceof Error ? e.message : "Verification failed."),
  });

  // Auto-send the code once when the gate first appears.
  useEffect(() => {
    if (!sentOnce.current) {
      sentOnce.current = true;
      send.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto">
      <div className="card p-7">
        <div className="text-center">
          <span className="size-12 mx-auto rounded-xl bg-navy-50 text-navy-700 grid place-items-center">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-3 text-xl font-bold text-ink">Verify it's you</h1>
          <p className="mt-1 text-sm text-muted">
            For your security, enter the code we email to{" "}
            <span className="font-medium text-ink">{maskedEmail || "your registered email"}</span>.
          </p>
        </div>

        {info && (
          <p className="mt-4 text-sm text-success bg-success-bg rounded-md px-3 py-2 inline-flex items-center gap-2 w-full">
            <Mail className="size-4 shrink-0" /> {info}
          </p>
        )}

        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            if (code.trim().length === 6) verify.mutate();
          }}
        >
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="input text-center text-2xl tracking-[0.4em] font-mono"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoFocus
          />
          {error && (
            <p className="text-sm text-error bg-error-bg rounded-md px-3 py-2 inline-flex items-center gap-2 w-full">
              <AlertTriangle className="size-4 shrink-0" /> {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary w-full" disabled={verify.isPending || code.trim().length !== 6}>
            {verify.isPending ? <><Loader2 className="size-4 animate-spin" /> Verifying…</> : "Verify & continue"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-muted">
          Didn't get it?{" "}
          <button
            type="button"
            className="font-medium text-navy-700 hover:underline disabled:opacity-50"
            onClick={() => send.mutate()}
            disabled={send.isPending}
          >
            {send.isPending ? "Sending…" : "Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Verified upload portal ──────────────────────────────────────────────────
function VerifiedPortal({ token, data }: { token: string; data: PortalData }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const projects = data.projects ?? [];

  const [projectId, setProjectId] = useState<string>("");
  const selectedId = projectId || projects[0]?.id || "";
  const selected: PortalProject | undefined = projects.find((p) => p.id === selectedId);

  // The client's own uploads on this project (their "folder").
  const docs = useQuery({
    queryKey: ["portal-docs", token, selectedId],
    queryFn: () => listPortalDocsApi(token, selectedId),
    enabled: !!selectedId,
  });

  const [error, setError] = useState("");
  const upload = useMutation({
    mutationFn: (file: File) => uploadPortalDocApi(token, { file, projectId: selectedId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-docs", token, selectedId] }),
    onError: (e) => setError(e instanceof Error ? e.message : "Upload failed."),
  });

  async function onFiles(files: FileList | null) {
    if (!files || !selectedId) return;
    setError("");
    for (const file of Array.from(files)) {
      await upload.mutateAsync(file).catch(() => {});
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-ink tracking-tight">
          Welcome{data.client?.name ? `, ${data.client.name}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted inline-flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-success" /> Email verified — your session is active.
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          No project has been linked to you yet. Al Qarar will assign one shortly — check back after they confirm.
        </div>
      ) : (
        <>
          {projects.length > 1 && (
            <div className="card p-5">
              <label className="label" htmlFor="portal-project">Upload to project</label>
              <select
                id="portal-project"
                className="input max-w-md"
                value={selectedId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} · {p.code}</option>
                ))}
              </select>
            </div>
          )}

          <div className="card p-5">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-ink">
                Upload documents{selected ? ` — ${selected.name}` : ""}
              </h2>
              <p className="text-sm text-muted">
                Add your contract, programme, correspondence and site records. Your files go straight to the
                Al Qarar claims team.
              </p>
            </div>

            <label
              htmlFor="portal-file"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFiles(e.dataTransfer.files);
              }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-navy-300 bg-navy-50/40 px-6 py-10 text-center cursor-pointer transition-colors"
            >
              <UploadCloud className="size-8 text-navy-500" />
              <p className="text-sm font-medium text-ink">Drag & drop files here, or click to browse</p>
              <p className="text-xs text-faint">PDF, Word, Excel, programmes and scans</p>
              <input
                id="portal-file"
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>

            {upload.isPending && (
              <p className="mt-3 text-sm text-muted inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Uploading…
              </p>
            )}
            {error && (
              <p className="mt-3 text-sm text-error bg-error-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
                <AlertTriangle className="size-4" /> {error}
              </p>
            )}
            {upload.isSuccess && !upload.isPending && !error && (
              <p className="mt-3 text-sm text-success bg-success-bg rounded-md px-3 py-2 inline-flex items-center gap-2">
                <CheckCircle2 className="size-4" /> Uploaded — thank you.
              </p>
            )}
          </div>

          {/* The client's own uploaded files for this project (their folder). */}
          <div className="card">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-ink">Your uploaded documents</h2>
              <p className="text-xs text-muted mt-0.5">{docs.data?.length ?? 0} file(s) you've uploaded</p>
            </div>
            {docs.isLoading ? (
              <div className="px-5 py-8 text-center text-sm text-muted inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : (docs.data?.length ?? 0) === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">You haven't uploaded any documents yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {docs.data!.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="size-9 shrink-0 grid place-items-center rounded-lg bg-navy-50 text-navy-700">
                      <FileText className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{d.name}</p>
                      <p className="text-xs text-muted">
                        {d.type} · {sizeLabel(d.sizeKB)} · {formatDate(d.uploadedAt)}
                      </p>
                    </div>
                    {d.driveFileId && (
                      <button
                        type="button"
                        onClick={() => downloadPortalDocApi(token, d.id, d.name).catch(() => {})}
                        className="btn btn-ghost px-2"
                        title="Download"
                        aria-label={`Download ${d.name}`}
                      >
                        <Download className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
