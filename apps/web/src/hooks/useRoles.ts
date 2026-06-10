import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRoleApi,
  deleteRoleApi,
  listRolesApi,
  updateRoleApi,
  type RoleCreatePayload,
  type RoleUpdatePayload,
} from "@/api/roles";

export const rolesKey = ["roles"] as const;

export function useRolesQuery() {
  return useQuery({ queryKey: rolesKey, queryFn: listRolesApi, staleTime: 10 * 60_000 });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoleCreatePayload) => createRoleApi(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RoleUpdatePayload }) => updateRoleApi(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRoleApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: rolesKey }),
  });
}
