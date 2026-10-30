#!/usr/bin/env python3
"""Cut word clips from page narration when Edge TTS fails."""
import json
import re
import subprocess
from pathlib import Path

import whisper

ROOT = Path(__file__).resolve().parents[1]
AUDIT = Path("/tmp/whisper-audit-after.json")
MODEL = None


def read_units(text):
    out = []
    for m in re.finditer(r"[A-Za-z']+|[^A-Za-z']+", text or ""):
        if re.search(r"[A-Za-z']", m.group(0)):
            out.append(m.group(0).lower())
    return out


def norm_tok(s):
    return re.sub(r"[^a-z]", "", (s or "").lower())


def acceptable(word, heard):
    hn = norm_tok(heard)
    wn = norm_tok(word)
    if not hn:
        return False
    if wn == hn or (len(wn) >= 4 and wn in hn):
        return True
    if hn.startswith(wn[: max(2, len(wn) - 1)]):
        return True
    return False


def load_align(book_id):
    for p in (ROOT / "assets").glob(f"align_{book_id}.json"):
        return json.loads(p.read_text())
    raise FileNotFoundError(book_id)


def pick_page(align, lemma):
    best = None
    for pg in align["pages"]:
        words = read_units(pg["text"])
        if lemma not in words:
            continue
        score = words.count(lemma) * 10 + (1.0 / max(1, len(words)))
        if lemma in words and len(words) <= 3:
            score += 50
        if not best or score > best[0]:
            best = (score, pg)
    return best[1] if best else None


def cut_audio(src: Path, start: float, end: float, dest: Path):
    start = max(0.0, start - 0.02)
    end = end + 0.05
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
            "-af",
            "afade=t=in:st=0:d=0.02,afade=t=out:st=0:d=0.02",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "4",
            str(dest),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True,
    )


def find_span(model, page_audio: Path, lemma: str):
    r = model.transcribe(str(page_audio), word_timestamps=True, language="en", fp16=False)
    wn = norm_tok(lemma)
    for seg in r.get("segments", []):
        for w in seg.get("words") or []:
            if norm_tok(w.get("word")) == wn:
                return w["start"], w["end"]
            # min's vs mins/men's
            if wn.endswith("s") and norm_tok(w.get("word")) == wn[:-1]:
                return w["start"], w["end"]
    # fallback: token order from page text
    return None


def main():
    global MODEL
    MODEL = whisper.load_model("base.en")
    audit = json.loads(AUDIT.read_text())
    fixed, failed = [], []

    for m in audit["mismatches"]:
        book = m["book"]
        word = m["word"]
        dest = ROOT / m["path"]
        try:
            align = load_align(book)
            pg = pick_page(align, word)
            if not pg:
                failed.append({"book": book, "word": word, "reason": "no page"})
                continue
            audio = ROOT / "assets" / pg["audio"]
            span = find_span(MODEL, audio, word)
            if not span:
                failed.append({"book": book, "word": word, "reason": "no span", "page": pg["page_id"]})
                continue
            cut_audio(audio, span[0], span[1], dest)
            heard = MODEL.transcribe(str(dest), language="en", fp16=False)["text"].strip()
            if not acceptable(word, heard):
                failed.append({"book": book, "word": word, "reason": "verify", "heard": heard, "page": pg["page_id"]})
                continue
            fixed.append({"book": book, "word": word, "page": pg["page_id"], "heard": heard})
        except Exception as e:
            failed.append({"book": book, "word": word, "reason": str(e)})

    print(json.dumps({"fixed": len(fixed), "failed": failed, "samples": fixed[:10]}, indent=2))


if __name__ == "__main__":
    main()
