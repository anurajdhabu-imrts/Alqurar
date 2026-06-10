import { api } from "./client";
import type { User } from "@/types";

export async function loginApi(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function meApi(): Promise<User> {
  const { data } = await api.get("/auth/me");
  return data;
}
