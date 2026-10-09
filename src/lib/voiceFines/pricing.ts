/** Priser pr. 1M tokens i USD. Justér hvis udbyderne ændrer satser. */
export const USD_TO_DKK = 6.9;

export const TRANSCRIBE_RATES = {
  audioIn: 6.0,
  textIn: 2.5,
  textOut: 10.0
} as const;

export const PARSE_RATES = {
  input: 0.15,
  output: 0.6,
  cacheRead: 0.075,
  cacheWrite: 0
} as const;

export type TranscribeUsage = {
  audioIn: number;
  textIn: number;
  textOut: number;
};

export type ParseUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export const emptyTranscribeUsage = (): TranscribeUsage => ({ audioIn: 0, textIn: 0, textOut: 0 });
export const emptyParseUsage = (): ParseUsage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });

export function transcribeCostUsd(u: TranscribeUsage): number {
  return (
    (u.audioIn * TRANSCRIBE_RATES.audioIn + u.textIn * TRANSCRIBE_RATES.textIn + u.textOut * TRANSCRIBE_RATES.textOut) /
    1_000_000
  );
}

export function parseCostUsd(u: ParseUsage): number {
  return (
    (u.input * PARSE_RATES.input +
      u.output * PARSE_RATES.output +
      u.cacheRead * PARSE_RATES.cacheRead +
      u.cacheWrite * PARSE_RATES.cacheWrite) /
    1_000_000
  );
}

export function usdToDkk(usd: number): number {
  return usd * USD_TO_DKK;
}
