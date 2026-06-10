import { create } from "zustand";
import { loginApi, meApi } from "@/api/auth";
import { TOKEN_KEY } from "@/api/client";
import type { User } from "@/types";

type AuthStatus = "idle" | "authenticated" | "unauthenticated";

interface AuthState {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Restore session from localStorage on app boot — verifies token via /auth/me. */
  initialize: () => Promise<void>;
}

const USER_KEY = "alqarar.user";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  status: "idle",

  login: async (email, password) => {
    const { access_token } = await loginApi(email, password);
    localStorage.setItem(TOKEN_KEY, access_token);
    set({ token: access_token });
    const user = await meApi();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, status: "authenticated" });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null, token: null, status: "unauthenticated" });
  },

  initialize: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ status: "unauthenticated" });
      return;
    }
    try {
      const user = await meApi();
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, token, status: "authenticated" });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ user: null, token: null, status: "unauthenticated" });
    }
  },
}));
