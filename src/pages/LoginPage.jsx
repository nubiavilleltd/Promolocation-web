import React from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { FormErrorSummary } from "../components/FormControls";
import PasswordField from "../components/PasswordField";
import { useAuth } from "../context/AuthContext";
import { useLogin } from "../hooks/useLogin";
import { getDefaultAuthorizedPath, isAdminUser } from "../utils/authAccess";
import { assetPath } from "../utils/assetPath";
import {
  DASHBOARD_TEAM_LABEL,
  REGULAR_ADMIN_TEAM_LABEL,
} from "../utils/uiLabels";

function getLoginErrorMessage(status) {
  switch (status) {
    case 400:
      return "Invalid credentials.";
    case 401:
      return "Invalid API token.";
    case 403:
      return "Email not verified.";
    case 404:
      return "No account found with that email.";
    case 406:
      return `Account pending ${REGULAR_ADMIN_TEAM_LABEL} approval.`;
    case 423:
      return "Account has been deactivated.";
    case 451:
      return `Only ${DASHBOARD_TEAM_LABEL} users can sign in to this dashboard.`;
    default:
      return "Something went wrong.";
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formErrors, setFormErrors] = useState([]);
  const { authUser, logout } = useAuth();
  const { mutateAsync: loginUser, isPending } = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const apiToken = (import.meta.env.VITE_API_TOKEN ?? "").trim();
  const redirectFromPath = location.state?.from?.pathname;
  const getRedirectPath = (user) =>
    redirectFromPath || getDefaultAuthorizedPath(user);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    if (!isAdminUser(authUser)) {
      logout();
      return;
    }

    if (authUser) {
      navigate(getRedirectPath(authUser), { replace: true });
    }
  }, [authUser, logout, navigate, redirectFromPath]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      const validationErrors = [];
      if (!trimmedEmail) {
        validationErrors.push("Email is required.");
      }
      if (!trimmedPassword) {
        validationErrors.push("Password is required.");
      }
      setFormErrors(validationErrors);
      return;
    }

    try {
      const loggedInUser = await loginUser({
        token: apiToken,
        email: trimmedEmail,
        password: trimmedPassword,
      });

      navigate(getRedirectPath(loggedInUser), { replace: true });
    } catch (error) {
      console.error("Login backend error:", {
        status: error?.status,
        message: error?.message,
        details: error?.details,
      });

      setPassword("");

      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: getLoginErrorMessage(error?.status),
        confirmButtonColor: "#d33",
      });
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="logo-wrapper">
          <img
            src={assetPath("assets/auth-logo.png")}
            alt="Logo"
            className="logo"
          />
        </div>

        <h1>Dashboard Login</h1>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="input-group">
            <label htmlFor="email">
              Email Address <span className="required-mark">*</span>
            </label>
            <input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              disabled={isPending}
              autoComplete="email"
              aria-invalid={Boolean(formErrors.length)}
              onChange={(event) => {
                setEmail(event.target.value);
                setFormErrors([]);
              }}
            />
          </div>

          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFormErrors([]);
            }}
            disabled={isPending}
            placeholder="Password...."
            autoComplete="current-password"
            required
          />

          <div className="auth-inline-actions">
            <Link to="/forgot-password" className="auth-inline-link">
              Forgot password?
            </Link>
          </div>

          <FormErrorSummary errors={formErrors} />

          <button type="submit" className="login-btn" disabled={isPending}>
            {isPending ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
