import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Loader2,
  ScanLine,
  Sparkles,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { analyzeDocument, type ClaimContext, type DocumentAnalysisResult } from "@/api/documents";
import { apiErrorMessage } from "@/api/client";
import { cn } from "@/lib/utils";
import type { ClaimDocument, DocType } from "@/types";

/** A document row with its live AI-analysis state. */
type PanelDoc = ClaimDocument & {
  analysis?: DocumentAnalysisResult;
  analysisError?: string;
};

const typeIcon: Record<DocType, LucideIcon> = {
  PDF: FileText,
  DOCX: FileText,
  XLSX: FileSpreadsheet,
  "P6 XML": FileCode2,
  MPP: FileCode2,
  Scan: ScanLine,
  Other: FileText,
};

const typeTint: Record<DocType, string> = {
  PDF: "bg-error-bg text-error",
  DOCX: "bg-info-bg text-info",
  XLSX: "bg-success-bg text-success",
  "P6 XML": "bg-navy-100 text-navy-700",
  MPP: "bg-navy-100 text-navy-700",
  Scan: "bg-warning-bg text-warning",
  Other: "bg-navy-50 text-muted",
};

function typeFromName(name: string): DocType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (ext === "doc" || ext === "docx") return "DOCX";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "XLSX";
  if (ext === "xml") return "P6 XML";
  if (ext === "mpp") return "MPP";
  if (["png", "jpg", "jpeg", "tif", "tiff"].includes(ext)) return "Scan";
  return "Other";
}

function fmtSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

const statusTone: Record<ClaimDocument["status"], Tone> = {
  Parsed: "success",
  Parsing: "warning",
  Queued: "neutral",
};

export function DocumentsPanel({
  seed,
  kind = "claim",
  claimContext,
  onAnalyzed,
  onUploaded,
}: {
  seed: ClaimDocument[];
  kind?: "claim" | "contract";
  /** Claim metadata sent to the AI to ground document relevance. */
  claimContext?: ClaimContext;
  /** Called when a document finishes AI analysis (to persist on the claim). */
  onAnalyzed?: (filename: string, analysis: DocumentAnalysisResult) => void;
  /** Called as soon as a file is added (before analysis) — to persist the upload. */
  onUploaded?: (file: File) => void;
}) {
  const [docs, setDocs] = useState<PanelDoc[]>(seed);

  const onDrop = useCallback(
    (accepted: File[]) => {
      accepted.forEach((f) => onUploaded?.(f));
      const added = accepted.map((f, i) => {
        const type = typeFromName(f.name);
        const doc: PanelDoc = {
          id: `up-${Date.now()}-${i}`,
          name: f.name,
          type,
          sizeKB: Math.max(1, Math.round(f.size / 1024)),
          status: "Parsing", // shown as "Analysing…" while the model runs
          ocr: type === "Scan",
          uploadedAt: new Date().toISOString().slice(0, 10),
        };
        return { doc, file: f };
      });

      setDocs((prev) => [...added.map((a) => a.doc), ...prev]);

      // Run real Claude analysis on each uploaded file.
      added.forEach(async ({ doc, file }) => {
        try {
          const analysis = await analyzeDocument(file, claimContext);
          setDocs((prev) =>
            prev.map((d) => (d.id === doc.id ? { ...d, status: "Parsed", analysis } : d)),
          );
          onAnalyzed?.(file.name, analysis);
        } catch (err) {
          setDocs((prev) =>
            prev.map((d) =>
              d.id === doc.id
                ? { ...d, status: "Parsed", analysisError: apiErrorMessage(err, "AI analysis failed.") }
                : d,
            ),
          );
        }
      });
    },
    [claimContext, onAnalyzed, onUploaded],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const parsed = docs.filter((d) => d.status === "Parsed").length;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-navy-400 bg-navy-50" : "border-border-strong hover:border-navy-300 hover:bg-navy-50/50",
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="size-8 text-navy-400 mx-auto" strokeWidth={1.8} />
        <p className="mt-2.5 text-sm font-semibold text-ink">
          Drag &amp; drop documents, or <span className="text-navy-700">browse</span>
        </p>
        <p className="text-xs text-faint mt-1">
          {kind === "claim"
            ? "PDF, DOCX, Excel, P6 XML, MS Project (MPP) and scanned site diaries (OCR)"
            : "Contracts, sub-contracts, purchase orders and amendments — PDF, DOCX, Excel"}
        </p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold text-ink">{docs.length} documents</p>
        <p className="text-muted">{parsed} parsed &amp; indexed</p>
      </div>

      <div className="space-y-2">
        {docs.map((d) => {
          const Icon = typeIcon[d.type];
          const analysing = d.status === "Parsing";
          return (
            <div key={d.id} className="card p-3">
              <div className="flex items-center gap-3">
                <span className={cn("size-10 shrink-0 rounded-lg grid place-items-center", typeTint[d.type])}>
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{d.name}</p>
                  <p className="text-xs text-faint">
                    {d.type} · {fmtSize(d.sizeKB)}
                    {d.pages ? ` · ${d.pages} pages` : ""}
                  </p>
                </div>
                {d.ocr && <Badge tone="warning">OCR</Badge>}
                <Badge tone={analysing ? "warning" : statusTone[d.status]}>
                  {analysing ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  {analysing ? "Analysing…" : "Analysed"}
                </Badge>
              </div>

              {/* ── AI analysis: what this document is about ── */}
              {d.analysis && (
                <div className="mt-3 rounded-lg border border-border bg-navy-50/40 p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700">
                      <Sparkles className="size-3.5 text-amber-500" /> {d.analysis.document_type}
                    </span>
                    <Badge tone={d.analysis.supports_eot ? "success" : "neutral"}>
                      {d.analysis.supports_eot ? "Supports EOT" : "Context only"}
                    </Badge>
                    <span className="text-[11px] text-faint">{d.analysis.confidence}% confidence</span>
                  </div>
                  <p className="text-xs text-ink leading-relaxed">{d.analysis.summary}</p>
                  {d.analysis.relevance_to_claim && (
                    <p className="text-xs text-muted mt-1.5">
                      <span className="font-medium text-ink">Relevance:</span> {d.analysis.relevance_to_claim}
                    </p>
                  )}
                  {d.analysis.key_dates.length > 0 && (
                    <p className="text-[11px] text-faint mt-1.5">Key dates: {d.analysis.key_dates.join(" · ")}</p>
                  )}
                </div>
              )}

              {analysing && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                  <Brain className="size-3.5" /> Claude is reading the document…
                </p>
              )}
              {d.analysisError && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-error">
                  <AlertCircle className="size-3.5" /> {d.analysisError}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
