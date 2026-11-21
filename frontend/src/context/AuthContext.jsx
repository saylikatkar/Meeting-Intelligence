
import { createContext, useContext, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

const USE_MOCK = !import.meta.env.VITE_API_URL;

export const roleAccounts = {
  admin: {
    name: import.meta.env.VITE_ADMIN_NAME || "Admin",
    email: import.meta.env.VITE_ADMIN_EMAIL,
    password: import.meta.env.VITE_ADMIN_PASSWORD,
  },
};

function sameEmail(a, b) {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}

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

function mockLogin(email, password, role, profile) {
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

  if (!account.email || !account.password) {
    throw new Error(
      `The ${role} account is not configured. Add VITE_${role.toUpperCase()}_EMAIL and VITE_${role.toUpperCase()}_PASSWORD to your .env file.`
    );
  }

  if (
    !sameEmail(email, account.email) ||
    password !== account.password
  ) {
    throw new Error("Invalid email or password.");
  }

  return {
    name: account.name,
    email: account.email,
    role,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser);

  async function login(email, password, role, profile) {
    let loggedInUser;

    if (USE_MOCK) {
      loggedInUser = mockLogin(email, password, role, profile);

      localStorage.setItem("access", "mock-token");
    } else {
      const { data } = await api.post("/auth/login/", {
        email,
        password,
      });

      if (!data?.user) {
        throw new Error("Login response did not contain user details.");
      }

      const tokens = data.tokens || data;

      if (!tokens.access || !tokens.refresh) {
        throw new Error(
          "Login succeeded, but access or refresh tokens were not returned."
        );
      }

      if (data.user.role !== role) {
        throw new Error(
          `This account has the role "${data.user.role}". Please select the matching role.`
        );
      }

      localStorage.setItem("access", tokens.access);
      localStorage.setItem("refresh", tokens.refresh);

      loggedInUser = {
        ...data.user,
        name: data.user.name || data.user.email?.split("@")[0] || "User",
      };
    }

    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);

    return loggedInUser;
  }

  function updateProfile(changes) {
    const savedUser = getSavedUser();

    if (!savedUser) return;

    const next = { ...savedUser, ...changes };

    localStorage.setItem("user", JSON.stringify(next));
    setUser(next);
  }

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
