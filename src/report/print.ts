import type { CheckOutcome } from "../types/result.js";
import { formatOutcome } from "./format.js";

export function printOutcome(outcome: CheckOutcome, write: (s: string) => void = (s) => process.stdout.write(s)): void {
  write(`${formatOutcome(outcome)}\n`);
}
