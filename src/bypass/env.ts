export const BYPASS_ENV_VAR = "DOCGUARD_BYPASS";

export function bypassRequested(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env[BYPASS_ENV_VAR];
  if (v === undefined) return false;
  const norm = v.trim().toLowerCase();
  return norm === "1" || norm === "true" || norm === "yes";
}
