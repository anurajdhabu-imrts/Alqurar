import { api } from "./client";
import type { PermissionGroup } from "@/types";

export async function listPermissionsApi(): Promise<PermissionGroup[]> {
  const { data } = await api.get("/permissions/");
  return data;
}
