import { useState } from "react";
import { Check, Loader2, MessageSquareText, Pencil, Quote, Send, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { apiErrorMessage } from "@/api/client";
import {
  useAddDocComment,
  useDeleteDocComment,
  useDocComments,
  useUpdateDocComment,
} from "@/hooks/useProjectDocuments";
import type { CommentAnchor } from "@/types";

/** Side panel: read + add comments/notes for a single document. Comments may be
 * anchored to selected text (passed in as `pendingAnchor` from the viewer). */
export function DocumentComments({
  documentId,
  pendingAnchor,
  onClearPendingAnchor,
  onJumpToAnchor,
}: {
  documentId: string;
  pendingAnchor?: CommentAnchor | null;
  onClearPendingAnchor?: () => void;
  /** Jump to (and flash) the highlighted text in the document for this comment. */
  onJumpToAnchor?: (commentId: string) => void;
}) {
  const { data: comments = [], isLoading } = useDocComments(documentId);
  const add = useAddDocComment(documentId);
  const update = useUpdateDocComment(documentId);
  const del = useDeleteDocComment(documentId);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Inline editing: which comment is being edited and its working text.
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (id: string, body: string) => {
    setEditId(id);
    setEditText(body);
    setError(null);
  };
  const cancelEdit = () => {
    setEditId(null);
    setEditText("");
  };
  const saveEdit = (id: string) => {
    const body = editText.trim();
    if (!body) return;
    setError(null);
    update.mutate(
      { id, body },
      {
        onSuccess: cancelEdit,
        onError: (e) => setError(apiErrorMessage(e, "Could not update the comment.")),
      },
    );
  };

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    add.mutate(
      { body, anchor: pendingAnchor ?? null },
      {
        onSuccess: () => {
          setDraft("");
          onClearPendingAnchor?.();
        },
        onError: (e) => setError(apiErrorMessage(e, "Could not save the comment.")),
      },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageSquareText className="size-4 text-navy-700" />
        <h2 className="text-sm font-semibold text-ink">Comments</h2>
        <span className="ml-auto text-xs text-muted">{comments.length}</span>
      </div>

      {/* Existing comments */}
      <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No comments yet. Select text in the document, or add a general note below.
          </p>
        ) : (
          comments.map((c) =>
            editId === c.id ? (
              <div key={c.id} className="rounded-lg border border-navy-300 bg-white p-3">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") saveEdit(c.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  rows={3}
                  autoFocus
                  className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy-400"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button type="button" onClick={cancelEdit} className="btn btn-ghost px-2 text-xs" title="Cancel">
                    <X className="size-3.5" /> Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(c.id)}
                    disabled={update.isPending || !editText.trim()}
                    className="btn btn-primary px-2 text-xs"
                    title="Save"
                  >
                    {update.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={c.id}
                id={`comment-${c.id}`}
                onClick={c.anchorText ? () => onJumpToAnchor?.(c.id) : undefined}
                className={`group rounded-lg border border-border bg-navy-50/40 p-3 scroll-mt-3 ${
                  c.anchorText ? "cursor-pointer hover:border-amber-300" : ""
                }`}
                title={c.anchorText ? "Jump to highlighted text" : undefined}
              >
                {c.anchorText && (
                  <p className="mb-2 flex gap-1.5 rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-[11px] italic text-amber-800">
                    <Quote className="size-3 shrink-0 translate-y-0.5" />
                    <span className="line-clamp-2">{c.anchorText}</span>
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm text-ink">{c.body}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-faint">
                  <span className="font-medium text-muted">{c.author || "Unknown"}</span>
                  <span>· {formatDate(c.createdAt)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(c.id, c.body);
                    }}
                    className="ml-auto text-muted opacity-0 transition-opacity hover:text-navy-700 group-hover:opacity-100"
                    aria-label="Edit comment"
                    title="Edit"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      del.mutate(c.id);
                    }}
                    disabled={del.isPending}
                    className="text-error opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Delete comment"
                    title="Delete"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ),
          )
        )}
      </div>

      {/* New comment */}
      <div className="border-t border-border p-3">
        {pendingAnchor && (
          <div className="mb-2 flex items-start gap-1.5 rounded border-l-2 border-amber-400 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
            <Quote className="size-3 shrink-0 translate-y-0.5" />
            <span className="line-clamp-2 flex-1 italic">{pendingAnchor.text}</span>
            <button type="button" onClick={onClearPendingAnchor} aria-label="Clear selection" title="Clear">
              <X className="size-3.5" />
            </button>
          </div>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          placeholder={pendingAnchor ? "Comment on the selected text…" : "Add a comment about this document…"}
          rows={3}
          className="w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy-400"
        />
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-faint">⌘/Ctrl + Enter to send</span>
          <button
            type="button"
            onClick={submit}
            disabled={add.isPending || !draft.trim()}
            className="btn btn-primary"
          >
            {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Add comment
          </button>
        </div>
      </div>
    </div>
  );
}
