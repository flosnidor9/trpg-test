# Browser JSON pixel watermark v2

`watermark-codec.js`, `watermark-dct.js`, `watermark.js` contain the complete browser
implementation. `watermark.mjs` exports the public API; `watermark.d.mts` supplies
TypeScript types. No external runtime library, PNG metadata, LSB carrier, network
request, or UI is required. `png-metadata.js` remains the application adapter.

## Usage

```js
import {
  embedJsonIntoImage, extractJsonFromImage, extractJsonFromImageDetailed,
  normalizeForWatermark, getWatermarkCapacity,
} from './watermark.mjs';

// Auto-fit canonical output, with the more robust v2 defaults.
const png = await embedJsonIntoImage(file, json);
const restored = await extractJsonFromImage(png);

// Explicit size: reports Payload too large rather than silently enlarging.
const fixed = await embedJsonIntoImage(file, json, {
  maxDimension: 1200,
  strength: 100,
  redundancy: 7,
  blockSize: 8,
  coefficients: [[1, 2], [2, 1]],
  outputCanonicalizedImage: true,
});
console.log(getWatermarkCapacity(1920, 1080, { maxDimension: 1200 })); // 180 bytes

try {
  const { json, debug } = await extractJsonFromImageDetailed(downloadedFile);
  console.table(debug.triedNormalizations);
} catch (error) {
  console.log(error.message, error.debug); // diagnostics also survive failures
}

// Supply nonstandard encoder sizes/pairs explicitly after a resize.
await extractJsonFromImage(downloadedFile, {
  maxDimensions: [1000, 1200],
  coefficientPairs: [[[1, 2], [2, 1]]],
});
```

Existing `extractJsonFromImage(blob)` still returns only JSON. The detailed API
returns `{ json, debug }`. Invalid/unreadable images fail before normalization and
have no decode diagnostics. Failure after decoding attaches `error.debug`.

## Canonical rule and capacity

Both paths use `scale = maxDimension / max(width, height)`, then independently
`round(width * scale)` / `round(height * scale)` (minimum 1 pixel). Canvas uses
high-quality image smoothing and flattens alpha on white before embedding. Aspect
ratio is preserved to the nearest pixel. **This is an exact target long edge,
not a downscale-only ceiling**: the decoder must enlarge smaller renditions back
into the encoder's coordinate system. Small source images can also be enlarged.
`normalizeForWatermark()` returns the normalized `ImageData`.

If `maxDimension` is specified, it is fixed (64..4096). Otherwise the encoder tries
1200, 1600, 2048, 2400, 3200, 4096, and selects the smallest that holds the encoded
packet. This auto-fit prevents the strengthened repetition from breaking export
of existing larger profiles. It can enlarge an image when capacity requires it.
If none fits, embedding throws with required/available block counts. The actual
capacity depends on aspect ratio, block size, repetition and compressed data.

`getWatermarkCapacity()` reports compressed payload bytes at the preferred 1200
or explicit size, excluding the body CRC. It is not the maximum auto-fit capacity.
For 1920x1080 at 1200, default settings hold only 180 bytes. A real profile with
roughly 900 compressed bytes selected a 2400px long edge in the test. Several
profiles may require 3200/4096px. Large payloads and robustness compete for space.

`outputCanonicalizedImage` defaults to `true`. `false` resamples the watermarked
canonical image back to input dimensions. That extra resampling can reduce
robustness, especially when the input is smaller than the selected canonical
size. It preserves dimensions, not the original pixel values. Neither mode
promises to prevent X from making other renditions.

## Packet, sync and markers

V2 uses the following logical packet, mapped across a deterministic shuffled grid
of non-overlapping DCT blocks:

```
64-bit preamble ×7
24-byte header ×9
128-byte body chunk ×redundancy
16-bit marker ×3
128-byte body chunk ×redundancy
16-bit marker ×3
...
```

The header contains `WJ02` MAGIC, version 2, compression flags, repetition count,
block size, payload length, coefficient pair, strength and header CRC32. The body
is JSON → UTF-8 → optional deflate (if smaller) → compressed bytes + CRC32. CRC is
checked on the compressed bytes before decompression and UTF-8/JSON parsing.
Compression has the same 2MB JSON limit and uncompressed browser fallback as v1.

Sync is a fixed deterministic 64-bit training sequence. Before reading the
header the decoder measures its signed, magnitude-weighted correlation, clipping
outliers; correlation must be at least 0.72. A random/no-watermark image is not
accepted merely because an arbitrary byte stream can be parsed as JSON.

Markers record local correlation between chunks and make damaged regions visible
in diagnostics. They are **not** a general crop/registration or missing-chunk
repair system: this implementation still requires the correct grid and a complete
CRC-valid packet. Repeated blocks are dispersed throughout the image so a small
local disturbance need not erase all copies of a bit.

## DCT and voting

Default payload strength is 100 (previously 40), repetition is 7 (previously 5),
block size is 8. Sync/header/markers use strength 120. Valid strength range remains
4..200; odd repetition counts 1..31 and block sizes 8/16 are supported.

The default coefficient pair is `[1,2]` / `[2,1]`. These equal-radial-frequency
low/mid-band coefficients retain more energy through shrinking than v1's
`[2,3]` / `[3,2]`, while avoiding DC and the first axial frequencies. The tradeoff
is a more visible pattern, particularly on flat white areas. RGB rounding and
clipping are rechecked during embedding rather than trusting an unclipped inverse
projection. Unsupported coefficient locations fail validation.

