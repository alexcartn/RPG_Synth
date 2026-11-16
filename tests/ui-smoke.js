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
class Node{constructor(){this.gain=new Param();this.frequency=new Param();this.detune=new Param();this.Q=new Param();this.pan=new Param();this.delayTime=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();this.playbackRate=new Param();this.offset=new Param();nodes++}setPeriodicWave(){}connect(x){return x}disconnect(){}start(){}stop(){}getByteTimeDomainData(b){b.fill(128)}}
class Ctx{constructor(){this.sampleRate=44100;this.currentTime=0;this.destination=new Node()}
 createGain(){return new Node()}createDynamicsCompressor(){return new Node()}createAnalyser(){const n=new Node();n.fftSize=2048;n.frequencyBinCount=1024;n.getFloatTimeDomainData=a=>a.fill(0);n.getFloatFrequencyData=a=>a.fill(-100);return n}createWaveShaper(){return new Node()}createDelay(){return new Node()}
 createBuffer(c,l,sr){const d=[...Array(c)].map(()=>new Float32Array(l));return{numberOfChannels:c,length:l,sampleRate:sr,getChannelData:i=>d[i]}}
 createConvolver(){return new Node()}createScriptProcessor(){return new Node()}createOscillator(){return new Node()}createConstantSource(){return new Node()}createPeriodicWave(){return {}}createBiquadFilter(){return new Node()}createBufferSource(){return new Node()}createStereoPanner(){return new Node()}createAnalyser(){const n=new Node();n.fftSize=2048;n.frequencyBinCount=1024;n.getFloatTimeDomainData=a=>a.fill(0);n.getFloatFrequencyData=a=>a.fill(-100);return n}close(){}}
