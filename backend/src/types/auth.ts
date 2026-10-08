export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  company: string | null;
  avatar_url: string | null;
  isEmailVerified: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  expiresIn?: number;
}

export interface AuthResponseData {
  user?: AuthUser;
  session?: AuthSession;
  isEmailVerified?: boolean;
}
