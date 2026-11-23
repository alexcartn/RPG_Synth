/* À la table : sous la voix, effacement au micro, enchaînements, télécommande, émotions sur deux axes, nouvelles ambiances.
   Même DOM simulé et même faux moteur audio que le test de fumée ; ici les rampes posent leur valeur, pour lire les gains. */
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<link[^>]*>/g,'')
  .replace(/<script src="([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync(path.join(root,f),'utf8')+'</script>');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.detail||e.message||e);if(!/Not implemented: (navigation|window.scrollTo)/.test(m))errs.push(m)});vc.on('error',e=>errs.push(String(e)));
class Param{constructor(){this.value=0}setValueCurveAtTime(){return this}setValueAtTime(v){this.value=v;return this}linearRampToValueAtTime(v){this.value=v;return this}exponentialRampToValueAtTime(v){this.value=v;return this}setTargetAtTime(v){this.value=v;return this}cancelScheduledValues(){return this}}
class Node{constructor(){for(const k of['gain','frequency','detune','Q','pan','delayTime','threshold','knee','ratio','attack','release','playbackRate','offset'])this[k]=new Param();this.gain.value=1}setPeriodicWave(){}connect(x){return x}disconnect(){}start(){}stop(){}getByteTimeDomainData(b){b.fill(128)}}
let micLevel=0;
class Ctx{constructor(){this.sampleRate=44100;this.currentTime=0;this.destination=new Node();this.state='running'}
 createGain(){return new Node()}createDynamicsCompressor(){return new Node()}createWaveShaper(){return new Node()}createDelay(){return new Node()}
 createBuffer(c,l,sr){const d=[...Array(c)].map(()=>new Float32Array(l));return{numberOfChannels:c,length:l,sampleRate:sr,getChannelData:i=>d[i]}}
 createConvolver(){return new Node()}createScriptProcessor(){return new Node()}createOscillator(){return new Node()}createConstantSource(){return new Node()}createPeriodicWave(){return {}}createBiquadFilter(){return new Node()}createBufferSource(){return new Node()}createStereoPanner(){return new Node()}
 createMediaStreamSource(){return new Node()}
 createAnalyser(){const n=new Node();n.fftSize=1024;n.frequencyBinCount=512;n.getFloatTimeDomainData=a=>{for(let i=0;i<a.length;i++)a[i]=micLevel*Math.sin(i*0.3)};n.getFloatFrequencyData=a=>a.fill(-100);return n}close(){}resume(){}}
class Off extends Ctx{constructor(c,l,sr){super();this.sampleRate=sr;this._c=c;this._l=l}startRendering(){const b=this.createBuffer(this._c,this._l,this.sampleRate);return Promise.resolve(b)}}
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,url:'http://localhost/?telecommande=1',beforeParse(w){w.__noWelcome=true;w.TextEncoder=TextEncoder;w.AudioContext=Ctx;w.OfflineAudioContext=Off;
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:0}):()=>{},set:()=>true});
  Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});}});
