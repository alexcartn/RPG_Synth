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
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.detail||e.message||e);if(!/Not implemented: (navigation|window.scrollTo)/.test(m))errs.push(m)});vc.on('error',e=>errs.push(String(e)));
class Param{constructor(){this.value=0}setValueCurveAtTime(){return this}setValueAtTime(){return this}linearRampToValueAtTime(){return this}exponentialRampToValueAtTime(){return this}setTargetAtTime(){return this}cancelScheduledValues(){return this}}
let nodes=0;
class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.detune=new Param();this.Q=new Param();this.pan=new Param();this.delayTime=new Param();this.threshold=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();this.playbackRate=new Param();this.offset=new Param();nodes++}setPeriodicWave(){}connect(x){return x}disconnect(){}start(){}stop(){}getByteTimeDomainData(b){b.fill(128)}}
class Ctx{constructor(){this.sampleRate=44100;this.currentTime=0;this.destination=new Node()}
 createGain(){return new Node()}createDynamicsCompressor(){return new Node()}createWaveShaper(){return new Node()}createDelay(){return new Node()}
 createBuffer(c,l,sr){const d=[...Array(c)].map(()=>new Float32Array(l));return{numberOfChannels:c,length:l,sampleRate:sr,getChannelData:i=>d[i]}}
 createConvolver(){return new Node()}createOscillator(){return new Node()}createConstantSource(){return new Node()}createPeriodicWave(){return {}}createBiquadFilter(){return new Node()}createBufferSource(){return new Node()}createStereoPanner(){return new Node()}createAnalyser(){return new Node()}close(){}}
