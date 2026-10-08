import { Router } from "express";
import { authController } from "../controllers/auth-controller.js";
import { requireAuth } from "../middleware/auth.js";

export const authRoutes = Router();

authRoutes.post("/register", authController.register);
authRoutes.post("/login", authController.login);
authRoutes.post("/verify-email", authController.verifyEmail);
authRoutes.post("/resend-verification", authController.resendVerification);
authRoutes.post("/forgot-password", authController.forgotPassword);
authRoutes.post("/reset-password", authController.resetPassword);
authRoutes.get("/me", requireAuth, authController.me);
authRoutes.post("/logout", authController.logout);
