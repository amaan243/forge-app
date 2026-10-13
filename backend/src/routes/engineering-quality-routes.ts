import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  requireProjectMember,
  requireProjectEditor,
  requireProjectAdmin,
} from "../middleware/project-auth.js";
import { engineeringQualityController } from "../controllers/engineering-quality-controller.js";

export const qualityRoutes = Router({ mergeParams: true });

qualityRoutes.use(requireAuth);

qualityRoutes.get("/quality/context", requireProjectMember, engineeringQualityController.getContext);
qualityRoutes.post("/quality/evaluate", requireProjectEditor, engineeringQualityController.evaluate);
qualityRoutes.get("/quality/reports", requireProjectMember, engineeringQualityController.listReports);
qualityRoutes.get("/quality/reports/:reportId", requireProjectMember, engineeringQualityController.getReport);
qualityRoutes.post("/quality/evidence", requireProjectEditor, engineeringQualityController.recordEvidence);
qualityRoutes.get("/quality/evidence", requireProjectMember, engineeringQualityController.listEvidence);
qualityRoutes.get("/quality/policies", requireProjectMember, engineeringQualityController.getPolicies);
qualityRoutes.put("/quality/policies/:policyId", requireProjectAdmin, engineeringQualityController.updatePolicy);
