import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { platformController } from "../controllers/platform-operations-controller.js";
export const searchRoutes = Router();
searchRoutes.use(requireAuth);
searchRoutes.get("/", platformController.search);