import { PermanentError } from "../errors";
import type { SourceProvider } from "./types";
import { wikipediaBg } from "./wikipedia";

export const PROVIDERS: Record<string, SourceProvider> = {
  [wikipediaBg.key]: wikipediaBg,
};

export const DEFAULT_PROVIDER = wikipediaBg.key;

export function getProvider(key: string): SourceProvider {
  const p = PROVIDERS[key];
  if (!p) throw new PermanentError(`Непознат доставчик на източници „${key}“`);
  return p;
}

export type { Candidate, FetchedDocument, SourceProvider } from "./types";
