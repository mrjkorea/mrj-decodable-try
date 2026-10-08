/**
 * Headless header layout + reload library visibility (mock sign-in).
 * Run: node test/playwright-header-verify.mjs
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const TEST_STUDENT = 'zz_test_mrjmetrics';
const widths = [360, 390, 414, 1280];

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const filePath = join(root, p.replace(/^\//, ''));
      try {
        const st = statSync(filePath);
        if (!st.isFile()) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
        res.end(readFileSync(filePath));
      } catch (e) {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}/` });
    });
  });
}

async function stubSignInAndAuth(page) {
  const authJs = `
    window.MRJ_AUTH = window.MRJ_AUTH || {};
    MRJ_AUTH.student = function(){ return '${TEST_STUDENT}'; };
    MRJ_AUTH.token = function(){ return 'mock-token-layout'; };
    MRJ_AUTH.signOut = function(){};
  `;
  await page.route('**/*mrj-auth.js*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: authJs });
  });
  await page.route('**/*mrj-auth-boot.js*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
  await page.route('**/*mrj-auth.css*', (route) => {
    route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  await page.route('**/macros/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ found: false }),
    });
  });
}

async function applyMockSession(page) {
  await page.evaluate((student) => {
    localStorage.setItem('mrj-dec-student', student);
    if (window.MRJ_AUTH) {
      MRJ_AUTH.student = () => student;
      MRJ_AUTH.token = () => 'mock-token-layout';
    }
    window.dispatchEvent(new CustomEvent('mrj-auth-ready', { detail: { id: student } }));
  }, TEST_STUDENT);
}

function box(el) {
  return el.boundingBox();
}

async function measureHeader(page) {
  const header = page.locator('header');
  const pill = page.locator('[data-mrj-name-pill]');
  const lib = page.locator('#libStage');
  const doc = page.locator('html');
  const hb = await header.boundingBox();
  const pb = await pill.boundingBox();
  const lb = await lib.boundingBox();
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientW = await page.evaluate(() => document.documentElement.clientWidth);
  const libHidden = await lib.evaluate((n) => n.classList.contains('hidden'));
  const pillText = await pill.textContent();
  return {
    header: hb,
    pill: pb,
    libStage: lb,
    horizontalScroll: scrollW > clientW + 1,
    libVisible: !libHidden,
    pillText: (pillText || '').trim(),
  };
}

async function main() {
  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const table = [];

  try {
    for (const w of widths) {
      const context = await browser.newContext({ viewport: { width: w, height: 800 } });
      const page = await context.newPage();
      await stubSignInAndAuth(page);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await applyMockSession(page);
      await page.waitForSelector('#libStage:not(.hidden)', { timeout: 20000 });
      let m = await measureHeader(page);
      table.push({
        viewport: w,
        phase: 'initial',
        ...m,
      });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await applyMockSession(page);
      await page.waitForSelector('#libStage:not(.hidden)', { timeout: 20000 });
      m = await measureHeader(page);
      table.push({
        viewport: w,
        phase: 'after_reload',
        ...m,
      });
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const failures = [];
  for (const row of table) {
    if (row.horizontalScroll) failures.push(`${row.viewport}/${row.phase}: horizontal scroll`);
    if (!row.libVisible) failures.push(`${row.viewport}/${row.phase}: library hidden`);
    if (!row.pill || row.pill.width < 1) failures.push(`${row.viewport}/${row.phase}: pill missing`);
    const docW = row.viewport;
    if (row.header && row.header.x + row.header.width > docW + 1) {
      failures.push(`${row.viewport}/${row.phase}: header overflows viewport`);
    }
  }

  console.log(JSON.stringify({ table, failures }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
