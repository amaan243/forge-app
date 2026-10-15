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
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/drift",
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/drift/00000000-0000-0000-0000-000000000002/findings",
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/quality/context",
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/quality/reports",
      "/api/v1/projects/00000000-0000-0000-0000-000000000001/exports",
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

  it("protects global search, notifications, settings, and node explanation endpoints", async () => {
    expect((await request(app).get("/api/v1/search?q=api")).status).toBe(401);
    expect((await request(app).get("/api/v1/notifications")).status).toBe(401);
    expect((await request(app).patch("/api/v1/notifications/00000000-0000-0000-0000-000000000001/read")).status).toBe(401);
    expect((await request(app).post("/api/v1/notifications/read-all")).status).toBe(401);
    expect((await request(app).get("/api/v1/settings")).status).toBe(401);
    expect((await request(app).patch("/api/v1/settings").send({ theme: "dark" })).status).toBe(401);
    expect((await request(app).post("/api/v1/projects/00000000-0000-0000-0000-000000000001/architecture/nodes/00000000-0000-0000-0000-000000000002/explain")).status).toBe(401);
    expect((await request(app).post("/api/v1/projects/00000000-0000-0000-0000-000000000001/design-review")).status).toBe(401);
    expect((await request(app).patch("/api/v1/projects/00000000-0000-0000-0000-000000000001/architecture/versions/00000000-0000-0000-0000-000000000002/edges/00000000-0000-0000-0000-000000000003").send({ label: "calls" })).status).toBe(401);
  });

  it("handles CORS preflight and headers for deployed Vercel frontend", async () => {
    const origin = "https://forge-app-client.vercel.app";
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type,Authorization");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toBeDefined();
  });

  it("handles CORS preflight for local development origin", async () => {
    const origin = "http://localhost:5173";
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("handles CORS preflight for preview Vercel deployments", async () => {
    const origin = "https://forge-app-client-feat-preview.vercel.app";
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("rejects unauthorized origins from receiving CORS headers", async () => {
    const response = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "https://malicious-attacker.com")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("handles preflight for Google OAuth redirect endpoint", async () => {
    const origin = "https://forge-app-client.vercel.app";
    const response = await request(app)
      .options("/api/v1/auth/oauth/google/redirect")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "Content-Type,Authorization");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("returns Google OAuth initiation JSON format for /oauth/google and /oauth/google/redirect", async () => {
    const origin = "https://forge-app-client.vercel.app";

    // Test primary route
    const res1 = await request(app)
      .get("/api/v1/auth/oauth/google")
      .set("Origin", origin)
      .set("Accept", "application/json");

    expect(res1.status).toBe(200);
    expect(res1.headers["access-control-allow-origin"]).toBe(origin);
    expect(res1.headers["access-control-allow-credentials"]).toBe("true");
    expect(res1.body).toMatchObject({
      success: true,
      message: "OAuth URL generated",
      data: {
        provider: "google",
        url: expect.stringContaining("supabase.co"),
      },
    });

    // Test /redirect alias route
    const res2 = await request(app)
      .get("/api/v1/auth/oauth/google/redirect")
      .set("Origin", origin)
      .set("Accept", "application/json");

    expect(res2.status).toBe(200);
    expect(res2.headers["access-control-allow-origin"]).toBe(origin);
    expect(res2.headers["access-control-allow-credentials"]).toBe("true");
    expect(res2.body).toMatchObject({
      success: true,
      message: "OAuth URL generated",
      data: {
        provider: "google",
        url: expect.stringContaining("supabase.co"),
      },
    });
  });

  it("ensures error responses from allowed origins retain CORS headers", async () => {
    const origin = "https://forge-app-client.vercel.app";
    const response = await request(app)
      .get("/api/v1/does-not-exist")
      .set("Origin", origin);

    expect(response.status).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});