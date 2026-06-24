// ── Client company profiles (admin-registered clients) ─────────────────────
// The login account for a client is created via the backend users API, but the
// backend User model only holds name/email/role/status/phone. The extra company
// details captured at registration (company name, CR no., country, role on
// project, assigned project) live here, keyed by the created user id.
//
// Persisted to localStorage and exposed to React via useSyncExternalStore — the
// same lightweight store pattern used by mock/clientData's claimDocStore.
import { useSyncExternalStore } from "react";

export interface ClientProfile {
  /** Id of the backing Client-role user account. */
  userId: string;
  company: string;
  crNo?: string;
  country?: string;
  /** Role the client company plays on the project. */
  roleOnProject?: string;
  contactName: string;
  email: string;
  phone?: string;
  /** Project the client was assigned to at registration (optional). */
  projectId?: string;
  /** ISO datetime. */
  createdAt: string;
}

const KEY = "alqarar.clientProfiles";

function load(): ClientProfile[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ClientProfile[]) : [];
  } catch {
    return [];
  }
}

let profiles: ClientProfile[] = load();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(profiles));
  } catch {
    /* ignore storage quota / private-mode errors */
  }
  listeners.forEach((l) => l());
}

export const clientProfileStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  snapshot(): ClientProfile[] {
    return profiles;
  },
  /** Upsert by userId (newest first). */
  add(p: ClientProfile) {
    profiles = [p, ...profiles.filter((x) => x.userId !== p.userId)];
    emit();
  },
  remove(userId: string) {
    profiles = profiles.filter((p) => p.userId !== userId);
    emit();
  },
  get(userId: string): ClientProfile | undefined {
    return profiles.find((p) => p.userId === userId);
  },
};

/** Subscribe to all client company profiles. */
export function useClientProfiles(): ClientProfile[] {
  return useSyncExternalStore(
    clientProfileStore.subscribe,
    clientProfileStore.snapshot,
    clientProfileStore.snapshot,
  );
}
