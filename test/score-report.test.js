'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('../dec-progress-merge.js');

const TEST_STUDENT = 'zz_test_mrjmetrics';
const FIXED_DATE = new Date(2026, 9, 11, 12, 0, 0);

(function testDictationReport() {
  const cmPosts = [];
  const ssiCalls = [];
  const env = {
    getStudent: function () { return TEST_STUDENT; },
    postMetrics: function (body) { cmPosts.push(body); },
    noteScore: function (p) { ssiCalls.push(p); }
  };
  const res = M.reportDecodableScore(env, 'mlr_dec_045', 'dictation', 4, 5, { missed: ['x'] }, {
    when: FIXED_DATE,
    completed: true
  });
  assert.strictEqual(res.status, 'ok');
  assert.strictEqual(cmPosts.length, 1);
  const ev = cmPosts[0].events[0];
  assert.strictEqual(ev.item_id, 'mlr_dec_045:dictation');
  assert.strictEqual(ev.score_value, 4);
  assert.strictEqual(ev.score_max, 5);
  assert.strictEqual(ev.score_pct, 80);
  assert.strictEqual(ev.local_date, '2026-10-11');
  assert.strictEqual(cmPosts[0].student_email, TEST_STUDENT);
  assert.strictEqual(cmPosts[0].session_id, 'decodable-zz_test_mrjmetrics-2026-10-11');
  assert.strictEqual(ssiCalls.length, 1);
  assert.deepStrictEqual(ssiCalls[0], {
    program: 'decodable',
    itemId: 'mlr_dec_045:dictation',
    scoreValue: 4,
    scoreMax: 5,
    scorePct: 80,
    localDate: '2026-10-11'
  });
})();

(function testSpeakTenPages() {
  const ssiCalls = [];
  const env = {
    getStudent: function () { return TEST_STUDENT; },
    postMetrics: function () {},
    noteScore: function (p) { ssiCalls.push(p); }
  };
  const bookId = 'mlr_dec_001';
  for (let i = 0; i < 10; i++) {
    const section = 'speak-p' + String(i + 1).padStart(2, '0');
    M.reportDecodableScore(env, bookId, section, 70, 100, null, { when: FIXED_DATE });
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += 70;
  M.reportDecodableScore(env, bookId, 'speak', Math.round(sum), 1000, { pages: 10 }, {
    when: FIXED_DATE,
    itemType: 'section'
  });
  const pageScores = ssiCalls.filter(function (c) { return /:speak-p/.test(c.itemId); });
  assert.strictEqual(pageScores.length, 10);
  const speakTotal = ssiCalls.find(function (c) { return c.itemId === 'mlr_dec_001:speak'; });
  assert.ok(speakTotal);
  assert.strictEqual(speakTotal.scoreMax, 1000);
  assert.strictEqual(speakTotal.scoreValue, 700);
})();

(function testNoReportWhenSignedOut() {
  const cmPosts = [];
  const ssiCalls = [];
  const env = {
    getStudent: function () { return ''; },
    postMetrics: function (body) { cmPosts.push(body); },
    noteScore: function (p) { ssiCalls.push(p); }
  };
  const res = M.reportDecodableScore(env, 'mlr_dec_001', 'listen', 1, 1, null, {});
  assert.strictEqual(res.status, 'skipped');
  assert.strictEqual(cmPosts.length, 0);
  assert.strictEqual(ssiCalls.length, 0);
})();

(function testFailedSpeakTryCmOnly() {
  const cmPosts = [];
  const ssiCalls = [];
  const env = {
    getStudent: function () { return TEST_STUDENT; },
    postMetrics: function (body) { cmPosts.push(body); },
    noteScore: function (p) { ssiCalls.push(p); }
  };
  M.reportDecodableScore(env, 'mlr_dec_001', 'speak-p01', 42, 100, null, {
    when: FIXED_DATE,
    completed: false,
    noteScore: false,
    itemType: 'attempt'
  });
  assert.strictEqual(cmPosts.length, 1);
  assert.strictEqual(cmPosts[0].events[0].item_type, 'attempt');
  assert.strictEqual(ssiCalls.length, 0);
})();

(function testIndexCacheBustMatchesBuild() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const buildMatch = html.match(/<meta name="mrj-build" content="([^"]+)"/);
  assert.ok(buildMatch, 'mrj-build meta');
  const build = buildMatch[1];
  const mergeV = html.match(/dec-progress-merge\.js\?v=([^"]+)/);
  assert.ok(mergeV, 'dec-progress-merge cache param');
  assert.strictEqual(mergeV[1], build);
  const constBuild = html.match(/const MRJ_BUILD='([^']+)'/);
  assert.ok(constBuild);
  assert.strictEqual(constBuild[1], build);
})();

console.log('score-report: ok');
