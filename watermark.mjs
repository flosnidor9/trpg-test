import './watermark-codec.js';
import './watermark-dct.js';
import './watermark.js';
export const { embedJsonIntoImage, extractJsonFromImage, extractJsonFromImageDetailed,
  normalizeForWatermark, getWatermarkCapacity } = globalThis.JsonWatermark;
