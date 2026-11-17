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
/* Banc de mesure musical. Les seuils décrivent une musique correcte (accords sur les mesures, danses sur la grille, pas de frottement),
   pas les résultats du moment : s'il échoue, c'est la musique qu'il faut corriger, pas le seuil. */
const NAMES=(process.argv.slice(2).find(a=>!a.startsWith('--'))||'Taberna,Tripudium,Chorea,Sidera,Somnus,Crypta,Bayati,Scriptorium').split(',');
const ONLY=process.argv.includes('--print');
/* depuis les versions ambiance, la taverne, le branle et la gigue sont des ambiances lentes au placement libre : plus aucune danse à caler sur la grille */
const DANCE=[], SLOW=['Sidera','Somnus','Taberna','Tripudium','Chorea'];
setTimeout(()=>{

 try{
 const rows=w.eval(`(()=>{ const out=[]; const NAMES=${JSON.stringify(NAMES)};
  const pc=x=>((x%12)+12)%12, q=(a,p)=>{ const b=a.slice().sort((x,y)=>x-y); return b[Math.min(b.length-1,Math.floor(p*(b.length-1)))]; };
  for(const nm of NAMES){ const p=PRESETS.find(x=>x[0]===nm); if(!p) continue;
   const A={n:0,uni:0,ton:0,notes:0,off:0,dur:0,long:0,ov:0,ovN:0,st:0,stOk:0,chg:0,chgOk:0,bass:0,rub:0,low:0,fills:0,fillOk:0,vel:[],lo:1e9,hi:-1e9,lo2:1e9,hi2:-1e9};
   for(let sd=1;sd<=4;sd++){
     const mk=(chance)=>{ const Sx=merge(clone(DEFAULT),clone(p[1])); Sx.seed=sd*7919; Sx.mel.lvl=0.6; if(!chance) Sx.chance={skip:0,ratchet:0,mutate:0,octave:0,rest:0}; const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(240); return {e,Sx}; };
     { const {e,Sx}=mk(true); const m=e.events.filter(x=>x.tr===0); for(const x of m){ A.lo2=Math.min(A.lo2,x.off); A.hi2=Math.max(A.hi2,x.off); } }
     const {e,Sx}=mk(false), E=e.E, t0=e.t0f(), bar=e.bar, m=e.events.filter(x=>x.tr===0).sort((a,b)=>a.t-b.t), ch=e.chords();
     for(let i=0;i<m.length;i++){ const x=m[i]; A.notes++; if(pc(x.off)===0) A.ton++;
       const qq=(x.t-t0)/E, k=Math.round(qq), ex=k+(k%2===1?Sx.swing*0.5:0); if(Math.abs(qq-ex)>0.1) A.off++;
       const d=x.dur/E; A.dur+=d; if(d>=6) A.long++; A.vel.push(x.vel);
       if(i>0){ A.n++; if(x.off===m[i-1].off) A.uni++; A.ovN++; if(x.t<m[i-1].t+m[i-1].dur-0.005) A.ov++; }
       if(k%2===0&&Math.abs(qq-k)<0.1){ let c=ch[0]; for(const z of ch){ if(z.t<=x.t+0.001) c=z; else break; } if(c){ A.st++; if(c.offs.some(o=>pc(o)===pc(x.off))) A.stOk++; } } }
     for(const c of ch){ if(c.t>230) break; A.chg++; const b=(c.t-t0)/bar; if(Math.abs(b-Math.round(b))<0.02) A.chgOk++; }
     for(const x of e.events.filter(x=>x.tag==="bass")){ A.bass++; const d=Math.min(pc(x.off),12-pc(x.off)); if((d>0&&d<=2)) A.rub++; if(x.off<12) A.low++; }
     const ph=new Set(e.phraseBars()); for(const b of e.fillBars()){ A.fills++; if(ph.has(b+1)) A.fillOk++; }
   }
   const db=20*Math.log10(q(A.vel,0.9)/Math.max(1e-3,q(A.vel,0.1)));
   out.push({nm,notes:A.notes,uni:A.uni/Math.max(1,A.n),ton:A.ton/Math.max(1,A.notes),off:A.off/Math.max(1,A.notes),dur:A.dur/Math.max(1,A.notes),long:A.long/Math.max(1,A.notes),ov:A.ov/Math.max(1,A.ovN),
     chordTone:A.stOk/Math.max(1,A.st),chgOk:A.chgOk/Math.max(1,A.chg),chg:A.chg,bass:A.bass,rub:A.rub,low:A.low,fills:A.fills,fillOk:A.fillOk/Math.max(1,A.fills),db,range:(A.hi2-A.lo2)/12});
  } return out; })()`);
 const f=x=>typeof x==='number'?(Math.abs(x)<10?x.toFixed(2):x.toFixed(0)):x;
 console.log('préréglage | notes | unissons | tonique | hors grille | chevauch. | accord/temps fort | accords sur mesure | basse (frott.) | relances/phrases | dyn p10-p90 dB | tessiture');
 let fail=0;
 for(const r of rows){ console.log([r.nm,r.notes,f(r.uni),f(r.ton),f(r.off),f(r.ov),f(r.chordTone),f(r.chgOk)+' ('+r.chg+')',r.bass+' ('+r.rub+')',f(r.fillOk)+' ('+r.fills+')',f(r.db),f(r.range)].join(' | '));
  if(ONLY) continue;
  const ck=(c,m)=>{ if(!c){ console.log('  ECHEC '+r.nm+' : '+m); fail++; } };
  ck(r.chgOk>=0.999,'changements d\'accord hors mesure : '+f(1-r.chgOk)+' (aucun toléré)');
  ck(r.ov<=0.01,'notes qui démarrent avant la fin de la précédente : '+f(r.ov)+' (max 0,01)');
  ck(r.rub===0&&r.low===0,'basse qui frotte contre le bourdon : '+r.rub+', sous le registre : '+r.low+' (aucune)');
  ck(r.chordTone>=0.75,'notes d\'accord sur les temps forts : '+f(r.chordTone)+' (min 0,75)');
  ck(r.uni<0.15,'unissons '+f(r.uni)+' (max 0,15)'); ck(r.ton<0.22,'tonique '+f(r.ton)+' (max 0,22)');
  ck(r.db>=4,'dynamique (écart 10e-90e centile) '+f(r.db)+' dB (min 4)'); ck(r.range<=3.01,'tessiture '+f(r.range)+' octaves (max 3)');
  ck(r.fills===0||r.fillOk>=0.95,'relances de percussion hors début de phrase : '+f(1-r.fillOk)+' (max 0,05)');
  if(DANCE.includes(r.nm)) ck(r.off<=0.03,'danse : '+f(r.off)+' des notes hors grille (max 0,03)');
  if(SLOW.includes(r.nm)){ ck(r.dur>=3,'durée moyenne '+f(r.dur)+' croches (min 3)'); ck(r.long>=0.05,'notes tenues '+f(r.long)+' (min 0,05)'); ck(r.off>=0.1,'placement libre '+f(r.off)+' (min 0,10)'); } }
 console.log('ERREURS',errs.length?errs:'aucune'); process.exit(fail||errs.length?1:0);
 }catch(e){ console.log('EXCEPTION',e&&e.stack||e); process.exit(1); }
},500);
