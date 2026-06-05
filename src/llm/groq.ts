import Groq from "groq-sdk";
import {
  LlmAuthError,
  LlmTimeoutError,
  type LlmCompleteOptions,
  type LlmMessage,
  type LlmProvider,
} from "./provider.js";

export interface GroqProviderOptions {
  readonly apiKey: string;
}

function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new LlmTimeoutError(timeoutMs)), timeoutMs);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

export function createGroqProvider(opts: GroqProviderOptions): LlmProvider {
  if (opts.apiKey.length === 0) {
    throw new LlmAuthError("Missing GROQ_API_KEY");
  }
  const client = new Groq({ apiKey: opts.apiKey });

  return {
    name: "groq",
    async complete(messages: readonly LlmMessage[], cfg: LlmCompleteOptions): Promise<string> {
      const call = client.chat.completions.create({
        model: cfg.model,
        temperature: cfg.temperature ?? 0,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...(cfg.responseFormat === "json_object"
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });

      const result = await withTimeout(call, cfg.timeoutMs);
      const text = result.choices[0]?.message?.content;
      return typeof text === "string" ? text : "";
    },
  };
}
