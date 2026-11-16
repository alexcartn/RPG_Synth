const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const root=require('path').join(__dirname,'..');
// inline les scripts locaux : jsdom n'exécute pas les <script src> sans resources:'usable'
const html=fs.readFileSync(require('path').join(root,'index.html'),'utf8').replace(/<link[^>]*>/g,'')
  .replace(/<script src="([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync(require('path').join(root,f),'utf8')+'</script>');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.detail||e.message||e);if(!/Not implemented: (navigation|window.scrollTo)/.test(m))errs.push(m)});vc.on('error',e=>errs.push(String(e)));
class Param{constructor(){this.value=0}setValueCurveAtTime(){return this}setValueAtTime(){return this}linearRampToValueAtTime(){return this}exponentialRampToValueAtTime(){return this}setTargetAtTime(){return this}cancelScheduledValues(){return this}}
let nodes=0;
class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.detune=new Param();this.Q=new Param();this.pan=new Param();this.delayTime=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();this.playbackRate=new Param();this.offset=new Param();nodes++}setPeriodicWave(){}connect(x){return x}disconnect(){}start(){}stop(){}getByteTimeDomainData(b){b.fill(128)}}
class Ctx{constructor(){this.sampleRate=44100;this.currentTime=0;this.destination=new Node()}
 createGain(){return new Node()}createDynamicsCompressor(){return new Node()}createAnalyser(){const n=new Node();n.fftSize=2048;n.frequencyBinCount=1024;n.getFloatTimeDomainData=a=>a.fill(0);n.getFloatFrequencyData=a=>a.fill(-100);return n}createWaveShaper(){return new Node()}createDelay(){return new Node()}
 createBuffer(c,l,sr){const d=[...Array(c)].map(()=>new Float32Array(l));return{numberOfChannels:c,length:l,sampleRate:sr,getChannelData:i=>d[i]}}
 createConvolver(){return new Node()}createScriptProcessor(){return new Node()}createOscillator(){return new Node()}createConstantSource(){return new Node()}createPeriodicWave(){return {}}createBiquadFilter(){return new Node()}createBufferSource(){return new Node()}createStereoPanner(){return new Node()}createAnalyser(){const n=new Node();n.fftSize=2048;n.frequencyBinCount=1024;n.getFloatTimeDomainData=a=>a.fill(0);n.getFloatFrequencyData=a=>a.fill(-100);return n}close(){}}
class Off extends Ctx{constructor(c,l,sr){super();this.sampleRate=sr;this._c=c;this._l=l}startRendering(){const b=this.createBuffer(this._c,this._l,this.sampleRate);b.getChannelData(0)[100]=.3;b.getChannelData(1)[100]=.3;return Promise.resolve(b)}}
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.TextEncoder=TextEncoder;w.AudioContext=Ctx;w.lamejs={Mp3Encoder:class{encodeBuffer(){return new Int8Array(8)}flush(){return new Int8Array(2)}}};w.OfflineAudioContext=Off;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:0}):()=>{},set:()=>true});}});
const w=dom.window,d=w.document;
/* Banc de mesure musical : les seuils ci-dessous font échouer le test quand la musique se dégrade. */
const NAMES=(process.argv[2]||'Taberna,Sidera,Crypta,Bayati,Somnus,Chorea').split(',');
const ONLY=process.argv.includes('--print');
setTimeout(()=>{
 const rows=w.eval(`(()=>{ const out=[]; const NAMES=${JSON.stringify(NAMES)};
  for(const nm of NAMES){ const p=PRESETS.find(x=>x[0]===nm); if(!p) continue;
   let n=0,uni=0,ton=0,notes=0,offg=0,dsum=0,long=0,dmax=0,vmin=9,vmax=0,lo=1e9,hi=-1e9,tens=[];
   for(let sd=1;sd<=4;sd++){
     const Sx=merge(clone(DEFAULT),clone(p[1])); Sx.seed=sd*7919; Sx.mel.lvl=0.6;
     const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(240);
     const E=30/Sx.tempo, m=e.events.filter(x=>x.tr===0);
     for(let i=0;i<m.length;i++){ notes++; const pc=((m[i].off%12)+12)%12; if(pc===0) ton++;
       const q=m[i].t/E; if(Math.abs(q-Math.round(q))>0.06) offg++;
       const d=m[i].dur/E; dsum+=d; if(d>=6) long++; dmax=Math.max(dmax,d);
       vmin=Math.min(vmin,m[i].vel); vmax=Math.max(vmax,m[i].vel); lo=Math.min(lo,m[i].off); hi=Math.max(hi,m[i].off);
       if(i>0){ n++; if(m[i].off===m[i-1].off) uni++; } }
   }
   const pads=[]; 
   out.push({nm,notes,uni:uni/Math.max(1,n),ton:ton/Math.max(1,notes),offg:offg/Math.max(1,notes),dur:dsum/Math.max(1,notes),long:long/Math.max(1,notes),dmax,vmin,vmax,vdb:20*Math.log10(vmax/Math.max(1e-3,vmin)),range:(hi-lo)/12});
  } return out; })()`);
 const f=x=>typeof x==='number'?(Math.abs(x)<10?x.toFixed(2):x.toFixed(0)):x;
 console.log('préréglage | notes | unissons | tonique | hors grille | durée moy | ≥6 croches | dyn dB | tessiture (oct.)');
 let fail=0;
 for(const r of rows){ console.log([r.nm,r.notes,f(r.uni),f(r.ton),f(r.offg),f(r.dur),f(r.long),f(r.vdb),f(r.range)].join(' | '));
  if(!ONLY){ const ck=(c,m)=>{ if(!c){ console.log('  ECHEC '+r.nm+' : '+m); fail++; } };
   ck(r.uni<0.15,'unissons '+f(r.uni)+' (max 0,15)'); ck(r.ton<0.22,'tonique '+f(r.ton)+' (max 0,22)'); ck(r.vdb>=5.5,'dynamique '+f(r.vdb)+' dB (min 5,5)'); ck(r.range<=3.01,'tessiture '+f(r.range)+' octaves (max 3)');
   if(r.nm==='Sidera'||r.nm==='Somnus'){ ck(r.dur>=3,'durée moyenne '+f(r.dur)+' croches (min 3 pour une ambiance lente)'); ck(r.long>=0.05,'notes tenues (≥6 croches) '+f(r.long)+' (min 0,05)'); ck(r.offg>=0.1,'placement libre '+f(r.offg)+' (min 0,10)'); } } }
 console.log('ERREURS',errs.length?errs:'aucune'); process.exit(fail||errs.length?1:0);
},500);
