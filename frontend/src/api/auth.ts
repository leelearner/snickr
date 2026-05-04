import { apiRequest } from "./http";
import type {
  LoginPayload,
  ProfileUpdatePayload,
  RegisterPayload,
  UserOut,
} from "../types/api";

export const authApi = {
  register(payload: RegisterPayload) {
    return apiRequest<UserOut>("/api/auth/register", {
      method: "POST",
      body: payload,
    });
  },
  login(payload: LoginPayload) {
    return apiRequest<UserOut>("/api/auth/login", {
      method: "POST",
      body: payload,
    });
  },
  logout() {
    return apiRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  },
  me() {
    return apiRequest<UserOut>("/api/auth/me");
  },
  updateMe(payload: ProfileUpdatePayload) {
    return apiRequest<UserOut>("/api/auth/me", {
      method: "PATCH",
      body: payload,
    });
  },
};
