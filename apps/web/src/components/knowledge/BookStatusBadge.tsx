import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import type { BookStatus } from "@/api/knowledge";

const CONFIG: Record<BookStatus, { tone: Tone; label: string }> = {
  pending: { tone: "info", label: "Queued" },
  processing: { tone: "warning", label: "Extracting" },
  done: { tone: "success", label: "Ready" },
  failed: { tone: "error", label: "Failed" },
};

/** Extraction status of a contract book, with a spinner while Claude is reading. */
export function BookStatusBadge({ status }: { status: BookStatus }) {
  const { tone, label } = CONFIG[status];
  return (
    <Badge tone={tone}>
      {status === "processing" && <Loader2 className="size-3 animate-spin" />}
      {status === "pending" && <Clock className="size-3" />}
      {status === "done" && <CheckCircle2 className="size-3" />}
      {status === "failed" && <AlertCircle className="size-3" />}
      {label}
    </Badge>
  );
}
