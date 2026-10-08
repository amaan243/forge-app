import type { NextFunction, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { UnauthorizedError } from "../errors/app-error.js";
import type { AuthenticatedRequest, AuthenticatedUser } from "../types/api.js";

export async function requireAuth(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try {
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedError();
    const { data, error } = await supabase.auth.getUser(header.slice(7));
    if (error || !data.user) throw new UnauthorizedError();
    const user: AuthenticatedUser = { id: data.user.id, email: data.user.email, role: data.user.role, userMetadata: data.user.user_metadata as Record<string, unknown> };
    const authenticated = request as unknown as AuthenticatedRequest;
    authenticated.user = user; authenticated.userId = user.id;
    next();
  } catch (error) { next(error); }
}