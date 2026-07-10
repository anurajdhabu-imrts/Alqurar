import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteBookApi,
  getBookApi,
  listBookClausesApi,
  listBooksApi,
  reextractBookApi,
  searchClausesApi,
  uploadBookApi,
  type ClauseSearchParams,
  type ContractBook,
  type UploadBookPayload,
} from "@/api/knowledge";

export const booksKey = ["knowledge", "books"] as const;
export const bookKey = (id: string) => ["knowledge", "book", id] as const;
export const bookClausesKey = (id: string) => ["knowledge", "book-clauses", id] as const;
export const clauseSearchKey = (p: ClauseSearchParams) => ["knowledge", "search", p] as const;

/** True while any book is still being read by the AI — drives list polling. */
function anyProcessing(books: ContractBook[] | undefined): boolean {
  return (books ?? []).some((b) => b.status === "pending" || b.status === "processing");
}

/** All contract books. Polls every 3s while at least one is still extracting,
 * so cards show live progress and settle to a fixed clause count when done. */
export function useBooksQuery() {
  return useQuery({
    queryKey: booksKey,
    queryFn: listBooksApi,
    refetchInterval: (q) => (anyProcessing(q.state.data) ? 3000 : false),
  });
}

/** One book. Polls while it is extracting, and refreshes its clause list the
 * moment extraction finishes so the reader fills in without a manual reload. */
export function useBookQuery(bookId: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: bookKey(bookId),
    queryFn: async () => {
      const book = await getBookApi(bookId);
      if (book.status === "done") {
        qc.invalidateQueries({ queryKey: bookClausesKey(bookId) });
      }
      return book;
    },
    enabled: !!bookId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "pending" || s === "processing" ? 3000 : false;
    },
  });
}

export function useBookClausesQuery(bookId: string) {
  return useQuery({
    queryKey: bookClausesKey(bookId),
    queryFn: () => listBookClausesApi(bookId),
    enabled: !!bookId,
    staleTime: 5 * 60_000,
  });
}

/** Cross-book clause search. Disabled until at least one filter is set, so the
 * page doesn't fetch the whole library on first paint. */
export function useClauseSearch(params: ClauseSearchParams, enabled: boolean) {
  return useQuery({
    queryKey: clauseSearchKey(params),
    queryFn: () => searchClausesApi(params),
    enabled,
    staleTime: 60_000,
  });
}

export function useUploadBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UploadBookPayload) => uploadBookApi(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: booksKey }),
  });
}

export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => deleteBookApi(bookId),
    onSuccess: () => qc.invalidateQueries({ queryKey: booksKey }),
  });
}

export function useReextractBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bookId: string) => reextractBookApi(bookId),
    onSuccess: (book) => {
      qc.invalidateQueries({ queryKey: booksKey });
      qc.invalidateQueries({ queryKey: bookKey(book.id) });
    },
  });
}
