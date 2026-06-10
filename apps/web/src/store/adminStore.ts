import { create } from "zustand";
import { seedRoles, seedUsers } from "@/mock/admin";
import type { ManagedUser, Role, UserStatus } from "@/types";

interface AdminState {
  users: ManagedUser[];
  roles: Role[];
  addUser: (user: Omit<ManagedUser, "id">) => void;
  updateUser: (id: string, patch: Partial<Omit<ManagedUser, "id">>) => void;
  removeUser: (id: string) => void;
  setUserStatus: (id: string, status: UserStatus) => void;
  addRole: (role: Omit<Role, "id">) => void;
  updateRole: (id: string, patch: Partial<Omit<Role, "id">>) => void;
  removeRole: (id: string) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  users: seedUsers,
  roles: seedRoles,

  addUser: (user) =>
    set((s) => ({ users: [{ ...user, id: `u-${Date.now()}` }, ...s.users] })),

  updateUser: (id, patch) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),

  removeUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

  setUserStatus: (id, status) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, status } : u)) })),

  addRole: (role) => set((s) => ({ roles: [...s.roles, { ...role, id: `r-${Date.now()}` }] })),

  updateRole: (id, patch) =>
    set((s) => ({ roles: s.roles.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

  removeRole: (id) => set((s) => ({ roles: s.roles.filter((r) => r.id !== id) })),
}));