class Off extends Ctx{constructor(c,l,sr){super();this.sampleRate=sr;this._c=c;this._l=l}startRendering(){const b=this.createBuffer(this._c,this._l,this.sampleRate);b.getChannelData(0)[100]=.3;b.getChannelData(1)[100]=.3;return Promise.resolve(b)}}
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.TextEncoder=TextEncoder;w.AudioContext=Ctx;w.lamejs={Mp3Encoder:class{encodeBuffer(){return new Int8Array(8)}flush(){return new Int8Array(2)}}};w.OfflineAudioContext=Off;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:0}):()=>{},set:()=>true});}});
const w=dom.window,d=w.document;
setTimeout(async()=>{
 {const longL=[...d.querySelectorAll('.ctl > .l > label')].filter(l=>l.textContent.length>46).map(l=>l.textContent); if(longL.length){ console.log('ECHEC libellés trop longs (mettre l\'explication dans une aide)',longL); process.exit(1); } console.log('libellés : tous courts,',d.querySelectorAll('.ctl .help').length,'aides repliables');}
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
 // mode Conduire : boutons, pad XY, cercle jouable, clavier, figer, replanification
 d.getElementById('jeuBtn').click(); await new Promise(r=>setTimeout(r,150));
 { const st=d.querySelectorAll('#jeuMixer .dw-strip').length; console.log('jeu : mixeur, voies',st,'| faders',d.querySelectorAll('#jeuMixer input.vert').length); if(st<8){ console.log('ECHEC mixeur absent de Conduire'); process.exit(1); } }
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
 w.eval('S.syn.fil.type="lowpass24"; S.syn.oscA.wave=1; S.syn.oscB.lvl=0.4; S.syn.mod[4]={src:"lfo3",dst:"wave",amt:0.6}; S.syn.mod[5]={src:"key",dst:"lvlb",amt:0.4}; S.syn.mono.on=1; S.syn.rack.chorus.mix=0.4; S.syn.rack.delay.mix=0.3; S.syn.rack.rev.mix=0.3; S.syn.rack.comp.amt=0.5; live.eng.setLevels(); live.eng.synOn(3,0.7,{fromOff:0,glide:0.1}).release(); atScopeDraw(); S.syn.fil.type="lowpass"; S.syn.mod[4]={src:"none",dst:"wave",amt:0}; S.syn.mono.on=0; S.syn.oscB.lvl=0;');
 console.log('atelier : tables',w.eval('SYN_WAVES.length'),'| modulations',w.eval('S.syn.mod.length'),'| rack',w.eval('Object.keys(S.syn.rack).join(",")'),'| ancienne scène complétée',w.eval('(()=>{ const o=S; S=merge(clone(DEFAULT),{syn:{mod:[{src:"none",dst:"pitch",amt:0}]}}); normS(); const n=S.syn.mod.length; S=o; return n; })()'));
 d.getElementById('reglBtn').click();
 // génératif : formes, contrepoint, couleur de mode, caractère, gestes
 console.log('génératif :',w.eval('(()=>{ const out=[]; let t=60; for(const f of ["libre","passacaille","ostinato","rondeau","variations"]){ S.mus.form=f; live.eng.replan("all"); t+=60; live.eng.schedule(t); out.push(f); } S.mus.form="libre"; S.canon.lvl=0.3; S.canon.shift="contre"; S.car={grav:0.9,aud:0.9,orn:0.9,sil:0.1,rep:0.2}; S.mus.color="tension"; live.eng.replan("all"); live.eng.schedule(t+120); S.mus.color="off"; S.canon.shift="q+"; S.car={grav:0.5,aud:0.5,orn:0.5,sil:0.5,rep:0.5}; ["suspense","revelation","danger"].forEach(g=>live.eng.gesture(g)); return out.join(",")+" ok"; })()'));
 console.log('génératif, notes sur 2 minutes :',w.eval('(()=>{ const r=[]; for(const f of ["libre","passacaille","ostinato","rondeau","variations","turing"]){ const Sx=clone(S); Sx.mus.form=f; Sx.mel.lvl=0.6; Sx.canon.lvl=0.3; Sx.canon.shift="contre"; const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(120); const m=e.events.filter(x=>x.tr===0), c=e.events.filter(x=>x.tr===1); r.push(f+" mél "+m.length+" ("+new Set(m.map(x=>x.off)).size+" hauteurs) contre "+c.length); } return r.join(" | "); })()'));
 // intelligence : critique des phrases, plan en arche, harmonie idiomatique
 console.log('intelligence :',w.eval('(()=>{ const stat=c=>{ let leaps=0,runs=0,n=0,tri=0; for(let sd=1;sd<=6;sd++){ const Sx=clone(S); Sx.seed=sd*7919; Sx.mus.crit=c; Sx.chance={skip:0,ratchet:0,mutate:0,octave:0,rest:0}; Sx.mel.lvl=0.6; const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(240); const m=e.events.filter(x=>x.tr===0); for(let i=1;i<m.length;i++){ const d=Math.abs(m[i].off-m[i-1].off); n++; if(d>=6) leaps++; if(Math.abs(d-6)<0.01) tri++; if(i>1&&m[i].off===m[i-1].off&&m[i-1].off===m[i-2].off) runs++; } } return [leaps,tri,runs,n]; }; const a=stat(0), b=stat(1); return "sans critique (grands sauts, tritons, séries de trois, notes) "+a.join("/")+" | avec "+b.join("/"); })()'));
 console.log('plan en arche :',w.eval('(()=>{ const Sx=clone(S); Sx.mus.arc="arche"; Sx.sectionBars=4; const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(200); const b=4*Sx.sectionBars*30/Sx.tempo*2/ (1); const names=[]; for(let i=0;i<6;i++) names.push(e.secAt(i*Sx.sectionBars*(60/Sx.tempo)*4+0.1).role); return names.join(", "); })()'));
 console.log('harmonie idiomatique :',w.eval('(()=>{ const out=[]; for(const k of ["dorien","mixolydien","phrygien"]){ const Sx=clone(S); Sx.scales=[k,"",""]; Sx.mus.harm="idiome"; Sx.mel.lvl=0; const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(120); const ch=e.events.filter(x=>x.tr===2); const sets=[...new Set(ch.map(x=>x.t))].slice(0,5).map(t=>[...new Set(ch.filter(x=>x.t===t).map(x=>((x.off%12)+12)%12))].sort((a,b)=>a-b).join(".")); out.push(k+": "+sets.join(" - ")); } return out.join(" | "); })()'));
 // table des affects : lecture et recherche par émotion
 console.log('affects :',w.eval('(()=>{ const a=affSuggest(["mystérieux"]).map(r=>SC[r.key].n.replace(/ \\(.*/,"")+" en "+NOTES[r.root]).join(", "); const b=affSuggest(["fataliste","tragique"]).slice(0,3).map(r=>SC[r.key].n.replace(/ \\(.*/,"")).join(", "); affApply("phrygien",4); return "mystérieux : "+a+" | fataliste et tragique : "+b+" | lecture : "+document.getElementById("affNow").textContent.slice(0,90); })()'));
 // capture de la lecture, chance, dérives
 w.eval('S.chance={skip:0.3,ratchet:0.4,mutate:0.5,octave:0.3,rest:0.5}; S.drift[0].d=1; S.drift[0].v=1; live.eng.replan("all"); live.eng.schedule(live.ctx.currentTime+60)');
 w.eval('capStart()'); w.eval('CAP.node&&CAP.node.onaudioprocess&&CAP.node.onaudioprocess({inputBuffer:{getChannelData:()=>new Float32Array(4096)}})'); console.log('capture : en cours',w.eval('CAP.on'),'| octets',w.eval('CAP.chunks.length')); w.eval('if(!URL.createObjectURL){ URL.createObjectURL=()=>"blob:x"; URL.revokeObjectURL=()=>{}; }'); w.eval('capStop()'); console.log('capture : arrêtée',w.eval('!CAP.on'),'| graine différente à chaque lecture',w.eval('(()=>{ const a=newSeed(), b=newSeed(); return a!==b; })()'));
 // météo : mappage et effet sur l'énergie
 console.log('météo :',JSON.stringify(w.eval('wxMap({weather_code:63,rain:1.6,cloud_cover:95,wind_speed_10m:32,is_day:0,temperature_2m:9})')),'|',w.eval('wxText(wxMap({weather_code:95,rain:0,cloud_cover:100,wind_speed_10m:10,is_day:1,temperature_2m:20}))'));
 // DAW : mode, mixeur, enregistrement, piano roll
 d.getElementById('dawBtn').click(); await new Promise(r=>setTimeout(r,100));
 console.log('daw : mode',w.eval('MODE'),'| lignes',d.querySelectorAll('#dawHeads .dw-h').length,'| touches',d.querySelectorAll('#piano .pk').length);
 w.eval('S.daw.tracks[0].notes.push({s:0,off:12,d:1,v:0.7},{s:2,off:14,d:2,v:0.7})'); w.eval('live.eng.dawReplan(S.daw.tracks[0].id)');
 w.eval('S.daw.mix.mute.perc=true; live.eng.setLevels(); S.daw.tracks[1].solo=true; live.eng.setLevels(); S.daw.tracks[1].solo=false; S.daw.mix.mute.perc=false; live.eng.setLevels()');
 w.eval('DW.rec=true; dawSnap(S.daw.tracks[0])'); w.eval('atOn("t1",3)'); await new Promise(r=>setTimeout(r,300)); w.eval('atOff("t1")');
 console.log('daw : notes enregistrées',w.eval('S.daw.tracks[0].notes.length'),'| annuler',d.getElementById('dawUndo').disabled);
 w.eval('dawRecStop()');
 w.eval('S.daw.arp.on=true; S.daw.arp.mode="updown"; atOn("a1",0); atOn("a2",2); atOn("a3",4)'); console.log('arp : touches tenues',w.eval('arpHeld().length'),'| séquence',w.eval('arpSeq().join(",")'));
 await new Promise(r=>setTimeout(r,400)); w.eval('atOff("a1"); atOff("a2"); atOff("a3"); S.daw.arp.on=false');
 d.getElementById('dawTabSeq').click(); w.eval('S.daw.tracks[0].notes=[]; seqRandom()'); console.log('séquenceur : notes au hasard',w.eval('S.daw.tracks[0].notes.length>0'),'| décalage',w.eval('(seqShift(),S.daw.tracks[0].notes.length>0)'));
 d.getElementById('dawTabRoll').click();
 w.eval('dawUndo()'); console.log('daw : après annulation',w.eval('S.daw.tracks[0].notes.length'));
 d.getElementById('reglBtn').click();
 // courbe de tension
 [...d.querySelectorAll('.curvetools .lnk')][2].click(); await new Promise(r=>setTimeout(r,300));
 console.log('courbe : mode',w.eval('S.curve.mode'),'| valeur actuelle',w.eval('live.eng.tensNow().toFixed(2)'));
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
