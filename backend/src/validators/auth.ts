import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  full_name: z.string().trim().min(1, "Full name is required").max(120),
  role: z.string().trim().max(80).optional().default("Developer"),
  company: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export const verifyEmailSchema = z.object({
  token_hash: z.string().optional(),
  token: z.string().optional(),
  code: z.string().optional(),
  type: z.string().optional().default("signup"),
  email: z.string().trim().email().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long"),
  accessToken: z.string().optional(),
  token_hash: z.string().optional(),
  type: z.string().optional().default("recovery"),
});

export const exchangeCodeSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});
