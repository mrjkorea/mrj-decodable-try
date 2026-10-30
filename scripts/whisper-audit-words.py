#!/usr/bin/env python3
"""Transcribe word tap mp3s and flag mismatches vs expected lemma."""
import json, re, sys, tempfile
from pathlib import Path
import whisper

ROOT = Path(__file__).resolve().parents[1]
lib = json.loads((ROOT / "assets/decodable_library.json").read_text())

def read_units(text):
    out = []
    for m in re.finditer(r"[A-Za-z']+|[^A-Za-z']+", text or ""):
        tok = m.group(0)
        if re.search(r"[A-Za-z']", tok):
            out.append(tok.lower())
    return out

def norm(s):
    return re.sub(r"[^a-z]", "", (s or "").lower())

def acceptable(expected, heard):
    e, h = norm(expected), norm(heard)
    if not h:
        return False
    if e == h:
        return True
    if h in e or e in h:
        return True
    # apostrophe names: sam vs sam's
    if e.endswith("'s") and h == e[:-2]:
        return True
    if e + "s" == h or e == h.rstrip("s"):
        return True
    return False

model = whisper.load_model("tiny.en")

books = [b for b in lib["books"] if re.match(r"mlr_dec_0(0[1-9]|1[0-9]|20)$", b["id"])]
jobs = []
for b in books:
    align = json.loads((ROOT / "assets" / b["align"]).read_text())
    lemmas = set()
    for p in align["pages"]:
        lemmas.update(read_units(p["text"]))
    for w in sorted(lemmas):
        fp = ROOT / "assets/books" / align["book_id"] / "audio/words" / f"{w}.mp3"
        if fp.is_file():
            jobs.append((align["book_id"], w, fp))

bad = []
ok = 0
for i, (bid, w, fp) in enumerate(jobs):
    result = model.transcribe(str(fp), language="en", fp16=False)
    heard = (result.get("text") or "").strip()
    if acceptable(w, heard):
        ok += 1
    else:
        bad.append({"book": bid, "word": w, "heard": heard, "path": str(fp.relative_to(ROOT))})
    if (i + 1) % 25 == 0:
        print(f"... {i+1}/{len(jobs)} ok={ok} bad={len(bad)}", file=sys.stderr)

print(json.dumps({"ok": ok, "total": len(jobs), "mismatches": bad}, indent=2))
