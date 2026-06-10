import { api } from "./client";
import type { ManagedUser, UserRole, UserStatus } from "@/types";

export interface UserCreatePayload {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  password?: string;
}

export async function listUsersApi(): Promise<ManagedUser[]> {
  const { data } = await api.get("/users/");
  return data;
}

export async function createUserApi(payload: UserCreatePayload): Promise<ManagedUser> {
  const { data } = await api.post("/users/", payload);
  return data;
}

export async function updateUserApi(id: string, patch: UserUpdatePayload): Promise<ManagedUser> {
  const { data } = await api.patch(`/users/${id}`, patch);
  return data;
}

export async function deleteUserApi(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
