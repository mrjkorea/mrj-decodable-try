#!/usr/bin/env python3
"""Final pass: GuyNeural + slow rate for remaining whisper mismatches."""
import asyncio
import json
import re
from pathlib import Path

import edge_tts
import whisper

ROOT = Path(__file__).resolve().parents[1]
VOICES = ["en-US-GuyNeural", "en-US-ChristopherNeural"]
RATE = "-10%"
AUDIT = Path("/tmp/whisper-audit-after.json")


def variants(word: str):
    cap = word.capitalize()
    if word == "a":
        return ["a.", "A."]
    if word.endswith("'s"):
        return [cap + ".", cap]
    if len(word) <= 4:
        return [cap + ".", cap, word + "."]
    return [cap + ".", cap]


def acceptable(word, heard):
    hn = re.sub(r"[^a-z]", "", heard.lower())
    wn = re.sub(r"[^a-z]", "", word.lower())
    if not hn:
        return False
    if wn == hn:
        return True
    if len(wn) >= 4 and wn in hn:
        return True
    if hn.startswith(wn[: max(2, len(wn) - 1)]):
        return True
    return False


async def synth(text: str, voice: str, out: Path):
    await edge_tts.Communicate(text, voice, rate=RATE).save(str(out))


async def run_all(todo, tmp, model):
    ok, bad = [], []
    for item in todo:
        book, word, rel = item["book"], item["word"], item["path"]
        out = tmp / f"guy__{book}__{word.replace(chr(39), '_')}.mp3"
        chosen = None
        for voice in VOICES:
            for text in variants(word):
                try:
                    await synth(text, voice, out)
                except Exception:
                    continue
                heard = model.transcribe(str(out), language="en", fp16=False)["text"].strip()
                if acceptable(word, heard):
                    chosen = (text, heard, voice)
                    break
            if chosen:
                break
        if not chosen:
            bad.append(item)
            continue
        (ROOT / rel).write_bytes(out.read_bytes())
        ok.append({"book": book, "word": word, "heard": chosen[1], "voice": chosen[2]})
    return ok, bad


def main():
    audit = json.loads(AUDIT.read_text())
    todo = audit["mismatches"]
    model = whisper.load_model("tiny.en")
    tmp = ROOT / ".tmp-word-tts"
    tmp.mkdir(exist_ok=True)
    ok, bad = asyncio.run(run_all(todo, tmp, model))
    print(json.dumps({"fixed": len(ok), "remaining": len(bad), "bad": bad}, indent=2))


if __name__ == "__main__":
    main()
