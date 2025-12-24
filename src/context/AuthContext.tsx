import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { User, AuthState } from "@/types";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const VALID_EMAIL = "admin@contract.ai";
const VALID_PASSWORD = "password123";
const DEFAULT_USER: User = {
  name: "Admin User",
  email: "admin@contract.ai",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
  });

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    if (email === VALID_EMAIL && password === VALID_PASSWORD) {
      setAuthState({
        isAuthenticated: true,
        user: DEFAULT_USER,
      });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthState({
      isAuthenticated: false,
      user: null,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
