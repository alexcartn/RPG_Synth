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
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc,pretendToBeVisual:true,url:'http://localhost/',beforeParse(w){w.__noWelcome=true;w.TextEncoder=TextEncoder;w.AudioContext=Ctx;w.OfflineAudioContext=Off;
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
  /* 7. tension harmonique */
  console.log('tension harmonique');
  const th=w.eval(`(()=>{ const fifths=r=>{ for(let j=0;j<12;j++){ if(((Math.round(r)-7*j)%12+12)%12===0||((Math.round(r)+7*j)%12+12)%12===0) return j; } return 6; };
    const run=(tens,tm)=>{ let d=0,n=0,sev=0; for(const sd of [3,5,8]){ const Sx=merge(clone(DEFAULT),{seed:sd,tension:tens,scales:["dorien","",""],mus:{harm:"libre",tharm:tm},pad:{lvl:0.4,voices:3}}); const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(300);
      e.chords().forEach(c=>{ const r=c.root!==undefined?c.root:c.iv[c.d%c.iv.length]; d+=fifths(r); n++; if(c.offs.length>=4) sev++; }); } return {dist:d/n, sept:sev/n}; };
    return {calme:run(0.1,0.8), tendu:run(0.9,0.8), sans:run(0.9,0)}; })()`);
  console.log('  ',JSON.stringify(th));
  ck(th.tendu.dist>th.calme.dist+0.4,'en tension, les accords s\'éloignent de la tonique (quintes)');
  ck(th.tendu.sept>0.9&&th.calme.sept===0,'la tension ajoute la septième, le calme s\'en passe');
  /* à zéro, la tension ne touche plus l'harmonie : mêmes accords aux mêmes instants (le moteur ne garde qu'une fenêtre d'accords, on compare les instants communs) */
  const same=w.eval(`(()=>{ const run=tens=>{ const Sx=merge(clone(DEFAULT),{seed:3,tension:tens,scales:["dorien","",""],mus:{harm:"libre",tharm:0},pad:{lvl:0.4,voices:3}}); const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(300); return new Map(e.chords().map(c=>[c.t.toFixed(3),c.d+":"+c.offs.join(",")])); };
    const a=run(0.5), b=run(0.9); let n=0,eq=0; a.forEach((v,k)=>{ if(b.has(k)){ n++; if(b.get(k)===v) eq++; } }); return {n,eq}; })()`);
  ck(same.n>20&&same.eq===same.n,'à zéro, la tension ne touche plus l\'harmonie ('+same.eq+'/'+same.n+' accords identiques)');
  /* 8. harmonie de cinéma */
  console.log('harmonie de cinéma');
  const ci=w.eval(`(()=>{ const out={};
    for(const k of ["merveilleux","menace","off"]){ let ch=0,tot=0,mIn=0,mN=0; const names={};
      for(const sd of [2,4,6]){ const Sx=merge(clone(DEFAULT),{seed:sd,tension:0.5,scales:["ionien","",""],mus:{cine:k,cineAmt:0.6},mel:{lvl:0.6,dens:0.8},pad:{lvl:0.4}}); const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(240);
        const cs=e.chords(); cs.forEach(c=>{ tot++; if(c.chrom){ ch++; names[c.name]=(names[c.name]||0)+1; } });
        e.events.filter(x=>x.tr===0).forEach(x=>{ let c=null; for(const z of cs){ if(z.t<=x.t+0.001) c=z; else break; } if(c&&c.chrom){ mN++; const pcs=c.offs.map(o=>((o%12)+12)%12); if(pcs.some(p=>Math.abs(p-(((x.off%12)+12)%12))<0.3)) mIn++; } }); }
      out[k]={part:ch/tot, mel:mN?mIn/mN:1, noms:names}; }
    return out; })()`);
  console.log('  ',JSON.stringify(ci));
  ck(ci.merveilleux.part>0.08&&ci.menace.part>0.08,'des accords hors de la gamme apparaissent');
  ck(ci.off.part===0,'sans harmonie de cinéma, aucun');
  ck(ci.merveilleux.mel>=0.95&&ci.menace.mel>=0.95,'la mélodie se pose sur leurs notes');
  /* 9. geste surprise */
  console.log('surprise');
  w.eval('if(!live) startLive()'); await sleep(200);
  ck(w.eval('live.eng.gesture("surprise",1)')>0,'le geste Surprise joue');
  ck(!!d.querySelector('#jeuGest [data-g="surprise"]'),'il a son bouton dans Conduire');
  /* 10. banc d'écoute */
  console.log('banc d\'écoute');
  ck(Math.abs(w.eval('signTest(9,10)')-0.02148)<0.001&&w.eval('signTest(5,10)')===1,'test du signe juste (9 sur 10 : p = 0,021)');
  d.getElementById('seancePorte').click(); d.getElementById('seanceDistrait').click();
  const se=w.eval('bancLoad("bourdon.seance")'); ck(se.length===2&&se[0].note==='porte'&&se[0].scene!==undefined,'notes en séance enregistrées avec la scène');
  w.eval('bancOpen(true)'); d.getElementById('bancF').value='cine'; d.getElementById('bancP').value='Vigilia';
  await w.eval('bancPrepare()');
  ck(w.eval('!!BANC.trial&&BANC.trial.preset==="Vigilia"'),'un essai se prépare (deux rendus, même graine)');
  d.getElementById('bancNA').value='4'; d.getElementById('bancNB').value='2'; d.querySelector('input[name="bancPref"][value="A"]').checked=true;
  w.eval('bancValidate()');
  const es=w.eval('bancLoad("bourdon.banc")'); ck(es.length===1&&es[0].pref===es[0].A&&es[0].notes[es[0].A]===4,'l\'essai est gardé, avec ce qu\'étaient A et B');
  ck(/Bilan/.test(d.getElementById('bancRes').textContent),'le bilan s\'affiche');
  w.eval('bancOpen(false)');
  /* 11. jeu expressif */
  console.log('jeu expressif');
  const xp=w.eval(`(()=>{ const r={}; for(const x of [0,1]){ const Sx=merge(clone(DEFAULT),{seed:31,mus:{expr:x},mel:{lvl:0.6,dens:0.8}}); const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(180);
    const m=e.events.filter(z=>z.tr===0), mean=m.reduce((a,b)=>a+b.vel,0)/m.length, sd=Math.sqrt(m.reduce((a,b)=>a+(b.vel-mean)*(b.vel-mean),0)/m.length);
    const hi=m.filter(z=>z.off>=24), lo=m.filter(z=>z.off<18), av=l=>l.reduce((a,b)=>a+b.vel,0)/Math.max(1,l.length); r[x]={n:m.length,sd,hiLo:av(hi)/Math.max(1e-9,av(lo)),notes:m.map(z=>z.off).join(",")}; } return r; })()`);
  console.log('   écart des nuances',xp[0].sd.toFixed(3),'→',xp[1].sd.toFixed(3),'| aigu/grave',xp[0].hiLo.toFixed(2),'→',xp[1].hiLo.toFixed(2));
  ck(xp[0].notes===xp[1].notes,'le jeu expressif ne change pas les notes');
  ck(xp[1].sd>xp[0].sd*1.05&&xp[1].hiLo>xp[0].hiLo,'il creuse les nuances et fait l\'aigu plus fort');
  /* 12. accordages et MIDI */
  console.log('accordages');
  const ac=w.eval(`(()=>{ const c=(S2,o)=>1200*Math.log2(mkFreq(S2)(o)/mkFreq(S2)(0)), A={root:0,a4:440,temper:"aeu"};
    const sc=parseScala("! essai\\nEssai\\n 4\\n 150.0\\n 350.0\\n 3/2\\n 2/1\\n");
    return {rast:c(A,3.5), bay:c(A,1.5), quinte:c(A,7), slots:sc.slots.join(","), sc:c({root:0,a4:440,temper:"scala",scala:sc},3.5)}; })()`);
  console.log('  ',JSON.stringify(ac));
  ck(Math.abs(ac.rast-384.9)<0.2&&Math.abs(ac.bay-181.1)<0.2&&Math.abs(ac.quinte-701.9)<0.2,'turc : tierce du Rast à 17 commas, seconde du Bayati à 8, quinte à 31');
  ck(ac.slots==='0,1.5,3.5,7'&&Math.abs(ac.sc-350)<0.01,'Scala : chaque degré à sa place sur la grille, à sa hauteur exacte');
  let bad=false; try{ w.eval('parseScala("rien")'); }catch(e){ bad=true; } ck(bad,'un fichier Scala illisible est refusé');
  const md=w.eval(`(()=>{ const Sx=merge(clone(DEFAULT),{temper:"aeu",scales:["rast","",""]}); const ev=[{tr:0,t:0,off:3.5,dur:0.5,vel:0.2},{tr:2,t:0,off:10.5,dur:1,vel:0.2},{tr:0,t:1,off:4,dur:0.5,vel:0.2}];
    const hex=u=>Array.from(u).slice(14).map(x=>x.toString(16).padStart(2,"0")).join(" "), b=hex(midiFile(ev,Sx,{tuning:"bend"})), m=hex(midiFile(ev,Sx,{tuning:"mts"}));
    return {bend:(b.match(/ e0 /g)||[]).length, mts:/f0 [0-9a-f]{2} 7f 7f 08 02 00/.test(m), mtsBend:(m.match(/ e0 /g)||[]).length}; })()`);
  console.log('  ',JSON.stringify(md));
  ck(md.bend>=2,'pitch bend à la hauteur exacte (ici le Rast turc)');
  ck(md.mts&&md.mtsBend===0,'MTS : un message d\'accord, plus aucun pitch bend');
  /* 15. estampie */
  console.log('estampie');
  const P=w.eval(`(()=>{ const p=PRESETS.find(x=>x[0]==="Estampida"); const Sx=merge(clone(DEFAULT),clone(p[1])); Sx.seed=3;
    const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(200); return e.phraseLog().slice(0,12); })()`);
  console.log('   phrases (une lettre par phrase différente)',P.map(x=>String.fromCharCode(65+x)).join(''));
  ck(P.length>=12&&P[0]===P[2]&&P[4]===P[6]&&P[8]===P[10]&&P[0]!==P[4],'chaque punctus est joué deux fois, puis un nouveau vient');
  ck(P[1]===P[5]&&P[3]===P[7]&&P[1]!==P[3],'les fins ouverte et close reviennent, différentes l\'une de l\'autre');
  /* 16. le lieu en trois rôles */
  console.log('lieu : signaux et marqueurs');
  const sg=w.eval(`(()=>{ const Sx=merge(clone(DEFAULT),{seed:12,mel:{lvl:0.6,dens:0.85},nature:{oiseaux:0.8,corbeaux:0.8,loup:0.6,grenouilles:0.8},amb:{marque:0.8,marqueSon:"cloche"}});
    const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(300); const sp=e.melSpans(), cs=e.signals();
    const inMel=cs.filter(c=>sp.some(s=>c.t0<s[1]&&c.t0+0.5>s[0])).length, clash=cs.filter((c,i)=>cs.some((d,j)=>j!==i&&c.lo<d.hi&&c.hi>d.lo&&c.t0<d.t1&&c.t1>d.t0)).length;
    return {n:cs.length, inMel, clash}; })()`);
  console.log('  ',JSON.stringify(sg));
  ck(sg.n>20,'des signaux en nombre');
  ck(sg.inMel/sg.n<0.35,'la plupart attendent un silence de la mélodie ('+Math.round(100*sg.inMel/sg.n)+' % pendant une phrase)');
  ck(sg.clash/sg.n<0.15,'deux bêtes de la même bande se chevauchent rarement ('+Math.round(100*sg.clash/sg.n)+' %)');
  ck(w.eval('PRESETS.find(p=>p[0]==="Taberna")[1].amb.marqueSon')==='cloche'&&w.eval('PRESETS.find(p=>p[0]==="Portus")[1].amb.marqueSon')==='bord','chaque univers a son marqueur (cloche, cloche de bord…)');
  /* 17. corpus et chaîne de Markov */
  console.log('corpus');
  const cp=w.eval(`(()=>{ const r={}; for(const lg of ["corpus","modal"]){ let st=0,n=0,fin=0,ph=0; for(const sd of [4,9]){ const Sx=merge(clone(DEFAULT),{seed:sd,scales:["dorien","",""],mus:{logic:lg},mel:{lvl:0.6,dens:0.7}}); Sx.chance={skip:0,ratchet:0,mutate:0,octave:0,rest:0};
      const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(200); const m=e.events.filter(z=>z.tr===0).sort((a,b)=>a.t-b.t);
      for(let i=1;i<m.length;i++){ n++; if(Math.abs(m[i].off-m[i-1].off)<=2.01) st++; } } r[lg]={pas:st/n}; } return r; })()`);
  console.log('  ',JSON.stringify(cp));
  ck(cp.corpus.pas>0.5,'la mélodie apprise avance surtout par degrés conjoints, comme le chant ('+Math.round(100*cp.corpus.pas)+' %, hors Fortuna)');
  /* 18. arbre : grammaire et lecture */
  console.log('arbre');
  const ab=w.eval(`(()=>{ const r={}; for(const lec of ["vent","lecture"]){ const Sx=merge(clone(DEFAULT),{seed:5,arbre:{lvl:0.5,prof:5,vent:lec==="vent"?0.6:0,pousse:0,lecture:lec}});
      const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(240); r[lec]=e.events.filter(z=>z.tr===4).length; } return r; })()`);
  console.log('  ',JSON.stringify(ab));
  ck(ab.lecture>10,'la lecture de la ramure chante, même sans vent');
  /* 19. vielle et cornemuse */
  console.log('vielle et cornemuse');
  ck(w.eval('INST_OPTS.some(o=>o[0]==="vielle")&&INST_OPTS.some(o=>o[0]==="cornemuse")'),'au choix des instruments');
  const vc=w.eval(`(()=>{ const out={}; for(const nm of ["Estampida","Saltarellus"]){ const p=PRESETS.find(x=>x[0]===nm); const e=buildEngine(new AudioContext(),merge(clone(DEFAULT),clone(p[1])),{record:true}); e.start(0,0,0); e.schedule(60); out[nm]=e.events.filter(z=>z.tr===0).length; } return out; })()`);
  ck(vc.Estampida>40&&vc.Saltarellus>40,'Estampida (vielle, bourdons et chien) et Saltarellus (cornemuse) jouent');
  /* 20. émotions GEMS */
  console.log('émotions GEMS');
  ck(w.eval('EMOTIONS.length')===17&&w.eval('["tendre","puissant","transcendant"].every(e=>EMOTIONS.includes(e)&&AFF_VA[e]&&EMO_TIP[e])'),'tendre, puissant, transcendant ajoutés, avec leur place et leurs indices');
  const tdr=w.eval('affSuggest(["tendre"],k=>AFF_MAQAM.indexOf(k)<0,3).map(r=>r.key)'); console.log('   tendre :',tdr.join(', '));
  ck(tdr.some(k=>["melo","pentmaj","ionien","lydien","hexacorde"].includes(k)),'la tendresse appelle des gammes douces');
  w.eval('stopLive()');
 }catch(e){ console.log('EXCEPTION',e&&e.stack||e); fail++; }
 console.log('ERREURS',errs.length?errs:'aucune');
 console.log(fail||errs.length?'ECHEC table':'Table : tout passe'); process.exit(fail||errs.length?1:0);
},800);
