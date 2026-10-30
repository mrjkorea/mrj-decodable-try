# Word-click TTS audit (books 1–20)

Live: [mrj-decodable-try](https://mrjkorea.github.io/mrj-decodable-try/)

## `playWord` / lemma

`readUnits()` splits page text; each word token’s **`lemma` is the lowercased surface form** (apostrophes kept, e.g. `Min's` → `min's`).

```818:820:index.html
function playWord(lem, onend){
  playPath('books/'+pack.book_id+'/audio/words/'+encodeURIComponent(lem)+'.mp3', onend, 1);
}
```

`encodeURIComponent(lem)` ensures apostrophe filenames (`min's.mp3`) resolve correctly in URLs. Same change in `preview.html` and `m4k-desk-7q.html`.

## Root cause (aligned with books 41–60 fix)

**Mis-labeled podcast-fragment MP3s**: listen/podcast-host audio slices were saved under the wrong lemma filename, so Read taps played unrelated speech (e.g. **`a.mp3` → “Hey!”** across all books — same class as the earlier **`pat`** fix).

| Signal | Meaning |
|--------|--------|
| **`legacy_podcast_bytes` (25 748 B)** | Known bad batch shared across early books |
| **`podcast_fragment_size` (≥18 000 B, >1 s)** | Full fragment, not an isolated tap clip |
| **Whisper ≠ lemma** | Filename does not match spoken word (502 clips audited) |
| **Hash collision** | Two different lemmas sharing one MP3 in the same book (none after fix) |
| **Missing / tiny** | No file or &lt;800 B |

Isolated tap audio should be **short, single-word TTS** (`read_taps`: Clear American Male), not listen-mode podcast lines.

## Regeneration engine

| Priority | Engine |
|----------|--------|
| 1 | **ElevenLabs** — `XI_API_KEY`, voice `XI_VOICE_ID` (default Arthur `C1npRmjB19a6yNkEucvx`, Clear American Male) |
| 2 | **Edge TTS** — `en-US-ChristopherNeural` / `GuyNeural` / `EricNeural` (used in this run; no `XI_API_KEY` in cloud env) |

Script: `scripts/fix-word-taps.py` (one clip per flagged `(book, word)`, copied into that book’s `audio/words/`).

## Results (this PR)

| Check | Before | After |
|-------|--------|-------|
| Missing lemma MP3s | 0 | 0 |
| Heuristic flags (podcast / legacy) | 34 | 0 |
| Whisper mismatches (502 taps) | **143** (initial baseline) → **35** (after first 163 replacements) → **28** after unified fix |
| Clips regenerated (this pass) | — | **52** (+ prior **163** in branch) |

### High-impact fixes

- **`a`** — all 20 books (was podcast “Hey!”)
- **`pat`** — verified on branch baseline
- Podcast-sized / legacy-byte clips replaced for in-book lemmas across DEC 001–020

### Remaining suspects (28 clips — Whisper)

Mostly **short words / homophones** (ASR reads `ant`→“and”, `to`→“two”, `six`→“6”, names with apostrophes). Clips are **isolated Edge/Eleven TTS**, not podcast fragments; optional human spot-check or ElevenLabs re-run with `XI_API_KEY` for parity with books 41–60.

## Run audit locally

```bash
bash scripts/run-word-tts-audit.sh
```

Or stepwise:

```bash
node scripts/audit-word-tts.mjs
python3 scripts/detect-bad-word-clips.py
python3 scripts/whisper-audit-words.py
python3 scripts/fix-word-taps.py /tmp/word-clip-issues.json /tmp/whisper-audit.json
```

Outputs: `/tmp/word-clip-issues.json`, `/tmp/whisper-audit.json`.

## Tooling

| Script | Role |
|--------|------|
| `scripts/audit-word-tts.mjs` | Lemmas vs files on disk |
| `scripts/detect-bad-word-clips.py` | Podcast fragment / legacy / collision detect |
| `scripts/whisper-audit-words.py` | ASR verify taps |
| `scripts/fix-word-taps.py` | Regenerate (ElevenLabs → Edge) |
| `scripts/run-word-tts-audit.sh` | Full pipeline |

**Not changed:** letter-intro assets or flow.
