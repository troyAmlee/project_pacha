import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on first load by asking the server who we are.
  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((payload) => setMember(payload?.member ?? null))
      .catch(() => setMember(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    const payload = await api.postJson("/api/auth/login", credentials);
    setMember(payload.member);
    return payload.member;
  }

  async function signup(details) {
    const payload = await api.postJson("/api/auth/signup", details);
    setMember(payload.member);
    return payload;
  }

  async function logout() {
    await api.postJson("/api/auth/logout", {});
    setMember(null);
  }

  // Sync the cached rider after a profile edit or favorite toggle.
  function updateMember(updated) {
    setMember(updated);
  }

  return (
    <AuthContext.Provider
      value={{ member, loading, login, signup, logout, updateMember }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
