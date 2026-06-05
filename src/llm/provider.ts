export interface LlmMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface LlmCompleteOptions {
  readonly model: string;
  readonly temperature?: number;
  readonly timeoutMs: number;
  readonly responseFormat?: "json_object" | "text";
}

export interface LlmProvider {
  readonly name: string;
  complete(messages: readonly LlmMessage[], opts: LlmCompleteOptions): Promise<string>;
}

export class LlmTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM call exceeded ${String(timeoutMs)}ms`);
    this.name = "LlmTimeoutError";
  }
}

export class LlmAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmAuthError";
  }
}
