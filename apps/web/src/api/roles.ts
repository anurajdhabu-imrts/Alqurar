import { api } from "./client";
import type { Role } from "@/types";

export interface RoleCreatePayload {
  name: string;
  description?: string;
  color?: string;
  permissionIds?: string[];
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string;
  color?: string;
  permissionIds?: string[];
}

export async function listRolesApi(): Promise<Role[]> {
  const { data } = await api.get("/roles/");
  return data;
}

export async function createRoleApi(payload: RoleCreatePayload): Promise<Role> {
  const { data } = await api.post("/roles/", payload);
  return data;
}

export async function updateRoleApi(id: string, patch: RoleUpdatePayload): Promise<Role> {
  const { data } = await api.patch(`/roles/${id}`, patch);
  return data;
}

export async function deleteRoleApi(id: string): Promise<void> {
  await api.delete(`/roles/${id}`);
}
