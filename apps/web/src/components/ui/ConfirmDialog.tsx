import { AlertTriangle } from "lucide-react";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative card w-full max-w-sm p-6 shadow-lg">
        <div className="size-11 rounded-full bg-error-bg text-error grid place-items-center mb-4">
          <AlertTriangle className="size-5" />
        </div>
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <p className="mt-1.5 text-sm text-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn bg-error text-white hover:brightness-110" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
