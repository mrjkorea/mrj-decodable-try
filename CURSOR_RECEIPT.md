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

## Receipt 15SEP2026 night — Listen 3× + books 4–10
- **Command/job:** `CURSOR_JOB_15SEP_4TO10.md`
- **Model:** `cursor-grok-4.6-high`
- **Files:**
  - `mrj-decodable-try/index.html` — `ASSET_V=dec20260915v2`, `LISTEN_LOOPS=3`, listen plays page audio 3× at `LISTEN_RATE` 0.8 with `Listen n / 3` status, `listenGen` invalidates leftover `onended`, `MAX_BOOKS=10`, BASE GitHub Pages path lock unchanged
  - `mrj-leveled-readers/vertical-slice-max/player/decodable.html` — same Listen 3× / library 10 (factory paths unchanged; not committed from this repo)
  - `mrj-decodable-try/assets/decodable_library.json` — books 001–010
  - `mrj-decodable-try/assets/books/mlr_dec_004` … `mlr_dec_010` — pages p01–p10, cover from p01, audio pages/song/words/dictation, `video/p10.mp4` only; 009/010 pages from Drive
  - `mrj-decodable-try/assets/align_mlr_dec_004.json` … `align_mlr_dec_010.json`
  - `mrj-decodable-try/assets/decodable/famous_carpet/famous_{no,see,he,me,we,be,my}_crowd10.mp3`
- **Deploy:** main `382f098` + slim `gh-pages` `ad56fd4` (no ONNX `model_parts`, `.nojekyll`, Pages source `gh-pages` / root). `gh` as `mrjkorea`. Direct `git push origin main` refused workflow scope on leftover `.github/workflows/pages.yml`; cherry-picked this job onto `origin/main` instead.
- **Live URL:** https://mrjkorea.github.io/mrj-decodable-try/?test=1
- **Local proof:** `LISTEN_LOOPS=3` in `index.html`; library 10 books; p01+p10 exist for 004–010. Browser: library shows 10 books; book 004 Listen status `Listen 1 / 3` then `2 / 3` then `3 / 3` then auto-next; ▶ Listen restarts to `Listen 1 / 3`.
- **Curl proof (200, last-modified Tue, 15 Sep 2026 14:57:53 GMT):**
  - `/?test=1` HTML len 46662 contains `dec20260915v2` + `LISTEN_LOOPS=3`
  - `/assets/books/mlr_dec_004/pages/p01.png` 713942 image/png
  - `/assets/books/mlr_dec_010/pages/p01.png` 3500490 image/png

## Receipt 16SEP2026 01:47 KST — Book 4 fury (NO video, language, word taps)
- cursor-agent CLI was logged out; finished on this Mac (Grok 4.6).
- Famous: overlay_famous_box.py → famous_{no,see,he,me,we,be,my}_steps_out.mp4. Player clips map + object-fit contain (cover was the zoom crop).
- Language: #langPick in header on every screen. i18n books 001–010 × 14 langs. Live ko book4 p01: 민이 수액을 마셔요.
- Word taps: words_v10 copy where lemma exists; 54 missing CVC baked G1 18aea83a [clear]. Live no.mp3 200.
- Apps lock: decodables ≠ readers. Readers = packs A–D, no pron/record.
- Deploy: gh-pages a617928 force, live HTML contains dec20260916v1 + famous_no_steps_out.
- Say: not claimed fixed (web try still pulls the big grader from GitHub raw).

## Receipt 17SEP2026 — word highlight + Say on GitHub + no-clip taps
- **Command/job:** `CURSOR_JOB_17SEP_HIGHLIGHT_SAY.md`
- **Model:** `cursor-grok-4.6-high`
- **Files:**
  - `mrj-decodable-try/index.html` — `ASSET_V=dec20260917v1`, `syncWordHighlight` (`currentTime/duration` over `#sentence .w`, rAF + `timeupdate`), Listen resets each of 3 loops, Song 1×, `listenGen` cancels leftover rAF, `.w.on` yellow
  - `mrj-decodable-try/pronounce/grade-browser.js` — `*.github.io` fetches same-origin `model_parts` first (8s header timeout, cancel 404 body), then raw.githubusercontent; `MRJPronounce.setBase(BASE+'pronounce/')` unchanged
  - `mrj-leveled-readers/vertical-slice-max/player/decodable.html` + `player/pronounce/grade-browser.js` — same highlight + fetch (factory paths unchanged)
  - Word taps: `/tmp/dec_word_taps_clear/*.mp3` duration ≥ 0.85s copied over books 001–010 `audio/words/` (and factory copies). `sits` 1.016s / 25748 bytes. Listen page mp3s untouched.
- **Deploy:** main `0695f7f` + `66c3ccc`; slim `gh-pages` `ba04963` **includes** `pronounce/model_parts/*.part0N` + `ort/` + `models/` + js, `.nojekyll`. Pages source `gh-pages` / root / `build_type=legacy`. `gh` as `mrjkorea`.
- **Live URL:** https://mrjkorea.github.io/mrj-decodable-try/?test=1&v=dec20260917v1
- **Browser (localhost:8770):** Listen page “Tam sat at a mat.” highlight walked Tam→sat→at→a→mat, reset to Tam on loop 2; Song same walk; Read tap kept `.on` on the tapped word; Next bumped `listenGen`.
- **Curl proof (200, last-modified Thu, 17 Sep 2026 04:17:54 GMT):**
  - `/?test=1&v=dec20260917v1` HTML len 47931 contains `dec20260917v1` + `syncWordHighlight`
  - `/assets/books/mlr_dec_009/pages/p01.png` 1974061 image/png
  - `/pronounce/model_parts/model_int8.onnx.part00` 76000000 application/octet-stream (**github.io**, not only raw)
  - `/assets/books/mlr_dec_009/audio/words/sits.mp3` 25748 audio/mp3
