# Letter-intro videos (books 1–20)

Played after the sound-picture / cousin letter screens and before the famous
word: cousin → **letter intro** → famous word → chase → Listen.

The mp4 files arrive in a follow-up commit. Until then the step shows
"This video did not load. Tap Next." so books still open.

- Served from `assets/decodable/letter_intro/<name>` via `asset()`.
- Per-book order comes from `letter_intros` in `assets/align_mlr_dec_0XX.json`
  (fallback: `LETTER_INTROS` in `index.html`).
- Expected files (23):
  - Book 1: `a_letter_intro.mp4`, `m_letter_intro.mp4`, `s_letter_intro.mp4`, `t_letter_intro.mp4`
  - Books 2–20, one each, `<letter>_letter_intro.mp4` for
    p, i, n, f, o, d, c, u, g, b, e, k, h, r, l, w, j, y, x
- Encode like the other clips (H.264 + AAC). `-movflags +faststart` lets
  phones start playing before the whole file downloads.
- `npm test` fails if some but not all of the 23 files are present.
