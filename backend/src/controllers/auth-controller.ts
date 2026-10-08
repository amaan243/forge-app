import type { RequestHandler } from "express";
import { supabase, supabaseAdmin } from "../lib/supabase.js";
import { env } from "../config/env.js";
import { AppError, ConflictError, UnauthorizedError } from "../errors/app-error.js";
import {
  registerSchema,
  loginSchema,
  resendVerificationSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validators/auth.js";
import type { AuthenticatedRequest } from "../types/api.js";
import type { AuthResponseData, AuthUser } from "../types/auth.js";

export const authController = {
  register: (async (request, response) => {
    const { email, password, full_name, role, company } = registerSchema.parse(request.body);

    let createdUser: { id: string; email?: string; email_confirmed_at?: string } | null = null;
    let sessionData: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number } | null = null;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          role,
          company,
        },
        emailRedirectTo: `${env.CLIENT_URL}/verify-email`,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("exists")) {
        throw new ConflictError("An account with this email address already exists.");
      }
      if (error.message.toLowerCase().includes("rate limit")) {
        const adminRes = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          user_metadata: { full_name, role, company },
          email_confirm: false,
        });
        if (adminRes.error || !adminRes.data.user) {
          if (adminRes.error?.message?.toLowerCase().includes("already registered") || adminRes.error?.message?.toLowerCase().includes("exists")) {
            throw new ConflictError("An account with this email address already exists.");
          }
          throw new AppError(adminRes.error?.message || "Registration failed", 400, "REGISTRATION_FAILED");
        }
        createdUser = adminRes.data.user;
      } else {
        throw new AppError(error.message, 400, "REGISTRATION_FAILED");
      }
    } else if (data.user) {
      createdUser = data.user;
      if (data.session) {
        sessionData = data.session;
      }
    }

    if (!createdUser) {
      throw new AppError("Failed to create user account", 500, "REGISTRATION_FAILED");
    }

    // Ensure profile row exists in public.profiles
    try {
      await supabaseAdmin.from("profiles").upsert(
        {
          id: createdUser.id,
          full_name,
          avatar_url: null,
        },
        { onConflict: "id" }
      );
    } catch {
      // Non-blocking if trigger already created it
    }

    const isEmailVerified = Boolean(createdUser.email_confirmed_at);

    const user: AuthUser = {
      id: createdUser.id,
      email: createdUser.email ?? email,
      full_name,
      role: role ?? "Developer",
      company: company ?? null,
      avatar_url: null,
      isEmailVerified,
    };

    const resData: AuthResponseData = {
      user,
      isEmailVerified,
      ...(sessionData && isEmailVerified
        ? {
            session: {
              accessToken: sessionData.access_token,
              refreshToken: sessionData.refresh_token,
              expiresAt: sessionData.expires_at,
              expiresIn: sessionData.expires_in,
            },
          }
        : {}),
    };

    response.status(201).json({
      success: true,
      message: isEmailVerified
        ? "Account created successfully"
        : "Registration successful. Please check your email to verify your account.",
      data: resData,
    });
  }) as RequestHandler,

  login: (async (request, response) => {
    const { email, password } = loginSchema.parse(request.body);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      if (error?.message?.toLowerCase().includes("email not confirmed")) {
        return response.status(403).json({
          success: false,
          message: "Please verify your email before signing in.",
          error: {
            code: "EMAIL_NOT_VERIFIED",
            details: { email },
          },
          data: {
            isEmailVerified: false,
            email,
          },
        });
      }
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Email verification check
    if (!data.user.email_confirmed_at) {
      if (data.session) {
        await supabase.auth.signOut();
      }
      return response.status(403).json({
        success: false,
        message: "Please verify your email before signing in.",
        error: {
          code: "EMAIL_NOT_VERIFIED",
          details: { email: data.user.email },
        },
        data: {
          isEmailVerified: false,
          user: {
            id: data.user.id,
            email: data.user.email ?? email,
            full_name: (data.user.user_metadata?.full_name as string) || null,
            role: (data.user.user_metadata?.role as string) || "Developer",
            company: (data.user.user_metadata?.company as string) || null,
            avatar_url: (data.user.user_metadata?.avatar_url as string) || null,
            isEmailVerified: false,
          },
        },
      });
    }

    // Ensure profile row exists
    let profileFullName: string | null = null;
    let profileAvatarUrl: string | null = null;
    try {
      const { data: profile } = await supabaseAdmin.from("profiles").select().eq("id", data.user.id).single();
      if (profile) {
        profileFullName = profile.full_name;
        profileAvatarUrl = profile.avatar_url;
      } else {
        await supabaseAdmin.from("profiles").upsert(
          {
            id: data.user.id,
            full_name: data.user.user_metadata?.full_name || null,
            avatar_url: data.user.user_metadata?.avatar_url || null,
          },
          { onConflict: "id" }
        );
      }
    } catch {
      // Ignore profile lookup error
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? email,
      full_name: profileFullName || (data.user.user_metadata?.full_name as string) || null,
      role: (data.user.user_metadata?.role as string) || "Developer",
      company: (data.user.user_metadata?.company as string) || null,
      avatar_url: profileAvatarUrl || (data.user.user_metadata?.avatar_url as string) || null,
      isEmailVerified: true,
    };

    return response.json({
      success: true,
      message: "Signed in successfully",
      data: {
        user,
        session: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresAt: data.session.expires_at,
          expiresIn: data.session.expires_in,
        },
        isEmailVerified: true,
      },
    });
  }) as RequestHandler,

  resendVerification: (async (request, response) => {
    const { email } = resendVerificationSchema.parse(request.body);

    // Check if user is already verified
    try {
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers();
      const user = userList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (user?.email_confirmed_at) {
        throw new ConflictError("Email is already verified. Please sign in.");
      }
    } catch (err) {
      if (err instanceof ConflictError) throw err;
      // Continue to resend if listing users fails
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${env.CLIENT_URL}/verify-email`,
      },
    });

    if (error) {
      if (error.status === 429 || error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("security purposes")) {
        throw new AppError("Too many resend attempts. Please wait 60 seconds before trying again.", 429, "RATE_LIMIT_EXCEEDED");
      }
      throw new AppError(error.message, 400, "RESEND_FAILED");
    }

    return response.json({
      success: true,
      message: "Verification email resent successfully. Please check your inbox.",
    });
  }) as RequestHandler,

  verifyEmail: (async (request, response) => {
    const { token_hash, code, token, type, email } = verifyEmailSchema.parse(request.body);

    let verifiedUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null;
    let verifiedSession: { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number } | null = null;

    if (token_hash) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: (type as "signup" | "email") || "signup",
      });
      if (error || !data.user) {
        const errMsg = error?.message || "Invalid or expired verification link";
        if (errMsg.toLowerCase().includes("expired")) {
          throw new AppError("Verification link has expired. Please request a new one.", 400, "LINK_EXPIRED");
        }
        throw new AppError(errMsg, 400, "VERIFICATION_FAILED");
      }
      verifiedUser = data.user;
      verifiedSession = data.session;
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error || !data.user) {
        throw new AppError(error?.message || "Verification code exchange failed", 400, "VERIFICATION_FAILED");
      }
      verifiedUser = data.user;
      verifiedSession = data.session;
    } else if (email && token) {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: (type as "signup" | "email") || "signup",
      });
      if (error || !data.user) {
        throw new AppError(error?.message || "Invalid OTP verification code", 400, "VERIFICATION_FAILED");
      }
      verifiedUser = data.user;
      verifiedSession = data.session;
    } else {
      throw new AppError("Missing verification credentials (token_hash, code, or email & OTP)", 400, "INVALID_VERIFICATION_PARAMS");
    }

    if (!verifiedUser) {
      throw new AppError("Failed to verify user", 400, "VERIFICATION_FAILED");
    }

    // Ensure profile row exists
    try {
      await supabaseAdmin.from("profiles").upsert(
        {
          id: verifiedUser.id,
          full_name: (verifiedUser.user_metadata?.full_name as string) || null,
          avatar_url: null,
        },
        { onConflict: "id" }
      );
    } catch {
      // Ignore
    }

    const user: AuthUser = {
      id: verifiedUser.id,
      email: verifiedUser.email ?? "",
      full_name: (verifiedUser.user_metadata?.full_name as string) || null,
      role: (verifiedUser.user_metadata?.role as string) || "Developer",
      company: (verifiedUser.user_metadata?.company as string) || null,
      avatar_url: null,
      isEmailVerified: true,
    };

    return response.json({
      success: true,
      message: "Email verified successfully.",
      data: {
        user,
        ...(verifiedSession
          ? {
              session: {
                accessToken: verifiedSession.access_token,
                refreshToken: verifiedSession.refresh_token,
                expiresAt: verifiedSession.expires_at,
                expiresIn: verifiedSession.expires_in,
              },
            }
          : {}),
        isEmailVerified: true,
      },
    });
  }) as RequestHandler,

  forgotPassword: (async (request, response) => {
    const { email } = forgotPasswordSchema.parse(request.body);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.CLIENT_URL}/reset-password`,
    });

    if (error) {
      if (error.status === 429) {
        throw new AppError("Too many password reset requests. Please wait a minute.", 429, "RATE_LIMIT_EXCEEDED");
      }
      throw new AppError(error.message, 400, "RESET_REQUEST_FAILED");
    }

    return response.json({
      success: true,
      message: "Password reset link sent to your email. Please check your inbox.",
    });
  }) as RequestHandler,

  resetPassword: (async (request, response) => {
    const { password, accessToken, token_hash, type } = resetPasswordSchema.parse(request.body);

    const authHeader = request.header("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : accessToken;

    if (token) {
      const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userRes.user) {
        throw new UnauthorizedError("Password reset session is invalid or has expired.");
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userRes.user.id, {
        password,
      });

      if (updateErr) {
        throw new AppError(updateErr.message, 400, "PASSWORD_UPDATE_FAILED");
      }

      return response.json({
        success: true,
        message: "Password has been updated successfully. Please sign in with your new password.",
      });
    }

    if (token_hash) {
      const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
        token_hash,
        type: (type as "recovery") || "recovery",
      });

      if (otpErr || !otpData.user) {
        throw new AppError("Invalid or expired password reset link.", 400, "INVALID_RESET_LINK");
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(otpData.user.id, {
        password,
      });

      if (updateErr) {
        throw new AppError(updateErr.message, 400, "PASSWORD_UPDATE_FAILED");
      }

      return response.json({
        success: true,
        message: "Password has been updated successfully. Please sign in with your new password.",
      });
    }

    throw new AppError("Authentication credentials missing for password reset.", 400, "MISSING_CREDENTIALS");
  }) as RequestHandler,

  me: (async (request, response) => {
    const authReq = request as unknown as AuthenticatedRequest;
    const { data: profile } = await supabaseAdmin.from("profiles").select().eq("id", authReq.userId).single();

    const user: AuthUser = {
      id: authReq.userId,
      email: authReq.user.email ?? "",
      full_name: profile?.full_name || (authReq.user.userMetadata?.full_name as string) || null,
      role: (authReq.user.userMetadata?.role as string) || "Developer",
      company: (authReq.user.userMetadata?.company as string) || null,
      avatar_url: profile?.avatar_url || (authReq.user.userMetadata?.avatar_url as string) || null,
      isEmailVerified: true,
    };

    return response.json({
      success: true,
      message: "Current user session retrieved",
      data: { user, isEmailVerified: true },
    });
  }) as RequestHandler,

  logout: (async (_request, response) => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Non-blocking
    }
    return response.json({
      success: true,
      message: "Logged out successfully",
    });
  }) as RequestHandler,
};
