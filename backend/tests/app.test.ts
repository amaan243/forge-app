import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("API foundation", () => {
  it("reports health", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("rejects protected requests without a bearer token", async () => {
    const response = await request(app).get("/api/v1/me");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rejects invalid JSON domain input after authentication boundary", async () => {
    const response = await request(app).post("/api/v1/workspaces").send({ name: "" });
    expect(response.status).toBe(401);
  });

  it("returns a consistent not-found response", async () => {
    const response = await request(app).get("/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
  });

  it("protects architecture endpoints with project authentication", async () => {
    const response = await request(app).get("/api/v1/projects/00000000-0000-0000-0000-000000000001/architecture");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("protects playground, documentation, story, and insights endpoints", async () => {
    for (const path of [
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/playground",
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/documentation",
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/story",
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/insights",
    ]) { const response = await request(app).get(path); expect(response.status).toBe(401); }
  });

  it("exposes OpenAPI documentation without requiring project authorization", async () => {
    const response = await request(app).get("/api/docs");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it("returns a readiness contract", async () => {
    const response = await request(app).get("/ready");
    expect([200, 503]).toContain(response.status);
    expect(response.body).toMatchObject({ status: expect.any(String), database: expect.any(String), redis: expect.any(String) });
  });

  it("protects global search and notifications", async () => {
    expect((await request(app).get("/api/v1/search?q=api")).status).toBe(401);
    expect((await request(app).get("/api/v1/notifications")).status).toBe(401);
  });
});