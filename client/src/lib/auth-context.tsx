import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  authApi,
  type User,
  type LoginPayload,
  type RegisterPayload,
} from "@/api/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  error: string | null;
  login: (payload: LoginPayload) => Promise<{ success: boolean; error?: string; emailNotVerified?: boolean; email?: string }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; error?: string; isEmailVerified?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "archforge_token";
const REFRESH_TOKEN_KEY = "archforge_refresh_token";
const USER_KEY = "archforge_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initAuth = useCallback(async () => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const cachedUser = localStorage.getItem(USER_KEY);

    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch {
        // Ignore cache parse error
      }
    }

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const res = await authApi.getMe();
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setUser(null);
      }
      // If network error, retain cached user so user is not kicked offline abruptly
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const login = async (payload: LoginPayload) => {
    setError(null);
    try {
      const res = await authApi.login(payload);
      if (res.success && res.data?.session?.accessToken && res.data.user) {
        localStorage.setItem(TOKEN_KEY, res.data.session.accessToken);
        if (res.data.session.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, res.data.session.refreshToken);
        }
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, error: res.message || "Failed to sign in" };
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.error?.code === "EMAIL_NOT_VERIFIED") {
        return {
          success: false,
          emailNotVerified: true,
          email: err.response.data?.error?.details?.email || payload.email,
          error: "Please verify your email before signing in.",
        };
      }
      const message = err.response?.data?.message || err.message || "Invalid email or password";
      setError(message);
      return { success: false, error: message };
    }
  };

  const register = async (payload: RegisterPayload) => {
    setError(null);
    try {
      const res = await authApi.register(payload);
      if (res.success && res.data?.user) {
        if (res.data.session?.accessToken && res.data.isEmailVerified) {
          localStorage.setItem(TOKEN_KEY, res.data.session.accessToken);
          if (res.data.session.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, res.data.session.refreshToken);
          }
          localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
          setUser(res.data.user);
        }
        return {
          success: true,
          isEmailVerified: res.data.isEmailVerified,
        };
      }
      return { success: false, error: res.message || "Registration failed" };
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || "Registration failed";
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue client cleanup even if backend network call fails
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
      }
    } catch {
      // Ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user && user.isEmailVerified),
        isEmailVerified: Boolean(user?.isEmailVerified),
        error,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
