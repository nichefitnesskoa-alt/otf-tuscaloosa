import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch staff profile and role from database
  const fetchUserProfile = useCallback(async (supabaseUser: SupabaseUser) => {
    try {
      // First get staff record
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, name, role, user_id')
        .eq('user_id', supabaseUser.id)
        .single();

      if (staffError || !staffData) {
        console.error('User not found in staff table:', staffError);
        setUser(null);
        return;
      }

      // Map database role to app role
      let role: UserRole = 'SA';
      if (staffData.role === 'Admin') {
        role = 'Admin';
      } else if (staffData.role === 'Coach') {
        role = 'Coach';
      }

      setUser({
        id: staffData.id,
        name: staffData.name,
        role,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid potential race conditions with Supabase auth
          setTimeout(() => {
            fetchUserProfile(currentSession.user);
          }, 0);
        } else {
          setUser(null);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        fetchUserProfile(currentSession.user);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session,
      login, 
      logout, 
      isAuthenticated: !!user && !!session,
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
