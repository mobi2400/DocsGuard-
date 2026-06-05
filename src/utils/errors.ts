export class DocGuardError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DocGuardError";
    this.code = code;
  }
}

export class ConfigError extends DocGuardError {
  constructor(message: string) {
    super("CONFIG_INVALID", message);
    this.name = "ConfigError";
  }
}

export class ConfigNotFoundError extends DocGuardError {
  constructor(path: string) {
    super("CONFIG_NOT_FOUND", `No .docguard.json found at ${path}. Run \`docguard init\` first.`);
    this.name = "ConfigNotFoundError";
  }
}
