'use strict';
// Letter-intro step: align JSON lists, the index.html fallback map and the media folder agree.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const lib = JSON.parse(fs.readFileSync(path.join(root, 'assets/decodable_library.json'), 'utf8'));
const mediaDir = path.join(root, 'assets/decodable/letter_intro');

const mapSrc = html.match(/const LETTER_INTROS=(\{[\s\S]*?\});/);
assert.ok(mapSrc, 'LETTER_INTROS fallback map required');
const fallback = Function('return ' + mapSrc[1])();

const expected = new Set();
for (const book of lib.books) {
  const align = JSON.parse(fs.readFileSync(path.join(root, 'assets', book.align), 'utf8'));
  const list = align.letter_intros;
  assert.ok(Array.isArray(list) && list.length, `${book.id}: letter_intros missing`);
  assert.deepStrictEqual(fallback[book.id], list, `${book.id}: LETTER_INTROS differs from ${book.align}`);
  for (const f of list) {
    assert.match(f, /^[a-z0-9_]+_letter_intro\.mp4$/, `${book.id}: bad file name ${f}`);
    expected.add(f);
  }
  if (book.id !== 'mlr_dec_001') assert.strictEqual(list.length, 1, `${book.id}: one video`);
}
assert.deepStrictEqual(fallback.mlr_dec_001, ['a', 'm', 's', 't'].map((l) => l + '_letter_intro.mp4'));
assert.strictEqual(expected.size, 23, '23 letter-intro videos for books 1-20');

assert.ok(fs.existsSync(path.join(mediaDir, 'README.md')), 'letter_intro folder README');
const onDisk = fs.readdirSync(mediaDir).filter((f) => f.endsWith('.mp4'));
if (onDisk.length) {
  const missing = [...expected].filter((f) => !onDisk.includes(f));
  assert.deepStrictEqual(missing, [], 'letter-intro media drop is incomplete');
}

assert.ok(html.includes("asset('decodable/letter_intro/'+clips[at])"), 'videos load through asset()');
const cousinExits = html.match(/reportIntroStep\('sound'\);\s*introStep='letter-intro'/g) || [];
assert.strictEqual(cousinExits.length, 2, 'both cousin exits (last letter, no letters) go to letter-intro');
assert.ok(!/reportIntroStep\('sound'\);\s*introStep='famous-card'/.test(html), 'cousin must not skip letter-intro');
assert.ok(/reportIntroStep\('letter-intro'\);\s*introStep='famous-card'/.test(html), 'letter-intro hands off to famous-card');

console.log(`letter-intro: ok (${lib.books.length} books, ${expected.size} videos, ${onDisk.length} on disk)`);
