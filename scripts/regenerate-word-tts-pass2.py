#!/usr/bin/env python3
"""Retry failed lemmas with several plain-text Edge prompts; strict whisper check."""
import asyncio
import json
import re
from pathlib import Path

import edge_tts
import whisper

ROOT = Path(__file__).resolve().parents[1]
VOICE = "en-US-ChristopherNeural"
AUDIT = Path("/tmp/whisper-audit.json")
REGEN = Path("/tmp/regen.json")


def variants(word: str):
    cap = word.capitalize()
    if word == "a":
        return ["a.", "A."]
    if word.endswith("'s"):
        return [cap, cap + "."]
    if len(word) <= 3:
        return [cap + ".", word + ".", cap]
    return [cap + ".", word + ".", cap]


def acceptable(word, heard):
    if "phoneme" in heard.lower() or "alphabet equals" in heard.lower():
        return False
    hn = re.sub(r"[^a-z]", "", heard.lower())
    wn = re.sub(r"[^a-z]", "", word.lower())
    if not hn:
        return False
    if wn == hn:
        return True
    if len(wn) >= 4 and wn in hn:
        return True
    if wn + "s" == hn or (wn.endswith("s") and wn[:-1] == hn):
        return True
    if len(wn) <= 3 and hn.startswith(wn[: max(1, len(wn) - 1)]):
        return True
    return False


async def synth(text: str, out: Path):
    await edge_tts.Communicate(text, VOICE).save(str(out))


def paths_for_word(word: str):
    rels = set()
    for m in json.loads(AUDIT.read_text())["mismatches"]:
        if m["word"] == word:
            rels.add(m["path"])
    if word == "a":
        for i in range(1, 4):
            rels.add(f"assets/books/mlr_dec_{i:03d}/audio/words/a.mp3")
    return sorted(rels)


def main():
    failed = {f["word"] for f in json.loads(REGEN.read_text())["failed"]}
    model = whisper.load_model("tiny.en")
    tmp = ROOT / ".tmp-word-tts"
    tmp.mkdir(exist_ok=True)

    clear_a = tmp / "clear__a.mp3"
    if clear_a.is_file():
        for i in range(1, 4):
            (ROOT / f"assets/books/mlr_dec_{i:03d}/audio/words/a.mp3").write_bytes(clear_a.read_bytes())

    ok, bad = [], []
    for word in sorted(failed):
        if word == "a":
            continue
        out = tmp / f"retry__{word.replace(chr(39), '_')}.mp3"
        chosen = None
        for text in variants(word):
            asyncio.run(synth(text, out))
            heard = model.transcribe(str(out), language="en", fp16=False)["text"].strip()
            if acceptable(word, heard):
                chosen = (text, heard)
                break
        if not chosen:
            bad.append({"word": word})
            continue
        rels = paths_for_word(word)
        for rel in rels:
            p = ROOT / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(out.read_bytes())
        ok.append({"word": word, "prompt": chosen[0], "heard": chosen[1], "files": len(rels)})

    heard_a = model.transcribe(
        str(ROOT / "assets/books/mlr_dec_001/audio/words/a.mp3"), language="en", fp16=False
    )["text"].strip()
    print(json.dumps({"ok": ok, "bad": bad, "a_book1": heard_a}, indent=2))


if __name__ == "__main__":
    main()
