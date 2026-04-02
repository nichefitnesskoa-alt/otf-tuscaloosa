import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole, COACHES, SALES_ASSOCIATES } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  login: (name: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  canAccessAdmin: boolean;
  canAccessDataTools: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Determine role based on staff table, falling back to hardcoded lists
function getRoleForName(name: string, staffRole?: string): UserRole {
  if (staffRole) {
    if (staffRole === 'Admin') return 'Admin';
    if (staffRole === 'Coach') return 'Coach';
    if (staffRole === 'Both') return 'Admin'; // Both gets full access
    return 'SA';
  }
  // Fallback for legacy
  if (name === 'Koa') return 'Admin';
  if ((COACHES as readonly string[]).includes(name)) return 'Coach';
  if ((SALES_ASSOCIATES as readonly string[]).includes(name)) return 'SA';
  return 'SA';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolveUser = useCallback(async (name: string) => {
    // Look up role from staff table
    const { data } = await supabase
      .from('staff')
      .select('role')
      .eq('name', name)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const role = getRoleForName(name, (data as any)?.role);
    return { id: name, name, role };
  }, []);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem('currentUser');
    if (savedName) {
      resolveUser(savedName).then(u => {
        setUser(u);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [resolveUser]);

  const login = useCallback((name: string) => {
    // Optimistically set with fallback role, then resolve from DB
    const fallbackUser: User = {
      id: name,
      name,
      role: getRoleForName(name),
    };
    setUser(fallbackUser);
    localStorage.setItem('currentUser', name);
    // Async resolve actual role
    resolveUser(name).then(u => setUser(u));
  }, [resolveUser]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('currentUser');
  }, []);

  const canAccessAdmin = user?.role === 'Admin';
  const canAccessDataTools = user?.role === 'Admin';

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user,
      isLoading,
      canAccessAdmin,
      canAccessDataTools,
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
