#!/usr/bin/env python3
"""Map wrong-audio clusters by md5 using whisper mismatches."""
import json, hashlib
from pathlib import Path

ROOT = Path('/workspace')
d = json.load(open('/tmp/whisper-audit.json'))
mismatches = d['mismatches']

def md5(p):
    return hashlib.md5(Path(p).read_bytes()).hexdigest()

clusters = {}
for m in mismatches:
    fp = ROOT / m['path']
    h = md5(fp)
    clusters.setdefault(h, {'heard': set(), 'words': set(), 'paths': []})
    clusters[h]['heard'].add(m['heard'])
    clusters[h]['words'].add(m['word'])
    clusters[h]['paths'].append(m['path'])

print(f"mismatch entries {len(mismatches)} unique hashes {len(clusters)}")
for h, c in sorted(clusters.items(), key=lambda x: -len(x[1]['paths'])):
    print(len(c['paths']), h[:8], 'words', sorted(c['words'])[:8], 'heard', list(c['heard'])[:2])
