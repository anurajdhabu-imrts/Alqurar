// ── Public client portal API ───────────────────────────────────────────────
// The portal (/portal/:token) is passwordless and opens DIRECTLY via the secret
// link — the token identifies the client and their projects, and access needs
// nothing more. We deliberately use plain `fetch` (not the shared axios `api`)
// so no admin auth header is attached and a 401 doesn't bounce to /login.
//
// NOTE: An email-OTP + verified-session layer was removed to simplify the flow.
// The session/OTP helpers + calls are kept commented at the bottom for restore.
import type { UploadedClaimDocument } from "@/types";

const baseURL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000/api/v1";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    /* not JSON */
  }
  return fallback;
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface PortalProject {
  id: string;
  name: string;
  code: string;
  standard: string;
  status: string;
}

export interface PortalData {
  /** Always true now (kept so the page's verified-branch still renders). */
  verified: boolean;
  client?: { name: string; company: string; email: string };
  projects?: PortalProject[];
}

// ── Calls ──────────────────────────────────────────────────────────────────

/** Portal state — resolves the link to the client + their projects. */
export async function getPortalApi(token: string): Promise<PortalData> {
  const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(await readError(res, "This upload link is invalid or has expired."));
  return res.json();
}

/** Documents the client has already uploaded to one of their projects. */
export async function listPortalDocsApi(token: string, projectId: string): Promise<UploadedClaimDocument[]> {
  const res = await fetch(
    `${baseURL}/portal/${encodeURIComponent(token)}/documents?projectId=${encodeURIComponent(projectId)}`,
  );
  if (!res.ok) throw new Error(await readError(res, "Couldn't load your documents."));
  return res.json();
}

/** Upload a file into a project. */
export async function uploadPortalDocApi(
  token: string,
  { file, projectId }: { file: File; projectId: string },
): Promise<UploadedClaimDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("projectId", projectId);
  const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res, "Upload failed — please try again."));
  return res.json();
}

/** Download a file — streams the blob and triggers a save. */
export async function downloadPortalDocApi(token: string, documentId: string, filename: string): Promise<void> {
  const res = await fetch(
    `${baseURL}/portal/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}/download`,
  );
  if (!res.ok) throw new Error(await readError(res, "Couldn't download this file."));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Portal Proposal (sent-to-client) ──────────────────────────────────────

export interface PortalProposal {
  projectId: string;
  title: string;
  projectName: string;
  date: string | null;
  sentAt: string | null;
  status: "sent";
}

export interface PortalProposalDownload {
  content: Record<string, unknown> | null;
  inputs: Record<string, unknown>;
  projectName: string;
  currency: string;
}

/** Fetch the list of proposals that have been sent to this client. */
export async function getPortalProposalApi(token: string): Promise<PortalProposal[]> {
  const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}/proposal`);
  if (!res.ok) throw new Error(await readError(res, "Couldn't load your proposals."));
  return res.json();
}

/** Fetch the full proposal data for client-side PDF generation. */
export async function getPortalProposalDownloadApi(
  token: string,
  projectId: string,
): Promise<PortalProposalDownload> {
  const res = await fetch(
    `${baseURL}/portal/${encodeURIComponent(token)}/proposal/download?projectId=${encodeURIComponent(projectId)}`,
  );
  if (!res.ok) throw new Error(await readError(res, "Couldn't download this proposal."));
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// DISABLED — email OTP + verified session (kept for future restore)
//
// When the portal required email verification, a verified session token was
// stored in localStorage (keyed by portal token) and sent as the
// `X-Portal-Session` header on every protected call. To re-enable, restore the
// helpers + calls below and add `headers: sessionHeaders(token)` back to the
// get/list/upload/download fetches above, plus the `email`/`OtpRequestResult`
// fields on PortalData.
//
// const sessionKey = (token: string) => `alqarar.portal.session.${token}`;
// export function getPortalSession(token: string): string | null {
//   try { return localStorage.getItem(sessionKey(token)); } catch { return null; }
// }
// function setPortalSession(token: string, session: string): void {
//   try { localStorage.setItem(sessionKey(token), session); } catch { /* ignore */ }
// }
// export function clearPortalSession(token: string): void {
//   try { localStorage.removeItem(sessionKey(token)); } catch { /* ignore */ }
// }
// function sessionHeaders(token: string): Record<string, string> {
//   const s = getPortalSession(token);
//   return s ? { "X-Portal-Session": s } : {};
// }
//
// export interface OtpRequestResult { sent: boolean; email: string; expiresInMinutes: number; }
//
// /** Send a one-time code to the client's registered email. */
// export async function requestOtpApi(token: string): Promise<OtpRequestResult> {
//   const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}/request-otp`, { method: "POST" });
//   if (!res.ok) throw new Error(await readError(res, "Couldn't send the verification code."));
//   return res.json();
// }
//
// /** Verify the code; on success the session token is stored for future access. */
// export async function verifyOtpApi(token: string, code: string): Promise<void> {
//   const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}/verify-otp`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ code }),
//   });
//   if (!res.ok) throw new Error(await readError(res, "Verification failed."));
//   const data = await res.json();
//   if (data?.sessionToken) setPortalSession(token, data.sessionToken);
// }
// ─────────────────────────────────────────────────────────────────────────────