const w=dom.window,d=w.document;
let fail=0; const ck=(c,m)=>{ console.log((c?'  ok   ':'  ECHEC ')+m); if(!c) fail++; };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
 try{
  /* 1. sous la voix */
  console.log('sous la voix');
  d.getElementById('play').click(); await sleep(300);
  ck(w.eval('!!VOIX.chain&&live.out===VOIX.chain.eq'),'la lecture passe par la chaîne de la table');
  const dens=on=>w.eval(`(()=>{ VOIX.under=${on}; const e=buildEngine(new AudioContext(),merge(clone(DEFAULT),{seed:5,mel:{lvl:0.6,dens:0.8}}),{record:true,underVoice:()=>VOIX.under?1:0}); e.start(0,0,0); e.schedule(120); return e.events.filter(x=>x.tr===0).length; })()`);
  const n0=dens(false), n1=dens(true); console.log('  notes de mélodie en 2 min :',n0,'puis sous la voix',n1);
  ck(n1<n0*0.85,'la mélodie se fait plus rare sous la voix');
  w.eval('voixUnder(true)');
  ck(w.eval('VOIX.chain.under.gain.value')<0.4&&w.eval('VOIX.chain.eq.gain.value')<=-6,'niveau baissé d\'environ 9 dB et bande de la parole creusée');
  ck(d.getElementById('voixUnder').getAttribute('aria-pressed')==='true','le bouton le montre');
  w.eval('voixUnder(false)');
  ck(w.eval('VOIX.chain.under.gain.value')===1&&w.eval('VOIX.chain.eq.gain.value')===0,'et tout revient');
  /* 2. micro */
  console.log('micro');
  await w.eval('voixMic(true)'); await sleep(50);
  ck(w.eval('VOIX.mic&&!!VOIX.ana'),'le micro est branché (sur un analyseur seul, jamais sur la sortie)');
  micLevel=0.002; await sleep(1200);
  ck(!w.eval('VOIX.talking')&&w.eval('VOIX.chain.duck.gain.value')===1,'pièce calme : la musique reste');
  micLevel=0.3; await sleep(400);
  ck(w.eval('VOIX.talking'),'on parle : détecté');
  ck(Math.abs(w.eval('VOIX.chain.duck.gain.value')-Math.pow(10,-w.eval('VOIX.depth')/20))<1e-6,'la musique s\'efface de la profondeur choisie');
  micLevel=0.002; await sleep(400);
  ck(w.eval('VOIX.talking'),'un court silence entre deux mots ne la fait pas revenir');
  await sleep(700);
  ck(!w.eval('VOIX.talking')&&w.eval('VOIX.chain.duck.gain.value')===1,'un vrai silence la fait revenir');
  micLevel=0.3; await sleep(400); ck(w.eval('VOIX.talking'),'on reparle');
  await sleep(8600); ck(!w.eval('VOIX.talking')&&w.eval('VOIX.chain.duck.gain.value')===1,'un bruit continu sans le moindre creux (la musique montée) ne garde pas la musique effacée');
  micLevel=0.002;
  await w.eval('voixMic(false)');
  ck(!w.eval('VOIX.mic')&&!w.eval('VOIX.timer'),'micro coupé, plus d\'écoute');
  /* 3. enchaînements */
  console.log('enchaînements');
  ck(!!d.getElementById('enchMode')&&d.getElementById('enchSting').options.length===5,'réglages du point de sortie et du signal');
  const exits=w.eval(`(()=>{ const e=live.eng, c=live.ctx; c.currentTime=7.3; const t0=e.t0f(), bar=e.bar, r={};
    ["mesure","phrase","cadence"].forEach(m=>{ const t=enchExit(e,c,m); r[m]={t, enBarre:Math.abs(((t-t0)/bar)-Math.round((t-t0)/bar))<1e-6, apres:t>c.currentTime, sous8:t<=c.currentTime+0.4+8*bar+1e-6}; }); return r; })()`);
  console.log('  ',JSON.stringify(exits));
  ck(Object.values(exits).every(x=>x.apres&&x.sous8),'chaque point de sortie est à venir, à moins de huit mesures');
  ck(exits.mesure.enBarre&&exits.phrase.enBarre,'mesure et phrase tombent sur une barre de mesure');
  w.eval('ENCH.mode="mesure"; ENCH.sting="cloche"; loadScene(PRESETS.find(p=>p[0]==="Crypta")[1],null)');
  ck(w.eval('!!ENCH.pending'),'un changement de scène attend le point de sortie');
  w.eval('ENCH.mode="direct"; ENCH.sting="aucun"; live.ctx.currentTime=0');
  /* 4. télécommande */
  console.log('télécommande');
  ck(w.eval('TELE.on'),'?telecommande=1 la permet');
  const r1=w.eval('teleRun({cmd:"ambiance",nom:"vigilia"})'); ck(r1.ok&&w.eval('SCENE.name')==='Vigilia','ambiance par son nom (sans tenir compte des majuscules)');
  ck(!w.eval('teleRun({cmd:"ambiance",nom:"Atlantis"})').ok,'ambiance inconnue refusée');
  w.eval('teleRun({cmd:"tension",valeur:0.9})'); ck(w.eval('S.tension')===0.9,'tension');
  w.eval('teleRun({cmd:"emotions",liste:"serein, sacré",univers:"dark"})'); ck(w.eval('AFF.sel.size')===2&&w.eval('seekUni()')==='dark','émotions et univers');
  ck(w.eval('teleRun({cmd:"geste",nom:"suspense"})').ok,'geste');
  w.eval('teleRun({cmd:"sousLaVoix",actif:true})'); ck(w.eval('VOIX.under'),'sous la voix'); w.eval('teleRun({cmd:"sousLaVoix",actif:false})');
  ck(!w.eval('teleRun({cmd:"supprimer"})').ok,'ordre inconnu refusé');
  w.eval('S.tension=0.3'); w.postMessage({bourdon:1,cmd:'tension',valeur:1},'*'); await sleep(30);
  ck(w.eval('S.tension')===0.3,'un message qui ne vient pas de la fenêtre qui a ouvert Bourdon est ignoré');
  /* 5. émotions sur deux axes */
  console.log('émotions');
  ck(w.eval('Object.keys(AFF_VA).length===EMOTIONS.length&&EMOTIONS.every(e=>AFF_VA[e])'),'chaque émotion a sa valence, son éveil et ses indices');
  const cue=w.eval(`(()=>{ const base=PRESETS.find(p=>p[0]==="Vigilia")[1], tempo=base.tempo, out={};
    for(const e of ["serein","sauvage"]){ AFF.sel.clear(); AFF.sel.add(e); affStart({preset:["Vigilia",base,""],key:"eolien",root:9}); out[e]={tempo:S.tempo,dens:S.mel.dens,sil:S.car.sil,tension:S.tension}; }
    out.base=tempo; return out; })()`);
  console.log('  ',JSON.stringify(cue));
  ck(cue.serein.tempo<cue.base&&cue.sauvage.tempo>cue.base,'le tempo suit l\'éveil (serein plus lent, sauvage plus vif)');
  ck(cue.serein.dens<cue.sauvage.dens&&cue.serein.tension<cue.sauvage.tension,'densité et tension aussi');
  ck(cue.serein.sil<cue.sauvage.sil,'le serein est plus lié, le sauvage plus détaché');
  const kw=w.eval('(()=>{ const a=affOf("ionien",0), b=affOf("ionien",6); return Math.abs(a.w("joyeux")-b.w("joyeux")); })()');
  ck(kw<0.2,'changer de tonalité ne change presque plus l\'émotion ('+kw.toFixed(3)+')');
  ck(w.eval('modeClair("ionien")>modeClair("dorien")&&modeClair("dorien")>modeClair("eolien")&&modeClair("eolien")>modeClair("phrygien")'),'clarté des modes dans l\'ordre de Temperley et Tan');
  ck(/demande/.test(d.getElementById('affNow').textContent),'la lecture dit ce que demande l\'émotion');
  /* 6. nouvelles ambiances */
  console.log('dungeon synth');
  const nouv=["Spiritus Antiquus","Agmen Umbrarum","Turris Vetus","Feudum","Cuniculus","Memoria","Nix Aeterna"];
  ck(w.eval(`${JSON.stringify(nouv)}.every(n=>UNIVERS.find(u=>u.id==="dungeon").items.some(i=>i[0]===n))`),'sept écoles du genre dans l\'univers Dungeon synth');
  ck(w.eval(`${JSON.stringify(nouv)}.every(n=>{ const p=PRESETS.find(x=>x[0]===n)[1]; return p.norm!==0; })`),'chacune a son gain de sonie mesuré');
  for(const n of nouv){ const c=w.eval(`(()=>{ const p=PRESETS.find(x=>x[0]===${JSON.stringify(n)}); const e=buildEngine(new AudioContext(),merge(clone(DEFAULT),clone(p[1])),{record:true}); e.start(0,0,0); e.schedule(90); return e.events.length; })()`); ck(c>20,n+' joue ('+c+' notes en 90 s)'); }
  w.eval('stopLive()');
 }catch(e){ console.log('EXCEPTION',e&&e.stack||e); fail++; }
 console.log('ERREURS',errs.length?errs:'aucune');
 console.log(fail||errs.length?'ECHEC table':'Table : tout passe'); process.exit(fail||errs.length?1:0);
},800);
