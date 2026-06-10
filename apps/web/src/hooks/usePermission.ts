import { useQuery } from "@tanstack/react-query";
import { listPermissionsApi } from "@/api/permissions";
import { useAuthStore } from "@/store/authStore";
import { useRolesQuery } from "./useRoles";

export { useRolesQuery };

/** Grouped permission catalog (for the Create-Role permission matrix). */
export function usePermissionsQuery() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: listPermissionsApi,
    staleTime: 60 * 60_000,
  });
}

/** Permission ids granted to the currently signed-in user (from their role). */
export function useUserPermissions(): string[] {
  const user = useAuthStore((s) => s.user);
  const { data: roles } = useRolesQuery();
  if (!user || !roles) return [];
  return roles.find((r) => r.name === user.role)?.permissionIds ?? [];
}

/** Synchronous boolean check against the user's effective permissions. */
export function useHasPermission(permissionId: string): boolean {
  return useUserPermissions().includes(permissionId);
}
