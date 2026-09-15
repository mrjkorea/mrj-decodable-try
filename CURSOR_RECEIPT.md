# Receipt 14SEP2026 — GitHub try books 1–3
- TTS: baked missing male taps `jen` + `jen's` (Fish 851d4a3a) into read_words_male and mlr_dec_034/audio/words
- Famous crowd files already on disk (a/is/go crowd10). Inventory false-positive on word "famous" because filename famous_famous_crowd10
- Site: ~/.hermes/projects/mrj-decodable-try → https://mrjkorea.github.io/mrj-decodable-try/
- Live curl 200: index, library json, p01.png, word a.mp3, crowd a.mp3
- Cloud Composer 2.5: bc-c6944a05-315f-441f-b49f-492097cf4faf (Say/mic in-browser grade)

## Receipt 15SEP2026 — Say score + Next + loading bar (Jay)
- **Command/job:** `CURSOR_JOB_15SEP_SAY.md`
- **Model:** Composer
- **Files:**
  - `mrj-decodable-try/index.html` — `ASSET_V=dec20260915v1`, `#sayNext` on pass only, `#loadbar`/`#loadbarFill`/`#loadbarLbl`, preload on Say, no auto `finishSayPage` from `gradeBlob`
  - `mrj-decodable-try/pronounce/grade-browser.js` — optional `load(onProgress)` with download/session/done pct
  - `mrj-leveled-readers/vertical-slice-max/player/decodable.html` — mirrored Say UI/JS/CSS (factory `/player/pronounce/` + `/assets/` paths unchanged)
  - `mrj-leveled-readers/vertical-slice-max/player/pronounce/grade-browser.js` — same `onProgress` load API
- **Tested (no browser):** `python3 -c` asserts `ASSET_V`, `sayNext`/`loadbar` in try + factory HTML, no `if (sc>=SPEAK_DEFAULT) finishSayPage` (only `sayNext` → `finishSayPage`), `load(onProgress)` in grade-browser.js

## Receipt 15SEP2026 20:58 KST — GitHub Pages try link live
- **Command:** `cursor-agent -p --force --trust --sandbox disabled --approve-mcps --workspace mrj-decodable-try --model cursor-grok-4.6-high` (wrote `.github/workflows/pages.yml`; GitHub OAuth lacks `workflow` scope so that file stayed unpushed)
- **Deploy:** slim `gh-pages` branch (no ONNX `model_parts`) + Pages source `gh-pages` / legacy. Build `328bbac` status `built` 2026-09-15T11:58:04Z
- **Live URL:** https://mrjkorea.github.io/mrj-decodable-try/?test=1
- **Curl proof:** HTML len 44050 contains `dec20260915v1`, `sayNext`, `loadbarFill`; last-modified Tue, 15 Sep 2026 11:57:55 GMT
