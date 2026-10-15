import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestContext } from "./middleware/request-context.js";
import { profileRoutes } from "./routes/profile-routes.js";
import { projectRoutes } from "./routes/project-routes.js";
import { workspaceRoutes } from "./routes/workspace-routes.js";
import { architectureRoutes } from "./routes/architecture-routes.js";
import { repositoryIntelligenceRoutes } from "./routes/repository-intelligence-routes.js";
import { engineeringRoutes } from "./routes/engineering-intelligence-routes.js";
import { platformRoutes, notificationRoutes, settingsRoutes, workspaceSettingsRoutes } from "./routes/platform-operations-routes.js";
import { workflowRoutes } from "./routes/workflow-orchestration-routes.js";
import { knowledgeGraphRoutes } from "./routes/knowledge-graph-routes.js";
import { searchRoutes } from "./routes/search-routes.js";
import { openApiRoutes } from "./routes/openapi-routes.js";
import { authRoutes } from "./routes/auth-routes.js";
import { qualityRoutes } from "./routes/engineering-quality-routes.js";
import { Redis } from "ioredis";
import { supabaseAdmin } from "./lib/supabase.js";
export const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const defaultAllowedOrigins = [
  "https://forge-app-client.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

function sanitizeOrigin(urlStr: string): string {
  return urlStr.trim().replace(/\/+$/, "");
}

function parseOrigins(...inputs: (string | undefined)[]): string[] {
  const result: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    for (const part of input.split(",")) {
      const sanitized = sanitizeOrigin(part);
      if (sanitized) result.push(sanitized);
    }
  }
  return result;
}

const explicitOrigins = new Set([
  ...defaultAllowedOrigins,
  ...parseOrigins(env.CLIENT_URL, env.FRONTEND_URL, env.ALLOWED_ORIGINS),
]);

function isAllowedOrigin(origin: string): boolean {
  const sanitized = sanitizeOrigin(origin);
  if (explicitOrigins.has(sanitized)) return true;
  if (/^https:\/\/forge-app-client(-[a-z0-9\-]+)?\.vercel\.app$/i.test(sanitized)) {
    return true;
  }
  if (env.ALLOWED_ORIGINS === "*") return true;
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "x-request-id",
    ],
    optionsSuccessStatus: 204,
  })
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(requestContext);
app.use(rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX, standardHeaders: "draft-8", legacyHeaders: false }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/me", profileRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/projects/:projectId/architecture", architectureRoutes);
app.use("/api/v1/projects/:projectId", repositoryIntelligenceRoutes);
app.use("/api/v1/projects/:projectId", engineeringRoutes);
app.use("/api/v1/projects/:projectId", workflowRoutes);
app.use("/api/v1/projects/:projectId", knowledgeGraphRoutes);
app.use("/api/v1/projects/:projectId", platformRoutes);
app.use("/api/v1/projects/:projectId", qualityRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/workspaces/:workspaceId/settings", workspaceSettingsRoutes);
app.use("/api/v1/search", searchRoutes);
app.use("/api/docs", openApiRoutes);
async function dependencyHealth(): Promise<{ database: "ok" | "unavailable"; redis: "ok" | "unavailable" }> { let database: "ok" | "unavailable" = "ok"; let redis: "ok" | "unavailable" = "ok"; try { await Promise.race([supabaseAdmin.from("profiles").select("id").limit(1), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("database health timeout")), 1000))]); } catch { database = "unavailable"; } try { const client = new Redis(env.REDIS_URL, { lazyConnect: true, connectTimeout: 1000, maxRetriesPerRequest: 0 }); client.on("error", () => undefined); await client.connect(); await client.ping(); await client.quit(); } catch { redis = "unavailable"; } return { database, redis }; }
app.get("/health", async (_request, response) => { const dependencies = await dependencyHealth(); response.json({ success: true, status: "ok", ...dependencies, timestamp: new Date().toISOString() }); });
app.get("/ready", async (_request, response) => { const dependencies = await dependencyHealth(); const ready = dependencies.database === "ok" && dependencies.redis === "ok"; response.status(ready ? 200 : 503).json({ success: ready, status: ready ? "ok" : "unavailable", ...dependencies, timestamp: new Date().toISOString() }); });
app.use((_request, response) => response.status(404).json({ success: false, message: "Route not found", error: { code: "NOT_FOUND" } }));
app.use(errorHandler);