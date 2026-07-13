import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createEmployeeApi,
  deleteEmployeeApi,
  listEmployeesApi,
  updateEmployeeApi,
  type EmployeeCreatePayload,
  type EmployeeUpdatePayload,
} from "@/api/employees";

export const employeesKey = ["employees"] as const;

export function useEmployeesQuery() {
  return useQuery({ queryKey: employeesKey, queryFn: listEmployeesApi, staleTime: 60_000 });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EmployeeCreatePayload) => createEmployeeApi(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeesKey }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EmployeeUpdatePayload }) =>
      updateEmployeeApi(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeesKey }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployeeApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: employeesKey }),
  });
}
