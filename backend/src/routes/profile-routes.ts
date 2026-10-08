import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { profileController } from "../controllers/profile-controller.js";
export const profileRoutes = Router();
profileRoutes.use(requireAuth);
profileRoutes.get("/", profileController.me);
profileRoutes.patch("/", profileController.update);
profileRoutes.get("/profile", profileController.profile);
profileRoutes.patch("/profile", profileController.update);