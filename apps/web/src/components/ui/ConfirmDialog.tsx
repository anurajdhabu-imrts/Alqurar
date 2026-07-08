import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** "danger" (default) styles the dialog red for destructive actions; "primary"
   *  styles it for a positive confirmation (e.g. confirming a proposal). */
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const isDanger = variant === "danger";
  const Icon = isDanger ? AlertTriangle : CheckCircle2;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card w-full max-w-sm p-6 shadow-lg">
        <div
          className={`size-11 rounded-full grid place-items-center mb-4 ${
            isDanger ? "bg-error-bg text-error" : "bg-success-bg text-success"
          }`}
        >
          <Icon className="size-5" />
        </div>
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <p className="mt-1.5 text-sm text-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button
            className={`btn text-white hover:brightness-110 ${isDanger ? "bg-error" : "bg-success"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
