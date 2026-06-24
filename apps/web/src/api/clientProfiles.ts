import { api } from "./client";
import type { ClientProfile } from "@/store/clientProfiles";

/** Client company profiles (server-side, keyed by the client's user id). */
export async function listClientProfilesApi(): Promise<ClientProfile[]> {
  const { data } = await api.get("/client-profiles/");
  return data;
}

export async function upsertClientProfileApi(profile: ClientProfile): Promise<ClientProfile> {
  const { data } = await api.post("/client-profiles/", profile);
  return data;
}

export async function deleteClientProfileApi(userId: string): Promise<void> {
  await api.delete(`/client-profiles/${userId}`);
}
