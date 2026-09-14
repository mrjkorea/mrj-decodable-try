# Cursor Cloud receipt — browser Say (mic) scoring

## Agent / command
- **Agent:** Cursor Cloud Agent (Composer 2.5)
- **Branch:** `cursor/decodable-try-mic-grade-7b41`
- **Repo:** `mrjkorea/mrj-decodable-try` (GitHub Pages)

## Problem
Say mode recorded audio and `POST`ed to `/api/grade`, which does not exist on static GitHub Pages.

## Solution
- Score in the browser with **onnxruntime-web** (jsDelivr CDN) and **wav2vec2-lv-60-espeak-cv-ft** ONNX from Hugging Face (`onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX`).
- `model_int8.onnx` uses **ConvInteger**, which ort-web WASM cannot run; the loader uses **`model_uint8.onnx`** from the same repo (same phoneme accuracy on book audio in local checks).
- Expected espeak phones for decodable vocabulary are in a small in-repo lexicon; CTC decode + alignment yields `{ overall: { score, band }, words: [{ word, score }], model_id }` (pass still **50%** / `SPEAK_DEFAULT`).

## Files changed
| File | Change |
|------|--------|
| `index.html` | Load ort + `browser-grader.js`; replace `gradeBlob()` to call `MrjBrowserGrader.grade()`; remove `/api/grade` fetch |
| `assets/browser-grader.js` | **New** — model download, audio decode/resample, ONNX inference, GOP-style word scores |
| `assets/wav2vec2-espeak-vocab.json` | **New** — CTC vocab (~4.6KB), same-origin (no extra HF fetch) |

**Not changed:** books, images, word MP3s, famous crowd assets, Listen / Read / Song flows.

## How tested
1. **Python + ONNX Runtime (CPU):** Page TTS MP3 `mlr_dec_001` p03 (“Sam sat.”) → 100% word scores with aligned phonemes (`s æ m s æ t`).
2. **Playwright + Chromium (desktop UA):** Served site locally, called `MrjBrowserGrader.grade('Sam sat.', mp3Blob)` → `{ overall.score: 1, words: [{sam:1},{sat:1}], model_id: 'wav2vec2-lv-60-espeak-cv-ft-uint8' }`.
3. **Manual (recommended after deploy):** Open https://mrjkorea.github.io/mrj-decodable-try/ → Say → first mic use may show **“Preparing scoring…”** while ~318MB model downloads → record a page line → word chips and pass/fail at 50%.

Local test helper (not committed): `GRADE_TEST_NO_SERVER=1 GRADE_TEST_PORT=9888 node scripts/test-browser-grade.mjs` with `python3 -m http.server 9888`.
