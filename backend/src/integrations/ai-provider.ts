import { env } from "../config/env.js";
import { GroqAIProvider } from "./groq-provider.js";

export interface AIProvider {
  generate(input: { requirements: string; projectName?: string }): Promise<unknown>;
  analyze(input: { requirements: string }): Promise<unknown>;
  structuredOutput<T>(input: { prompt: string; schema: unknown; systemPrompt?: string; maxTokens?: number }): Promise<T>;
  isAvailable?(): boolean;
}

export class UnsupportedAIProvider implements AIProvider {
  isAvailable(): boolean {
    return false;
  }
  async generate(input: { requirements: string; projectName?: string }): Promise<unknown> {
    void input;
    throw new Error("No AI provider is configured");
  }
  async analyze(input: { requirements: string }): Promise<unknown> {
    void input;
    throw new Error("No AI provider is configured");
  }
  async structuredOutput<T>(input: { prompt: string; schema: unknown }): Promise<T> {
    void input;
    throw new Error("No AI provider is configured");
  }
}

/**
 * Returns the currently active AI provider based on AI_PROVIDER environment variable.
 * Defaults to Groq when configured with an API key, otherwise falls back to UnsupportedAIProvider.
 */
export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER || env.AI_PROVIDER || "none").toLowerCase();
  const apiKey =
    process.env.GROQ_API_KEY ||
    env.GROQ_API_KEY ||
    process.env.AI_API_KEY ||
    env.AI_API_KEY ||
    "";

  if (provider === "groq" && apiKey.trim().length > 0) {
    return new GroqAIProvider({
      apiKey,
      model: process.env.GROQ_MODEL || env.GROQ_MODEL || "openai/gpt-oss-20b",
    });
  }

  return new UnsupportedAIProvider();
}

/**
 * Checks whether a live AI provider (Groq) is configured and ready to execute requests.
 */
export function isAIConfigured(): boolean {
  const provider = (process.env.AI_PROVIDER || env.AI_PROVIDER || "none").toLowerCase();
  const apiKey =
    process.env.GROQ_API_KEY ||
    env.GROQ_API_KEY ||
    process.env.AI_API_KEY ||
    env.AI_API_KEY ||
    "";
  return provider === "groq" && apiKey.trim().length > 0;
}