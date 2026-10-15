import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../errors/app-error.js";
import { logger } from "../lib/logger.js";
import type { ApiResponse } from "../types/api.js";
import { isAllowedOrigin } from "../config/cors.js";

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;
  const origin = request.headers.origin;
  if (origin && isAllowedOrigin(origin) && !response.headersSent) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
  }
  const normalized = error instanceof ZodError ? new ValidationError(error.flatten()) : error instanceof AppError ? error : new AppError("An unexpected error occurred");
  if (normalized.statusCode >= 500) logger.error("Unhandled request error", { requestId: request.requestId, error });
  const body: ApiResponse<never> = { success: false, message: normalized.message, error: { code: normalized.code, ...(normalized.details === undefined ? {} : { details: normalized.details }) } };
  response.status(normalized.statusCode).json(body);
};