Each read returns the actual coefficient difference, not just a bit. Voting tries:

1. Soft: sum signed differences, clipping each weight to twice the declared strength.
2. Hard: one equal vote per copy, using the sign.
3. Erasure: discard differences below 15% of strength, then use clipped soft votes.

Near-zero differences contribute little or nothing to soft/erasure voting.
A tied result is zero. Header copies and each body chunk are voted independently.
Final success always requires MAGIC/version/length, header CRC, body CRC,
decompression, UTF-8 decoding and JSON.parse. Repetition cannot reconstruct bits
whose every copy is destroyed; CRC prevents silently accepting such corruption.

## Multi-pass extraction and compatibility

The decoder first tries the old v1 layout at the input's native size. Existing v1
PNGs remain readable; this does not make already-resized v1 images recoverable.
The new encoder writes v2; old decoders cannot read new images.

V2 then tries native dimensions and exact long edges 1200, 1024, 768, 1600, 2048,
2400, 3200, 4096. At each it tries short-edge rounding corrections 0/-1/+1, block
sizes 8/16, and three sync/header pairs:
`[1,2]/[2,1]`, `[2,3]/[3,2]`, `[1,3]/[3,1]`. It measures sync at pixel phases
(0,0), (-1,0), (1,0), (0,-1), (0,1). Only sync-qualified candidates read headers.
A CRC-valid header supplies the exact payload parameters. Confidence-weighted,
hard and erasure votes are tried without speculative JSON acceptance. The first
fully validated payload wins.

`maxDimensions` and `coefficientPairs` replace the built-in lists; native dimensions
are always attempted. Lists are bounded to 16 sizes / 8 pairs, images to 32M pixels
and 50MB. Operations yield between passes and during long bit loops. Difficult
failures are substantially slower than clean round-trips; this code is not yet a
Web Worker implementation.

Debug attempts contain input/normalized dimensions, coefficient pair, block size,
phase, sync score, MAGIC/header CRC/body success, repetition, chunk marker scores,
uncertain fraction, successful voting mode, and failure reason. `crcOk` becomes
true only after the entire decoded JSON has been validated.

## Verification

```sh
node --test tests/profile.test.cjs tests/png-metadata.test.cjs
node tests/watermark-browser.cjs
node tests/png-check.cjs
```

Browser tests require Playwright and its Chromium. Set `TRPG_PLAYWRIGHT_MODULE`
and `TRPG_BROWSER` when using externally installed packages/browser binaries.
The frozen `tests/fixtures/watermark-v1.js` creates genuine v1 images to test
compatibility independently of the new implementation.

The browser matrix covers textured/white/black/transparent images and an actual
profile PNG, PNG round-trip/re-encode, JPEG, resizing, resize+JPEG, resize+WebP,
color offsets, custom parameters, noncanonical output, exact capacity boundaries,
scalar JSON, no-watermark rejection, damaged replicas/CRC rejection, and DOM
canvas/image fallbacks. Stronger transforms are reported rather than presumed to
succeed. Results below are local Canvas simulations, not real X-app captures.

Measured results (four synthetic styles + one real profile, five fixtures):

| Transformation | Recovery |
| --- | --- |
| Original PNG round-trip | 5/5 |
| Canvas PNG re-encode | 5/5 |
| JPEG quality 0.9 | 5/5 |
| Resize to 75% | 5/5 |
| Resize to 75% + JPEG quality 0.9 | 5/5 |
| Resize to 75% + JPEG quality 0.75 | 5/5 |
| Resize to 75% + WebP quality 0.8 | 5/5 |
| RGB values +8 + JPEG quality 0.9 | 5/5 |
| Resize to 50% + JPEG quality 0.9 | 5/5 |
| Resize to 25% + JPEG quality 0.75 | **0/5** |

No-watermark images were rejected, three of seven erased replicas recovered,
all seven erased replicas failed CRC, and the application PNG export/import test
passed for personal and party images. Node profile/codec tests: 39 passed.
For the actual profile, native PNG/JPEG decode took roughly 0.2s and 75% renditions
roughly 1.8–1.9s; the slowest matrix pass took about 4.3s on this desktop.
These timings are not mobile measurements. Full attempts/results are recorded in
[tests/watermark-robustness-results.json](tests/watermark-robustness-results.json).

## Limits and next steps

This is resize-tolerant, not resize-invariant. Heavy shrinkage removes carrier
frequencies; neither enlarging nor higher repetition can recreate absent signals.
Arbitrary crop, aspect-ratio distortion, rotation, screenshots, overlays and image
filters remain outside the supported registration model. Short-edge rounding
search is only ±1px; unusual sizes/pairs need explicit decoder candidates.

Priorities for further improvement are real X iOS/Android rendition fixtures and
an automated regression matrix, BCH/Reed–Solomon or LDPC error correction with
interleaving, better scale/translation estimation using a separate spatial sync
carrier, adaptive carrier energy based on content, and a Worker for decoding.
Compact application-specific profile encoding would reduce the need for large
canonical outputs and leave more space for error correction. Testing the actual
saved files is required before claiming an X/mobile recovery rate.
