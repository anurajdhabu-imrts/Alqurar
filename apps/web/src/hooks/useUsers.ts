import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUserApi,
  deleteUserApi,
  listUsersApi,
  updateUserApi,
  type UserCreatePayload,
  type UserUpdatePayload,
} from "@/api/users";

export const usersKey = ["users"] as const;

export function useUsersQuery() {
  return useQuery({ queryKey: usersKey, queryFn: listUsersApi, staleTime: 30_000 });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserCreatePayload) => createUserApi(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UserUpdatePayload }) => updateUserApi(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUserApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
  });
}
