import { z } from "zod";

export const CATEGORIES = ["security", "architecture", "api-contract", "naming", "style"] as const;
export type Category = (typeof CATEGORIES)[number];

export const SEVERITIES = ["pass", "warn", "block"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const PRIORITIES = ["critical", "normal", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PROVIDERS = ["groq"] as const;
export type Provider = (typeof PROVIDERS)[number];

const severitySchema = z.enum(SEVERITIES);
const prioritySchema = z.enum(PRIORITIES);

export const severityMapSchema = z
  .object({
    security: severitySchema,
    architecture: severitySchema,
    "api-contract": severitySchema,
    naming: severitySchema,
    style: severitySchema,
  })
  .strict();

export const llmConfigSchema = z
  .object({
    provider: z.enum(PROVIDERS),
    model: z.string().min(1),
  })
  .strict();

export const retrievalConfigSchema = z
  .object({
    topK: z.number().int().positive().max(50),
    minScore: z.number().min(0).max(1),
  })
  .strict();

export const configSchema = z
  .object({
    docs: z.array(z.string().min(1)).min(1),
    ignore: z.array(z.string().min(1)),
    severity: severityMapSchema,
    priority: z.record(z.string().min(1), prioritySchema),
    llm: llmConfigSchema,
    retrieval: retrievalConfigSchema,
    timeoutMs: z.number().int().positive().max(60_000),
  })
  .strict();

export const partialConfigSchema = z
  .object({
    docs: z.array(z.string().min(1)).min(1).optional(),
    ignore: z.array(z.string().min(1)).optional(),
    severity: severityMapSchema.partial().optional(),
    priority: z.record(z.string().min(1), prioritySchema).optional(),
    llm: llmConfigSchema.partial().optional(),
    retrieval: retrievalConfigSchema.partial().optional(),
    timeoutMs: z.number().int().positive().max(60_000).optional(),
  })
  .strict();

export type DocGuardConfig = z.infer<typeof configSchema>;
export type PartialDocGuardConfig = z.infer<typeof partialConfigSchema>;
export type SeverityMap = z.infer<typeof severityMapSchema>;
export type LlmConfig = z.infer<typeof llmConfigSchema>;
export type RetrievalConfig = z.infer<typeof retrievalConfigSchema>;

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
