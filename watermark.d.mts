export type CoefficientPair = [[number, number], [number, number]];
export interface WatermarkOptions {
  /** DCT coefficient difference. Default 100; range 4..200. */
  strength?: number;
  /** Odd repetition count 1..31. Default 7. */
  redundancy?: number;
  /** Supported blind-decoding block sizes. Default 8. */
  blockSize?: 8 | 16;
  /** Default [[1,2],[2,1]], equal-frequency low/mid-band pair. */
  coefficients?: CoefficientPair;
  /** Fixed long edge, 64..4096. If omitted, auto-fit starts at 1200. */
  maxDimension?: number;
  /** Default true. False resamples the encoded canvas to input dimensions. */
  outputCanonicalizedImage?: boolean;
}
export interface DecodeOptions {
  /** Replaces built-in candidates; native input dimensions are always tried. */
  maxDimensions?: number[];
  /** Replaces the three built-in sync/header pairs. */
  coefficientPairs?: CoefficientPair[];
}
export interface DecodeAttempt {
  width: number;
  height: number;
  blockSize: number;
  coefficientPair: number[];
  phase?: [number, number];
  legacy?: boolean;
  redundancy?: number;
  score?: number;
  magicOk: boolean;
  headerCrcOk?: boolean;
  /** True only after body CRC, decompression and JSON parsing all succeed. */
  crcOk: boolean;
  markerScores?: number[];
  uncertainFraction?: number;
  voting?: 'soft' | 'hard' | 'erasure';
  error?: string;
}
export interface DecodeDebugInfo {
  inputWidth: number;
  inputHeight: number;
  triedNormalizations: DecodeAttempt[];
}
/** Failed extraction throws Error with a debug property (after image decoding). */
export function extractJsonFromImageDetailed(image: Blob, options?: DecodeOptions): Promise<{ json: unknown; debug: DecodeDebugInfo }>;
export function embedJsonIntoImage(image: Blob, json: unknown, options?: WatermarkOptions): Promise<Blob>;
export function extractJsonFromImage(image: Blob, options?: DecodeOptions): Promise<unknown>;
/** Resizes to an exact long edge of maxDimension (default 1200), allowing upscaling. */
export function normalizeForWatermark(image: Blob, options?: WatermarkOptions): Promise<ImageData>;
/** Encoded payload bytes at the preferred/fixed normalization, excluding body CRC.
 * Embedding with omitted maxDimension can automatically select a larger size. */
export function getWatermarkCapacity(width: number, height: number, options?: WatermarkOptions): number;
