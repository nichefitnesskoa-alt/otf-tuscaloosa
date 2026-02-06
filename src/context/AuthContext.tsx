import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole, COACHES, SALES_ASSOCIATES } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (name: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Determine role based on staff name
function getRoleForName(name: string): UserRole {
  if (name === 'Admin') return 'Admin';
  if ((COACHES as readonly string[]).includes(name)) return 'Coach';
  if ((SALES_ASSOCIATES as readonly string[]).includes(name)) return 'SA';
  return 'SA';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('currentUser');
    if (savedName) {
      setUser({
        id: savedName,
        name: savedName,
        role: getRoleForName(savedName),
      });
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((name: string) => {
    const newUser: User = {
      id: name,
      name,
      role: getRoleForName(name),
    };
    setUser(newUser);
    localStorage.setItem('currentUser', name);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('currentUser');
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user,
      isLoading 
    }}>
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
