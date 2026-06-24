// ── Client company profiles ────────────────────────────────────────────────
// Company details captured at client registration (company name, CR no.,
// country, role, contact, assigned project), keyed by the client's user id.
// Stored on the BACKEND (client_profiles table) so they persist across restarts
// and devices. The login account itself lives in the users table.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteClientProfileApi,
  listClientProfilesApi,
  upsertClientProfileApi,
} from "@/api/clientProfiles";

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
  /** Project the client is assigned to (optional). */
  projectId?: string;
  /** ISO datetime. */
  createdAt?: string;
}

export const clientProfilesKey = ["client-profiles"] as const;

export function useClientProfilesQuery() {
  return useQuery({ queryKey: clientProfilesKey, queryFn: listClientProfilesApi, staleTime: 30_000 });
}

/** All client company profiles (reactive). */
export function useClientProfiles(): ClientProfile[] {
  const { data } = useClientProfilesQuery();
  return useMemo(() => data ?? [], [data]);
}

export function useUpsertClientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: ClientProfile) => upsertClientProfileApi(profile),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientProfilesKey }),
  });
}

export function useDeleteClientProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => deleteClientProfileApi(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientProfilesKey }),
  });
}
