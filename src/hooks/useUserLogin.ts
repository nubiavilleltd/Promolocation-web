import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth-store";
import { ApiError, LoginPayload, LoginResponse } from "../../types/auth";
import { login } from "../api/auth";

export function useUserLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation<LoginResponse, ApiError, LoginPayload>({
    mutationFn: async (payload) => {
      if (import.meta.env.DEV) {
        console.log("[useUserLogin] payload", payload);
      }

      const response = await login(payload);

      if (import.meta.env.DEV) {
        console.log("[useUserLogin] response", response);
      }

      return response;
    },
    onSuccess: (data) => {
      setAuth(data);
    },
  });
}
