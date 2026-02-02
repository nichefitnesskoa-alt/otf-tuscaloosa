import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole, COACHES, SALES_ASSOCIATES } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (name: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('otf_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback((name: string) => {
    let role: UserRole = 'SA';
    
    if (name === 'Koa') {
      role = 'Admin';
    } else if (COACHES.includes(name as any)) {
      role = 'Coach';
    } else if (SALES_ASSOCIATES.includes(name as any)) {
      role = 'SA';
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      role,
    };

    setUser(newUser);
    localStorage.setItem('otf_user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('otf_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
