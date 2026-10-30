/**
 * Letter-intro step in Chrome: cousin -> letter intro -> famous word -> Listen.
 * Covers the Next lock (a jump to the end does not count), book 1's four clips,
 * back-navigation, leaving for Books, a clip that fails to load, and align JSON
 * without letter_intros. Clips not yet in assets/decodable/letter_intro/ are
 * stood in by a short repo clip; clips that are there are also decoded.
 * Run: node test/letter-intro.playwright.mjs   (Google Chrome: H.264 mp4)
 */
import assert from 'assert';
import { chromium } from 'playwright';
import { createServer } from 'http';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const STUDENT = 'zz_test_letter_intro';
const INTRO_DIR = 'assets/decodable/letter_intro/';
const STAND_IN = join(root, 'assets/decodable/lawbreaker/jail_from.mp4');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};

function startStaticServer() {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\//, '') || 'index.html';
    let file = join(root, rel);
    if (rel.startsWith(INTRO_DIR) && rel.endsWith('.mp4') && !existsSync(file)) file = STAND_IN;
    let st = null;
    try { st = statSync(file); } catch { /* 404 below */ }
    if (!st || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    const head = { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (!m) { res.writeHead(200, { ...head, 'Content-Length': st.size }); res.end(readFileSync(file)); return; }
    let start = m[1] ? +m[1] : st.size - +m[2];
    let end = m[1] && m[2] ? +m[2] : st.size - 1;
    start = Math.max(0, start); end = Math.min(end, st.size - 1);
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    res.end(readFileSync(file).subarray(start, end + 1));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}

async function openLibrary(browser, base, progress) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  const posts = [], errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([student, prog]) => {
    localStorage.setItem('mrj-dec-student', student);
    if (prog) localStorage.setItem('mrj_dec_progress_v4', JSON.stringify(prog));
  }, [STUDENT, progress || null]);
  const authJs = `window.MRJ_AUTH={student:()=>localStorage.getItem('mrj-dec-student')||'',token:()=>'mock-token',signOut(){},noteScore(){}};`;
  await page.route('https://mrjkorea.github.io/**', (route) => {
    const url = route.request().url();
    if (url.includes('mrj-auth.js')) return route.fulfill({ contentType: 'application/javascript', body: authJs });
    return route.fulfill({ contentType: url.includes('.css') ? 'text/css' : 'application/javascript', body: '' });
  });
  await page.route('https://script.google.com/**', (route) => {
    posts.push(route.request().postData() || '');
    return route.fulfill({ contentType: 'application/json', body: '{"found":false,"status":"ok"}' });
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('#libStage:not(.hidden) .card');
  return { page, posts, errors };
}

const state = (page) => page.evaluate(() => {
  const v = document.getElementById('letterIntroVid');
  const lbl = document.querySelector('#introBody .g-lbl');
  const msg = document.getElementById('letterIntroMsg');
  return {
    step: introStep, idx: letterIntroIdx, badge: $('modeBadge').textContent,
    label: lbl ? lbl.textContent : '', msg: msg ? msg.textContent : '',
    goText: $('introGo').textContent, locked: $('introGo').disabled, src: v ? v.getAttribute('src') : '',
  };
});

async function openBookToLetterIntro(page, id, letters) {
  await page.click(`.card[data-id="${id}"]`);
  await page.waitForFunction(() => mode === 'intro' && introStep === 'cousin');
  for (const L of letters) {
    assert.strictEqual(await page.textContent('#introBody .en'), L, `${id}: cousin letter ${L}`);
    await page.click('#introGo');
  }
  await page.waitForSelector('#letterIntroVid');
}

/** Let the app's own autoplay run, then fast-forward real playback until Next unlocks. */
async function watchClip(page) {
  await page.waitForFunction(() => {
    const v = document.getElementById('letterIntroVid');
    return v && !v.paused && v.currentTime > 0;
  }, null, { timeout: 20000 });
  await page.evaluate(() => { document.getElementById('letterIntroVid').playbackRate = 8; });
  await page.waitForFunction(() => !document.getElementById('introGo').disabled, null, { timeout: 60000 });
}

const { server, base } = await startStaticServer();
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
try {
  // Book 1: four clips, the Next lock, back-navigation, then on through the famous word to Listen.
  {
    const { page, posts, errors } = await openLibrary(browser, base);
    await openBookToLetterIntro(page, 'mlr_dec_001', ['A', 'M', 'S', 'T']);
    let s = await state(page);
    assert.deepStrictEqual([s.step, s.badge, s.label, s.goText, s.locked], ['letter-intro', 'New sound', 'Letter intro · 1 / 4', 'Next', true]);
    assert.ok(s.src.endsWith('/assets/decodable/letter_intro/a_letter_intro.mp4?v=dec20261030-letter-intro'), s.src);
    await page.evaluate(() => introAdvance());
    assert.strictEqual((await state(page)).idx, 0, 'introAdvance holds while the clip is unwatched');

    await page.waitForFunction(() => { const v = $('letterIntroVid'); return v && v.duration > 1 && !v.paused; });
    await page.evaluate(() => { const v = $('letterIntroVid'); v.currentTime = v.duration - 0.2; });
    await page.waitForFunction(() => $('letterIntroVid').ended);
    s = await state(page);
    assert.ok(s.locked, 'a jump to the end must not unlock Next');
    assert.strictEqual(s.msg, 'Watch the whole video. Tap it to play again.');
    await page.click('#letterIntroScene');
    await watchClip(page);
    assert.strictEqual((await state(page)).msg, 'Tap Next.');

    for (const [n, L] of [[2, 'm'], [3, 's'], [4, 't']]) {
      await page.click('#introGo');
      s = await state(page);
      assert.deepStrictEqual([s.label, s.locked], [`Letter intro · ${n} / 4`, true]);
      assert.ok(s.src.includes(`/letter_intro/${L}_letter_intro.mp4?`), s.src);
      await watchClip(page);
    }
    await page.click('#introGo');
    s = await state(page);
    assert.deepStrictEqual([s.step, s.badge, s.goText], ['famous-card', 'Famous word', 'See the word']);
    const reported = await page.evaluate(() => bookProg('mlr_dec_001').reported);
    assert.ok(reported.includes('sound') && reported.includes('letter-intro'), JSON.stringify(reported));
    assert.ok(posts.some((b) => b.includes('mlr_dec_001:letter-intro')), 'letter-intro completion posted');

    await page.evaluate(() => testBackIntro());
    s = await state(page);
    assert.deepStrictEqual([s.step, s.idx, s.label, s.locked], ['letter-intro', 3, 'Letter intro · 4 / 4', false]);
    for (let i = 0; i < 3; i++) await page.evaluate(() => testBackIntro());
    s = await state(page);
    assert.deepStrictEqual([s.step, s.idx, s.label, s.locked], ['letter-intro', 0, 'Letter intro · 1 / 4', false]);
    await page.evaluate(() => testBackIntro());
    s = await state(page);
    assert.deepStrictEqual([s.step, s.badge], ['cousin', 'The consonant T']);
    await page.click('#introGo');
    s = await state(page);
    assert.deepStrictEqual([s.step, s.idx, s.locked], ['letter-intro', 0, false], 'watched clips stay open this visit');
    for (let i = 0; i < 4; i++) await page.click('#introGo');
    assert.strictEqual((await state(page)).step, 'famous-card');

    await page.click('#introGo');
    assert.strictEqual((await state(page)).step, 'famous');
    await page.evaluate(() => { $('carpetVid').playbackRate = 4; });
    await page.waitForFunction(() => { if (audio) audio.playbackRate = 4; return !$('introGo').disabled; }, null, { timeout: 60000, polling: 200 });
    await page.click('#introGo');
    await page.waitForFunction(() => mode === 'listen' && introDone && !$('bookStage').classList.contains('hidden'));
    assert.deepStrictEqual(errors, []);
    await page.close();
    console.log('letter-intro: book 1 (4 clips, lock, back-nav, famous -> Listen) ok');
  }

  // Book 2: one clip; Books stops it; a clip that fails to load; align JSON without letter_intros.
  {
    const { page, errors } = await openLibrary(browser, base, { byStudent: { [STUDENT]: { mlr_dec_001: { passed: true } } } });
    await openBookToLetterIntro(page, 'mlr_dec_002', ['P']);
    let s = await state(page);
    assert.deepStrictEqual([s.step, s.label, s.locked], ['letter-intro', 'Letter intro', true]);
    assert.ok(s.src.includes('/letter_intro/p_letter_intro.mp4?'), s.src);
    await page.waitForFunction(() => { const v = $('letterIntroVid'); return v && !v.paused && v.currentTime > 0; });
    await page.evaluate(() => { window.__introVid = $('letterIntroVid'); });
    await page.click('#btnLibrary');
    await page.waitForSelector('#libStage:not(.hidden)');
    await page.waitForFunction(() => window.__introVid.paused && !document.getElementById('letterIntroVid'), null, { timeout: 2000 });

    await page.route('**/letter_intro/p_letter_intro.mp4*', (route) => route.fulfill({ status: 404, body: 'missing' }));
    await openBookToLetterIntro(page, 'mlr_dec_002', ['P']);
    await page.waitForFunction(() => !$('introGo').disabled);
    assert.strictEqual((await state(page)).msg, 'This video did not load. Tap Next.');
    await page.click('#introGo');
    assert.strictEqual((await state(page)).step, 'famous-card');
    await page.unroute('**/letter_intro/p_letter_intro.mp4*');

    await page.route('**/assets/align_mlr_dec_002.json*', async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      delete json.letter_intros;
      await route.fulfill({ response: res, json });
    });
    await page.click('#btnLibrary');
    await openBookToLetterIntro(page, 'mlr_dec_002', ['P']);
    s = await state(page);
    assert.strictEqual(await page.evaluate(() => pack.letter_intros), undefined);
    assert.ok(s.src.includes('/letter_intro/p_letter_intro.mp4?'), 'LETTER_INTROS fallback: ' + s.src);
    await watchClip(page);
    await page.click('#introGo');
    assert.strictEqual((await state(page)).step, 'famous-card');
    assert.deepStrictEqual(errors, []);
    await page.close();
    console.log('letter-intro: book 2 (Books stops clip, load error, JSON fallback) ok');
  }

  const names = [];
  for (let n = 1; n <= 20; n++) {
    const align = JSON.parse(readFileSync(join(root, `assets/align_mlr_dec_${String(n).padStart(3, '0')}.json`), 'utf8'));
    names.push(...align.letter_intros);
  }
  const present = names.filter((f) => existsSync(join(root, INTRO_DIR, f)));
  if (!present.length) {
    console.log('letter-intro: no mp4s committed yet, so the flow ran on a stand-in clip');
  } else {
    const page = await browser.newPage();
    for (const f of present) {
      const r = await page.evaluate((src) => new Promise((done) => {
        const v = document.createElement('video');
        v.onloadedmetadata = () => done({ ok: v.duration > 0, duration: v.duration });
        v.onerror = () => done({ ok: false, error: v.error && v.error.code });
        v.src = src;
      }), base + INTRO_DIR + f);
      assert.ok(r.ok, `${f} does not decode in Chrome: ${JSON.stringify(r)}`);
    }
    await page.close();
    console.log(`letter-intro: ${present.length}/${names.length} committed clips decode`);
  }
} finally {
  await browser.close();
  server.close();
}
