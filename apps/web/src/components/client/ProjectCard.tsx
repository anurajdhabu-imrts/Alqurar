import { ArrowUpRight, Building2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { riskTone } from "@/lib/status";
import { formatCurrency } from "@/lib/utils";
import type { Project } from "@/types";
import { claimsForProject } from "@/mock/clientData";

/** Compact, clickable project overview card (used on dashboard, projects, upload). */
export function ProjectCard({
  project,
  docCount,
  onClick,
  action = "Open",
}: {
  project: Project;
  docCount?: number;
  onClick?: () => void;
  action?: string;
}) {
  const claims = claimsForProject(project.name);

  return (
    <button
      type="button"
      onClick={onClick}
      className="card card-hover p-5 text-left w-full flex flex-col gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{project.code}</p>
          <h3 className="mt-0.5 text-base font-semibold text-ink leading-snug">{project.name}</h3>
        </div>
        <Badge tone={riskTone[project.riskLevel]}>{project.riskLevel} risk</Badge>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Building2 className="size-3.5 text-faint" />
        <span className="truncate">{project.employer}</span>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-3 pt-3 border-t border-border">
        <div>
          <p className="text-[11px] text-faint">Contract value</p>
          <p className="text-sm font-semibold text-ink">{formatCurrency(project.value, project.currency)}</p>
        </div>
        <div>
          <p className="text-[11px] text-faint">Claims</p>
          <p className="text-sm font-semibold text-ink">{claims.length}</p>
        </div>
        <div>
          <p className="text-[11px] text-faint">Documents</p>
          <p className="text-sm font-semibold text-ink inline-flex items-center gap-1">
            {docCount ?? 0}
            <FileText className="size-3.5 text-faint" />
          </p>
        </div>
      </div>

      <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-700">
        {action} <ArrowUpRight className="size-3.5" />
      </span>
    </button>
  );
}
