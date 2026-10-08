export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR", details?: unknown) {
    super(message); this.name = "AppError"; this.statusCode = statusCode; this.code = code; this.details = details;
  }
}
export class NotFoundError extends AppError { constructor(message = "Resource not found") { super(message, 404, "NOT_FOUND"); } }
export class UnauthorizedError extends AppError { constructor(message = "Authentication required") { super(message, 401, "UNAUTHORIZED"); } }
export class ForbiddenError extends AppError { constructor(message = "You do not have permission to perform this action") { super(message, 403, "FORBIDDEN"); } }
export class ValidationError extends AppError { constructor(details: unknown) { super("Request validation failed", 400, "VALIDATION_ERROR", details); } }
export class ConflictError extends AppError { constructor(message: string) { super(message, 409, "CONFLICT"); } }