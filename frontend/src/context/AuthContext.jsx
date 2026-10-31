
import { createContext, useContext, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

// Use the real Django backend when VITE_API_URL is configured.
const USE_MOCK = !import.meta.env.VITE_API_URL;
console.log("API URL:", import.meta.env.VITE_API_URL);
console.log("Using mock login:", USE_MOCK);

// Admin account configuration from .env
export const roleAccounts = {
  admin: {
    name: import.meta.env.VITE_ADMIN_NAME || "Admin",
    email: import.meta.env.VITE_ADMIN_EMAIL,
    password: import.meta.env.VITE_ADMIN_PASSWORD,
    secretKey: import.meta.env.VITE_ADMIN_SECRET_KEY,
  },
};

function sameEmail(a, b) {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

// Check whether the saved user is authorized for the requested role.
export function isAuthorized(user, role) {
  if (!user || user.role !== role) return false;

  if (USE_MOCK && roleAccounts[role]) {
    return sameEmail(user.email, roleAccounts[role].email);
  }

  return true;
}

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

// Mock login used only when the backend URL is not configured.
function mockLogin(email, password, role, profile, secretKey) {
  const account = roleAccounts[role];

  if (!account) {
    const name = profile?.name || email.split("@")[0];

    const user = {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      email,
      role,
    };

    if (profile?.avatar) {
      user.avatar = profile.avatar;
    }

    return user;
  }

  if (!account.email || !account.password || !account.secretKey) {
    const prefix = `VITE_${role.toUpperCase()}`;

    throw new Error(
      `The ${role} account is not configured. Add ${prefix}_EMAIL, ${prefix}_PASSWORD and ${prefix}_SECRET_KEY to your .env file.`
    );
  }

  if (
    !sameEmail(email, account.email) ||
    password !== account.password ||
    secretKey !== account.secretKey
  ) {
    throw new Error("Invalid email, password or secret key.");
  }

  return {
    name: account.name,
    email: account.email,
    role,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser);

  // Login using either the mock system or the real Django backend.
  async function login(email, password, role, profile, secretKey) {
    let loggedInUser;

    if (USE_MOCK) {
      loggedInUser = mockLogin(
        email,
        password,
        role,
        profile,
        secretKey
      );

      localStorage.setItem("access", "mock-token");
    } else {
      const payload =
        role === "admin"
          ? { email, password, secret_key: secretKey }
          : { email, password };

      const { data } = await api.post("/auth/login/", payload);

      // Ensure the backend returned user details.
      if (!data?.user) {
        throw new Error(
          "Login response did not contain user details."
        );
      }

      // Django returns tokens inside data.tokens.
      // The fallback also supports APIs returning top-level tokens.
      const tokens = data.tokens || data;

      if (!tokens.access || !tokens.refresh) {
        throw new Error(
          "Login succeeded, but access or refresh tokens were not returned."
        );
      }

      // Check the account role before saving the session.
      if (data.user.role !== role) {
        throw new Error(
          `This account has the role "${data.user.role}". Please select the matching role.`
        );
      }

      localStorage.setItem("access", tokens.access);
      localStorage.setItem("refresh", tokens.refresh);

      // Keep the user's existing backend details.
      loggedInUser = {
        ...data.user,
        name: data.user.name || data.user.email?.split("@")[0] || "User",
      };
    }

    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);

    return loggedInUser;
  }

  // Update the signed-in user's profile.
  function updateProfile(changes) {
    const savedUser = getSavedUser();

    if (!savedUser) return;

    const next = { ...savedUser, ...changes };

    localStorage.setItem("user", JSON.stringify(next));
    setUser(next);
  }

  // Log out and clear the local session.
  function logout() {
    const refreshToken = localStorage.getItem("refresh");

    if (!USE_MOCK && refreshToken) {
      api
        .post("/auth/logout/", { refresh: refreshToken })
        .catch((error) => {
          console.error("Backend logout failed:", error);
        });
    }

    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");

    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, login, logout, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
