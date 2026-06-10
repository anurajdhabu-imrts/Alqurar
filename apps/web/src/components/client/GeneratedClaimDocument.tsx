import { FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { DocumentAnalysisResult } from "@/api/documents";

/**
 * A claim-document draft assembled from the AI analysis of an uploaded file.
 * Pure presentation — the analysis itself is produced by the shared
 * `analyzeDocument` API (reused from the Claim Registration module).
 */
export function GeneratedClaimDocument({ analysis }: { analysis: DocumentAnalysisResult }) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 space-y-4">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700">
            <Sparkles className="size-3.5 text-amber-500" /> {analysis.document_type}
          </span>
          <Badge tone={analysis.supports_eot ? "success" : "neutral"}>
            {analysis.supports_eot ? "Supports EOT" : "Context only"}
          </Badge>
          <span className="text-[11px] text-faint">{analysis.confidence}% confidence</span>
        </div>
        <h3 className="text-lg font-bold text-ink leading-tight">{analysis.title || analysis.filename}</h3>
        <p className="text-xs text-faint inline-flex items-center gap-1.5">
          <FileText className="size-3.5" /> Generated from {analysis.filename}
        </p>
      </header>

      <Section title="Summary">
        <p className="text-sm text-ink leading-relaxed">{analysis.summary}</p>
      </Section>

      {analysis.relevance_to_claim && (
        <Section title="Relevance to claim">
          <p className="text-sm text-ink leading-relaxed">{analysis.relevance_to_claim}</p>
        </Section>
      )}

      {analysis.key_points.length > 0 && (
        <Section title="Key points">
          <ul className="list-disc pl-5 space-y-1 text-sm text-ink">
            {analysis.key_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </Section>
      )}

      {analysis.parties.length > 0 && (
        <Section title="Parties">
          <p className="text-sm text-ink">{analysis.parties.join(" · ")}</p>
        </Section>
      )}

      {analysis.key_dates.length > 0 && (
        <Section title="Key dates">
          <p className="text-sm text-ink">{analysis.key_dates.join(" · ")}</p>
        </Section>
      )}

      <p className="text-[11px] text-faint border-t border-border pt-3">
        AI-generated draft · {analysis.model}. Review before submission.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">{title}</h4>
      {children}
    </section>
  );
}
