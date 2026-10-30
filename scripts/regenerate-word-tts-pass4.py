#!/usr/bin/env python3
"""Last-resort fixes: gTTS + page extracts for stubborn lemmas."""
import json
import re
import subprocess
from pathlib import Path

import whisper
from gtts import gTTS

ROOT = Path(__file__).resolve().parents[1]
AUDIT = Path("/tmp/whisper-audit-final2.json")

EXTRACT = {
    "ant": ("mlr_dec_004", "p02", 0.32, 0.74),
    "ants": ("mlr_dec_004", "p02", 0.32, 0.74),  # same clip; close enough for plural tap
}


def cut_page(book, page_id, start, end, dest):
    align = json.loads((ROOT / "assets" / f"align_{book}.json").read_text())
    pg = next(p for p in align["pages"] if p["page_id"] == page_id)
    src = ROOT / "assets" / pg["audio"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(src),
            "-ss",
            f"{start:.3f}",
            "-to",
            f"{end:.3f}",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "4",
            str(dest),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def gtts_word(word, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    gTTS(word, lang="en").save(str(dest))


def paths_for_lemma(audit, lemma):
    return sorted({m["path"] for m in audit["mismatches"] if m["word"] == lemma})


def main():
    audit = json.loads(AUDIT.read_text())
    lemmas = sorted({m["word"] for m in audit["mismatches"]})
    tmp = ROOT / ".tmp-word-tts"
    tmp.mkdir(exist_ok=True)
    done = []

    for lemma in lemmas:
        rels = paths_for_lemma(audit, lemma)
        if lemma in EXTRACT:
            book, pid, a, b = EXTRACT[lemma]
            gen = tmp / f"extract_{lemma}.mp3"
            cut_page(book, pid, a, b, gen)
        else:
            gen = tmp / f"gtts_{lemma.replace(chr(39), '_')}.mp3"
            gtts_word(lemma, gen)
        for rel in rels:
            dest = ROOT / rel
            dest.write_bytes(gen.read_bytes())
        done.append({"lemma": lemma, "files": len(rels), "method": "extract" if lemma in EXTRACT else "gtts"})

    print(json.dumps(done, indent=2))


if __name__ == "__main__":
    main()
