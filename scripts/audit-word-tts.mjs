#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/decodable_library.json'), 'utf8'));

function readUnits(text) {
  const units = [];
  const re = /[A-Za-z']+|[^A-Za-z']+/g;
  let m;
  const src = String(text || '');
  while ((m = re.exec(src))) {
    const tok = m[0];
    if (/[A-Za-z']/.test(tok)) units.push({ kind: 'word', show: tok, lemma: tok.toLowerCase() });
  }
  return units;
}

function lemmasFromPages(pages) {
  const set = new Set();
  for (const p of pages) {
    for (const u of readUnits(p.text)) {
      if (u.kind === 'word') set.add(u.lemma);
    }
  }
  return set;
}

function md5(file) {
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function fileSize(file) {
  return fs.statSync(file).size;
}

const books = lib.books.filter((b) => /^mlr_dec_0(0[1-9]|1[0-9]|20)$/.test(b.id));

const globalHashToWords = new Map(); // hash -> [{book, word}]
const allIssues = [];

for (const b of books) {
  const alignPath = path.join(ROOT, 'assets', b.align);
  const align = JSON.parse(fs.readFileSync(alignPath, 'utf8'));
  const bookId = align.book_id;
  const wordsDir = path.join(ROOT, 'assets/books', bookId, 'audio/words');
  const needed = lemmasFromPages(align.pages);
  const have = new Set(
    fs.existsSync(wordsDir)
      ? fs.readdirSync(wordsDir).filter((f) => f.endsWith('.mp3')).map((f) => f.replace(/\.mp3$/, ''))
      : []
  );

  const missing = [...needed].filter((w) => !have.has(w)).sort();
  const extra = [...have].filter((w) => !needed.has(w)).sort();

  const short = [];
  const dupWithinBook = new Map();
  for (const w of needed) {
    const fp = path.join(wordsDir, w + '.mp3');
    if (!fs.existsSync(fp)) continue;
    const sz = fileSize(fp);
    if (sz < 800) short.push({ w, sz });
    const h = md5(fp);
    if (!dupWithinBook.has(h)) dupWithinBook.set(h, []);
    dupWithinBook.get(h).push(w);
    const key = h;
    if (!globalHashToWords.has(key)) globalHashToWords.set(key, []);
    globalHashToWords.get(key).push({ book: bookId, word: w, sz });
  }

  const withinDupes = [...dupWithinBook.entries()]
    .filter(([, ws]) => ws.length > 1)
    .map(([h, ws]) => ({ words: ws, hash: h.slice(0, 8) }));

  // plural/singular: missing plural but have singular or vice versa
  const morph = [];
  for (const w of missing) {
    if (w.endsWith('s') && have.has(w.slice(0, -1))) morph.push({ missing: w, haveInstead: w.slice(0, -1) });
    if (w.endsWith('es') && have.has(w.slice(0, -2))) morph.push({ missing: w, haveInstead: w.slice(0, -2) });
    if (!w.endsWith('s') && have.has(w + 's')) morph.push({ missing: w, haveInstead: w + 's' });
  }

  allIssues.push({
    book: bookId,
    title: align.title,
    needed: needed.size,
    have: have.size,
    missing,
    extra,
    short,
    withinDupes,
    morph,
  });
}

// Cross-book: same hash, different word string (strong wrong-audio signal)
const crossWrong = [];
for (const [h, entries] of globalHashToWords) {
  const words = new Set(entries.map((e) => e.word));
  if (words.size > 1 && entries.length > 1) {
    // only flag if words are not just same lemma across books
    const distinct = [...words];
    if (distinct.length > 1) {
      crossWrong.push({ hash: h.slice(0, 8), entries: entries.slice(0, 8), total: entries.length });
    }
  }
}

console.log(JSON.stringify({ books: allIssues, crossHashDifferentWord: crossWrong.slice(0, 50) }, null, 2));
