/**
 * Say mode: Next must unlock after 5 mic presses (doorFail, low score, errors).
 * Run: node test/say-max-tries.playwright.mjs
 */
import assert from 'assert';
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const TEST_STUDENT = 'zz_test_say5_unlock';
const BOOK = 'mlr_dec_001';
const wavPath = join(root, 'test', 'bench-wavs', 'correct-it-is-here.wav');

function mime(p) {
  const ext = extname(p);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = (req.url || '/').split('?')[0];
      const path = url === '/' ? '/index.html' : url;
      const file = join(root, path.replace(/^\//, ''));
      try {
        const st = statSync(file);
        if (!st.isFile()) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(file) });
        res.end(readFileSync(file));
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}/` });
    });
  });
}

async function waitSayIdle(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('speakStatus');
    if (!el) return false;
    const t = el.textContent || '';
    return !/Listening|Checking your speaking/i.test(t);
  }, { timeout: 120000 });
}

async function runScenario(browser, base, scenario) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.MRJ_AUTH = { student: () => null, token: () => '', signOut: () => {} };
    localStorage.setItem('mrj-dec-student', 'zz_test_say5_unlock');
  });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('pageerror:', err.message));
  await page.goto(base, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => typeof renderSay === 'function' && typeof $ === 'function', { timeout: 120000 });

  await page.evaluate(
    async ({ student, book, scenarioName }) => {
      localStorage.setItem('mrj-dec-student', student);
      const prog = {
        byStudent: {
          [student]: {
            [book]: {
              listen: true,
              read: true,
              song: true,
              dictation: true,
              speakPages: {},
              passed: false,
            },
          },
        },
      };
      localStorage.setItem('mrj_dec_progress_v4', JSON.stringify(prog));
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('mrj_say5_')) localStorage.removeItem(k);
      });

      const assetV = window.ASSET_V || '';
      const basePath = window.BASE || '/';
      if (!i18n) {
        i18n = await fetch(basePath + 'assets/decodable_i18n.json?v=' + assetV).then((r) => r.json());
      }
      pack = await fetch(basePath + 'assets/align_' + book + '.json?v=' + assetV).then((r) => r.json());
      mode = 'speak';
      sayPage = 0;
      introDone = true;
      pronounceLoaded = true;

      window.MRJPronounce = {
        load: async () => true,
        grade: async () => {
          if (scenarioName === 'gradeError') throw new Error('mock grade timeout');
          if (scenarioName === 'doorFail') {
            return {
              doorFail: true,
              reason: 'Say the sentence again, please. Say each word clearly.',
              overall: { score: 0, band: 'fail' },
              meta: { scoring_mode: 'hubert-phoneme' },
              words: [],
            };
          }
          if (scenarioName === 'lowScore') {
            return {
              doorFail: false,
              overall: { score: 0.22, band: 'fail' },
              scorePct: 22,
              meta: { scoring_mode: 'hubert-phoneme' },
              words: [{ word: 'test', score: 0.22 }],
              model_id: 'mock',
            };
          }
          return {
            doorFail: false,
            overall: { score: 0.85, band: 'pass' },
            meta: { scoring_mode: 'hubert-phoneme' },
            words: [],
            model_id: 'mock',
          };
        },
      };

      $('workStage').classList.remove('hidden');
      const gate = document.getElementById('mrj-auth-gate');
      if (gate) gate.classList.add('hidden');
      renderSay();
    },
    { student: TEST_STUDENT, book: BOOK, scenarioName: scenario },
  );

  await page.waitForSelector('#sayLine', { timeout: 30000 });

  for (let i = 0; i < 5; i++) {
    await page.click('#sayLine', { force: true });
    if (i < 4) {
      await page.waitForTimeout(400);
      const stop = page.locator('#sayStop');
      if (await stop.isVisible()) await stop.click({ force: true });
      await waitSayIdle(page);
    }
  }

  await page.waitForFunction(() => {
    const btn = document.getElementById('sayNext');
    return btn && !btn.classList.contains('hidden');
  }, { timeout: 15000 });

  const nextVisible = await page.evaluate(() => {
    const btn = document.getElementById('sayNext');
    return !!(btn && !btn.classList.contains('hidden'));
  });
  assert.ok(nextVisible, `${scenario}: #sayNext should be visible after 5 mic presses`);

  const tries = await page.evaluate(() => sayTries);
  assert.ok(tries >= 5, `${scenario}: sayTries should be >= 5 (got ${tries})`);

  await context.close();
}

const { server, base } = await startStaticServer();

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${wavPath}`,
  ],
});

try {
  for (const scenario of ['doorFail', 'lowScore', 'gradeError']) {
    await runScenario(browser, base, scenario);
    console.log('say-max-tries:', scenario, 'ok');
  }
  console.log('say-max-tries: all scenarios passed');
} finally {
  await browser.close();
  server.close();
}
