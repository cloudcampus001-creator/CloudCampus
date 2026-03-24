/**
 * SupabaseAuthContext.jsx
 * -----------------------
 * Provides Supabase auth state to the app.
 *
 * CHANGES FROM ORIGINAL:
 * - isSessionValid() now trusts the Supabase JWT directly.
 *   The JWT is cryptographically signed — no need to also check localStorage.
 * - The 5-day inactivity check has been removed from the auth gate;
 *   Supabase handles token expiry via refresh tokens automatically.
 * - clearSession() is still called on logout for localStorage cleanup.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { clearSession } from '@/lib/sessionPersistence';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user,    setUser]    = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Handle a session object from Supabase ─────────────────────────────────
  // Trust the JWT directly — Supabase handles expiry and refresh.
  const handleSession = useCallback(async (currentSession) => {
    if (currentSession) {
      setSession(currentSession);
      setUser(currentSession.user ?? null);
    } else {
      setSession(null);
      setUser(null);
    }
    setLoading(false);
  }, []);

  // ── Initialise auth on mount ──────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (mounted) await handleSession(initialSession);
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          clearSession('logout');
          setSession(null);
          setUser(null);
          setLoading(false);
        } else if (
          event === 'SIGNED_IN'       ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION'
        ) {
          await handleSession(newSession);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [handleSession]);

  // ── Auth actions ──────────────────────────────────────────────────────────
  // signUp and signIn are kept for completeness but CloudCampus uses
  // the cloud-campus-auth Edge Function for all role-based logins.
  const signUp = useCallback(async (email, password, options) => {
    const { error } = await supabase.auth.signUp({ email, password, options });
    if (error) {
      toast({ variant: 'destructive', title: 'Sign up failed', description: error.message });
    }
    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ variant: 'destructive', title: 'Sign in failed', description: error.message });
    }
    return { error };
  }, [toast]);

  const signOut = useCallback(async () => {
    clearSession('logout');
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: 'destructive', title: 'Sign out failed', description: error.message });
    }
    return { error };
  }, [toast]);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    isAuthenticated: !!session && !!user,
  }), [user, session, loading, signUp, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
