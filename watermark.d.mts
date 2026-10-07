export interface WatermarkOptions {
  /** DCT coefficient difference. Default 40; range 4..200. */
  strength?: number;
  /** Odd repetition count 1..31. Default 5. */
  redundancy?: number;
  /** Supported blind-decoding block sizes. Default 8. */
  blockSize?: 8 | 16;
  /** Two [vertical, horizontal] mid-frequency coordinates. */
  coefficients?: [[number, number], [number, number]];
}
export function embedJsonIntoImage(image: Blob, json: unknown, options?: WatermarkOptions): Promise<Blob>;
export function extractJsonFromImage(image: Blob): Promise<unknown>;
/** Capacity in encoded payload bytes, after framing/repetition overhead. */
export function getWatermarkCapacity(width: number, height: number, options?: WatermarkOptions): number;
