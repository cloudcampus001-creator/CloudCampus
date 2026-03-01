/**
 * SupabaseAuthContext.jsx
 * -----------------------
 * Provides Supabase auth state to the app.
 * Integrates with sessionPersistence so the 5-day inactivity rule
 * is enforced even when Supabase's own token is still technically valid.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { clearSession, isSessionAlive } from '@/lib/sessionPersistence';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();

  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Session validity ───────────────────────────────────────────────────────
  // We respect both Supabase's token AND our own 5-day inactivity window.
  const isSessionValid = useCallback((currentSession) => {
    if (!currentSession) return false;

    // Our own inactivity gate
    if (!isSessionAlive()) return false;

    return true;
  }, []);

  // ── Handle a session object from Supabase ─────────────────────────────────
  const handleSession = useCallback(async (currentSession) => {
    if (currentSession && isSessionValid(currentSession)) {
      setSession(currentSession);
      setUser(currentSession.user ?? null);
    } else if (currentSession) {
      // Supabase says we're logged in, but our inactivity rule disagrees
      await supabase.auth.signOut();
      clearSession('inactivity');
      setSession(null);
      setUser(null);
      toast({
        title: "Session Expired",
        description: "You've been inactive for 5 days. Please log in again.",
        variant: "default",
      });
    } else {
      setSession(null);
      setUser(null);
    }
    setLoading(false);
  }, [isSessionValid, toast]);

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

    // Listen for Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          clearSession('logout');
          setSession(null);
          setUser(null);
          setLoading(false);
        } else if (
          event === 'SIGNED_IN'      ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION'
        ) {
          await handleSession(newSession);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [handleSession]);

  // ── Auth actions ──────────────────────────────────────────────────────────
  const signUp = useCallback(async (email, password, options) => {
    const { error } = await supabase.auth.signUp({ email, password, options });
    if (error) {
      toast({ variant: "destructive", title: "Sign up Failed", description: error.message || "Something went wrong" });
    }
    return { error };
  }, [toast]);

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ variant: "destructive", title: "Sign in Failed", description: error.message || "Something went wrong" });
    }
    return { error };
  }, [toast]);

  const signOut = useCallback(async () => {
    clearSession('logout');
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", title: "Sign out Failed", description: error.message || "Something went wrong" });
    }
    return { error };
  }, [toast]);

  // ── Context value ─────────────────────────────────────────────────────────
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
