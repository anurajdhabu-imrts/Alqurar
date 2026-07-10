import { api } from "./client";

/** Extraction lifecycle of an uploaded contract book. */
export type BookStatus = "pending" | "processing" | "done" | "failed";

/** A standard contract book in the Knowledge Center (FIDIC Red Book, NEC4, …). */
export interface ContractBook {
  id: string;
  name: string;
  edition: string;
  publisher?: string | null;
  fileName: string;
  sizeKB: number;
  mime?: string | null;
  uploadedAt: string;
  uploadedBy: string;
  status: BookStatus;
  error?: string | null;
  clauseCount: number;
  /** Books are read in chunks; these drive the progress bar while processing. */
  processedChunks: number;
  totalChunks: number;
}

/** One clause extracted from a book — verbatim wording plus an AI summary. */
export interface BookClause {
  id: string;
  bookId: string;
  clause_number: string;
  clause_title: string;
  clause_text: string;
  summary: string;
  tags: string[];
  sortIndex: number;
  createdAt?: string | null;
}

/** A clause hit from the cross-book search, attributed to its book. */
export interface BookClauseHit extends BookClause {
  bookName: string;
  bookEdition: string;
}

export interface UploadBookPayload {
  file: File;
  name: string;
  edition?: string;
  publisher?: string;
}

export interface ClauseSearchParams {
  q?: string;
  bookId?: string;
  clauseNumber?: string;
  title?: string;
}

export async function listBooksApi(): Promise<ContractBook[]> {
  const { data } = await api.get<ContractBook[]>("/knowledge/books");
  return data;
}

export async function getBookApi(bookId: string): Promise<ContractBook> {
  const { data } = await api.get<ContractBook>(`/knowledge/books/${bookId}`);
  return data;
}

/** Upload a book. Returns as soon as it's stored — AI extraction runs in the
 * background, so poll {@link listBooksApi} for `status` and `clauseCount`. */
export async function uploadBookApi(payload: UploadBookPayload): Promise<ContractBook> {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("name", payload.name);
  form.append("edition", payload.edition ?? "");
  form.append("publisher", payload.publisher ?? "");
  const { data } = await api.post<ContractBook>("/knowledge/books", form, {
    headers: { "Content-Type": "multipart/form-data" },
    // A contract book is a large file — the default 15s timeout is not enough.
    timeout: 120_000,
  });
  return data;
}

export async function deleteBookApi(bookId: string): Promise<void> {
  await api.delete(`/knowledge/books/${bookId}`);
}

/** Re-run AI extraction on a book already on file (reuses the stored bytes). */
export async function reextractBookApi(bookId: string): Promise<ContractBook> {
  const { data } = await api.post<ContractBook>(`/knowledge/books/${bookId}/reextract`);
  return data;
}

export async function listBookClausesApi(bookId: string): Promise<BookClause[]> {
  const { data } = await api.get<BookClause[]>(`/knowledge/books/${bookId}/clauses`);
  return data;
}

/** Search clauses across every book. Filters are ANDed server-side. */
export async function searchClausesApi(params: ClauseSearchParams): Promise<BookClauseHit[]> {
  const { data } = await api.get<BookClauseHit[]>("/knowledge/clauses", {
    params: {
      q: params.q || undefined,
      bookId: params.bookId || undefined,
      clauseNumber: params.clauseNumber || undefined,
      title: params.title || undefined,
    },
  });
  return data;
}

export function bookDownloadUrl(bookId: string): string {
  return `${api.defaults.baseURL}/knowledge/books/${bookId}/download`;
}
