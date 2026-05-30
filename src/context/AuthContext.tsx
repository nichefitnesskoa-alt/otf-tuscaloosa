import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
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

// Determine role based on staff table.
// NOTE: 'Both' staff get the UNION of Coach + SA features (not Admin).
// Admin access is gated by IDENTITY (Koa) below — never by role string.
// Authoritative source = `staff` table. If a name is not in `staff`, default
// to 'SA' (lowest privilege). No static fallback list — that drifts.
function getRoleForName(name: string, staffRole?: string): UserRole {
  if (staffRole === 'Admin') return 'Admin';
  if (staffRole === 'Coach') return 'Coach';
  if (staffRole === 'Both') return 'Both';
  if (name === 'Koa') return 'Admin';
  return 'SA';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolveUser = useCallback(async (name: string) => {
    // Look up role + permissions from staff table
    const { data } = await (supabase
      .from('staff')
      .select('role, permissions') as any)
      .eq('name', name)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const role = getRoleForName(name, (data as any)?.role);
    const permissions = ((data as any)?.permissions || {}) as Record<string, boolean>;
    return { id: name, name, role, permissions };
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

  // Admin is gated by identity (Koa), not by role string.
  const canAccessAdmin = user?.name === 'Koa';
  const canAccessDataTools = user?.name === 'Koa';

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
