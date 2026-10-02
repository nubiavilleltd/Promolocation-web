// src/api/auth.ts
import {
  ChangePasswordPayload,
  ChangePasswordResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginPayload,
  LoginResponse,
  ResetAdminPasswordPayload,
  ResetAdminPasswordResponse,
} from "../../types/auth";
import { apiClient } from "./client";
import { authenticatedAdminPost } from "./loggedIn-client";

const ADMIN_LOGIN_PATH = "/admin_api/admin_login";
const CHANGE_PASSWORD_PATH = "/admin_api/change_password";
const FORGOT_PASSWORD_PATH = "/admin_api/forgot_password";
const RESET_ADMIN_PASSWORD_PATH = "/admin_api/reset_admin_password";

export function login(payload: LoginPayload) {
  return apiClient<LoginResponse>(ADMIN_LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: ChangePasswordPayload) {
  return authenticatedAdminPost<ChangePasswordResponse>(
    CHANGE_PASSWORD_PATH,
    payload,
  );
}

export function forgotPassword(payload: ForgotPasswordPayload) {
  return apiClient<ForgotPasswordResponse>(FORGOT_PASSWORD_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetAdminPassword(payload: ResetAdminPasswordPayload) {
  return apiClient<ResetAdminPasswordResponse>(RESET_ADMIN_PASSWORD_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
