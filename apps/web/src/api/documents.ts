import { api } from "./client";

/** Mirrors the backend DocumentAnalysisOut schema. */
export interface DocumentAnalysisResult {
  document_type: string;
  title: string;
  summary: string;
  relevance_to_claim: string;
  supports_eot: boolean;
  key_points: string[];
  parties: string[];
  key_dates: string[];
  confidence: number;
  filename: string;
  extracted_chars: number;
  truncated: boolean;
  model: string;
}

export interface ClaimContext {
  claimRef?: string;
  claimTitle?: string;
  standard?: string;
}

/** Upload a document and run real Claude analysis on it. */
export async function analyzeDocument(
  file: File,
  ctx?: ClaimContext,
): Promise<DocumentAnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  if (ctx?.claimRef) form.append("claim_ref", ctx.claimRef);
  if (ctx?.claimTitle) form.append("claim_title", ctx.claimTitle);
  if (ctx?.standard) form.append("standard", ctx.standard);

  // Let the browser set the multipart boundary; allow time for the model call.
  const { data } = await api.post<DocumentAnalysisResult>("/documents/analyze", form, {
    timeout: 120_000,
  });
  return data;
}
