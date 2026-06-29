import type { User, UserRole } from "@/types";

/** The built-in role that routes to the separate client portal. */
export const CLIENT_ROLE: UserRole = "Client View";

export function isClientRole(role?: UserRole | string | null): boolean {
  return role === CLIENT_ROLE;
}

export function isClientUser(user: Pick<User, "role"> | null | undefined): boolean {
  return !!user && isClientRole(user.role);
}

/** Landing path for a user based on their role (clients get the client portal). */
export function roleHomePath(user: Pick<User, "role"> | null | undefined): string {
  return isClientUser(user) ? "/client" : "/";
}
