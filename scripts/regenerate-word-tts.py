#!/usr/bin/env python3
"""Regenerate broken word-tap mp3s (edge-tts fallback when FISH_API_KEY absent)."""
import asyncio
import json
import re
import hashlib
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import edge_tts
import whisper

ROOT = Path(__file__).resolve().parents[1]
AUDIT = Path("/tmp/whisper-audit.json")
VOICE_G1 = "en-US-AndrewNeural"
VOICE_CLEAR = "en-US-ChristopherNeural"
RATE = "+0%"

# Whisper false positives only (homophone / number reading)
SKIP = {"six"}


def voice_group(book_id: str) -> str:
    n = int(book_id.replace("mlr_dec_", ""))
    return "g1" if n <= 3 else "clear"


def tts_voice(group: str) -> str:
    return VOICE_G1 if group == "g1" else VOICE_CLEAR


def speak_text(lemma: str) -> str:
    # Names and "I" read better capitalized
    if lemma in ("i",):
        return "I"
    if re.match(r"^[a-z]+('s)?$", lemma) and len(lemma) <= 5:
        return lemma.capitalize()
    return lemma


async def synth(word: str, voice: str, out: Path):
    communicate = edge_tts.Communicate(speak_text(word), voice, rate=RATE)
    await communicate.save(str(out))


def md5(p: Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()


def main():
    if not AUDIT.is_file():
        print("Run whisper-audit-words.py first", file=sys.stderr)
        sys.exit(1)
    audit = json.loads(AUDIT.read_text())
    model = whisper.load_model("tiny.en")

    by_group_word = defaultdict(set)  # (group, word) -> book ids
    paths = defaultdict(list)  # (group, word) -> [relative paths]
    for m in audit["mismatches"]:
        w = m["word"]
        if w in SKIP:
            continue
        g = voice_group(m["book"])
        by_group_word[(g, w)].add(m["book"])
        paths[(g, w)].append(m["path"])

    tmp = ROOT / ".tmp-word-tts"
    tmp.mkdir(exist_ok=True)
    fixed = []
    failed = []

    for (g, w), rel_paths in sorted(paths.items()):
        voice = tts_voice(g)
        gen = tmp / f"{g}__{w.replace(chr(39), '_')}.mp3"
        asyncio.run(synth(w, voice, gen))
        heard = model.transcribe(str(gen), language="en", fp16=False)["text"].strip()
        hn = re.sub(r"[^a-z]", "", heard.lower())
        wn = re.sub(r"[^a-z]", "", w.lower())
        ok = wn == hn or wn in hn or hn in wn or (wn + "s" == hn) or (wn == hn.rstrip("s"))
        if not ok:
            failed.append({"word": w, "group": g, "heard": heard})
            continue
        h = md5(gen)
        for rel in set(rel_paths):
            dest = ROOT / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(gen.read_bytes())
        fixed.append({"word": w, "group": g, "voice": voice, "md5": h[:8], "books": len(by_group_word[(g, w)]), "files": len(set(rel_paths)), "heard": heard})

    print(json.dumps({"fixed": fixed, "failed": failed, "skipped": sorted(SKIP)}, indent=2))


if __name__ == "__main__":
    main()
