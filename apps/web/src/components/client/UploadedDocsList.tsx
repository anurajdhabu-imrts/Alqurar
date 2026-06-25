import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import { useHasPermission } from "@/hooks/usePermission";
import { useDeleteProjectDoc } from "@/hooks/useProjectDocuments";
import { downloadProjectDocApi } from "@/api/projectDocuments";
import type { UploadedClaimDocument } from "@/types";

function sizeLabel(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

/** Existing uploaded claim documents for a project (read-only list). */
export function UploadedDocsList({ docs }: { docs: UploadedClaimDocument[] }) {
  // Delete is only available if the admin granted the client this permission.
  const canDelete = useHasPermission("client.documents.delete");
  const del = useDeleteProjectDoc();

  if (docs.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-muted">
        No claim documents uploaded for this project yet.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-5 py-3">
          <span className="size-9 shrink-0 grid place-items-center rounded-lg bg-navy-50 text-navy-700">
            <FileText className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink truncate">{d.name}</p>
            <p className="text-xs text-muted">
              {d.type} · {sizeLabel(d.sizeKB)} · {formatDate(d.uploadedAt)} · {d.uploadedBy}
              {d.claimRef ? ` · ${d.claimRef}` : ""}
            </p>
          </div>
          <Badge tone={d.status === "Under Review" ? "warning" : "neutral"}>{d.status}</Badge>
          {d.driveFileId && (
            <button
              type="button"
              onClick={() => downloadProjectDocApi(d.id, d.name)}
              className="btn btn-ghost px-2"
              aria-label={`Download ${d.name}`}
              title="Download"
            >
              <Download className="size-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => del.mutate({ id: d.id, projectId: d.projectId })}
              disabled={del.isPending}
              className="btn btn-ghost px-2 text-error"
              aria-label={`Delete ${d.name}`}
            >
              {del.isPending && del.variables?.id === d.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
