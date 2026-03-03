"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  buildAuthorizationUrl,
  parseIdToken,
  isTokenExpired,
  SESSION_KEYS,
} from "@/lib/login3";

interface Login3AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  idToken: string | null;
  walletAddress: string | null;
  email: string | null;
  sub: string | null;
  startLogin: () => Promise<void>;
  clearSession: () => void;
}

const Login3AuthContext = createContext<Login3AuthState>({
  isLoading: true,
  isAuthenticated: false,
  idToken: null,
  walletAddress: null,
  email: null,
  sub: null,
  startLogin: async () => {},
  clearSession: () => {},
});

export function useLogin3Auth() {
  return useContext(Login3AuthContext);
}

interface SessionData {
  isLoading: boolean;
  idToken: string | null;
  walletAddress: string | null;
  email: string | null;
  sub: string | null;
}

const INITIAL_STATE: SessionData = {
  isLoading: true,
  idToken: null,
  walletAddress: null,
  email: null,
  sub: null,
};

export function Login3AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData>(INITIAL_STATE);

  // Restore session from sessionStorage or URL params (after server callback redirect).
  // This one-time initialization must run client-side after mount.
  useEffect(() => {
    // Check if server callback redirected with token in URL
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("login3_token");
    if (tokenFromUrl) {
      sessionStorage.setItem(SESSION_KEYS.ID_TOKEN, tokenFromUrl);
      window.history.replaceState({}, "", window.location.pathname);
    }

    const stored = tokenFromUrl ?? sessionStorage.getItem(SESSION_KEYS.ID_TOKEN);
    if (stored && !isTokenExpired(stored)) {
      const claims = parseIdToken(stored);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client initialization from sessionStorage
      setSession({
        isLoading: false,
        idToken: stored,
        walletAddress: claims.wallet_address ?? null,
        email: claims.email ?? null,
        sub: claims.sub,
      });
    } else {
      setSession((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const startLogin = useCallback(async () => {
    const { url, codeVerifier, state } = await buildAuthorizationUrl();
    document.cookie = `login3_code_verifier=${codeVerifier}; path=/; max-age=600; SameSite=Lax`;
    document.cookie = `login3_state=${state}; path=/; max-age=600; SameSite=Lax`;
    window.location.href = url;
  }, []);

  const clearSession = useCallback(() => {
    setSession({
      isLoading: false,
      idToken: null,
      walletAddress: null,
      email: null,
      sub: null,
    });
    sessionStorage.removeItem(SESSION_KEYS.ID_TOKEN);
    sessionStorage.removeItem(SESSION_KEYS.CODE_VERIFIER);
    sessionStorage.removeItem(SESSION_KEYS.STATE);
  }, []);

  return (
    <Login3AuthContext.Provider
      value={{
        isLoading: session.isLoading,
        isAuthenticated: !!session.idToken,
        idToken: session.idToken,
        walletAddress: session.walletAddress,
        email: session.email,
        sub: session.sub,
        startLogin,
        clearSession,
      }}
    >
      {children}
    </Login3AuthContext.Provider>
  );
}
