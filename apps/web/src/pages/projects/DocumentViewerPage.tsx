import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { AlertCircle, ArrowLeft, Download, FileText, Loader2, MessageSquarePlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DocumentComments } from "@/components/client/DocumentComments";
import { downloadProjectDocApi, fetchProjectDocBlobApi } from "@/api/projectDocuments";
import { apiErrorMessage } from "@/api/client";
import { useDocComments } from "@/hooks/useProjectDocuments";
import type { CommentAnchor, DocumentComment } from "@/types";

type Rendered =
  | { kind: "image"; url: string }
  | { kind: "pdf"; url: string }
  // Word (docx) is anchorable; Excel (xlsx/csv) is rendered as tables but not anchorable.
  | { kind: "html"; html: string; anchorable: boolean }
  | { kind: "text"; text: string }
  | { kind: "unsupported"; ext: string };

function extOf(name = ""): string {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

/** Convert the fetched file into something we can show inline, by extension. */
async function renderBlob(blob: Blob, name: string): Promise<Rendered> {
  const ext = extOf(name);

  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "tif", "tiff", "svg"].includes(ext)) {
    return { kind: "image", url: URL.createObjectURL(blob) };
  }
  if (ext === "pdf") {
    // Force the correct type so the browser previews instead of downloading.
    const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    return { kind: "pdf", url };
  }
  if (ext === "docx") {
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
    return { kind: "html", html: value, anchorable: true };
  }
  if (["xlsx", "xls", "csv"].includes(ext)) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const wb = XLSX.read(bytes, { type: "array" });
    const html = wb.SheetNames.map(
      (sheet) =>
        `<h3 class="doc-sheet-title">${sheet}</h3>` + XLSX.utils.sheet_to_html(wb.Sheets[sheet]),
    ).join("");
    return { kind: "html", html, anchorable: false };
  }
  if (["txt", "xml", "json", "log", "md"].includes(ext)) {
    return { kind: "text", text: await blob.text() };
  }
  return { kind: "unsupported", ext };
}

/** Wrap [start, start+length) of the container's text in a <mark> for a comment.
 * Walks text nodes so a selection spanning multiple elements is highlighted in
 * each. Marks preserve textContent, so offsets stay valid across comments. */
function wrapTextRange(container: HTMLElement, start: number, length: number, commentId: string) {
  const end = start + length;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  let offset = 0;
  for (const node of textNodes) {
    const len = node.nodeValue?.length ?? 0;
    const nodeStart = offset;
    const nodeEnd = offset + len;
    offset = nodeEnd;
    if (nodeEnd <= start || nodeStart >= end) continue;
    // Don't re-wrap text already inside a highlight mark (overlapping comments).
    if ((node.parentElement as HTMLElement | null)?.dataset?.commentId) continue;
    const from = Math.max(0, start - nodeStart);
    const to = Math.min(len, end - nodeStart);
    if (from >= to) continue;
    const range = document.createRange();
    range.setStart(node, from);
    range.setEnd(node, to);
    const mark = document.createElement("mark");
    mark.className = "doc-mark";
    mark.dataset.commentId = commentId;
    try {
      range.surroundContents(mark);
    } catch {
      /* boundary we can't wrap cleanly — skip this fragment */
    }
  }
}

function highlightAnchors(container: HTMLElement, comments: DocumentComment[]) {
  for (const c of comments) {
    if (c.anchorText && c.anchorStart != null && c.anchorLength && c.anchorLength > 0) {
      wrapTextRange(container, c.anchorStart, c.anchorLength, c.id);
    }
  }
}

