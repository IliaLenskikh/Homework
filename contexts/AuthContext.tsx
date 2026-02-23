import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { UserProfile, UserRole } from '../types';
import { getErrorMessage } from '../utils/errorHandling';
import { isTableNotFoundError } from '../services/errorMapper';

interface AuthContextType {
  userProfile: UserProfile | null;
  isAuthChecking: boolean;
  isProfileLoading: boolean;
  authError: string | null;
  authSuccessMsg: string | null;
  handleAuth: (email: string, password: string, isLoginMode: boolean) => Promise<void>;
  handleLogout: () => Promise<void>;
  handlePasswordReset: (email: string) => Promise<void>;
  handleRoleSelection: (role: UserRole) => Promise<void>;
  handleRoleSwitch: () => Promise<void>;
  profileError: string | null;
  retryProfileLoad: () => Promise<void>;
  setAuthError: (msg: string | null) => void;
  setAuthSuccessMsg: (msg: string | null) => void;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (session) {
           await loadUserProfile(session.user.id, session.user.email!);
           setAuthSuccessMsg("Please set a new password below.");
        }
      }
      
      if (event === 'SIGNED_IN' && session) {
          // Reset error state on new sign in
          setProfileError(null);
          loadUserProfile(session.user.id, session.user.email!).catch(console.error);
      }
      
      if (event === 'SIGNED_OUT') {
          setUserProfile(null);
          setProfileError(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    setIsAuthChecking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await loadUserProfile(session.user.id, session.user.email!);
      }
    } catch (error) {
      console.error("Session check error:", error);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const loadUserProfile = async (userId: string, userEmail: string) => {
    setIsProfileLoading(true);
    setProfileError(null);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
         if (isTableNotFoundError(error)) {
             console.warn("Profiles table missing. Running in limited mode.");
             // In dev mode with missing table, we allow access but role selection might fail or be weird.
             // We'll treat it as a new user to allow the app to function partially.
             setUserProfile({ id: userId, name: '', email: userEmail, teacherEmail: '' });
             return;
         } else {
             throw error;
         }
      }

      if (data) {
        setUserProfile({
          id: data.id,
          name: data.full_name || '',
          email: userEmail,
          teacherEmail: data.teacher_email || '',
          role: data.role as UserRole,
          completed_stories: data.completed_stories || []
        });
      } else {
        // New user (no profile row yet)
        setUserProfile({ id: userId, name: '', email: userEmail, teacherEmail: '' });
      }
    } catch (e: any) {
      console.error("Critical profile load error:", e);
      setProfileError(getErrorMessage(e));
      // Do NOT set a dummy profile here. This prevents incorrect redirection to role selection.
    } finally {
      setIsProfileLoading(false);
    }
  };

  const retryProfileLoad = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await loadUserProfile(session.user.id, session.user.email!);
    }
  };

  const handleAuth = async (email: string, password: string, isLoginMode: boolean) => {
    setAuthError(null);
    setAuthSuccessMsg(null);
    
    try {
      let result;
      if (isLoginMode) {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) throw result.error;

      if (result.data.session) {
          await loadUserProfile(result.data.session.user.id, result.data.session.user.email!);
      } else if (!isLoginMode && result.data.user && !result.data.session) {
          setAuthSuccessMsg("Registration successful! Please check your email to confirm your account.");
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      setAuthError(getErrorMessage(error));
      throw error;
    }
  };

  const handlePasswordReset = async (email: string) => {
    setAuthError(null);
    setAuthSuccessMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setAuthSuccessMsg("Password reset link sent.");
    } catch (error: any) {
      setAuthError(getErrorMessage(error));
      throw error;
    }
  };

  const handleRoleSelection = async (role: UserRole) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No user found");

        const { error } = await supabase
            .from('profiles')
            .upsert({ 
                id: user.id, 
                role: role,
                email: user.email 
            }, { onConflict: 'id' });

        if (error) throw error;

        setUserProfile((prev) => prev ? { ...prev, id: user.id, role } : null);
    } catch (err: any) {
        setAuthError(getErrorMessage(err));
        throw err;
    }
  };

  const handleRoleSwitch = async () => {
      if (!userProfile?.id) return;
      const currentRole = userProfile.role || 'student';
      const newRole: UserRole = currentRole === 'student' ? 'teacher' : 'student';
      
      if (!window.confirm(`Switch to ${newRole} mode?`)) return;

      try {
          const { error } = await supabase
          .from('profiles')
          .upsert({ id: userProfile.id, role: newRole, email: userProfile.email }, { onConflict: 'id' });

          if (error) throw error;
          setUserProfile((prev) => prev ? { ...prev, role: newRole } : null);
      } catch (err: any) {
          setAuthError(getErrorMessage(err));
          throw err;
      }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    setAuthSuccessMsg(null);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{
      userProfile,
      isAuthChecking,
      isProfileLoading,
      authError,
      authSuccessMsg,
      handleAuth,
      handleLogout,
      handlePasswordReset,
      handleRoleSelection,
      handleRoleSwitch,
      profileError,
      retryProfileLoad,
      setAuthError,
      setAuthSuccessMsg,
      setUserProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
