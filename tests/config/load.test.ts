import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config/load.js";
import { ConfigError, ConfigNotFoundError } from "../../src/utils/errors.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "docguard-cfg-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeConfig(content: string): void {
  writeFileSync(join(dir, ".docguard.json"), content, "utf8");
}

describe("loadConfig", () => {
  it("throws ConfigNotFoundError when file is missing", async () => {
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigNotFoundError);
  });

  it("loads a valid full config", async () => {
    writeConfig(JSON.stringify(DEFAULT_CONFIG));
    const { config, path } = await loadConfig({ cwd: dir });
    expect(path).toBe(join(dir, ".docguard.json"));
    expect(config.llm.provider).toBe("groq");
    expect(config.severity.security).toBe("block");
  });

  it("merges a partial config with defaults", async () => {
    writeConfig(JSON.stringify({ docs: ["./d/*.md"], severity: { security: "warn" } }));
    const { config } = await loadConfig({ cwd: dir });
    expect(config.docs).toEqual(["./d/*.md"]);
    expect(config.severity.security).toBe("warn");
    expect(config.severity.architecture).toBe(DEFAULT_CONFIG.severity.architecture);
    expect(config.timeoutMs).toBe(DEFAULT_CONFIG.timeoutMs);
  });

  it("rejects malformed JSON", async () => {
    writeConfig("{ not json");
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigError);
  });

  it("rejects unknown severity values", async () => {
    writeConfig(JSON.stringify({ severity: { security: "explode" } }));
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigError);
  });

  it("rejects extra unknown fields (strict)", async () => {
    writeConfig(JSON.stringify({ ...DEFAULT_CONFIG, mystery: 1 }));
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigError);
  });

  it("rejects out-of-range retrieval values", async () => {
    writeConfig(JSON.stringify({ retrieval: { topK: 0, minScore: 0.5 } }));
    await expect(loadConfig({ cwd: dir })).rejects.toBeInstanceOf(ConfigError);
  });
});
