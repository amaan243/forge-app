import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../lib/logger.js";

export const requestContext: RequestHandler = (request, response, next) => {
  const requestId = request.header("x-request-id") ?? randomUUID();
  request.requestId = requestId; response.setHeader("x-request-id", requestId);
  const start = Date.now();
  response.on("finish", () => logger.info("HTTP request", { requestId, method: request.method, route: request.originalUrl, statusCode: response.statusCode, durationMs: Date.now() - start, userId: request.userId }));
  next();
};