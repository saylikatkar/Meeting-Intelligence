
import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

const USE_MOCK = !import.meta.env.VITE_API_URL;

export const roleAccounts = {
  admin: {
    email: import.meta.env.VITE_ADMIN_EMAIL || "",
    password: import.meta.env.VITE_ADMIN_PASSWORD || "",
  },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem("user");
    }
  }, [user]);

  async function register(name, email, password) {
    if (USE_MOCK) {
      throw new Error(
        "Backend API is not configured. Check VITE_API_URL in your frontend .env file."
      );
    }

    try {
      const response = await api.post("/auth/register/", {
        name,
        email,
        password,
      });

      const data = response.data;

      if (data.access) {
        localStorage.setItem("access", data.access);
      }

      if (data.refresh) {
        localStorage.setItem("refresh", data.refresh);
      }

      if (data.user) {
        setUser(data.user);
      }

      return data.user;
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Registration failed. Please try again.";

      throw new Error(message);
    }
  }

  async function login(email, password, role = "member", profile = null) {
    if (USE_MOCK) {
      const mockUser = {
        name: profile?.name || email.split("@")[0],
        email,
        role,
        status: "active",
      };

      setUser(mockUser);
      return mockUser;
    }

    try {
      const response = await api.post("/auth/login/", {
        email,
        password,
      });

      const data = response.data;

      if (data.access) {
        localStorage.setItem("access", data.access);
      }

      if (data.refresh) {
        localStorage.setItem("refresh", data.refresh);
      }

      if (data.user) {
        setUser(data.user);
      }

      return data.user;
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Invalid email or password.";

      throw new Error(message);
    }
  }

  async function logout() {
    try {
      if (!USE_MOCK) {
        await api.post("/auth/logout/");
      }
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      localStorage.removeItem("user");
      setUser(null);
    }
  }

  function updateProfile(updatedData) {
    setUser((currentUser) => {
      if (!currentUser) return null;

      return {
        ...currentUser,
        ...updatedData,
      };
    });
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function isAuthorized(user, allowedRoles = []) {
  if (!user) return false;

  if (allowedRoles.length === 0) return true;

  return allowedRoles.includes(user.role);
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
