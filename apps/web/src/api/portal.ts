// ── Public client portal API ───────────────────────────────────────────────
// The portal (/portal/:token) is passwordless: the link identifies the client,
// but access requires an email OTP, which mints a verified SESSION token. We
// store that session token in localStorage (keyed by portal token) and send it
// as the `X-Portal-Session` header on every protected call. We deliberately use
// plain `fetch` (not the shared axios `api`) so no admin auth header is attached
// and a 401 doesn't bounce to /login.
import type { UploadedClaimDocument } from "@/types";

const baseURL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000/api/v1";

// ── Verified-session token storage (per portal link) ───────────────────────
const sessionKey = (token: string) => `alqarar.portal.session.${token}`;

export function getPortalSession(token: string): string | null {
  try {
    return localStorage.getItem(sessionKey(token));
  } catch {
    return null;
  }
}
function setPortalSession(token: string, session: string): void {
  try {
    localStorage.setItem(sessionKey(token), session);
  } catch {
    /* storage blocked — session just won't persist */
  }
}
export function clearPortalSession(token: string): void {
  try {
    localStorage.removeItem(sessionKey(token));
  } catch {
    /* ignore */
  }
}

function sessionHeaders(token: string): Record<string, string> {
  const s = getPortalSession(token);
  return s ? { "X-Portal-Session": s } : {};
}

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
  verified: boolean;
  /** Masked email (e.g. s***@gmail.com) — present when NOT yet verified. */
  email?: string;
  /** Present only once verified. */
  client?: { name: string; company: string; email: string };
  projects?: PortalProject[];
}

export interface OtpRequestResult {
  sent: boolean;
  /** Masked destination, e.g. s***@gmail.com. */
  email: string;
  expiresInMinutes: number;
}

// ── Calls ──────────────────────────────────────────────────────────────────

/** Portal state — verified? (sends the session token if we have one). */
export async function getPortalApi(token: string): Promise<PortalData> {
  const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}`, {
    headers: sessionHeaders(token),
  });
  if (!res.ok) throw new Error(await readError(res, "This upload link is invalid or has expired."));
  return res.json();
}

/** Send a one-time code to the client's registered email. */
export async function requestOtpApi(token: string): Promise<OtpRequestResult> {
  const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}/request-otp`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await readError(res, "Couldn't send the verification code."));
  return res.json();
}

/** Verify the code; on success the session token is stored for future access. */
export async function verifyOtpApi(token: string, code: string): Promise<void> {
  const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error(await readError(res, "Verification failed."));
  const data = await res.json();
  if (data?.sessionToken) setPortalSession(token, data.sessionToken);
}

/** Documents already uploaded to one of the client's projects (verified only). */
export async function listPortalDocsApi(token: string, projectId: string): Promise<UploadedClaimDocument[]> {
  const res = await fetch(
    `${baseURL}/portal/${encodeURIComponent(token)}/documents?projectId=${encodeURIComponent(projectId)}`,
    { headers: sessionHeaders(token) },
  );
  if (!res.ok) throw new Error(await readError(res, "Couldn't load your documents."));
  return res.json();
}

/** Upload a file into a project (verified only). */
export async function uploadPortalDocApi(
  token: string,
  { file, projectId }: { file: File; projectId: string },
): Promise<UploadedClaimDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("projectId", projectId);
  const res = await fetch(`${baseURL}/portal/${encodeURIComponent(token)}/upload`, {
    method: "POST",
    headers: sessionHeaders(token),
    body: form,
  });
  if (!res.ok) throw new Error(await readError(res, "Upload failed — please try again."));
  return res.json();
}

/** Download a file (verified only) — streams the blob and triggers a save. */
export async function downloadPortalDocApi(token: string, documentId: string, filename: string): Promise<void> {
  const res = await fetch(
    `${baseURL}/portal/${encodeURIComponent(token)}/documents/${encodeURIComponent(documentId)}/download`,
    { headers: sessionHeaders(token) },
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
