'use strict';
// Decodable Say uses the shared MRJ HuBERT checker: green 75 / yellow 50 / pass 60, 5 tries.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const gradeJs = fs.readFileSync(path.join(root, 'pronounce', 'grade-browser.js'), 'utf8');

assert.ok(html.includes('pronounce/grade-browser.js'), 'grade-browser required');
assert.ok(!/citrinet/i.test(html + gradeJs), 'no Citrinet left');
assert.ok(!html.includes('SpeechRecognition'), 'browser SpeechRecognition must not be used');
assert.ok(gradeJs.includes("https://mrjkorea.github.io/pronounce/src/shared.js"), 'loads the shared engine');
assert.ok(gradeJs.includes("APP_ID = 'decodables'"));
assert.ok(gradeJs.includes('green: 75, yellow: 50'), 'thresholds 75/50');
assert.ok(gradeJs.includes('PASS_PCT = 60'), 'pass 60');
assert.ok(/const SPEAK_DEFAULT=60;/.test(html), 'page pass 60');
assert.ok(html.includes("const b=ws>=75?'good':(ws>=50?'ok':'needs_work');"), 'chip colours 75/50');
if (html.includes('SAY_MAX_TRIES')) assert.ok(/const SAY_MAX_TRIES=5;/.test(html), '5 tries');
assert.ok(html.includes('mrj-signin/mrj-auth.js'), 'shared MRJ sign-in');
assert.ok(html.includes('data-mrj-app="mrj-decodable-try"'), 'decodable sign-in app id');
assert.ok(html.includes('function skipLocks()'), 'teacher / test lock bypass');
assert.ok(html.includes('mrj-teacher-unlock.js'), 'teacher unlock helper');
assert.ok(html.includes("ASSET_V='dec20261027-teacher'"), 'asset build stamp');
console.log('hubert-shared: ok');
