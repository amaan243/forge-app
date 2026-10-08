import type { RequestHandler } from "express";
import { architectureRepository } from "../repositories/architecture-repository.js";
export const timelineController: RequestHandler = async (request, res) => { res.json({ success: true, message: "Timeline retrieved", data: await architectureRepository.timeline(String(request.params.projectId)) }); };