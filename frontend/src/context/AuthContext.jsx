import { createContext, useContext, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

// Until the Django API is ready, member login works with any email/password.
// Set VITE_API_URL in .env to switch to the real backend.
const USE_MOCK = !import.meta.env.VITE_API_URL;

// The admin portal only accepts the account set in .env, plus its secret key.
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

// a saved session only counts if it still matches the account in .env
export function isAuthorized(user, role) {
  if (!user || user.role !== role) return false;
  if (USE_MOCK && roleAccounts[role]) return sameEmail(user.email, roleAccounts[role].email);
  return true;
}

function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function mockLogin(email, password, role, profile, secretKey) {
  const account = roleAccounts[role];

  if (!account) {
    const name = profile?.name || email.split("@")[0];
    const user = { name: name.charAt(0).toUpperCase() + name.slice(1), email, role };
    if (profile?.avatar) user.avatar = profile.avatar;
    return user;
  }

  if (!account.email || !account.password || !account.secretKey) {
    const prefix = `VITE_${role.toUpperCase()}`;
    throw new Error(`The ${role} account is not set up. Add ${prefix}_EMAIL, ${prefix}_PASSWORD and ${prefix}_SECRET_KEY to .env.`);
  }
  if (!sameEmail(email, account.email) || password !== account.password || secretKey !== account.secretKey) {
    throw new Error("Invalid email, password or secret key.");
  }
  return { name: account.name, email: account.email, role };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getSavedUser);

  // `profile` lets mock member logins use the name from the user store;
  // `secretKey` is only used for admin sign-in
  async function login(email, password, role, profile, secretKey) {
    let loggedInUser;

    if (USE_MOCK) {
      loggedInUser = mockLogin(email, password, role, profile, secretKey);
      localStorage.setItem("access", "mock-token");
    } else {
      const { data } = await api.post("/auth/login/", role === "admin" ? { email, password, secret_key: secretKey } : { email, password });
      // expected response: { access, refresh, user: { name, email, role } }
      if (data.user.role !== role) {
        throw new Error(`This account is not a ${role} account.`);
      }
      localStorage.setItem("access", data.access);
      localStorage.setItem("refresh", data.refresh);
      loggedInUser = data.user;
    }

    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    return loggedInUser;
  }

  // update the signed-in user's name etc. (profile page)
  function updateProfile(changes) {
    // read the saved user, not state - this can run right after login()
    const next = { ...getSavedUser(), ...changes };
    localStorage.setItem("user", JSON.stringify(next));
    setUser(next);
  }

  function logout() {
    if (!USE_MOCK) {
      api.post("/auth/logout/", { refresh: localStorage.getItem("refresh") }).catch(() => {});
    }
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
