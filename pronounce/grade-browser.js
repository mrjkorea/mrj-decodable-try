/* MRJ Pronounce — in-page grader. Live Citrinet trial from pronounce-try. */
(function (global) {
  const ORIGIN = 'https://mrjkorea.github.io/pronounce-try/';
  const ORT_SRC = ORIGIN + 'vendor/ort/ort.wasm.min.js';
  const NEEDLE_SRC = ORIGIN + 'vendor/needle/needle.js';
  const TRIAL_SRC = ORIGIN + 'src/trial.js?v=20261010-citrinet';
  const WASM_PATHS = ORIGIN + 'vendor/ort/';
  const MODEL_PATHS = [
    ORIGIN + 'models/whistle/whistle.cact',
    ORIGIN + 'models/citrinet/model.int8.onnx',
    ORIGIN + 'models/citrinet/sp_pieces.json',
    ORIGIN + 'models/zipa/model.int8.onnx',
    ORIGIN + 'models/zipa/tokens.txt'
  ];

  let booted = null;
  let trialApi = null;

  function setBase() {}

  function emitProgress(onProgress, stage, pct) {
    if (typeof onProgress === 'function') {
      try { onProgress({ stage, pct }); } catch (_) {}
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const nodes = document.getElementsByTagName('script');
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].src === src && nodes[i].dataset.mrjReady === '1') {
          resolve();
          return;
        }
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { s.dataset.mrjReady = '1'; resolve(); };
      s.onerror = () => reject(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function pageResult(result) {
    const doorFail = !!(result && result.doorFail);
    const rawWords = doorFail ? [] : ((result && result.words) || []);
    const words = rawWords.map((w) => ({
      word: w.word,
      score: (Number(w.score) || 0) / 100,
      hint: typeof w.hint === 'string' ? w.hint : ''
    }));
    const score = doorFail ? 0 : (Number(result && result.score) || 0);
    const pass = doorFail ? false : !!(result && result.pass);
    const scorePct = doorFail ? 0 : Math.round(Number(result && result.scorePct) || score * 100);
    return Object.assign({}, result, {
      words,
      overall: { score, band: pass ? 'pass' : 'fail' },
      scorePct,
      pass,
      doorFail,
      reason: (result && result.reason) || '',
      model_id: 'citrinet-trial',
      meta: { scoring_mode: 'citrinet-trial' }
    });
  }

  async function load(onProgress) {
    if (booted) {
      const done = await booted;
      emitProgress(onProgress, 'done', 100);
      return done;
    }
    booted = (async () => {
      emitProgress(onProgress, 'download', 8);
      await loadScript(ORT_SRC);
      if (typeof global.createNeedle !== 'function') await loadScript(NEEDLE_SRC);
      emitProgress(onProgress, 'download', 24);
      trialApi = await import(TRIAL_SRC);
      emitProgress(onProgress, 'session', 40);
      await trialApi.bootTrialInPage({
        wasmPaths: WASM_PATHS,
        paths: MODEL_PATHS
      });
      emitProgress(onProgress, 'done', 100);
      return true;
    })().catch((e) => { booted = null; trialApi = null; throw e; });
    return booted;
  }

  async function grade(blob, text) {
    await load();
    const samples = await global.decodeAudioToMono(blob, 16000);
    const graded = await trialApi.gradeTrialSamples(samples, text, 60);
    return pageResult(graded.result);
  }

  global.MRJPronounce = { setBase, load, grade };
})(window);
