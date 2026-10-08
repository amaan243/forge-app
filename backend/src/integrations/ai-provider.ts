export interface AIProvider {
  generate(input: { requirements: string }): Promise<unknown>;
  analyze(input: { requirements: string }): Promise<unknown>;
  structuredOutput<T>(input: { prompt: string; schema: unknown }): Promise<T>;
}

export class UnsupportedAIProvider implements AIProvider {
  async generate(input: { requirements: string }): Promise<unknown> { void input; throw new Error("No AI provider is configured"); }
  async analyze(input: { requirements: string }): Promise<unknown> { void input; throw new Error("No AI provider is configured"); }
  async structuredOutput<T>(input: { prompt: string; schema: unknown }): Promise<T> { void input; throw new Error("No AI provider is configured"); }
}