#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== lemma vs filesystem =="
node scripts/audit-word-tts.mjs | tee /tmp/word-tts-files.json >/dev/null

echo "== heuristic detect (podcast fragments / collisions) =="
python3 scripts/detect-bad-word-clips.py | tee /tmp/word-clip-issues.json >/dev/null

echo "== whisper ASR verify =="
python3 scripts/whisper-audit-words.py | tee /tmp/whisper-audit.json

echo "== regenerate flagged clips =="
python3 scripts/fix-word-taps.py /tmp/word-clip-issues.json /tmp/whisper-audit.json | tee /tmp/word-fix-result.json

echo "== re-verify =="
python3 scripts/whisper-audit-words.py | tee /tmp/whisper-audit-after.json

python3 - <<'PY'
import json
a=json.load(open("/tmp/whisper-audit.json"))
b=json.load(open("/tmp/whisper-audit-after.json"))
print(f"whisper mismatches: {len(a['mismatches'])} -> {len(b['mismatches'])}")
PY
