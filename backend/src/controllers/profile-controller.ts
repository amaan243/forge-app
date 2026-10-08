import type { RequestHandler } from "express";
import { supabaseAdmin } from "../lib/supabase.js";
import type { AuthenticatedRequest } from "../types/api.js";
import { profileUpdate } from "../validators/profile.js";
export const profileController = {
  me: ((request, response) => response.json({ success: true, message: "Current user retrieved", data: (request as unknown as AuthenticatedRequest).user })) as RequestHandler,
  profile: (async (request, response) => { const { data, error } = await supabaseAdmin.from("profiles").select().eq("id", (request as unknown as AuthenticatedRequest).userId).single(); if (error) throw error; response.json({ success: true, message: "Profile retrieved", data }); }) as RequestHandler,
  update: (async (request, response) => { const { data, error } = await supabaseAdmin.from("profiles").update(profileUpdate.parse(request.body)).eq("id", (request as unknown as AuthenticatedRequest).userId).select().single(); if (error) throw error; response.json({ success: true, message: "Profile updated", data }); }) as RequestHandler,
};