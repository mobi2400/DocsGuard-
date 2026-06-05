import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

env.allowLocalModels = false;
env.useBrowserCache = false;

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

type EmbedderFn = (text: string) => Promise<Float32Array>;

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (pipelinePromise === null) {
    pipelinePromise = pipeline("feature-extraction", EMBEDDING_MODEL);
  }
  return pipelinePromise;
}

export async function getEmbedder(): Promise<EmbedderFn> {
  const pipe = await getPipeline();
  return async (text: string): Promise<Float32Array> => {
    const output = await pipe(text, { pooling: "mean", normalize: true });
    const data = output.data as Float32Array;
    return new Float32Array(data);
  };
}

export async function embedAll(texts: readonly string[]): Promise<Float32Array[]> {
  const embedder = await getEmbedder();
  const out: Float32Array[] = [];
  for (const text of texts) {
    out.push(await embedder(text));
  }
  return out;
}

export function resetPipeline(): void {
  pipelinePromise = null;
}
