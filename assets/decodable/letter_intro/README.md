# Letter-intro videos (books 1–20)

Played after the sound-picture / cousin letter screens and before the famous
word: cousin → **letter intro** → famous word → chase → Listen.

23 mp4s from release `letter-intros-wire-20261030` (not re-encoded).
Sample path: `assets/decodable/letter_intro/k_letter_intro.mp4`.

- Served from `assets/decodable/letter_intro/<name>` via `asset()`.
- Per-book order comes from `letter_intros` in `assets/align_mlr_dec_0XX.json`
  (fallback: `LETTER_INTROS` in `index.html`).
- Files (23):
  - Book 1: `a_letter_intro.mp4`, `m_letter_intro.mp4`, `s_letter_intro.mp4`, `t_letter_intro.mp4`
  - Books 2–20, one each, `<letter>_letter_intro.mp4` for
    p, i, n, f, o, d, c, u, g, b, e, k, h, r, l, w, j, y, x
- A missing clip still unlocks Next with "This video did not load. Tap Next."
- `npm test` fails if some but not all of the 23 files are present.
