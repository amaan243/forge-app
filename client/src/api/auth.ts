import apiClient from "./client";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  company: string | null;
  avatar_url: string | null;
  isEmailVerified: boolean;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  expiresIn?: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: User;
    session?: Session;
    isEmailVerified?: boolean;
    email?: string;
  };
  error?: {
    code: string;
    details?: unknown;
  };
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role?: string;
  company?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface VerifyEmailPayload {
  token_hash?: string;
  code?: string;
  token?: string;
  type?: string;
  email?: string;
}

export interface ResendVerificationPayload {
  email: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  password: string;
  accessToken?: string;
  token_hash?: string;
  type?: string;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/v1/auth/register", payload);
    return response.data;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/v1/auth/login", payload);
    return response.data;
  },

  async verifyEmail(payload: VerifyEmailPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/v1/auth/verify-email", payload);
    return response.data;
  },

  async resendVerification(payload: ResendVerificationPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/v1/auth/resend-verification", payload);
    return response.data;
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/v1/auth/forgot-password", payload);
    return response.data;
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/v1/auth/reset-password", payload);
    return response.data;
  },

  async getMe(): Promise<AuthResponse> {
    const response = await apiClient.get<AuthResponse>("/api/v1/auth/me");
    return response.data;
  },

  async logout(): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>("/api/v1/auth/logout");
    return response.data;
  },
};
