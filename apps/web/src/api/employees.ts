import { api } from "./client";

export type EmployeeStatus = "Active" | "Inactive";

/** Master-data record for a team member who can be costed on a proposal. */
export interface Employee {
  id: string;
  /** Retained on the backend for compatibility, but no longer captured in the UI —
   * the master data is keyed by designation/role + rate. */
  name?: string;
  designation: string;
  hourlyRate: number;
  department?: string | null;
  status: EmployeeStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface EmployeeCreatePayload {
  designation: string;
  hourlyRate: number;
  department?: string;
  status: EmployeeStatus;
}

export type EmployeeUpdatePayload = Partial<EmployeeCreatePayload>;

export async function listEmployeesApi(): Promise<Employee[]> {
  const { data } = await api.get<Employee[]>("/employees/");
  return data;
}

export async function createEmployeeApi(payload: EmployeeCreatePayload): Promise<Employee> {
  const { data } = await api.post<Employee>("/employees/", payload);
  return data;
}

export async function updateEmployeeApi(id: string, patch: EmployeeUpdatePayload): Promise<Employee> {
  const { data } = await api.patch<Employee>(`/employees/${id}`, patch);
  return data;
}

export async function deleteEmployeeApi(id: string): Promise<void> {
  await api.delete(`/employees/${id}`);
}