class Off extends Ctx{constructor(c,l,sr){super();this.sampleRate=sr;this._c=c;this._l=l}startRendering(){const b=this.createBuffer(this._c,this._l,this.sampleRate);b.getChannelData(0)[100]=.3;b.getChannelData(1)[100]=.3;return Promise.resolve(b)}}
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.TextEncoder=TextEncoder;w.AudioContext=Ctx;w.lamejs={Mp3Encoder:class{encodeBuffer(){return new Int8Array(8)}flush(){return new Int8Array(2)}}};w.OfflineAudioContext=Off;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:0}):()=>{},set:()=>true});}});
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
 // minuteur d'extinction, univers, nouveaux timbres
 d.getElementById('sleep').value='15'; d.getElementById('sleep').dispatchEvent(new w.Event('change'));
 console.log('minuteur :',d.getElementById('sleepNote').textContent);
 d.getElementById('sleep').value='0'; d.getElementById('sleep').dispatchEvent(new w.Event('change'));
 const un=d.getElementById('univers'); console.log('univers',[...un.options].map(o=>o.value).join(','));
 for(const id of ['calme','espace','orient']){ un.value=id; un.dispatchEvent(new w.Event('change')); d.querySelectorAll('#presets .lnk').forEach(b=>b.click()); await new Promise(r=>setTimeout(r,150)); }
 console.log('glose :',d.getElementById('presetGloss').textContent);
 for(const inst of ['luth','harpe','flute','carillon','orgue','oud','ney','kalimba','bol','verre','synthe','archet','cuivre','atelier']) w.eval(`(()=>{const e=buildEngine(new AudioContext(),merge(clone(DEFAULT),{mel:{inst:"${inst}"},canon:{lvl:.5,inst:"${inst}"},loops:{lvl:.5,inst:"${inst}"},pend:{lvl:.5,inst:"${inst}"}}),{});e.start(0,5,0);e.schedule(60);})()`);
 for(const tm of ['anche','orgue','choeur','bol','pur']) w.eval(`(()=>{const e=buildEngine(new AudioContext(),merge(clone(DEFAULT),{drone:{timbre:"${tm}"}}),{});e.start(0,5,0);})()`);
 for(const tm of ['choeur','cordes','orgue','synthe','verre','atelier']) w.eval(`(()=>{const e=buildEngine(new AudioContext(),merge(clone(DEFAULT),{pad:{lvl:.5,timbre:"${tm}"}}),{});e.start(0,5,0);e.schedule(60);})()`);
 console.log('timbres : construits sans erreur');
 // musique modale, cordes physiques, acoustiques et adaptation
 w.eval(`(()=>{ for(const [n,o] of PRESETS){ for(const lg of ["modal","hasard"]) for(const md of ["physique","classique"]){ const S2=merge(clone(DEFAULT),clone(o)); S2.mus={logic:lg,model:md}; const e=buildEngine(new AudioContext(),S2,{record:true}); e.start(0,5,0); e.schedule(120); e.replan("all"); e.freeze(true); e.freeze(false); e.reroll(); } }
   for(const room of ["gen","chapelle","salle","grotte","plaque"]){ const S2=merge(clone(DEFAULT),{fx:{room}}); buildEngine(new AudioContext(),S2,{}).setReverb(); }
   for(const mode of ["off","heure","apaiser"]){ const S2=merge(clone(DEFAULT),{adapt:{mode,amount:1,span:30}}); const e=buildEngine(new AudioContext(),S2,{}); e.start(0,5,0); e.schedule(60); e.adaptNow(); e.tensNow(); } })()`);
 console.log('musique modale, cordes physiques, acoustiques, adaptation : aucun échec sur', w.eval('PRESETS.length'), 'préréglages');
 // quarts de ton : cercle à 24 positions, noms, MIDI avec pitch bend ; sons de nature
 console.log('cercle : positions',d.querySelectorAll('.note-g').length,'dont quarts de ton',d.querySelectorAll('.note-g.q').length);
 {const sel=d.getElementById('c_scales_0'); sel.value='bayati'; sel.dispatchEvent(new w.Event('change')); await new Promise(r=>setTimeout(r,100));
  console.log('Bayati :',d.getElementById('ringcap').textContent);
  const mid=w.eval(`(()=>{const S2=merge(clone(DEFAULT),{scales:["bayati","",""],mel:{lvl:.6}});const e=buildEngine(new AudioContext(),S2,{record:true});e.start(0,5,0);e.schedule(120);const m=midiFile(e.events,S2);let n=0;for(let i=0;i<m.length;i++)if(m[i]===0xE0)n++;return {octets:m.length,bends:n,frac:e.events.filter(x=>x.off%1!==0).length};})()`);
  console.log('MIDI quarts de ton :',JSON.stringify(mid));
  d.querySelectorAll('.note-g.q')[2].dispatchEvent(new w.Event('click'));
  console.log('gamme libre 24 cases :',w.eval('S.custom.length'),'| gamme',w.eval('S.scales[0]'));
  sel.value='mixolydien'; sel.dispatchEvent(new w.Event('change'));}
 for(const k of ['pluie','mer','nuit','ruisseau','oiseaux']){ const e=d.getElementById('c_nature_'+k); e.value='0.6'; e.dispatchEvent(new w.Event('input')); e.dispatchEvent(new w.Event('change')); }
 await new Promise(r=>setTimeout(r,1500));
 console.log('nature : lecture toujours active',d.getElementById('play').getAttribute('aria-pressed'));
 for(const k of ['pluie','mer','nuit','ruisseau','oiseaux']){ const e=d.getElementById('c_nature_'+k); e.value='0'; e.dispatchEvent(new w.Event('input')); e.dispatchEvent(new w.Event('change')); }
 // mode Jeu : boutons, pad XY, cercle jouable, clavier, figer, replanification
 d.getElementById('jeuBtn').click(); await new Promise(r=>setTimeout(r,150));
 console.log('jeu : actif',w.eval('JEU.on'),'| boutons',d.querySelectorAll('#knobs .knob').length,'| cercle déplacé',!!d.querySelector('#ringSlot .ringwrap'));
 {const kb=d.querySelector('#knobs .knob'); const v0=w.eval('S.vol'); kb.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})); console.log('bouton au clavier : volume',v0,'→',w.eval('S.vol.toFixed(2)'),'| curseur du chapitre',d.getElementById('c_vol').value);}
 d.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyZ',key:'w',bubbles:true})); d.dispatchEvent(new w.KeyboardEvent('keydown',{code:'KeyA',key:'q',bubbles:true}));
 await new Promise(r=>setTimeout(r,60));
 console.log('notes jouées au clavier :',w.eval("VIZ.ev.filter(e=>e.kind==='play').length"));
 d.querySelectorAll('.note-g')[0].dispatchEvent(new w.Event('click')); d.querySelectorAll('.note-g')[4].dispatchEvent(new w.Event('click'));
 d.getElementById('jeuFreeze').click(); console.log('figer :',w.eval('S.mel.deja'),w.eval('S.mel.loop')); d.getElementById('jeuFreeze').click(); console.log('relâché :',w.eval('S.mel.deja'));
 d.getElementById('jeuReroll').click();
 w.eval('live.eng.replan("all")'); w.eval('live.eng.replan("mel")');
 d.getElementById('reglBtn').click(); console.log('retour aux réglages, cercle revenu',!!d.querySelector('.marge .ringwrap'));
 // atelier : mode, patches, notes tenues, machine en sourdine
 d.getElementById('atelierBtn').click(); await new Promise(r=>setTimeout(r,100));
 console.log('atelier : mode',w.eval('MODE'),'| boutons',d.querySelectorAll('#atelier .knob').length,'| touches',d.querySelectorAll('#piano .pk').length,'| patches',d.getElementById('synPatch').options.length);
 w.eval('loadSynPatch(SYN_PATCHES[3][1],SYN_PATCHES[3][0])'); w.eval('S.syn=synRandom(Math.random)'); w.eval('atelierSync()');
 {const pe=new w.Event('pointerdown',{bubbles:true}); pe.pointerId=7; d.getElementById('piano').querySelector('.pk').dispatchEvent(pe);}
 console.log('atelier : notes tenues',w.eval('AT.notes.size')); d.getElementById('atPanic').click();
 d.getElementById('atMach').click(); console.log('atelier : machine en sourdine',w.eval('S.mach===false')); d.getElementById('atMach').click();
 w.eval('live.eng.synOn(0,0.7).release()');
 d.getElementById('reglBtn').click();
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
