/* Browser wav2vec2 GOP grader — ONNX from Hugging Face CDN (not in git). */
(function(global){
  /* model_int8.onnx uses ConvInteger (no ort-web WASM); uint8 quant works in-browser. */
  const MODEL_ID='wav2vec2-lv-60-espeak-cv-ft-uint8';
  const HF='https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/resolve/main';
  const MODEL_URL=HF+'/onnx/model_uint8.onnx';
  function vocabUrl(){
    return global.MRJ_GRADE_VOCAB_URL || 'assets/wav2vec2-espeak-vocab.json';
  }
  const ORT_VER='1.22.0';
  const ORT_BASE='https://cdn.jsdelivr.net/npm/onnxruntime-web@'+ORT_VER+'/dist/';
  /** espeak en-us phones for decodable book vocabulary */
  const LEX={
    a:['eɪ'],at:['æ','t'],go:['ɡ','oʊ'],is:['ɪ','z'],it:['ɪ','t'],
    map:['m','æ','p'],mat:['m','æ','t'],pam:['p','æ','m'],pat:['p','æ','t'],
    pit:['p','ɪ','t'],sam:['s','æ','m'],sap:['s','æ','p'],sat:['s','æ','t'],
    tam:['t','æ','m'],tap:['t','æ','p'],taps:['t','æ','p','s'],tim:['t','ɪ','m'],tip:['t','ɪ','p']
  };

  let sessionP=null, vocabP=null, id2tok=null, modelBufP=null;

  async function loadModelBuffer(){
    if(modelBufP) return modelBufP;
    modelBufP=(async()=>{
      const resp=await fetch(MODEL_URL);
      if(!resp.ok) throw new Error('Could not download scoring model ('+resp.status+').');
      return resp.arrayBuffer();
    })();
    return modelBufP;
  }

  function band(score){
    if(score>=0.85) return 'Strong';
    if(score>=0.65) return 'Good';
    if(score>=0.50) return 'Fair';
    return 'Keep trying';
  }

  function parseWords(line){
    const out=[];
    for(const tok of String(line||'').split(/\s+/)){
      if(!tok.trim()) continue;
      const lemma=tok.replace(/[^A-Za-z']/g,'').toLowerCase();
      if(!lemma) continue;
      const phones=LEX[lemma];
      if(!phones) throw new Error('Unknown word "'+lemma+'" for scoring.');
      out.push({word:lemma, phones:phones.slice()});
    }
    if(!out.length) throw new Error('No words to score.');
    return out;
  }

  async function ensureOrt(){
    if(typeof ort==='undefined') throw new Error('ONNX Runtime Web not loaded.');
    ort.env.wasm.wasmPaths=ORT_BASE;
    ort.env.wasm.numThreads=1;
  }

  async function ensureVocab(){
    if(id2tok) return id2tok;
    if(!vocabP) vocabP=fetch(vocabUrl()).then(r=>{
      if(!r.ok) throw new Error('Could not load phoneme vocab.');
      return r.json();
    });
    const vocab=await vocabP;
    id2tok={};
    for(const [k,v] of Object.entries(vocab)) id2tok[v]=k;
    return id2tok;
  }

  async function ensureSession(onProgress){
    await ensureOrt();
    if(sessionP) return sessionP;
    sessionP=(async()=>{
      if(onProgress) onProgress('model');
      const buf=await loadModelBuffer();
      const sess=await ort.InferenceSession.create(buf, {
        executionProviders:['wasm'],
        graphOptimizationLevel:'all'
      });
      return sess;
    })();
    return sessionP;
  }

  function mixToMono(buf){
    if(buf.numberOfChannels===1) return buf.getChannelData(0);
    const n=buf.length, out=new Float32Array(n);
    for(let c=0;c<buf.numberOfChannels;c++){
      const ch=buf.getChannelData(c);
      for(let i=0;i<n;i++) out[i]+=ch[i];
    }
    const inv=1/buf.numberOfChannels;
    for(let i=0;i<n;i++) out[i]*=inv;
    return out;
  }

  function normalize(samples){
    const arr=samples instanceof Float32Array ? samples : Float32Array.from(samples);
    const n=arr.length||1;
    let mean=0; for(let i=0;i<n;i++) mean+=arr[i]; mean/=n;
    let v=0; for(let i=0;i<n;i++){ const d=arr[i]-mean; v+=d*d; } v/=n;
    const std=Math.sqrt(v+1e-7);
    for(let i=0;i<n;i++) arr[i]=(arr[i]-mean)/std;
    return arr;
  }

  async function blobTo16k(lineBlob){
    const ab=await lineBlob.arrayBuffer();
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    let decoded;
    try{ decoded=await ctx.decodeAudioData(ab.slice(0)); }
    finally{ await ctx.close().catch(()=>{}); }
    let mono=mixToMono(decoded);
    if(decoded.sampleRate!==16000){
      const dur=mono.length/decoded.sampleRate;
      const frames=Math.max(1, Math.ceil(dur*16000));
      const off=new OfflineAudioContext(1, frames, 16000);
      const tmp=off.createBuffer(1, mono.length, decoded.sampleRate);
      tmp.copyToChannel(mono, 0);
      const src=off.createBufferSource();
      src.buffer=tmp;
      src.connect(off.destination);
      src.start(0);
      const rendered=await off.startRendering();
      mono=rendered.getChannelData(0);
    }
    return normalize(mono);
  }

  function decodeCtc(logits, vmap){
    const T=logits.dims[1], V=logits.dims[2];
    const data=logits.data;
    const blank=0;
    let prev=-1;
    const phones=[];
    for(let t=0;t<T;t++){
      let best=0, bestV=-Infinity;
      for(let v=0;v<V;v++){
        const x=data[t*V+v];
        if(x>bestV){ bestV=x; best=v; }
      }
      if(best!==blank && best!==prev){
        const ph=vmap[best];
        if(ph && ph!=='<pad>' && ph!=='<s>' && ph!=='</s>' && ph!=='<unk>') phones.push(ph);
      }
      prev=best;
    }
    return phones;
  }

  function alignScore(exp, heard){
    const n=exp.length, m=heard.length;
    const dp=Array.from({length:n+1}, ()=>new Float64Array(m+1));
    const bt=Array.from({length:n+1}, ()=>new Array(m+1).fill(null));
    for(let i=1;i<=n;i++){ dp[i][0]=i; bt[i][0]='D'; }
    for(let j=1;j<=m;j++){ dp[0][j]=j; bt[0][j]='I'; }
    for(let i=1;i<=n;i++){
      for(let j=1;j<=m;j++){
        const cost=exp[i-1]===heard[j-1]?0:1;
        const opts=[[dp[i-1][j]+1,'D'],[dp[i][j-1]+1,'I'],[dp[i-1][j-1]+cost,'M']];
        let best=opts[0];
        for(let k=1;k<opts.length;k++) if(opts[k][0]<best[0]) best=opts[k];
        dp[i][j]=best[0]; bt[i][j]=best[1];
      }
    }
    const match=new Set();
    let i=n, j=m;
    while(i>0||j>0){
      const op=bt[i][j];
      if(op==='I') j--;
      else if(op==='D') i--;
      else{
        if(exp[i-1]===heard[j-1]) match.add(i-1);
        i--; j--;
      }
    }
    return match;
  }

  async function gradeLine(line, audioBlob, hooks){
    const words=parseWords(line);
    const exp=[]; const spans=[];
    for(const w of words){
      spans.push([exp.length, exp.length+w.phones.length]);
      exp.push(...w.phones);
    }
    const vmap=await ensureVocab();
    const sess=await ensureSession(hooks && hooks.onLoad);
    const input=await blobTo16k(audioBlob);
    const tensor=new ort.Tensor('float32', input, [1, input.length]);
    const out=await sess.run({input_values:tensor});
    const logits=out.logits;
    const heard=decodeCtc(logits, vmap);
    const matched=alignScore(exp, heard);
    const wordScores=words.map((w,idx)=>{
      const [a,b]=spans[idx];
      let hit=0;
      for(let k=a;k<b;k++) if(matched.has(k)) hit++;
      const score=(b>a)? hit/(b-a) : 0;
      return {word:w.word, score};
    });
    const overall=wordScores.reduce((s,w)=>s+w.score,0)/wordScores.length;
    return {
      overall:{score:overall, band:band(overall)},
      words:wordScores,
      model_id:MODEL_ID
    };
  }

  global.MrjBrowserGrader={
    MODEL_ID,
    preparing:false,
    async grade(line, blob, statusFn){
      const hooks={
        onLoad:()=>{ if(statusFn) statusFn('Preparing scoring…'); }
      };
      if(!sessionP && statusFn) statusFn('Preparing scoring…');
      return gradeLine(line, blob, hooks);
    }
  };
})(typeof window!=='undefined'?window:globalThis);
