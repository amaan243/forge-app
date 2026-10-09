import { Router } from "express";

const authResponses = { "200": { description: "Successful response" }, "400": { description: "Validation error" }, "401": { description: "Unauthorized" }, "403": { description: "Forbidden" }, "404": { description: "Not found" } };
const projectPath = { name: "projectId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const projectOperations = ["architecture", "repository", "dependencies", "drift", "playground", "documentation", "analytics", "exports", "timeline", "insights", "story"];
const paths: Record<string, unknown> = {
  "/auth/register": { post: { summary: "Register new user", responses: authResponses } },
  "/auth/login": { post: { summary: "Sign in with password", responses: authResponses } },
  "/auth/verify-email": { post: { summary: "Verify email with token_hash or OTP", responses: authResponses } },
  "/auth/resend-verification": { post: { summary: "Resend verification email", responses: authResponses } },
  "/auth/forgot-password": { post: { summary: "Request password reset email", responses: authResponses } },
  "/auth/reset-password": { post: { summary: "Reset password with token or token_hash", responses: authResponses } },
  "/auth/logout": { post: { summary: "Sign out and invalidate session", responses: authResponses } },
  "/auth/me": { get: { summary: "Current authenticated session", security: [{ bearerAuth: [] }], responses: authResponses } },
  "/me": { get: { summary: "Current user", security: [{ bearerAuth: [] }], responses: authResponses } },
  "/workspaces": { get: { summary: "List workspaces", security: [{ bearerAuth: [] }], responses: authResponses }, post: { summary: "Create workspace", security: [{ bearerAuth: [] }], responses: authResponses } },
  "/projects": { get: { summary: "List projects", security: [{ bearerAuth: [] }], responses: authResponses }, post: { summary: "Create project", security: [{ bearerAuth: [] }], responses: authResponses } },
  "/search": { get: { summary: "Authorized global search", security: [{ bearerAuth: [] }], parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }], responses: authResponses } },
  "/notifications": { get: { summary: "List notifications", security: [{ bearerAuth: [] }], responses: authResponses }, post: { summary: "Mark all notifications read", security: [{ bearerAuth: [] }], responses: authResponses } },
  "/settings": { get: { summary: "Get user settings", security: [{ bearerAuth: [] }], responses: authResponses }, patch: { summary: "Update user settings", security: [{ bearerAuth: [] },], responses: authResponses } },
};
for (const operation of projectOperations) {
  paths[`/projects/{projectId}/${operation}`] = { get: { summary: `Get ${operation}`, security: [{ bearerAuth: [] }], parameters: [projectPath], responses: authResponses }, post: { summary: `Create or generate ${operation}`, security: [{ bearerAuth: [] }], parameters: [projectPath], responses: authResponses } };
}
paths["/projects/{projectId}/drift/analyze"] = { post: { summary: "Run architecture drift analysis comparing snapshot and architecture version", security: [{ bearerAuth: [] }], parameters: [projectPath], responses: authResponses } };
paths["/projects/{projectId}/drift/{analysisId}"] = { get: { summary: "Get drift analysis by ID with findings", security: [{ bearerAuth: [] }], parameters: [projectPath, { name: "analysisId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: authResponses } };
paths["/projects/{projectId}/drift/{analysisId}/findings"] = { get: { summary: "List drift findings with optional filters", security: [{ bearerAuth: [] }], parameters: [projectPath, { name: "analysisId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: authResponses } };
paths["/projects/{projectId}/drift/{analysisId}/findings/{findingId}"] = { get: { summary: "Get drift finding evidence details", security: [{ bearerAuth: [] }], parameters: [projectPath, { name: "analysisId", in: "path", required: true, schema: { type: "string", format: "uuid" } }, { name: "findingId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: authResponses } };
paths["/projects/{projectId}/drift/{analysisId}/remediation"] = { post: { summary: "Generate drift remediation plan", security: [{ bearerAuth: [] }], parameters: [projectPath, { name: "analysisId", in: "path", required: true, schema: { type: "string", format: "uuid" } }], responses: authResponses } };

export const openApiRoutes = Router();
openApiRoutes.get("/", (_request, response) => response.json({ openapi: "3.0.3", info: { title: "ARCHFORGE API", version: "1.0.0", description: "ARCHFORGE versioned API. All project operations require an authenticated project member; mutations require editor/admin authorization." }, servers: [{ url: "/api/v1" }], security: [{ bearerAuth: [] }], components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } }, paths }));
