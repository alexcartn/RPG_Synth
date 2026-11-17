/* Studio : la théorie (accords, générateurs, relectures) et la page (chargement, panneaux, rendu, enregistrement d'arrangement). */
const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
let fail=0; const ok=(c,m)=>{ if(!c){ fail++; console.error('ÉCHEC : '+m); } };

/* ---------- théorie, en Node ---------- */
const TH=require(path.join(root,'js/studio/theorie.js'));
{
  const iv=TH.MODES.eolien.iv, pr="i bVI bIII bVII".split(" ").map(r=>TH.parseRoman(r,iv));
  ok(pr.every(Boolean),'chiffrage romain lu');
  ok(pr.map(c=>TH.chordName(c,2)).join(" ")==="Rém Si♭ Fa Do",'noms des accords en Ré éolien');
  ok(pr.every(c=>TH.isDiatonic(c,iv)),'la descente épique est dans la gamme');
  ok(TH.diatonic(TH.MODES.dorien.iv).map(TH.roman).join(" ")==="i ii bIII IV v vi° bVII",'accords du dorien');
  ok(TH.hasCar(TH.parseRoman("IV",TH.MODES.dorien.iv),"dorien"),'IV porte la sixte du dorien');
  for(const k of TH.ORDRE){ const M=TH.MODES[k]; ok(M.iv.length===7&&M.iv.indexOf(M.car)>=0,'note caractéristique dans la gamme : '+k);
    M.prog.forEach(([s])=>{ const ch=s.split(" ").map(r=>TH.parseRoman(r,M.iv)); ok(ch.every(Boolean),'progression lisible '+k+' : '+s); }); }
  const ctx={iv,key:2,meter:"4/4",mode:"eolien"};
  for(const t of ["nappe","bourdon","basse","arpege"]){ const n=TH.generate(t,{},pr,ctx); ok(n.length>0,'générateur '+t);
    ok(n.every(x=>x.s>=0&&x.s<16&&x.d>0&&x.p>20&&x.p<100&&x.v>0),'notes du générateur '+t+' dans les bornes');
    const same=JSON.stringify(TH.generate(t,{},pr,ctx))===JSON.stringify(n); ok(same,'générateur '+t+' déterministe (aucun hasard)'); }
  /* la nappe bouge peu d'un accord à l'autre */
  const nap=TH.generate("nappe",{},pr,ctx), byS={}; nap.forEach(n=>(byS[n.s]=byS[n.s]||[]).push(n.p));
  const ks=Object.keys(byS).map(Number).sort((a,b)=>a-b); let mv=0; for(let i=1;i<ks.length;i++){ const a=byS[ks[i-1]].sort((x,y)=>x-y), b=byS[ks[i]].sort((x,y)=>x-y); mv+=a.reduce((s,x,j)=>s+Math.abs(x-(b[j]||x)),0)/a.length; }
  ok(mv/(ks.length-1)<=3,'voicing serré : mouvement moyen ≤ 3 demi-tons ('+(mv/(ks.length-1)).toFixed(1)+')');
  ok(TH.nextSuggest("eolien",pr[0],1).length>0,'suggestions après i');
  ok(TH.reviewProg("dorien",[TH.parseRoman("i",TH.MODES.dorien.iv)],"4/4").length>0,'relecture de progression');
  ok(TH.reviewMel([{s:0,d:1,p:62,v:.8},{s:1,d:1,p:65,v:.8}],pr,ctx).length>0,'relecture de mélodie');
}

/* ---------- la page ---------- */
const html=fs.readFileSync(path.join(root,'studio.html'),'utf8').replace(/<link[^>]*>/g,'')
  .replace(/<script src="([^"]+)"><\/script>/g,(m,f)=>'<script>'+fs.readFileSync(path.join(root,f),'utf8')+'</script>');
