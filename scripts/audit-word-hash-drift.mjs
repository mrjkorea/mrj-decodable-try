#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/decodable_library.json'), 'utf8'));

function readUnits(text) {
  const re = /[A-Za-z']+|[^A-Za-z']+/g;
  const out = [];
  let m;
  while ((m = re.exec(String(text || '')))) {
    if (/[A-Za-z']/.test(m[0])) out.push(m[0].toLowerCase());
  }
  return out;
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

const books = lib.books.filter((b) => /^mlr_dec_0(0[1-9]|1[0-9]|20)$/.test(b.id));
const voiceGroup = (id) => {
  const n = parseInt(id.replace('mlr_dec_', ''), 10);
  return n <= 3 ? 'g1' : 'clear';
};

const neededByBook = {};
for (const b of books) {
  const align = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', b.align), 'utf8'));
  const set = new Set();
  for (const p of align.pages) readUnits(p.text).forEach((w) => set.add(w));
  neededByBook[align.book_id] = set;
}

// canonical: prefer highest book number in same voice group
const canonical = { g1: new Map(), clear: new Map() };
for (const b of [...books].reverse()) {
  const id = b.id;
  const g = voiceGroup(id);
  const dir = path.join(ROOT, 'assets/books', id, 'audio/words');
  if (!fs.existsSync(dir)) continue;
  for (const w of neededByBook[id] || []) {
    if (canonical[g].has(w)) continue;
    const fp = path.join(dir, w + '.mp3');
    if (fs.existsSync(fp)) canonical[g].set(w, { hash: md5(fp), from: id, fp });
  }
}

const drift = [];
for (const b of books) {
  const id = b.id;
  const g = voiceGroup(id);
  const dir = path.join(ROOT, 'assets/books', id, 'audio/words');
  for (const w of neededByBook[id] || []) {
    const fp = path.join(dir, w + '.mp3');
    const ref = canonical[g].get(w);
    if (!ref || !fs.existsSync(fp)) continue;
    const h = md5(fp);
    if (h !== ref.hash) {
      drift.push({ book: id, word: w, localHash: h.slice(0, 8), refBook: ref.from, refHash: ref.hash.slice(0, 8) });
    }
  }
}

// within-book duplicate content for different words (needed words only)
const dupes = [];
for (const b of books) {
  const id = b.id;
  const dir = path.join(ROOT, 'assets/books', id, 'audio/words');
  const byH = new Map();
  for (const w of neededByBook[id] || []) {
    const fp = path.join(dir, w + '.mp3');
    if (!fs.existsSync(fp)) continue;
    const h = md5(fp);
    if (!byH.has(h)) byH.set(h, []);
    byH.get(h).push(w);
  }
  for (const [h, ws] of byH) {
    if (ws.length > 1) dupes.push({ book: id, words: ws, hash: h.slice(0, 8) });
  }
}

console.log(JSON.stringify({ hashDriftFromNewestInGroup: drift, duplicateAudioSameBook: dupes }, null, 2));
