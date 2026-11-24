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
  console.log('leitmotiv');
  /* motif de référence : 1 3 5 4 2 1, rythme 2 1 1 2 2 4 */
  const M='{id:"t",name:"Le roi",degs:[0,2,4,3,1,0],rh:[2,1,1,2,2,4]}';
  const run=(over,L,dur)=>w.eval(`(()=>{ const Sx=merge(clone(DEFAULT),${over}); Sx.chance={skip:0,ratchet:0,mutate:0,octave:0,rest:0};
    const L=${L}; const e=buildEngine(new AudioContext(),Sx,{record:true,leit:L?()=>L:null}); e.start(0,0,0); e.schedule(${dur||240});
    const iv=t=>ivOf(Sx,e.secAt(t).key), kOf=(off,t)=>{ const v=iv(t),n=v.length; let bk=0,bd=1e9; for(let k=-4*n;k<=8*n;k++){ const d=Math.abs(degOff(v,k)-off); if(d<bd){bd=d;bk=k;} } return bk; };
    const mel=e.events.filter(z=>z.tr===0).sort((a,b)=>a.t-b.t);
    const occ=e.leitLog().map(x=>{ const ns=mel.filter(z=>z.t>=x.t-0.05).slice(0,x.n); const ks=ns.map(z=>kOf(z.off,z.t)); return {form:x.form,call:x.call,steps:ks.slice(1).map((k,i)=>k-ks[i]),pcs:ns.map(z=>((Math.round(z.off)%12)+12)%12)}; });
    return {sig:mel.map(z=>z.t.toFixed(3)+":"+z.off).join(","), occ}; })()`);
  const base='{seed:7,scales:["ionien","",""],mel:{lvl:0.6,dens:0.6},tension:0.5}';
  const a=run(base,null), b=run(base,'{motif:'+M+',form:"auto",presence:"appel",pending:false}');
  ck(a.sig===b.sig&&a.sig.length>100,'sans appel ni retour, la musique est identique note pour note');
  const c=run(base,'{motif:'+M+',form:"tel",presence:"souvent",pending:false}',400);
  console.log('   retours en 400 s :',c.occ.length);
  ck(c.occ.length>=3,'le motif revient de lui-même ('+c.occ.length+' fois)');
  ck(c.occ.length>0&&c.occ.every(o=>o.steps.join()==="2,2,-1,-2,-1"),'tel quel, on reconnaît son contour en degrés à chaque retour');
  const ph=run('{seed:7,scales:["phrygien","",""],mel:{lvl:0.6,dens:0.6},tension:0.5}','{motif:'+M+',form:"tel",presence:"souvent",pending:false}',400);
  ck(ph.occ.length>0&&ph.occ[0].steps.join()==="2,2,-1,-2,-1"&&ph.occ[0].pcs.join()!==c.occ[0].pcs.join(),'dans un autre mode : même contour, autres hauteurs');
  const forms=[["eolien",0.9,"menace"],["ionien",0.9,"tendu"],["dorien",0.1,"apaise"],["ionien",0.5,"tel"]].map(([k,t,f])=>{
    const r=run('{seed:3,scales:["'+k+'","",""],mel:{lvl:0.6,dens:0.6},tension:'+t+'}','{motif:'+M+',form:"auto",presence:"souvent",pending:false}',600);
    const calls=r.occ.filter(o=>o.form!=="lointain"); return {k,t,f,got:[...new Set(calls.map(o=>o.form))].join("/"),lointain:r.occ.length-calls.length}; });
  console.log('  ',JSON.stringify(forms));
  ck(forms.every(x=>x.got===x.f),'selon la scène : menaçant en tension sombre, tendu en tension claire, apaisé au calme, tel quel sinon');
  ck(forms.some(x=>x.lointain>0),'et parfois au loin, comme un souvenir');
  const men=run('{seed:3,scales:["eolien","",""],mel:{lvl:0.6,dens:0.6},tension:0.9}','{motif:'+M+',form:"menace",presence:"souvent",pending:false}',400);
  ck(men.occ.length>0&&men.occ[0].steps.join()==="-2,-2,1,2,1",'menaçant : le contour renversé');
  const ap=w.eval(`(()=>{ const Sx=merge(clone(DEFAULT),{seed:7,scales:["ionien","",""],mel:{lvl:0.6,dens:0.6}}); Sx.chance={skip:0.3,ratchet:0.3,mutate:0.3,octave:0.3,rest:0}; const L={motif:${M},form:"apaise",presence:"souvent",pending:false};
    const e=buildEngine(new AudioContext(),Sx,{record:true,leit:()=>L}); e.start(0,0,0); e.schedule(400); const x=e.leitLog()[0]; const ns=e.events.filter(z=>z.tr===0&&z.t>=x.t-0.05).sort((a,b)=>a.t-b.t).slice(0,3); return (ns[1].t-ns[0].t)/e.E; })()`);
  ck(Math.abs(ap-4)<0.2,'apaisé : deux fois plus lent, même sous Fortuna (la noire devient blanche : '+ap.toFixed(2)+' croches)');
  /* en direct : appeler, graver */
  console.log('en direct');
  ck(!!d.getElementById('leitBox')&&d.getElementById('leitCall').disabled,'le bloc Leitmotiv est dans Conduire, Appeler attend la lecture');
  d.getElementById('leitDraw').click();
  ck(w.eval('LEIT.list.length')===1&&d.getElementById('leitSel').options.length===1,'tirer un motif l\'ajoute à la liste');
  const dm=w.eval('LEIT.list[0]'); ck(dm.degs.length>=3&&dm.degs.length===dm.rh.length&&[0,2,4,7].includes(dm.degs[dm.degs.length-1]),'motif tiré : court, fin sur une note stable ('+dm.degs.map(x=>x+1).join(' ')+')');
  d.getElementById('leitDeg').value='1 5 4 3 1'; d.getElementById('leitRh').value='2 1 1 2'; d.getElementById('leitDeg').dispatchEvent(new w.Event('change'));
  ck(w.eval('JSON.stringify(LEIT.list[0].degs)')==='[0,4,3,2,0]'&&w.eval('JSON.stringify(LEIT.list[0].rh)')==='[2,1,1,2,2]','on le retouche en degrés (1 = la tonique) et en croches');
  d.getElementById('play').click(); await sleep(300);
  ck(!d.getElementById('leitCall').disabled,'pendant la lecture, Appeler est prêt');
  const cl=w.eval(`(()=>{ const e=live.eng, c=live.ctx; c.currentTime=12; const dt=e.leitCall(); e.schedule(c.currentTime+30); const lg=e.leitLog(); return {dt,n:lg.length,call:lg.length?lg[0].call:false,t:lg.length?lg[0].t:0,now:c.currentTime,bar:e.bar,t0:e.t0f()}; })()`);
  ck(cl.n>=1&&cl.call&&cl.t>cl.now&&cl.t-cl.now<=cl.bar+0.4,'appelé : il entre à la mesure suivante');
  ck(Math.abs(((cl.t-cl.t0)/cl.bar)-Math.round((cl.t-cl.t0)/cl.bar))<1e-6,'sur un début de mesure');
  ck(w.eval('LEIT.pending')===false,'l\'appel est consommé');
  const g=w.eval('(()=>{ live.ctx.currentTime=60; live.eng.schedule(70); return live.eng.leitGrab(); })()');
  ck(!!g&&g.degs.length>=2&&g.degs.length===g.rh.length,'graver la dernière phrase en fait un motif ('+(g?g.degs.map(x=>x+1).join(' '):'')+')');
  d.getElementById('leitGrab').click();
  ck(w.eval('LEIT.list.length')===2,'le bouton Graver l\'ajoute');
  ck(w.eval('(()=>{ const x=JSON.parse(localStorage.getItem("bourdon.leit")); return x.list.length===2&&!!x.active; })()'),'les motifs sont gardés d\'une séance à l\'autre');
  /* au clavier : 1 à 9 */
  w.eval('setMode("jeu")');
  const kb=w.eval(`(()=>{ live.ctx.currentTime=80; const before=live.eng.leitLog().length; document.dispatchEvent(new KeyboardEvent("keydown",{code:"Digit2",key:"é",bubbles:true})); live.eng.schedule(110); const lg=live.eng.leitLog(); return {active:LEIT.active===LEIT.list[1].id, called:lg.length>before&&lg.slice(before).some(x=>x.call), opt:document.getElementById("leitSel").options[1].textContent}; })()`);
  ck(kb.active&&kb.called,'touche 2 : le deuxième motif est choisi et appelé');
  ck(/^2 · /.test(kb.opt),'la liste montre le numéro de chaque motif ('+kb.opt+')');
  const kb2=w.eval(`(()=>{ const n=live.eng.leitLog().length; document.dispatchEvent(new KeyboardEvent("keydown",{code:"Digit9",bubbles:true})); const i=document.getElementById("leitName"); i.focus(); i.dispatchEvent(new KeyboardEvent("keydown",{code:"Digit1",bubbles:true})); live.eng.schedule(140); return {sel:LEIT.active===LEIT.list[1].id, n:live.eng.leitLog().filter(x=>x.call).length}; })()`);
  ck(kb2.sel,'un numéro sans motif, ou un chiffre tapé dans un champ, ne fait rien');
  w.eval('LEIT.presence="appel"'); ck(w.eval('leitOpts(true)')===null,'à l\'export, un motif qu\'on appelle seulement n\'est pas joué');
  w.eval('LEIT.presence="rare"'); ck(typeof w.eval('leitOpts(true)')==='function','ses retours, si, ils sont rendus');
  w.eval('stopLive()');
  /* intonation juste adaptative */
  console.log('juste adaptatif');
  ck(w.eval('CTL.some(c=>c.it.k==="temper")')&&w.eval('[...document.querySelectorAll("select")].some(s=>[...s.options].some(o=>o.value==="adapt"))'),'au choix des tempéraments');
  const ji=w.eval(`(()=>{ const r={}; for(const tp of ["egal","juste","adapt"]){ const Sx=merge(clone(DEFAULT),{seed:11,temper:tp,scales:["dorien","",""],pad:{lvl:0.6},mel:{lvl:0.6}}); const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(240);
      const F=mkFreq(Sx), hz=z=>F(z.off)*Math.pow(2,(z.ji||0)/1200), PURE=[0,111.73,203.91,315.64,386.31,498.04,609.78,701.96,813.69,884.36,996.09,1088.27];
      const ch=e.chords(), pad=e.events.filter(z=>z.tr===2&&!z.tag); let n=0, ok=0, beat=0, rootOk=0, nr=0, mel=0, melJ=0;
      ch.forEach(c=>{ const ns=pad.filter(z=>Math.abs(z.t-c.t)<0.002); if(ns.length<2) return; const root=c.root!==undefined?c.root:degOff(c.iv,c.d%c.iv.length);
        const rn=ns.find(z=>((z.off-root)%12+12)%12===0); if(!rn) return; nr++; const rc=((1200*Math.log2(hz(rn)/F(0)))%1200+1200)%1200; if(PURE.some(p=>Math.abs(p-rc)<0.05||Math.abs(p+1200-rc)<0.05)) rootOk++;
        ns.forEach(z=>{ if(z===rn) return; n++; const c2=((1200*Math.log2(hz(z)/hz(rn)))%1200+1200)%1200; const d=Math.min(...PURE.map(p=>Math.min(Math.abs(p-c2),Math.abs(p+1200-c2)))); if(d<0.05) ok++; beat+=d; }); });
      e.events.filter(z=>z.tr===0).forEach(z=>{ mel++; if(z.ji) melJ++; });
      r[tp]={chords:nr,pur:n?ok/n:0,ecart:n?beat/n:0,rootPur:nr?rootOk/nr:0,ji:e.events.filter(z=>z.ji).length,melJ:mel?melJ/mel:0}; } return r; })()`);
  console.log('  ',JSON.stringify(ji));
  ck(ji.adapt.chords>10&&ji.adapt.pur===1,'juste adaptatif : chaque note des nappes est pure sur la fondamentale de l\'accord ('+ji.adapt.chords+' accords)');
  ck(ji.adapt.rootPur===1,'et chaque fondamentale pure sur la tonique du bourdon');
  ck(ji.egal.ecart>5&&ji.juste.pur<1,'au tempérament égal, les accords battent (écart moyen '+ji.egal.ecart.toFixed(1)+' cents) ; la gamme juste fixe ne suffit pas sur tous les degrés ('+Math.round(100*ji.juste.pur)+' % purs)');
  ck(ji.egal.ji===0&&ji.juste.ji===0,'les autres tempéraments ne bougent pas');
  ck(ji.adapt.melJ>0&&ji.adapt.melJ<1,'la mélodie s\'accorde sur l\'accord pour ses notes d\'accord seulement ('+Math.round(100*ji.adapt.melJ)+' %)');
  const mid=w.eval(`(()=>{ const Sx=merge(clone(DEFAULT),{seed:11,temper:"adapt",scales:["dorien","",""],pad:{lvl:0.6},mel:{lvl:0.6}}); const ev=[{tr:0,t:0,off:4,dur:1,vel:0.2,ji:-5},{tr:0,t:1,off:4,dur:1,vel:0.2}]; const a=midiFile(ev,Sx,{tuning:"bend"}); return Array.from(a).join(","); })()`);
  ck(/224,/.test(mid)||mid.split(',').some((x,i,arr)=>x==='224'),'le MIDI rend l\'écart en pitch bend');
  /* résonateur modal */
  console.log('résonateur');
  ck(w.eval('["reso","resoarchet","sympa"].every(k=>INST_OPTS.some(o=>o[0]===k))'),'résonateur frappé, frotté et cordes sympathiques au choix des instruments');
  const rs=w.eval(`(()=>{ const sp=(buf,f,ratios)=>{ const x=buf.getChannelData(0), N=Math.min(x.length,16384), st=Math.floor(44100*0.03);
      const mag=fr=>{ let re=0,im=0; for(let i=0;i<N;i++){ const v=x[st+i]||0, wn=0.5-0.5*Math.cos(2*Math.PI*i/N); re+=v*wn*Math.cos(2*Math.PI*fr*i/44100); im+=v*wn*Math.sin(2*Math.PI*fr*i/44100); } return Math.hypot(re,im); };
      return ratios.map(r=>mag(f*r)); };
    const mk=P=>{ const Sx=merge(clone(DEFAULT),{seed:3,reso:P}); const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(5); return e; };
    const f=220, eS=mk({struct:0,bright:0.6,damp:0.3,pos:0.13}), eB=mk({struct:1,bright:0.6,damp:0.3,pos:0.13}), eM=mk({struct:0,bright:0.6,damp:0.3,pos:0.5});
    const str=sp(eS.bank.reso("frappe",f,0.3,1).buf,f,[2,2.76,3]), bar=sp(eB.bank.reso("frappe",f,0.3,1).buf,f,[2,2.76,3]), mid=sp(eM.bank.reso("frappe",f,0.3,1).buf,f,[2,3]);
    const lenOf=b=>b.duration||b.length/44100;
    const dmp=[0.1,0.9].map(d=>{ const x=mk({struct:0.3,bright:0.5,damp:d,pos:0.3}).bank.reso("frappe",f,0.3,1); return x.dur; });
    const bow=mk({}).bank.reso("frotte",f,0.3,3), bx=bow.buf.getChannelData(0), rms=(a,b)=>{ let s2=0; for(let i=Math.floor(a*44100);i<Math.floor(b*44100);i++) s2+=bx[i]*bx[i]; return Math.sqrt(s2/((b-a)*44100)); };
    const eY=mk({struct:0,bright:0.5,damp:0.2,pos:0.3}), syA=eY.bank.reso("frappe",f,0.3,1), syB=eY.bank.reso("frappe",f,0.3,1,1);
    let nan=false; [syA,syB,bow].forEach(r=>{ const d=r.buf.getChannelData(0); for(let i=0;i<d.length;i+=97) if(!Number.isFinite(d[i])||Math.abs(d[i])>1) nan=true; });
    const tail=r=>{ const d=r.buf.getChannelData(0); let a=0,b=0; for(let i=Math.floor(0.05*44100);i<Math.floor(0.3*44100);i++) a+=d[i]*d[i]; for(let i=Math.floor(4*44100);i<Math.min(d.length,Math.floor(5.5*44100));i++) b+=d[i]*d[i]; return Math.sqrt(b/a); };
    return {str,bar,mid,dmp,bow:[rms(0.5,1.5),rms(2,2.9)],nan,sym:[tail(syA),tail(syB)]}; })()`);
  console.log('  ',JSON.stringify(rs));
  ck(rs.str[0]>3*rs.str[1]&&rs.bar[1]>3*rs.bar[0],'structure : la corde a ses partiels harmoniques, la barre ses rapports 1 ; 2,76 ; 5,40');
  ck(rs.mid[0]<rs.mid[1]*0.3,'position : frappée au milieu, la corde perd ses partiels pairs');
  ck(rs.dmp[0]>rs.dmp[1]*2,'amortissement : peu amortie, elle résonne bien plus longtemps');
  ck(rs.bow[1]>rs.bow[0]*0.5,'frotté : l\'archet tient la note');
  ck(rs.sym[1]>rs.sym[0]*1.5,'cordes sympathiques : un halo qui prolonge la note (queue '+(rs.sym[1]/rs.sym[0]).toFixed(1)+' fois plus présente)');
  ck(!rs.nan,'aucune valeur folle');
  const pl=w.eval(`(()=>{ const Sx=merge(clone(DEFAULT),{seed:5,mel:{lvl:0.6,inst:"sympa"},arp:{lvl:0.4,inst:"reso"},pad:{lvl:0.3}}); const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(30); return e.events.filter(z=>z.tr===0).length; })()`);
  ck(pl>5,'la mélodie aux cordes sympathiques et l\'arpège au résonateur jouent');
  /* tintinnabuli */
  console.log('tintinnabuli');
  const tn=w.eval(`(()=>{ const r={}; for(const pos of ["off","sup","inf","alt","sup2"]){ const Sx=merge(clone(DEFAULT),{seed:13,scales:["eolien","",""],mel:{lvl:0.6,dens:0.6},tint:{lvl:pos==="off"?0:0.6,pos:pos==="off"?"alt":pos}}); Sx.chance={skip:0,ratchet:0,mutate:0,octave:0,rest:0};
      const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(120); const m=e.events.filter(z=>z.tr===0).sort((a,b)=>a.t-b.t), t=e.events.filter(z=>z.tag==="tint").sort((a,b)=>a.t-b.t);
      const tri=[0,3,7], inT=t.every(z=>tri.includes(((Math.round(z.off)%12)+12)%12)); let up=0,dn=0,alt=0;
      t.forEach((z,i)=>{ const mm=m.find(x=>Math.abs(x.t+0.004-z.t)<0.0005||Math.abs(x.t-z.t)<0.006); if(!mm) return; if(z.off>mm.off) up++; else dn++; });
      r[pos]={sig:m.map(z=>z.t.toFixed(3)+":"+z.off).join(","), n:m.length, nt:t.length, inT, up, dn}; } return r; })()`);
  console.log('  ',JSON.stringify(Object.fromEntries(Object.entries(tn).map(([k,v])=>[k,{n:v.n,nt:v.nt,inT:v.inT,up:v.up,dn:v.dn}]))));
  ck(tn.off.nt===0&&tn.sup.sig===tn.off.sig,'la voix T ne change pas une note de la mélodie');
  ck(tn.sup.nt===tn.sup.n&&tn.sup.inT,'une note de l\'accord de tonique sous chaque note de la mélodie, et seulement celles-là');
  ck(tn.sup.dn===0&&tn.sup2.dn===0&&tn.inf.up===0,'au-dessus, au-dessous, comme demandé');
  ck(tn.alt.up>0&&tn.alt.dn>0&&Math.abs(tn.alt.up-tn.alt.dn)<=tn.alt.nt*0.2,'en alternance : une fois au-dessus, une fois au-dessous');
  /* isorythmie */
  console.log('isorythmie');
  const iso=w.eval(`(()=>{ const Sx=merge(clone(DEFAULT),{seed:21,scales:["dorien","",""],mus:{form:"isorythmie"},mel:{lvl:0.6,dens:0.6},tempo:90}); Sx.chance={skip:0,ratchet:0,mutate:0,octave:0,rest:0};
    const e=buildEngine(new AudioContext(),Sx,{record:true}); e.start(0,0,0); e.schedule(400); const m=e.events.filter(z=>z.tr===0).sort((a,b)=>a.t-b.t);
    const per=a=>{ for(let p=2;p<=20;p++){ let ok=true; for(let i=p;i<a.length;i++) if(a[i]!==a[i-p]){ ok=false; break; } if(ok) return p; } return 0; };
    const offs=m.map(z=>z.off), iois=m.slice(1).map((z,i)=>Math.round((z.t-m[i].t)/e.E));
    const starts=[...new Set(e.phraseBars())]; return {n:m.length, col:per(offs), tal:per(iois), E:e.E, bar:e.bar}; })()`);
  console.log('  ',JSON.stringify(iso));
  ck(iso.n>40&&iso.col>=7&&iso.tal>=3,'une couleur de '+iso.col+' hauteurs et une talea de '+iso.tal+' durées, chacune exacte d\'un énoncé à l\'autre');
  ck(iso.col!==iso.tal&&iso.col%iso.tal!==0,'les deux cycles se décalent : les mêmes hauteurs reviennent sur d\'autres durées');
  /* série harmonique */
  console.log('série harmonique');
  const hs=w.eval(`(()=>{ const Sx=merge(clone(DEFAULT),{seed:4,drone:{lvl:0.6,harm:0.8}}); const c=new AudioContext(); const e=buildEngine(c,Sx,{record:true}); e.start(0,0,0);
    const f0=e.f0(), st=e.harmState(), ints=st.every(q=>Math.abs(q.f/f0-q.k)<1e-9); const on=st.map(()=>new Set()), cnt=[];
    for(let t=10;t<=600;t+=10){ e.schedule(t); const s2=e.harmState(); s2.forEach((q,i)=>on[i].add(q.v>0.001)); cnt.push(s2.filter(q=>q.v>0.001).length); }
    const e0=buildEngine(new AudioContext(),merge(clone(DEFAULT),{seed:4,drone:{lvl:0.6,harm:0}}),{record:true}); e0.start(0,0,0);
    return {n:st.length, ks:st.map(q=>q.k).join(","), ints, moved:on.filter(x=>x.size===2).length, min:Math.min(...cnt), max:Math.max(...cnt), off:e0.harmState().length}; })()`);
  console.log('  ',JSON.stringify(hs));
  ck(hs.n>=8&&hs.ints,'les partiels '+hs.ks+' : des multiples exacts de la tonique grave');
  ck(hs.moved>=hs.n-1,'chacun entre et sort, à son rythme, en dix minutes');
  ck(hs.min>=1&&hs.max<hs.n,'jamais tous à la fois, jamais aucun (de '+hs.min+' à '+hs.max+' ensemble)');
  ck(hs.off===0,'à zéro, rien n\'est construit');
 }catch(e){ console.log('EXCEPTION',e&&e.stack||e); fail++; }
 console.log('ERREURS',errs.length?errs:'aucune');
 console.log(fail||errs.length?'ECHEC pistes':'Pistes (leitmotiv, juste adaptatif, résonateur, tintinnabuli, isorythmie, série harmonique) : tout passe'); process.exit(fail||errs.length?1:0);
},800);
