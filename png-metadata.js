/* Legacy application adapter name; storage is exclusively a pixel watermark. */
(() => {
  'use strict';
  const format = 'trpg-playstyle-png';
  async function embed(image, profiles, options) {
    return JsonWatermark.embedJsonIntoImage(image, { format, version: 1, profiles }, options);
  }
  async function read(image) {
    let payload;
    try { payload = await JsonWatermark.extractJsonFromImage(image); }
    catch (error) {
      if (error.message === 'Watermark not found') throw new Error('비교 데이터가 없어요. 픽셀 워터마크 PNG 또는 JSON을 불러와 주세요.');
      if (error.message === 'Image decoding failed') throw new Error('PNG 파일이 손상되었거나 이미지 형식이 올바르지 않아요. 다른 이미지 또는 JSON을 불러와 주세요.');
      throw error;
    }
    if (payload?.format !== format || payload.version !== 1 || !Array.isArray(payload.profiles) || !payload.profiles.length) throw new Error('지원하지 않는 PNG 비교 데이터예요. JSON을 불러와 주세요.');
    return payload.profiles;
  }
  globalThis.TRPGPngMetadata = { embed, read };
})();
