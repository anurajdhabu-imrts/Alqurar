import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/api/client";
import { uploadProjectDocApi } from "@/api/projectDocuments";
import { projectDocsKey } from "./useProjectDocuments";

/** How many files to upload at once. Browsers cap concurrent connections to a
 *  host at ~6, and each upload holds a server thread while its bytes are written,
 *  so a small window keeps every file moving instead of starving the later ones. */
const MAX_PARALLEL = 3;

export type UploadItemStatus = "queued" | "uploading" | "failed";

export interface UploadItem {
  id: string;
  name: string;
  file: File;
  status: UploadItemStatus;
  error?: string;
  projectId: string;
  uploadedBy: string;
}

/**
 * Uploads a batch of picked files reliably.
 *
 * Selecting several files used to fire every request at once with no record of
 * what happened: a file that failed simply never appeared, with nothing on screen
 * to say so. This runs the batch through a bounded queue and keeps each file's
 * outcome, so a failure is visible and retryable rather than silent.
 *
 * Succeeded uploads drop out of the queue — they show up in the project's own
 * document list instead, which this refreshes as each one lands.
 */
export function useDocumentUploadQueue() {
  const qc = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);

  const waiting = useRef<UploadItem[]>([]);
  const active = useRef(0);
  const seq = useRef(0);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...changes } : it)));
  }, []);

  // Named function expression so the `finally` handler can start the next file.
  const pump = useCallback(
    function pumpNext() {
      while (active.current < MAX_PARALLEL && waiting.current.length > 0) {
        const item = waiting.current.shift()!;
        active.current += 1;
        patch(item.id, { status: "uploading", error: undefined });

        uploadProjectDocApi({ file: item.file, projectId: item.projectId, uploadedBy: item.uploadedBy })
          .then(() => {
            setItems((prev) => prev.filter((it) => it.id !== item.id));
            qc.invalidateQueries({ queryKey: projectDocsKey(item.projectId) });
          })
          .catch((err) => {
            patch(item.id, { status: "failed", error: apiErrorMessage(err, "Upload failed.") });
          })
          .finally(() => {
            active.current -= 1;
            pumpNext();
          });
      }
    },
    [patch, qc],
  );

  const enqueue = useCallback(
    (files: File[], projectId: string, uploadedBy: string) => {
      if (files.length === 0) return;
      const added: UploadItem[] = files.map((file) => ({
        id: `up-${(seq.current += 1)}`,
        name: file.name,
        file,
        status: "queued",
        projectId,
        uploadedBy,
      }));
      setItems((prev) => [...prev, ...added]);
      waiting.current.push(...added);
      pump();
    },
    [pump],
  );

  const retry = useCallback(
    (id: string) => {
      const target = items.find((it) => it.id === id);
      if (!target || target.status !== "failed") return;
      patch(id, { status: "queued", error: undefined });
      waiting.current.push({ ...target, status: "queued", error: undefined });
      pump();
    },
    [items, patch, pump],
  );

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const failed = items.filter((it) => it.status === "failed");
  const inFlight = items.filter((it) => it.status !== "failed");

  return { items, failed, inFlight, enqueue, retry, dismiss };
}
