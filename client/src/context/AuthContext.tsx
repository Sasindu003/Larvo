import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { authService, User } from '../services/auth.service';

// ── State ────────────────────────────────────────────────────────────────────
export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  status: AuthStatus;
}

type AuthAction =
  | { type: 'LOADING' }
  | { type: 'SET_USER'; user: User }
  | { type: 'CLEAR_USER' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, status: 'loading' };
    case 'SET_USER':
      return { user: action.user, status: 'authenticated' };
    case 'CLEAR_USER':
      return { user: null, status: 'unauthenticated' };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** true during initial /me check — use to avoid flashing logged-out state */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  googleLogin: (credential: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    status: 'idle',
  });

  const refreshUser = useCallback(async () => {
    dispatch({ type: 'LOADING' });
    try {
      const me = await authService.getMe();
      dispatch({ type: 'SET_USER', user: me });
    } catch {
      dispatch({ type: 'CLEAR_USER' });
    }
  }, []);

  // Restore session from httpOnly cookie on mount
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await authService.login({ email, password });
    dispatch({ type: 'SET_USER', user: res.data.user });
    return res.data.user;
  };

  const googleLogin = async (credential: string) => {
    const res = await authService.googleLogin(credential);
    dispatch({ type: 'SET_USER', user: res.data.user });
    return res.data.user;
  };

  const logout = async () => {
    await authService.logout();
    dispatch({ type: 'CLEAR_USER' });
  };

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        status: state.status,
        loading: state.status === 'idle' || state.status === 'loading',
        login,
        googleLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// ── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
