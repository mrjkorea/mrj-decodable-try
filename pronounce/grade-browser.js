/* MRJ Pronounce — in-page grader (no /api/grade). Same wav2vec2 GOP engine. */
(function (global) {
  const PARTS = [
    'model_int8.onnx.part00',
    'model_int8.onnx.part01',
    'model_int8.onnx.part02',
    'model_int8.onnx.part03',
    'model_int8.onnx.part04'
  ];
  let session = null;
  let ready = null;
  let base = '';

  function setBase(b) {
    base = b.endsWith('/') ? b : b + '/';
  }

  async function concatParts() {
    const bufs = [];
    let total = 0;
    const raw = 'https://raw.githubusercontent.com/mrjkorea/mrj-decodable-try/main/pronounce/model_parts/';
    for (const name of PARTS) {
      let r = await fetch(base + 'model_parts/' + name);
      if (!r.ok) r = await fetch(raw + name);
      if (!r.ok) throw new Error('missing model part ' + name);
      const u8 = new Uint8Array(await r.arrayBuffer());
      bufs.push(u8);
      total += u8.length;
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const b of bufs) { out.set(b, o); o += b.length; }
    return out.buffer;
  }

  async function load() {
    if (ready) return ready;
    ready = (async () => {
      if (typeof ort === 'undefined') throw new Error('onnxruntime missing');
      ort.env.wasm.wasmPaths = base + 'ort/';
      await loadG2P(base);
      const bytes = await concatParts();
      session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'] });
      try {
        const warm = new Float32Array(1600);
        await session.run({ input_values: new ort.Tensor('float32', warm, [1, 1600]) });
      } catch (_) {}
      return true;
    })().catch((e) => { ready = null; throw e; });
    return ready;
  }

  async function grade(blob, text) {
    await load();
    const samples = await decodeAudioToMono(blob, 16000);
    const stats = audioStats(samples, 16000);
    if (stats.durationMs < 80) throw new Error('too_short');
    const trimmed = capSpeechWindow(trimSilence(samples, 16000, 0.006, 80), 16000, 4500);
    const trimmedStats = audioStats(trimmed, 16000);
    const input = normalizeForModel(trimmed);
    const feeds = { input_values: new ort.Tensor('float32', input, [1, input.length]) };
    const results = await session.run(feeds);
    const logitsArr = results.logits.data;
    const T = results.logits.dims[1];
    const V = results.logits.dims[2];
    const logits = new Array(T);
    for (let t = 0; t < T; t++) logits[t] = logitsArr.subarray(t * V, (t + 1) * V);
    const { phones, words } = expectedPhoneSequence(text);
    return aggregate(text, words, forcedAlignGop(logits, phones, 0), trimmedStats.durationMs, 16000,
      'wav2vec2-lv-60-espeak-cv-ft-onnx-int8', 0, {
        clipping: stats.clipping, too_quiet: stats.tooQuiet, snr_est: stats.snrEst,
        warnings: stats.tooQuiet ? ['audio_too_quiet'] : []
      });
  }

  global.MRJPronounce = { setBase, load, grade };
})(window);