const errs=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{const m=String(e.detail||e.message||e);if(!/Not implemented: (navigation|window.scrollTo|HTMLDialogElement)/.test(m))errs.push(m)});vc.on('error',e=>errs.push(String(e)));
class Param{constructor(){this.value=0}setValueAtTime(){return this}linearRampToValueAtTime(){return this}exponentialRampToValueAtTime(){return this}setTargetAtTime(){return this}cancelScheduledValues(){return this}}
class Node{constructor(){for(const k of ['gain','frequency','detune','Q','pan','delayTime','threshold','knee','ratio','attack','release','playbackRate','offset'])this[k]=new Param();this.fftSize=512}setPeriodicWave(){}connect(x){return x}disconnect(){}start(){}stop(){}getFloatTimeDomainData(a){a.fill(0)}}
class Ctx{constructor(){this.sampleRate=44100;this.currentTime=0;this.destination=new Node();this.state='running'}resume(){}
 createGain(){return new Node()}createDynamicsCompressor(){return new Node()}createAnalyser(){return new Node()}createWaveShaper(){return new Node()}createDelay(){return new Node()}createChannelMerger(){return new Node()}createChannelSplitter(){return new Node()}
 createBuffer(c,l,sr){const d=[...Array(c)].map(()=>new Float32Array(l));return{numberOfChannels:c,length:l,sampleRate:sr,getChannelData:i=>d[i]}}
 createConvolver(){return new Node()}createOscillator(){return new Node()}createConstantSource(){return new Node()}createPeriodicWave(){return {}}createBiquadFilter(){return new Node()}createBufferSource(){return new Node()}createStereoPanner(){return new Node()}close(){}}
let notes=0;
class Off extends Ctx{constructor(c,l,sr){super();this.sampleRate=sr;this._c=c;this._l=l}startRendering(){const b=this.createBuffer(this._c,this._l,this.sampleRate);b.getChannelData(0)[100]=.3;return Promise.resolve(b)}}
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,url:'http://localhost/studio.html',beforeParse(w){w.TextEncoder=TextEncoder;w.AudioContext=Ctx;w.OfflineAudioContext=Off;
  w.HTMLDialogElement&&(w.HTMLDialogElement.prototype.showModal=function(){this.open=true});w.HTMLDialogElement&&(w.HTMLDialogElement.prototype.close=function(){this.open=false});
  w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:0}):()=>{},set:()=>true});}});
const w=dom.window,d=w.document;
setTimeout(async()=>{
  try{
    const S=w.__studio; ok(!!S,'la page démarre');
    d.querySelector('#tplRow button[data-tpl="dungeon"]').click();
    ok(d.querySelectorAll('.clip').length>=8,'les clips du modèle sont dans la grille');
    S.audio(); ok(!!S.graph&&!!S.TR,'graphe audio et transport');
    /* chaque panneau se dessine */
    [[0,0,'clip'],[1,0,'clip'],[3,1,'clip'],[4,1,'clip'],[5,1,'clip'],[1,0,'piste'],[5,1,'piste']].forEach(([t,r,tab])=>{ S.UI.t=t; S.UI.r=r; S.UI.focus=tab==='piste'?'piste':'clip'; S.UI.tab=tab; S.renderAll(); });
    S.UI.focus='master'; S.renderAll(); S.UI.focus='ret0'; S.renderAll(); S.UI.focus='gamme'; S.renderAll();
    S.UI.view='arr'; S.renderAll(); S.UI.view='session';
    /* chaque appareil se construit et se règle */
    Object.keys(w.eval('SON').DEV).forEach(k=>S.P.tracks[1].devs.push(w.eval('PJ').dev(k))); S.graph.sync(); S.graph.soft();
    /* lecture d'une scène : des notes sont planifiées */
    let n=0; const note=S.graph.note; S.graph.note=function(){ n++; return note.apply(this,arguments); };
    S.TR.X.rec=true; S.TR.launchScene(1); for(let i=0;i<40;i++){ S.graph.ctx.currentTime+=0.25; await new Promise(r=>setTimeout(r,30)); }
    ok(n>20,'la scène joue des notes ('+n+')');
    S.TR.stop(); ok(w.eval('PJ').arrLen(S.P.arr)>0,"l'arrangement est enregistré depuis la Session");
    /* instrument : notes tenues, export MIDI */
    const h=S.graph.noteOn(S.P.tracks[1],62,0.8); h.off(); const hs=S.graph.noteOn(S.P.tracks[5],0,0.8); hs.off();
    const ev=w.eval('SON').events(S.P), list=[...ev.keys()].map(t=>({t,notes:ev.get(t)})); const mid=w.eval('SON').midiBytes(S.P,list);
    ok(mid.length>100&&String.fromCharCode(...mid.slice(0,4))==='MThd','fichier MIDI ('+mid.length+' octets, '+list.length+' pistes)');
    ok(!!d.querySelector('#kb .piano .pk'),'clavier à l\'écran');
    /* rendu hors ligne */
    const r=await w.eval('SON').render(JSON.parse(JSON.stringify(S.P))); ok(r.L.length>44100,'rendu hors ligne');
  }catch(e){ fail++; console.error(e); }
  if(errs.length){ fail++; console.error(errs.join('\n')); }
  console.log(fail?'Studio : '+fail+' échec(s)':'Studio : tout passe'); process.exit(fail?1:0);
},300);
