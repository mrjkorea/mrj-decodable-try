#!/usr/bin/env python3
"""Detect mis-labeled podcast fragments and other bad word-tap clips (books 1–20)."""
import json
import re
import subprocess
import hashlib
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB = json.loads((ROOT / "assets/decodable_library.json").read_text())

# Legacy podcast-host fragment batch (filename often ≠ spoken word)
LEGACY_PODCAST_BYTES = {25748}


def read_units(text):
    out = []
    for m in re.finditer(r"[A-Za-z']+|[^A-Za-z']+", text or ""):
        if re.search(r"[A-Za-z']", m.group(0)):
            out.append(m.group(0).lower())
    return out


def duration_sec(path: Path) -> float:
    r = subprocess.run(
        [
            "ffprobe",
            "-hide_banner",
            "-loglevel",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            str(path),
        ],
        capture_output=True,
        text=True,
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def collect_jobs():
    jobs = []
    for b in LIB["books"]:
        if not re.match(r"mlr_dec_0(0[1-9]|1[0-9]|20)$", b["id"]):
            continue
        align = json.loads((ROOT / "assets" / b["align"]).read_text())
        lemmas = set()
        for p in align["pages"]:
            lemmas.update(read_units(p["text"]))
        for lem in sorted(lemmas):
            rel = f"assets/books/{align['book_id']}/audio/words/{lem}.mp3"
            jobs.append(
                {
                    "book": align["book_id"],
                    "word": lem,
                    "path": rel,
                }
            )
    return jobs


def main():
    jobs = collect_jobs()
    by_book_hash = defaultdict(list)
    issues = []

    for j in jobs:
        fp = ROOT / j["path"]
        flags = []
        if not fp.is_file():
            flags.append("missing")
            issues.append({**j, "flags": flags})
            continue
        sz = fp.stat().st_size
        dur = duration_sec(fp)
        h = md5(fp)
        by_book_hash[(j["book"], h)].append(j["word"])

        if sz in LEGACY_PODCAST_BYTES:
            flags.append("legacy_podcast_bytes")
        if sz >= 18000 and dur > 1.0:
            flags.append("podcast_fragment_size")
        if sz < 800:
            flags.append("tiny_file")
        if dur > 0 and dur < 0.12:
            flags.append("very_short")
        if dur > 2.8:
            flags.append("long_clip")

        if flags:
            issues.append({**j, "flags": flags, "bytes": sz, "duration": round(dur, 3), "md5": h[:12]})

    collisions = []
    for (book, h), words in by_book_hash.items():
        if len(words) > 1:
            collisions.append({"book": book, "md5": h[:12], "words": sorted(set(words))})

    print(
        json.dumps(
            {
                "jobs": len(jobs),
                "flagged": len(issues),
                "collisions": collisions,
                "issues": issues,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