/** In-app viewer for an uploaded project document (renders the file inline). */
export function DocumentViewerPage() {
  const { docId = "" } = useParams();
  const navigate = useNavigate();
  // Name passed via navigation state so we can pick a renderer by extension.
  const { name } = (useLocation().state as { name?: string } | null) ?? {};

  const { data: comments = [] } = useDocComments(docId);

  const [view, setView] = useState<Rendered | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Selected text awaiting the "Comment" button (viewport coords), and the
  // anchor the user committed to comment on.
  const [sel, setSel] = useState<{ anchor: CommentAnchor; top: number; left: number } | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<CommentAnchor | null>(null);

  const contentRef = useRef<HTMLElement | null>(null);

  // Load + render the document.
  useEffect(() => {
    if (!docId) return;
    let objectUrl: string | undefined;
    let cancelled = false;
    setError(null);
    setView(null);
    setSel(null);
    setPendingAnchor(null);

    (async () => {
      try {
        const blob = await fetchProjectDocBlobApi(docId);
        const rendered = await renderBlob(blob, name ?? "");
        if (cancelled) {
          if ("url" in rendered) URL.revokeObjectURL(rendered.url);
          return;
        }
        if ("url" in rendered) objectUrl = rendered.url;
        setView(rendered);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err instanceof Error && err.message
            ? apiErrorMessage(err, err.message)
            : apiErrorMessage(err, "Could not load the document.");
        // eslint-disable-next-line no-console
        console.error("Document viewer failed:", err);
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId, name]);

  const anchorable = !!view && ((view.kind === "html" && view.anchorable) || view.kind === "text");

  // Fill the anchorable container with content, then (re)apply comment highlights.
  // Runs whenever the document or the comment set changes.
  useEffect(() => {
    const el = contentRef.current;
    if (!el || !view || !anchorable) return;
    if (view.kind === "html") el.innerHTML = view.html;
    else if (view.kind === "text") el.textContent = view.text;
    highlightAnchors(el, comments);
  }, [view, comments, anchorable]);

  // When the user finishes selecting text, show a floating "Comment" button.
  const onContentMouseUp = () => {
    const selection = window.getSelection();
    const el = contentRef.current;
    if (!selection || selection.isCollapsed || !el) {
      setSel(null);
      return;
    }
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) {
      setSel(null);
      return;
    }
    const text = range.toString();
    if (!text.trim()) {
      setSel(null);
      return;
    }
    // Character offset of the selection start within the container's text.
    const pre = document.createRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const rect = range.getBoundingClientRect();
    setSel({ anchor: { text, start, length: text.length }, top: rect.top, left: rect.left + rect.width / 2 });
  };

  // Click a highlight → scroll its comment into view and flash it.
  const onContentClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest("[data-comment-id]") as HTMLElement | null;
    const id = mark?.dataset.commentId;
    if (!id) return;
    const card = document.getElementById(`comment-${id}`);
    card?.scrollIntoView({ behavior: "smooth", block: "center" });
    card?.classList.add("ring-2", "ring-amber-400");
    setTimeout(() => card?.classList.remove("ring-2", "ring-amber-400"), 1500);
  };

  // Click a comment → scroll to its highlighted text in the document and flash it.
  const jumpToAnchor = (commentId: string) => {
    const el = contentRef.current;
    const mark = el?.querySelector(`[data-comment-id="${CSS.escape(commentId)}"]`) as HTMLElement | null;
    if (!mark) return;
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    mark.classList.add("doc-mark-flash");
    setTimeout(() => mark.classList.remove("doc-mark-flash"), 1500);
  };

  const setContentEl = (el: HTMLElement | null) => {
    contentRef.current = el;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost px-2" aria-label="Back">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold text-ink truncate flex-1">{name ?? "Document"}</h1>
        {name && (
          <button
            type="button"
            onClick={() => downloadProjectDocApi(docId, name)}
            className="btn btn-ghost px-2"
            aria-label={`Download ${name}`}
            title="Download"
          >
            <Download className="size-4" />
          </button>
        )}
      </div>

      {anchorable && (
        <p className="text-xs text-muted">Tip: select any text in the document to comment on it.</p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Document preview */}
        <Card className="overflow-hidden lg:flex-1 lg:min-w-0">
          {error ? (
            <div className="flex items-center gap-2 px-5 py-10 text-sm text-error">
              <AlertCircle className="size-4" /> {error}
            </div>
          ) : !view ? (
            <div className="flex items-center justify-center gap-2 px-5 py-20 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Loading document…
            </div>
          ) : view.kind === "image" ? (
            <div className="grid place-items-center bg-navy-50/40 p-4">
              <img src={view.url} alt={name ?? "Document"} className="max-h-[80vh] max-w-full object-contain" />
            </div>
          ) : view.kind === "pdf" ? (
            <iframe src={view.url} title={name ?? "Document"} className="w-full h-[80vh] border-0" />
          ) : view.kind === "html" && view.anchorable ? (
            <div
              ref={setContentEl}
              onMouseUp={onContentMouseUp}
              onClick={onContentClick}
              className="doc-html max-h-[80vh] overflow-auto p-6 text-sm"
            />
          ) : view.kind === "html" ? (
            <div className="doc-html max-h-[80vh] overflow-auto p-6 text-sm" dangerouslySetInnerHTML={{ __html: view.html }} />
          ) : view.kind === "text" ? (
            <pre
              ref={setContentEl}
              onMouseUp={onContentMouseUp}
              onClick={onContentClick}
              className="max-h-[80vh] overflow-auto p-6 text-xs leading-relaxed whitespace-pre-wrap"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-5 py-16 text-center">
              <span className="size-12 grid place-items-center rounded-xl bg-navy-50 text-navy-600">
                <FileText className="size-6" />
              </span>
              <p className="text-sm text-muted">
                In-page preview isn’t available for <span className="font-medium text-ink">.{view.ext}</span> files.
              </p>
              {name && (
                <button type="button" onClick={() => downloadProjectDocApi(docId, name)} className="btn btn-primary">
                  <Download className="size-4" /> Download to view
                </button>
              )}
            </div>
          )}
        </Card>

        {/* Comments — saved per document */}
        <Card className="overflow-hidden lg:w-90 lg:shrink-0 lg:h-[80vh]">
          <DocumentComments
            documentId={docId}
            pendingAnchor={pendingAnchor}
            onClearPendingAnchor={() => setPendingAnchor(null)}
            onJumpToAnchor={jumpToAnchor}
          />
        </Card>
      </div>

      {/* Floating "Comment" button over a text selection */}
      {sel && (
        <button
          type="button"
          // Use mousedown + preventDefault so clicking doesn't clear the selection first.
          onMouseDown={(e) => {
            e.preventDefault();
            setPendingAnchor(sel.anchor);
            setSel(null);
            window.getSelection()?.removeAllRanges();
          }}
          style={{ position: "fixed", top: sel.top - 42, left: sel.left, transform: "translateX(-50%)", zIndex: 50 }}
          className="btn btn-primary shadow-lg"
        >
          <MessageSquarePlus className="size-4" /> Comment
        </button>
      )}
    </div>
  );
}
