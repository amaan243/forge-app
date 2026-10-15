import type { CorsOptions } from "cors";
import { env } from "./env.js";

export const defaultAllowedOrigins = [
  "https://forge-app-client.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

export function sanitizeOrigin(urlStr: string): string {
  return urlStr.trim().replace(/\/+$/, "");
}

export function parseOrigins(...inputs: (string | undefined)[]): string[] {
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

export const explicitOrigins = new Set([
  ...defaultAllowedOrigins,
  ...parseOrigins(env.CLIENT_URL, env.FRONTEND_URL, env.ALLOWED_ORIGINS),
]);

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  const sanitized = sanitizeOrigin(origin);
  if (explicitOrigins.has(sanitized)) return true;
  if (/^https:\/\/forge-app-client(-[a-z0-9\-]+)?\.vercel\.app$/i.test(sanitized)) {
    return true;
  }
  if (env.ALLOWED_ORIGINS === "*") return true;
  return false;
}

export const corsOptions: CorsOptions = {
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
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};
