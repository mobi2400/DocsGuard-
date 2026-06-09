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

function isRetryable(err: unknown): boolean {
  if (err instanceof LlmTimeoutError) return false;
  const e = err as { status?: number; code?: string } | null;
  if (e === null) return false;
  if (typeof e.status === "number" && e.status >= 500 && e.status < 600) return true;
  if (e.code === "ECONNRESET" || e.code === "ETIMEDOUT" || e.code === "ENOTFOUND") return true;
  return false;
}

const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGroqProvider(opts: GroqProviderOptions): LlmProvider {
  if (opts.apiKey.length === 0) {
    throw new LlmAuthError("Missing GROQ_API_KEY");
  }
  const client = new Groq({ apiKey: opts.apiKey });

  return {
    name: "groq",
    async complete(messages: readonly LlmMessage[], cfg: LlmCompleteOptions): Promise<string> {
      const makeCall = (): Promise<string> => {
        const call = client.chat.completions.create({
          model: cfg.model,
          temperature: cfg.temperature ?? 0,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          ...(cfg.responseFormat === "json_object"
            ? { response_format: { type: "json_object" as const } }
            : {}),
        });
        return withTimeout(call, cfg.timeoutMs).then((result) => {
          const text = result.choices[0]?.message?.content;
          return typeof text === "string" ? text : "";
        });
      };

      try {
        return await makeCall();
      } catch (err) {
        if (!isRetryable(err)) throw err;
        await sleep(RETRY_DELAY_MS);
        return await makeCall();
      }
    },
  };
}
