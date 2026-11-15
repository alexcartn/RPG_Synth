const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');
const root=require('path').join(__dirname,'..');
// inline les scripts locaux : jsdom n'exécute pas les <script src> sans resources:'usable'
const html=fs.readFileSync(require('path').join(root,'index.html'),'utf8').replace(/<link[^>]*>/g,'')
  .replace(/<script src="([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync(require('path').join(root,f),'utf8')+'</script>');
// PWA : tout ce que le service worker met en cache doit exister, et le manifeste doit être valide
{const sw=fs.readFileSync(require('path').join(root,'sw.js'),'utf8'), list=JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
 const miss=list.filter(f=>f!=='./'&&!fs.existsSync(require('path').join(root,f)));
 const mf=JSON.parse(fs.readFileSync(require('path').join(root,'manifest.webmanifest'),'utf8'));
 const missI=mf.icons.filter(i=>!fs.existsSync(require('path').join(root,i.src)));
 const idx=fs.readFileSync(require('path').join(root,'index.html'),'utf8');
 const unlisted=[...idx.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map(m=>m[1]).filter(f=>!list.includes(f));
 console.log('pwa : fichiers du cache',list.length,'manquants',miss.length?miss:'aucun','icones manquantes',missI.length?missI:'aucune','hors cache',unlisted.length?unlisted:'aucun');
 if(miss.length||missI.length||unlisted.length){console.log('ECHEC PWA');process.exit(1)}}
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.detail||e.message||e);if(!/Not implemented: navigation/.test(m))errs.push(m)});vc.on('error',e=>errs.push(String(e)));
class Param{constructor(){this.value=0}setValueAtTime(){return this}linearRampToValueAtTime(){return this}exponentialRampToValueAtTime(){return this}setTargetAtTime(){return this}cancelScheduledValues(){return this}}
let nodes=0;
class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.detune=new Param();this.Q=new Param();this.pan=new Param();this.delayTime=new Param();this.threshold=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();nodes++}connect(x){return x}disconnect(){}start(){}stop(){}getByteTimeDomainData(b){b.fill(128)}}
class Ctx{constructor(){this.sampleRate=44100;this.currentTime=0;this.destination=new Node()}
 createGain(){return new Node()}createDynamicsCompressor(){return new Node()}createWaveShaper(){return new Node()}createDelay(){return new Node()}
 createBuffer(c,l,sr){const d=[...Array(c)].map(()=>new Float32Array(l));return{numberOfChannels:c,length:l,sampleRate:sr,getChannelData:i=>d[i]}}
 createConvolver(){return new Node()}createOscillator(){return new Node()}createBiquadFilter(){return new Node()}createBufferSource(){return new Node()}createStereoPanner(){return new Node()}createAnalyser(){return new Node()}close(){}}
class Off extends Ctx{constructor(c,l,sr){super();this.sampleRate=sr;this._c=c;this._l=l}startRendering(){const b=this.createBuffer(this._c,this._l,this.sampleRate);b.getChannelData(0)[100]=.3;b.getChannelData(1)[100]=.3;return Promise.resolve(b)}}
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.TextEncoder=TextEncoder;w.AudioContext=Ctx;w.lamejs={Mp3Encoder:class{encodeBuffer(){return new Int8Array(8)}flush(){return new Int8Array(2)}}};w.OfflineAudioContext=Off;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{},set:()=>true});}});
const w=dom.window,d=w.document;
setTimeout(async()=>{
 console.log('chapitres',d.querySelectorAll('.chap').length,'controles',d.querySelectorAll('.ctl input,.ctl select').length,'ring',d.querySelectorAll('.note-g').length);
 d.getElementById('play').click(); await new Promise(r=>setTimeout(r,600));
 console.log('play pressed',d.getElementById('play').getAttribute('aria-pressed'),'noeuds',nodes);
 d.querySelectorAll('#presets .lnk').forEach(b=>b.click());
 await new Promise(r=>setTimeout(r,800));
 // fondu enchaîné : scène mémorisée puis rappelée pendant la lecture
 d.getElementById('saveScene').click();
 const sc=d.querySelectorAll('#scenes .lnk'); console.log('scenes',sc.length);
 sc[0].click(); await new Promise(r=>setTimeout(r,300));
 console.log('apres fondu, lecture',d.getElementById('play').getAttribute('aria-pressed'),'noeuds',nodes);
 // tension, boucles, pendules, déjà-vu pendant la lecture
 const set=(id,v)=>{const e=d.getElementById(id);e.value=v;e.dispatchEvent(new w.Event('input'));e.dispatchEvent(new w.Event('change'));};
 set('c_tension','0.9'); set('c_loops_lvl','0.6'); set('c_pend_lvl','0.5'); set('c_mel_deja','0.9');
 await new Promise(r=>setTimeout(r,2200));
 console.log('pendules visibles',!d.getElementById('pend').parentNode.hidden,'| qualité',d.getElementById('quality').value);
 d.getElementById('quality').value='eco'; d.getElementById('quality').dispatchEvent(new w.Event('change')); await new Promise(r=>setTimeout(r,300));
 // sons à la demande, courbe de tension, campagne
 const evb=[...d.querySelectorAll('#evBtns button')]; console.log('pad : boutons',evb.length,'actifs',evb.filter(b=>!b.disabled).length);
 evb.forEach(b=>b.click()); await new Promise(r=>setTimeout(r,100));
 [...d.querySelectorAll('.curvetools .lnk')][2].click(); await new Promise(r=>setTimeout(r,300));
 console.log('courbe : mode',w.eval('S.curve.mode'),'| valeur actuelle',w.eval('live.eng.tensNow().toFixed(2)'));
 d.getElementById('campGo').click(); await new Promise(r=>setTimeout(r,200));
 console.log('campagne : étape',w.eval('camp.idx'),'| statut',d.getElementById('campStatus').textContent);
 d.getElementById('campNext').click(); await new Promise(r=>setTimeout(r,200));
 console.log('campagne : étape suivante',w.eval('camp.idx'));
 d.getElementById('campGo').click();
 console.log('campagne arrêtée',w.eval('camp.running'));
 d.getElementById('play').click();
 for(const [stems,midi,loop,fmt] of [[false,false,false,'wav'],[false,false,false,'mp3-192'],[true,true,true,'both']]){
  d.getElementById('fmt').value=fmt;
  d.getElementById('xStems').checked=stems;d.getElementById('xMidi').checked=midi;d.getElementById('xLoop').checked=loop;
  if(stems)d.getElementById('dur').value='60';
  w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};
  d.getElementById('exp').click();
  for(let i=0;i<60&&d.getElementById('exp').disabled;i++)await new Promise(r=>setTimeout(r,200));
  console.log('export',fmt,stems,'=>',d.getElementById('status').textContent);
 }
 // toggle ring note, libre
 d.querySelectorAll('.note-g')[3].dispatchEvent(new w.Event('click'));
 console.log('scale0 apres clic',w.eval('S.scales[0]'),'custom',w.eval('JSON.stringify(S.custom)'));
 console.log('ERREURS',errs.length?errs:'aucune');
 process.exit(0);
},500);
