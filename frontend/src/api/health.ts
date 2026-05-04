import { apiRequest } from "./http";
import type { HealthOut } from "../types/api";

export const healthApi = {
  check() {
    return apiRequest<HealthOut>("/api/health");
  },
};
