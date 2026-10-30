#!/usr/bin/env python3
"""
Regenerate isolated word-tap MP3s for decodable books 1–20.

Engine: ElevenLabs (Clear American Male) when XI_API_KEY is set, else Edge TTS.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

import edge_tts
import whisper

ROOT = Path(__file__).resolve().parents[1]
EDGE_VOICES = ["en-US-ChristopherNeural", "en-US-GuyNeural", "en-US-EricNeural"]
EDGE_RATE = "-8%"
# Override with workspace voice id when known
ELEVEN_VOICE_ID = os.environ.get("XI_VOICE_ID", "C1npRmjB19a6yNkEucvx")
ELEVEN_MODEL = os.environ.get("XI_MODEL", "eleven_turbo_v2_5")


def speak_text(lemma: str) -> str:
    if lemma == "a":
        return "a."
    if lemma == "i":
        return "I."
    if lemma.endswith("'s"):
        return lemma.capitalize() + "."
    if len(lemma) <= 4:
        return lemma.capitalize() + "."
    return lemma + "."


def norm(s: str) -> str:
    return re.sub(r"[^a-z]", "", (s or "").lower())


def acceptable(lemma: str, heard: str) -> bool:
    if "phoneme" in heard.lower() or "xmlns" in heard.lower():
        return False
    wn, hn = norm(lemma), norm(heard)
    if not hn:
        return False
    if wn == hn:
        return True
    if len(wn) >= 4 and wn in hn:
        return True
    if wn + "s" == hn or (wn.endswith("s") and wn[:-1] == hn):
        return True
    if lemma == "a" and hn in ("a", "uh"):
        return True
    if len(wn) <= 3 and hn.startswith(wn[: max(1, len(wn) - 1)]):
        return True
    return False


def elevenlabs_tts(text: str, out: Path) -> bool:
    key = os.environ.get("XI_API_KEY")
    if not key:
        return False
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVEN_VOICE_ID}"
    body = json.dumps(
        {
            "text": text,
            "model_id": ELEVEN_MODEL,
            "voice_settings": {"stability": 0.55, "similarity_boost": 0.75, "style": 0, "use_speaker_boost": True},
        }
    ).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        out.write_bytes(resp.read())
    return True


async def edge_tts_one(text: str, voice: str, out: Path) -> None:
    await edge_tts.Communicate(text, voice, rate=EDGE_RATE).save(str(out))


def synthesize(lemma: str, out: Path, model) -> tuple[str, str] | None:
    prompts = [speak_text(lemma)]
    cap = lemma.capitalize()
    if lemma == "a":
        prompts = ["a.", "A.", "uh."]
    elif len(lemma) <= 4:
        prompts.extend([cap + ".", cap, lemma + "."])
    else:
        prompts.extend([cap + ".", cap])

    seen = []
    for text in prompts:
        if text in seen:
            continue
        seen.append(text)
        if elevenlabs_tts(text, out):
            heard = model.transcribe(str(out), language="en", fp16=False)["text"].strip()
            if acceptable(lemma, heard):
                return ("elevenlabs", heard)
        for voice in EDGE_VOICES:
            try:
                asyncio.run(edge_tts_one(text, voice, out))
            except Exception:
                continue
            heard = model.transcribe(str(out), language="en", fp16=False)["text"].strip()
            if acceptable(lemma, heard):
                return (f"edge:{voice}", heard)
    return None


def main():
    flagged_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/word-clip-issues.json")
    whisper_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/tmp/whisper-audit.json")

    to_fix: dict[tuple[str, str], set[str]] = {}

    if flagged_path.is_file():
        data = json.loads(flagged_path.read_text())
        for item in data.get("issues", []):
            key = (item["book"], item["word"])
            to_fix.setdefault(key, set()).add("heuristic")
    if whisper_path.is_file():
        data = json.loads(whisper_path.read_text())
        for item in data.get("mismatches", []):
            key = (item["book"], item["word"])
            to_fix.setdefault(key, set()).add("whisper")

    if not to_fix:
        print(json.dumps({"fixed": 0, "note": "nothing to fix"}))
        return

    model = whisper.load_model("tiny.en")
    tmp = ROOT / ".tmp-word-tts"
    tmp.mkdir(exist_ok=True)

    fixed, failed = [], []
    for (book, word), reasons in sorted(to_fix.items()):
        rel = f"assets/books/{book}/audio/words/{word}.mp3"
        out = ROOT / rel
        gen = tmp / f"{book}__{word.replace(chr(39), '_')}.mp3"
        result = synthesize(word, gen, model)
        if not result:
            failed.append({"book": book, "word": word, "reasons": sorted(reasons)})
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(gen.read_bytes())
        fixed.append({"book": book, "word": word, "engine": result[0], "heard": result[1], "reasons": sorted(reasons)})

    print(json.dumps({"fixed": len(fixed), "failed": failed, "engine": "elevenlabs" if os.environ.get("XI_API_KEY") else "edge-tts"}, indent=2))


if __name__ == "__main__":
    main()
