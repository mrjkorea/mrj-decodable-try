# Word-click TTS audit (books 1–20)

Live site: [mrj-decodable-try](https://mrjkorea.github.io/mrj-decodable-try/)

## How `playWord` / lemma works

In `index.html`, page text is split with `readUnits()`:

- Word tokens match `/[A-Za-z']+/`
- **`lemma` = on-page token lowercased** (e.g. `Sam` → `sam`, `Min's` → `min's`)
- Read mode renders `<span class="w" data-lem="…">` and calls `playWord(lem)` on tap
- Audio path: `assets/books/<book_id>/audio/words/<lemma>.mp3` (via `playPath('books/'+pack.book_id+'/audio/words/'+lem+'.mp3')`)

Apostrophes in lemmas are preserved in filenames (e.g. `min's.mp3`).

## Root patterns found

| Pattern | Detail |
|--------|--------|
| **Shared wrong clip** | Many high-frequency lemmas reused one bad MP3 across books. Worst: **`a.mp3`** (MD5 `654e910a…`) — Whisper transcribed **“Hey!”** on all 20 books (same class as the earlier **`pat`** fix). |
| **Oversized legacy pool** | Books 1–10 ship ~98 word files each (shared early pool); books 11–20 only pack words used in that book. Missing-file gaps were not the main issue; **wrong content** was. |
| **Stale size cluster** | 88 files at exactly **25 748 bytes** (legacy batch); not all were wrong, but several mismatched lemmas lived in that batch. |
| **Voice metadata** | Align JSON `voices.words` / `read_taps` point at Fish Audio voice IDs (`851d4a3a…` / `clear_american_male` for DEC 004–020). **No `FISH_API_KEY` in this environment**, so fixes use **Edge TTS** (Christopher/Guy) + **gTTS** / **page extract** for stubborn lemmas. Re-sync with Fish when a key is available for exact parity with book 21+. |
| **Hash drift** | No duplicate MD5s mapping **different** lemmas within the same book after fixes. |

## Audit method

1. `scripts/audit-word-tts.mjs` — lemmas from align page text vs files on disk (missing/extras).
2. `scripts/whisper-audit-words.py` — Whisper `tiny.en` transcription vs expected lemma (502 tap clips).
3. Regeneration: `scripts/regenerate-word-tts.py` (+ pass2/pass3/pass4) — replace failures; re-audit.

### Coverage summary

| Metric | Before fixes | After fixes |
|--------|----------------|-------------|
| Missing word MP3s (books 1–20) | 0 | 0 |
| Whisper mismatches (502 clips) | **143** | **31** (mostly short/homophone lemmas; see suspects) |
| MP3 files replaced | — | **163** |

## Words fixed (high impact)

- **`a`** — all 20 books (was “Hey!” everywhere)
- **`pat`** — already fixed on `gh-pages` before this pass; verified **“Pat.”**
- **`egg`**, **`ants`**, **`sits`**, **`fat`**, **`pond`**, **`must`**, **`nip`**, **`big`**, **`pop`**, **`got`**, **`the`**, **`with`**, **`be`**, **`dim`**, **`den`**, **`tam`**, **`sat`**, **`sap`**, **`gets`**, and **100+** other tap clips across books 1–20 (see git diff on `assets/books/mlr_dec_*/audio/words/`)

## Remaining suspects (31 tap clips)

Whisper still disagrees with the lemma (often **short words** or **gTTS/Edge homophones**). Worth a human ear check or Fish re-gen:

| Lemma | # clips | Whisper heard (typical) | Notes |
|-------|---------|-------------------------|--------|
| `ant` | 3 | “And…” | Page extract from DEC 004 narration; sounds correct in context but ASR confuses |
| `all` | 2 | “Oh.” / similar | Short vowel |
| `to` | 2 | “Two.” | Homophone |
| `six` | 1 | “6.” | Number reading |
| `one` | 1 | “1.” | Number reading |
| `ten` / `tin` | 2 | “10.” | Number confusion |
| `it` | 1 | varies | Short function word |
| `amit` / `amit's` | 2 | “Arm it.” / similar | Name |
| `min's` | 1 | “Men's.” | Name + possessive |
| Others | 1 each | see `/tmp/whisper-audit-final3.json` in CI artifact or re-run audit | `cot`, `dug`, `nab`, `fen`, `fen's`, `hut`, `crops`, `pups`, `rug`, `drips`, `jolts`, `on`, `yak`, `yaks`, `kits`, `sits` |

Re-run audit locally:

```bash
python3 scripts/whisper-audit-words.py | tee /tmp/whisper-audit.json
node scripts/audit-word-tts.mjs
```

## Tooling added

- `scripts/audit-word-tts.mjs`
- `scripts/audit-word-hash-drift.mjs`
- `scripts/whisper-audit-words.py`
- `scripts/regenerate-word-tts.py` (+ pass2–pass4 helpers)
- `scripts/cluster-bad-audio.py`

No letter-intro or `index.html` logic changes.
