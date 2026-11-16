"use strict";
/* ============================================================
   ATELIER : un synthétiseur à part entière
   Deux oscillateurs à table d'ondes (avec unisson), un sous-oscillateur, du bruit, une modulation de fréquence,
   un filtre à enveloppe, trois enveloppes, deux LFO et une matrice de modulation à quatre emplacements.
   ============================================================ */
const SYN_WAVES=["Sinus","Triangle","Dent de scie","Carré","Impulsion étroite","Orgue","Voyelle","Creux","Cloche","Corde","Dentelle","Verre","Dessinée"];
const SYN_DRAW=64;
/* LFO : divisions du tempo (en temps), forme dessinée (une période de 64 points, entre -1 et 1) */
const SYN_DIV=[["4 mesures",16],["2 mesures",8],["1 mesure",4],["1/2",2],["1/4",1],["1/8",0.5],["1/16",0.25],["1/32",0.125]];
function synLfoSeed(i){ return Array.from({length:64},(_,n)=>{ const th=n/64*2*Math.PI; return +(i===0?Math.sin(th)*0.7+Math.sin(2*th+1)*0.3:i===1?Math.sin(th)*0.5+Math.sin(3*th)*0.35+Math.sin(5*th)*0.15:Math.sin(th+Math.sin(2*th)*1.2)).toFixed(4); }); }
/* vitesse réelle d'un LFO : en Hz, ou calée sur le tempo du morceau quand la synchronisation est active */
function synLfoHz(L){ if(L.sync){ const d=SYN_DIV[Math.max(0,Math.min(SYN_DIV.length-1,Math.round(L.div===undefined?2:L.div)))][1], bpm=(typeof S!=="undefined"&&S&&S.tempo)||120; return bpm/60/d; } return L.rate; }
function synLfoVal(L,p){ p-=Math.floor(p); const sh=L.shape;
  if(sh==="draw"){ const t=synLfoTable(L.draw), x=p*t.length, i=x|0, f=x-i; return t[i]+(t[(i+1)%t.length]-t[i])*f; }
  return sh==="sine"?Math.sin(2*Math.PI*p):sh==="triangle"?(p<0.25?4*p:p<0.75?2-4*p:4*p-4):sh==="sawtooth"?(p<0.5?2*p:2*p-2):(p<0.5?1:-1); }
/* table d'un LFO dessiné : sans composante continue, crête à 1 (le moteur natif retire aussi le continu) */
function synLfoTable(d){ const a=(d&&d.length>=4)?d:synLfoSeed(0); let m=0; for(const x of a) m+=x; m/=a.length; let pk=0; const o=a.map(x=>{ const y=x-m; pk=Math.max(pk,Math.abs(y)); return y; }); return o.map(y=>+(y/(pk||1)).toFixed(4)); }
const SYN_SRC=[["none","Aucune"],["lfo1","LFO 1"],["lfo2","LFO 2"],["lfo3","LFO 3"],["env1","Enveloppe de volume"],["env2","Enveloppe 2"],["vel","Vélocité"],["key","Hauteur de la note"],["rand","Hasard (par note)"],["mac1","Macro 1"],["mac2","Macro 2"],["mac3","Macro 3"],["mac4","Macro 4"]];
const SYN_DST=[["pitch","Hauteur"],["cutoff","Coupure du filtre"],["reso","Résonance"],["amp","Volume (trémolo)"],["pan","Panoramique"],["fm","Quantité de FM"],["detuneb","Désaccord de B"],["wave","Position de table (A)"],["waveb","Position de table (B)"],["warp","Torsion (A)"],["lvlb","Niveau de B"]];

const SYN_DEFAULT={
  oscA:{wave:0.34, oct:0, semi:0, det:0, lvl:0.8, uni:3, spread:14, width:0.6, warp:0},
  oscB:{wave:0.5, oct:0, semi:0, det:6, lvl:0, uni:1, spread:10, width:0.6, warp:0},
  mac:{m1:0, m2:0, m3:0, m4:0},
  sub:{lvl:0, shape:"sine"},
  noise:{lvl:0},
  fm:{amt:0, ratio:2},
  fil:{type:"lowpass", cut:1800, res:0.9, key:0.5, env:1200},
  envA:{a:0.35, d:0.8, s:0.75, r:1.2},
  envF:{a:0.4, d:0.9, s:0.4, r:1.2},
  env2:{a:0.2, d:1, s:0.5, r:1},
  lfo1:{shape:"sine", rate:0.3, sync:0, div:2, draw:synLfoSeed(0)},
  lfo2:{shape:"triangle", rate:5, sync:0, div:4, draw:synLfoSeed(1)},
  lfo3:{shape:"triangle", rate:0.5, sync:0, div:3, draw:synLfoSeed(2)},
  mod:[{src:"lfo1",dst:"cutoff",amt:0.25},{src:"lfo2",dst:"pitch",amt:0.02},{src:"none",dst:"amp",amt:0},{src:"vel",dst:"cutoff",amt:0.3},{src:"none",dst:"wave",amt:0},{src:"none",dst:"cutoff",amt:0},{src:"none",dst:"pan",amt:0},{src:"none",dst:"lvlb",amt:0}],
  mono:{on:0, glide:0.08},
  draw:Array.from({length:64},(_,i)=>{ const th=i/64*2*Math.PI; return Math.sin(th)*0.8+Math.sin(3*th)*0.25-Math.sin(5*th)*0.1; }), drawV:0,
  rack:{chorus:{mix:0,rate:0.6,depth:0.5}, delay:{mix:0,time:0.32,fb:0.4}, rev:{mix:0}, eq:{lo:0,mid:0,hi:0}, comp:{amt:0}},
  vel:{amt:0.6},
  fx:{drive:0, level:0.8}
};

/* ---- tables d'ondes : chaque position entre deux formes est une interpolation de leurs harmoniques ---- */
const SYN_N=48;
function synHarm(kind,N){
  N=N||SYN_N; const re=new Float32Array(N+1), im=new Float32Array(N+1);
  for(let k=1;k<=N;k++){
    if(kind===0) im[k]=k===1?1:0;
    else if(kind===1) im[k]=(k%2)?((k%4===1?1:-1)*8/(Math.PI*Math.PI*k*k)):0;
    else if(kind===2) im[k]=(2/Math.PI)*((k%2)?1:-1)/k*-1;
    else if(kind===3) im[k]=(k%2)?4/(Math.PI*k):0;
    else if(kind===4) im[k]=2/(Math.PI*k)*Math.sin(Math.PI*k*0.2);
    else if(kind===5) im[k]=[0,1,0.7,0.5,0.4,0,0.25,0,0.18][k]||0;
    else if(kind===7) im[k]=(k%2)?(1/k)*((k===3||k===5)?0.15:1):0;
    else if(kind===8) im[k]=({1:1,3:0.7,5:0.55,7:0.4,9:0.3,11:0.2,13:0.12,2:0.15,4:0.1})[k]||0;
    else if(kind===9) im[k]=(1/k)*(k%5===0?0.1:1)*((k%2)?1:-1);
    else if(kind===10) im[k]=((k%3===0)?-1:1)*0.5/Math.sqrt(k)*(k>24?0:1);
    else if(kind===11) im[k]=([0,1,0,0,0.3,0,0.5,0,0,0.25,0,0.4,0,0,0.15])[k]||0;
    else im[k]=(Math.exp(-Math.pow((k-5)/1.6,2))*0.9+Math.exp(-Math.pow((k-11)/2,2))*0.55+Math.exp(-Math.pow((k-17)/2.4,2))*0.3)+(k===1?0.5:0);
  }
  return [re,im];
}
const SYN_BASE=SYN_WAVES.slice(0,12).map((_,i)=>synHarm(i));
/* la table dessinée : une période de SYN_DRAW points, passée aux harmoniques par une transformée de Fourier */
const synDrawCache=new Map();
function synDft(d,maxH){
  const N=d.length||SYN_DRAW, H=Math.min(maxH,Math.floor(N/2)-1), re=new Float32Array(Math.max(SYN_N,H)+1), im=new Float32Array(Math.max(SYN_N,H)+1);
  let mx=0; for(let n=0;n<N;n++) mx=Math.max(mx,Math.abs(d[n]||0));
  for(let k=1;k<=H;k++){ let a=0,b=0; for(let n=0;n<N;n++){ const x=(d[n]||0)/(mx||1), th=2*Math.PI*k*n/N; a+=x*Math.cos(th); b+=x*Math.sin(th); } re[k]=2*a/N; im[k]=2*b/N; }
  return [re,im];
}
function drawHarm(P){
  const d=P.draw||[], key=(P.drawV||0)+":"+d.length; let h=synDrawCache.get(key); if(h&&h.src===d) return h.v;
  const v=synDft(d,d.length>128?120:SYN_N); synDrawCache.set(key,{src:d,v}); if(synDrawCache.size>40) synDrawCache.delete(synDrawCache.keys().next().value); return v;
}
/* ---- import : un cycle tiré d'un son ----
   On cherche la partie la plus forte, la période par autocorrélation (40 à 1200 Hz), puis on rééchantillonne la moyenne de quelques cycles
   sur N points, sans composante continue et sans cassure au raccord. Un son sans hauteur (bruit, percussion) donne une table de timbre, pas une note. */
function synTableFromAudio(x,sr,N){
  N=N||256; const L=x.length; if(!L||L<64) return null;
  const W=Math.min(8192,L); let best=0, bs=-1;
  for(let s=0;s+W<=L;s+=Math.max(256,W>>2)){ let e=0; for(let i=0;i<W;i+=2) e+=x[s+i]*x[s+i]; if(e>bs){ bs=e; best=s; } }
  if(bs<=1e-9) return null;
  const seg=new Float32Array(W); for(let i=0;i<W;i++) seg[i]=x[best+i];
  const lmin=Math.max(8,Math.floor(sr/1200)), lmax=Math.min(W>>1,Math.floor(sr/40)), n=W-lmax, cor=new Float32Array(lmax+2);
  let e0=0; for(let i=0;i<n;i++) e0+=seg[i]*seg[i];
  let mx=0;
  for(let lag=lmin;lag<=lmax;lag++){ let c=0,e1=0; for(let i=0;i<n;i++){ c+=seg[i]*seg[i+lag]; e1+=seg[i+lag]*seg[i+lag]; } cor[lag]=c/Math.sqrt(e0*e1||1); if(cor[lag]>mx) mx=cor[lag]; }
  let P=0;
  if(mx>0.55){ /* la plus courte période presque aussi nette que la meilleure : on évite de prendre une octave plus bas */
    for(let lag=lmin+1;lag<lmax;lag++) if(cor[lag]>=0.9*mx&&cor[lag]>=cor[lag-1]&&cor[lag]>=cor[lag+1]){ const a=cor[lag-1], b=cor[lag], c=cor[lag+1], d=a-2*b+c; P=lag+(d?0.5*(a-c)/d:0); break; }
  }
  const at=p=>{ const i=Math.floor(p), f=p-i; return (seg[Math.max(0,Math.min(W-1,i))])*(1-f)+(seg[Math.max(0,Math.min(W-1,i+1))])*f; };
  const out=new Float32Array(N);
  if(P>0){
    let s0=0; for(let i=1;i<Math.min(W-2,Math.ceil(P)+2);i++) if(seg[i-1]<=0&&seg[i]>0){ s0=i-1+(-seg[i-1])/((seg[i]-seg[i-1])||1); break; }
    const cycles=Math.max(1,Math.min(4,Math.floor((W-s0-1)/P)));
    for(let k=0;k<N;k++){ let a=0; for(let c=0;c<cycles;c++) a+=at(s0+c*P+k*P/N); out[k]=a/cycles; }
  }else{
    const len=Math.min(W,2048); for(let k=0;k<N;k++){ let a=0, c=0; const i0=Math.floor(k*len/N), i1=Math.max(i0+1,Math.floor((k+1)*len/N)); for(let i=i0;i<i1;i++){ a+=seg[i]; c++; } out[k]=a/c; }
  }
  let m=0; for(let k=0;k<N;k++) m+=out[k]; m/=N; for(let k=0;k<N;k++) out[k]-=m;
  { const gap=out[N-1]-out[0]; for(let k=0;k<N;k++) out[k]-=gap*k/N; } /* raccord : le dernier point rejoint le premier */
  let pk=0; for(let k=0;k<N;k++) pk=Math.max(pk,Math.abs(out[k])); if(pk<1e-6) return null;
  return {table:Array.from(out,v=>+(v/pk*0.95).toFixed(4)), hz:P>0?sr/P:0, periodic:P>0, strength:mx};
}
const synBases=P=>SYN_BASE.concat([drawHarm(P)]);
const synWaveCache=new WeakMap();
function synWave(ctx,p,P){
  if(!ctx.createPeriodicWave) return null;
  let m=synWaveCache.get(ctx); if(!m){ m=new Map(); synWaveCache.set(ctx,m); }
  const bases=synBases(P), k=Math.round(Math.max(0,Math.min(1,p))*72), ck=k+":"+(P.drawV||0);
  if(m.has(ck)) return m.get(ck);
  const x=k/72*(bases.length-1), i=Math.min(bases.length-2,Math.floor(x)), f=x-i, re=new Float32Array(SYN_N+1), im=new Float32Array(SYN_N+1);
  for(let h=0;h<=SYN_N;h++){ re[h]=bases[i][0][h]*(1-f)+bases[i+1][0][h]*f; im[h]=bases[i][1][h]*(1-f)+bases[i+1][1][h]*f; }
  const w=ctx.createPeriodicWave(re,im); m.set(ck,w); return w;
}
const synDriveCurves={};
function synDrive(a){
  const k=Math.round(a*20); if(synDriveCurves[k]) return synDriveCurves[k];
  const n=512,c=new Float32Array(n),g=1+a*12; for(let i=0;i<n;i++){ const x=i/(n-1)*2-1; c[i]=Math.tanh(g*x)/Math.tanh(g); } return synDriveCurves[k]=c;
}

/* valeur d'une enveloppe ADSR à l'instant tt (même formule que l'automation) : sert à partir du bon niveau au relâchement */
function synEnvAt(E,peak,tt){
  if(tt<=0) return 0;
  if(tt<E.a) return peak*(tt/Math.max(0.0005,E.a));
  const sus=peak*E.s; return sus+(peak-sus)*Math.exp(-(tt-E.a)/(Math.max(0.01,E.d)/3));
}
function synGate(param,t,E,peak,base){
  param.setValueAtTime(base,t); param.linearRampToValueAtTime(base+peak,t+Math.max(0.0005,E.a));
  param.setTargetAtTime(base+peak*E.s,t+Math.max(0.0005,E.a),Math.max(0.01,E.d)/3);
}
function synRelease(param,t,tr,E,peak,base){
  const v=base+synEnvAt(E,peak,tr-t);
  param.cancelScheduledValues(tr); param.setValueAtTime(v,tr); param.setTargetAtTime(base,tr,Math.max(0.01,E.r)/3);
}

/* une voix : renvoie {release(tr)} ; dur=null pour une note tenue, relâchée plus tard */
function synthVoice(ctx,P,o){
  const t=o.t, f=o.f, vel=Math.max(0.02,Math.min(1,o.vel)), lite=!!o.lite, maxU=lite?3:7;
  const G=v=>{ const g=ctx.createGain(); g.gain.value=v; return g; };
  const srcs=[], oscs=[], detB=[];
  const ampPeak=(1-P.vel.amt)+P.vel.amt*vel;
  const f24=P.fil.type==="lowpass24"||P.fil.type==="highpass24", ftype=f24?P.fil.type.slice(0,-2):P.fil.type;
  const fcut=Math.max(20,Math.min(20000,P.fil.cut*Math.pow(f/261.63,P.fil.key)));
  const fil=ctx.createBiquadFilter(); fil.type=ftype; fil.Q.value=f24?P.fil.res*0.7:P.fil.res; fil.frequency.value=fcut;
  const fl=[fil]; let fout=fil;
  if(f24){ const f2=ctx.createBiquadFilter(); f2.type=ftype; f2.Q.value=0.7; f2.frequency.value=fcut; fil.connect(f2); fl.push(f2); fout=f2; }
  const amp=G(0), trem=G(1), pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
  let tail=fout;
  if(P.fx.drive>0.02&&ctx.createWaveShaper){ const ws=ctx.createWaveShaper(); ws.curve=synDrive(P.fx.drive); ws.oversample="none"; tail.connect(ws); tail=ws; }
  tail.connect(amp); amp.connect(trem);
  if(pan){ pan.pan.value=o.pan||0; trem.connect(pan); pan.connect(o.dst); } else trem.connect(o.dst);
  /* oscillateurs avec unisson */
  const setWave=(os,p)=>{ const w=synWave(ctx,p,P); if(w) os.setPeriodicWave(w); else os.type=p<0.17?"sine":p<0.5?"triangle":p<0.83?"sawtooth":"square"; };
  /* glissando : la note part de la hauteur précédente et glisse vers la sienne */
  const glide=(o.glide>0&&o.fromF>0), gl=o.glide||0;
  const fset=(os,hz)=>{ if(glide){ os.frequency.setValueAtTime(Math.max(10,hz*o.fromF/f),t); os.frequency.exponentialRampToValueAtTime(hz,t+gl); } else os.frequency.value=hz; };
  const wmods=P.mod.filter(m=>m.dst==="wave"&&m.src!=="none"&&Math.abs(m.amt)>0.001), lmods=P.mod.filter(m=>m.dst==="lvlb"&&m.src!=="none"&&Math.abs(m.amt)>0.001);
  const wGains=[], bGains=[];
  const addOsc=(def,isB)=>{
    const n=Math.max(1,Math.min(maxU,Math.round(def.uni||1))), out=[];
    for(let u=0;u<n;u++){
      const hz=f*Math.pow(2,(def.oct||0)+(def.semi||0)/12), sp=n>1?(u/(n-1)*2-1):0, lv=(def.lvl||0)/Math.sqrt(n);
      const os=ctx.createOscillator(); setWave(os,def.wave); fset(os,hz); os.detune.value=(def.det||0)+sp*(def.spread||0);
      const g=G(lv); os.connect(g);
      let dst=fil;
      if(n>1&&ctx.createStereoPanner){ const pn=ctx.createStereoPanner(); pn.pan.value=sp*(def.width===undefined?0.6:def.width); pn.connect(fil); dst=pn; }
      g.connect(dst);
      os.start(t+u*0.0011); srcs.push(os); oscs.push(os); out.push(os); if(isB){ detB.push(os); bGains.push(g); }
      /* fondu de table : une jumelle sur la table voisine, dont le niveau suit la source */
      if(!isB&&wmods.length){
        const dir=wmods[0].amt>=0?1:-1, os2=ctx.createOscillator(); setWave(os2,Math.max(0,Math.min(1,def.wave+dir*0.34))); fset(os2,hz); os2.detune.value=os.detune.value;
        const g2=G(0); os2.connect(g2); g2.connect(dst); os2.start(t+u*0.0011); srcs.push(os2); oscs.push(os2); out.push(os2); wGains.push({main:g,twin:g2,lv});
      }
    }
    return out;
  };
  const aOscs=addOsc(P.oscA,false);
  let fmGain=null;
  if(P.fm.amt>0.001){
    const mo=ctx.createOscillator(); mo.type="sine"; fset(mo,f*(P.fm.ratio||1)*Math.pow(2,(P.oscB.oct||0)));
    fmGain=G(P.fm.amt*f*3); mo.connect(fmGain); aOscs.forEach(a=>fmGain.connect(a.frequency)); mo.start(t); srcs.push(mo);
  }
  if(P.oscB.lvl>0.001||lmods.length) addOsc(P.oscB,true);
  if(P.sub.lvl>0.001){ const so=ctx.createOscillator(); so.type=P.sub.shape==="square"?"square":"sine"; fset(so,f/2); const sg=G(P.sub.lvl*(P.sub.shape==="square"?0.5:0.8)); so.connect(sg); sg.connect(fil); so.start(t); srcs.push(so); }
  if(P.noise.lvl>0.001&&o.noise){ const ns=ctx.createBufferSource(); ns.buffer=o.noise; ns.loop=true; const ng=G(P.noise.lvl*0.6); ns.connect(ng); ng.connect(fil); ns.start(t,Math.random()*1.5); srcs.push(ns); }
  /* enveloppes : volume, filtre (en centièmes de ton) et enveloppe 2 pour la matrice */
  const lvl=0.34*(P.fx.level===undefined?0.8:P.fx.level)/0.8, ampE=P.envA;
  synGate(amp.gain,t,ampE,lvl*ampPeak,0);
  fl.forEach(x=>synGate(x.detune,t,P.envF,P.fil.env,0));
  let e2g=null, e1g=null;
  const needEnv=k=>P.mod.some(m=>m.src===k&&m.dst!=="none"&&Math.abs(m.amt)>0.001);
  const mkEnv=E=>{ const c=ctx.createConstantSource(); c.offset.value=1; const g=G(0); c.connect(g); c.start(t); srcs.push(c); synGate(g.gain,t,E,1,0); return g; };
  if(needEnv("env2")&&ctx.createConstantSource) e2g=mkEnv(P.env2);
  if(needEnv("env1")&&ctx.createConstantSource) e1g=mkEnv(P.envA);
  /* LFO et matrice : chaque emplacement relie une source à un paramètre de la voix */
  const lfos={};
  const lfo=(k)=>{ if(lfos[k]) return lfos[k]; const d=P[k], os=ctx.createOscillator(); if(d.shape==="draw"&&ctx.createPeriodicWave){ const h=synDft(synLfoTable(d.draw),31); os.setPeriodicWave(ctx.createPeriodicWave(h[0],h[1])); } else os.type=d.shape==="draw"?"sine":d.shape; os.frequency.value=synLfoHz(d); os.start(t); srcs.push(os); return lfos[k]=os; };
  const constSrc=v=>{ if(!ctx.createConstantSource) return null; const c=ctx.createConstantSource(); c.offset.value=v; c.start(t); srcs.push(c); return c; };
  const velSrc=()=>constSrc(vel);
  const DST={
    pitch:{params:()=>oscs.map(x=>x.detune),scale:1200}, cutoff:{params:()=>fl.map(x=>x.detune),scale:4800}, reso:{params:()=>[fil.Q],scale:12},
    amp:{params:()=>[trem.gain],scale:0.9}, pan:{params:()=>pan?[pan.pan]:[],scale:1}, fm:{params:()=>fmGain?[fmGain.gain]:[],scale:f*3}, detuneb:{params:()=>detB.map(x=>x.detune),scale:100},
    lvlb:{params:()=>bGains.map(g=>g.gain),scale:0.5}
  };
  P.mod.forEach(m=>{
    const amt=m.amt; if(m.src==="none"||!DST[m.dst]||Math.abs(amt)<0.001) return;
    let src=null;
    if(m.src==="lfo1"||m.src==="lfo2"||m.src==="lfo3") src=lfo(m.src); else if(m.src==="env2") src=e2g; else if(m.src==="env1") src=e1g; else if(m.src==="vel") src=velSrc();
    else if(m.src==="key") src=constSrc(Math.max(-1,Math.min(1,Math.log2(f/261.63)/2))); else if(m.src==="rand") src=constSrc(Math.random()*2-1);
    if(!src) return;
    if(m.dst==="wave"){ wGains.forEach(w=>{ const a=Math.abs(amt)*w.lv; const s1=G(a); src.connect(s1); s1.connect(w.twin.gain); const s2=G(-a); src.connect(s2); s2.connect(w.main.gain); }); return; }
    const ps=DST[m.dst]?DST[m.dst].params():[]; if(!ps.length) return;
    ps.forEach(pr=>{ const sg=G(amt*DST[m.dst].scale); src.connect(sg); sg.connect(pr); });
  });
  let released=false;
  function release(tr){
    if(released) return; released=true; tr=Math.max(tr,t+0.02);
    synRelease(amp.gain,t,tr,ampE,lvl*ampPeak,0);
    fl.forEach(x=>synRelease(x.detune,t,tr,P.envF,P.fil.env,0));
    if(e2g) synRelease(e2g.gain,t,tr,P.env2,1,0);
    if(e1g) synRelease(e1g.gain,t,tr,ampE,1,0);
    const end=tr+Math.max(0.05,ampE.r)*1.4+0.15;
    srcs.forEach(s=>{ try{ s.stop(end); }catch(e){} });
  }
  if(o.dur!==null&&o.dur!==undefined) release(t+o.dur);
  return {release,t};
}

/* ---- patches : une petite bibliothèque, et un tirage au sort musical ---- */
/* ---------- moteur à tables d'ondes (AudioWorklet, js/fx.js) ----------
   Un nœud par destination, qui calcule toutes ses voix. synthNote() l'utilise quand le worklet est chargé,
   sinon retombe sur synthVoice() (nœuds natifs). Le patch est renvoyé aux nœuds dès qu'il change : les notes tenues suivent les réglages. */
const SYN_WT_N=256, synCtx=new WeakMap();
let synSpecBase=null, synNoteId=1;
function synSpectra(P){
  if(!synSpecBase) synSpecBase=SYN_WAVES.slice(0,12).map((_,i)=>{ const h=synHarm(i,SYN_WT_N); return [Array.from(h[0]),Array.from(h[1])]; });
  const d=drawHarm(P); return synSpecBase.concat([[Array.from(d[0]),Array.from(d[1])]]);
}
function synCore(P){ const o={}; for(const k in P) if(k!=="draw"&&k!=="rack") o[k]=P[k]; for(const k of ["lfo1","lfo2","lfo3"]) if(P[k]) o[k]={shape:P[k].shape,rate:synLfoHz(P[k]),draw:P[k].shape==="draw"?synLfoTable(P[k].draw):null}; return o; }
function synState(ctx){ let st=synCtx.get(ctx); if(!st){ st={nodes:new Map(),tabV:null,pv:""}; synCtx.set(ctx,st); } return st; }
function synNodeFor(ctx,dst,o){
  const st=synState(ctx); let n=st.nodes.get(dst); if(n) return n;
  try{ n=new AudioWorkletNode(ctx,"bourdon-synth",{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{seed:(o.seed||1)+st.nodes.size*7919,lite:!!o.lite}}); }catch(e){ return null; }
  n.connect(dst); n.__pv=""; st.nodes.set(dst,n); return n;
}
/* envoie le patch (et la table dessinée si elle a changé) aux nœuds qui ne l'ont pas encore */
function synPush(ctx,P,only){
  const st=synCtx.get(ctx); if(!st||!st.nodes.size) return;
  const core=synCore(P), pv=JSON.stringify(core), tv=(P.drawV||0)+":"+(P.draw||[]).length;
  if(st.tabV!==tv){ const first=st.nodes.values().next().value, sp=synSpectra(P); first.port.postMessage(st.tabV===null?{type:"tab",v:tv,spec:sp}:{type:"tab",v:tv,draw:sp[sp.length-1]}); st.tabV=tv; }
  for(const n of (only?[only]:st.nodes.values())) if(n.__pv!==pv){ n.__pv=pv; n.port.postMessage({type:"patch",P:core}); }
}
/* une destination disparaît (voix replanifiée, moteur éteint) : son nœud s'arrête à l'instant t */
function synDrop(ctx,dst,t){ const st=synCtx.get(ctx); if(!st) return; const n=st.nodes.get(dst); if(!n) return; n.port.postMessage({type:"dead",t}); st.nodes.delete(dst); const ms=Math.max(0,(t-(ctx.currentTime||0))*1000)+300; if(typeof setTimeout==="function") setTimeout(()=>{ try{ n.disconnect(); }catch(e){} },ms); }
function synDropAll(ctx,t,dsts){ const st=synCtx.get(ctx); if(!st) return; (dsts||[...st.nodes.keys()]).forEach(d=>synDrop(ctx,d,t)); }
function synPanic(ctx){ const st=synCtx.get(ctx); if(st) st.nodes.forEach(n=>n.port.postMessage({type:"panic"})); }
/* attend que chaque nœud ait reçu tous ses messages : à faire avant un rendu hors ligne, qui ne lit plus sa boîte une fois lancé */
function synFlush(ctx){
  const st=synCtx.get(ctx); if(!st||!st.nodes.size) return Promise.resolve();
  const k=synNoteId++, all=[...st.nodes.values()].map(n=>new Promise(res=>{ const h=e=>{ if(e.data&&e.data.type==="sync"&&e.data.k===k){ n.port.removeEventListener("message",h); res(); } }; n.port.addEventListener("message",h); n.port.start(); n.port.postMessage({type:"sync",k}); }));
  return Promise.race([Promise.all(all),new Promise(res=>setTimeout(res,3000))]);
}
const synWtOn=ctx=>!!(ctx.__fx&&typeof AudioWorkletNode!=="undefined");
function synthNote(ctx,P,o){
  /* le worklet est en cours de chargement (premières millisecondes de la lecture) : la note attend sa réponse */
  if(ctx.__fxP&&!ctx.__fxDone){
    let h=null, rel=null;
    ctx.__fxP.then(()=>{ const q=Object.assign({},o,{t:Math.max(o.t,(ctx.currentTime||0)+0.004)}); h=synthNote(ctx,P,q); if(rel!==null) h.release(Math.max(rel,q.t+0.02)); });
    return {t:o.t, release(tr){ if(h) h.release(tr); else rel=tr; }};
  }
  if(!synWtOn(ctx)) return synthVoice(ctx,P,o);
  const n=synNodeFor(ctx,o.dst,o); if(!n) return synthVoice(ctx,P,o);
  synPush(ctx,P,n);
  const id=synNoteId++, dur=(o.dur===null||o.dur===undefined)?null:o.dur;
  n.port.postMessage({type:"on",id,t:o.t,f:o.f,vel:o.vel,pan:o.pan||0,dur,fromF:o.fromF||0,glide:o.glide||0});
  let released=dur!==null;
  return {t:o.t, release(tr){ if(released) return; released=true; n.port.postMessage({type:"off",id,t:Math.max(tr,o.t+0.02)}); }};
}
const SYN_PATCHES=[
  ["Pad doux",{}],
  ["Basse sub",{oscA:{wave:0.5,uni:1,spread:0,lvl:0.7},sub:{lvl:0.8,shape:"sine"},fil:{type:"lowpass",cut:420,res:1.2,key:0.3,env:2200},envA:{a:0.006,d:0.25,s:0.7,r:0.18},envF:{a:0.004,d:0.22,s:0.2,r:0.2},mod:[{src:"none",dst:"cutoff",amt:0},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"vel",dst:"cutoff",amt:0.3}]}],
  ["Pincé synthé",{oscA:{wave:0.67,uni:2,spread:8},fil:{type:"lowpass",cut:900,res:1.5,key:0.6,env:4200},envA:{a:0.004,d:0.5,s:0,r:0.25},envF:{a:0.002,d:0.3,s:0.05,r:0.2},mod:[{src:"none",dst:"cutoff",amt:0},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"vel",dst:"cutoff",amt:0.4}],fx:{drive:0.1,level:0.9}}],
  ["Cloche FM",{oscA:{wave:0,uni:1,spread:0},oscB:{lvl:0,wave:0,oct:0},fm:{amt:0.9,ratio:3.5},fil:{type:"lowpass",cut:9000,res:0.5,key:0.2,env:0},envA:{a:0.003,d:2.2,s:0,r:1.6},envF:{a:0.01,d:0.5,s:1,r:0.5},mod:[{src:"env2",dst:"fm",amt:0.6},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],env2:{a:0.002,d:1.4,s:0,r:0.6}}],
  ["Orgue",{oscA:{wave:0.83,uni:1,spread:0,lvl:0.8},oscB:{wave:0.83,oct:1,lvl:0.4,uni:1,det:3},fil:{type:"lowpass",cut:3200,res:0.5,key:0.4,env:0},envA:{a:0.02,d:0.2,s:0.9,r:0.15},mod:[{src:"lfo2",dst:"amp",amt:0.08},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"cutoff",amt:0},{src:"none",dst:"amp",amt:0}],lfo2:{shape:"sine",rate:5.5}}],
  ["Cuivre doux",{oscA:{wave:0.5,uni:2,spread:9},fil:{type:"lowpass",cut:520,res:1,key:0.7,env:2600},envA:{a:0.14,d:0.4,s:0.8,r:0.3},envF:{a:0.2,d:0.5,s:0.6,r:0.3},mod:[{src:"lfo2",dst:"pitch",amt:0.012},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo2:{shape:"sine",rate:5}}],
  ["Voyelle chantée",{oscA:{wave:1,uni:3,spread:10,lvl:1},fil:{type:"bandpass",cut:900,res:3.2,key:0.3,env:1400},fx:{drive:0,level:2.6},envA:{a:0.25,d:0.5,s:0.85,r:0.7},envF:{a:0.5,d:1.2,s:0.5,r:0.8},mod:[{src:"lfo1",dst:"cutoff",amt:0.35},{src:"lfo2",dst:"pitch",amt:0.01},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo1:{shape:"sine",rate:0.22},lfo2:{shape:"sine",rate:5}}],
  ["Souffle",{oscA:{lvl:0,uni:1},noise:{lvl:1},fil:{type:"bandpass",cut:1400,res:5,key:0.9,env:1800},fx:{drive:0,level:3.6},envA:{a:0.9,d:1,s:0.8,r:1.6},envF:{a:1.2,d:1.5,s:0.3,r:1.6},mod:[{src:"lfo1",dst:"cutoff",amt:0.3},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo1:{shape:"sine",rate:0.15}}],
  ["Lead brillant",{oscA:{wave:0.5,uni:3,spread:16,lvl:0.7},oscB:{wave:0.67,oct:0,lvl:0.5,uni:2,det:7},fil:{type:"lowpass",cut:2600,res:2,key:0.6,env:2400},envA:{a:0.01,d:0.4,s:0.7,r:0.35},envF:{a:0.01,d:0.4,s:0.4,r:0.4},mod:[{src:"lfo2",dst:"pitch",amt:0.01},{src:"vel",dst:"cutoff",amt:0.3},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo2:{shape:"sine",rate:5.5},fx:{drive:0.25,level:0.5}}],
  ["Nappe de verre",{oscA:{wave:0,uni:5,spread:18,width:0.9,lvl:0.7},oscB:{wave:0.17,oct:1,lvl:0.3,uni:3,det:4},fil:{type:"lowpass",cut:5200,res:0.4,key:0.4,env:800},envA:{a:1.2,d:1.5,s:0.8,r:2.2},envF:{a:1.5,d:1.5,s:0.6,r:2},mod:[{src:"lfo1",dst:"detuneb",amt:0.3},{src:"none",dst:"pitch",amt:0},{src:"none",dst:"amp",amt:0},{src:"none",dst:"cutoff",amt:0}],lfo1:{shape:"triangle",rate:0.12}}]
];
function synMerge(base,over){
  const o=JSON.parse(JSON.stringify(base));
  for(const k in over){
    if(k==="draw"&&Array.isArray(over[k])) o[k]=over[k].slice();
    else if(Array.isArray(over[k])) o[k]=over[k].map(x=>({...x}));
    else if(over[k]&&typeof over[k]==="object"){ const b=o[k]||{}; o[k]={...b}; for(const j in over[k]){ const v=over[k][j]; o[k][j]=(v&&typeof v==="object"&&!Array.isArray(v))?{...(b[j]||{}),...v}:(Array.isArray(v)?v.slice():v); } }
    else o[k]=over[k];
  }
  const dm=base.mod||[]; while(o.mod.length<8) o.mod.push({...(dm[o.mod.length]||{src:"none",dst:"cutoff",amt:0})});
  return o;
}
function synPatch(i){ return synMerge(SYN_DEFAULT,SYN_PATCHES[i][1]); }
/* tirage au sort : des valeurs musicales, pas n'importe lesquelles */
function synRandom(rnd){
  const r=(a,b)=>a+(b-a)*rnd(), pick=l=>l[Math.floor(rnd()*l.length)], P=synMerge(SYN_DEFAULT,{});
  P.oscA={wave:r(0,1),oct:pick([-1,0,0,0]),semi:0,det:0,lvl:r(0.5,0.9),uni:pick([1,2,3,5]),spread:r(4,24),width:r(0.3,0.9)};
  P.oscB={wave:r(0,1),oct:pick([-1,0,0,1]),semi:pick([0,0,7,12,-12]),det:r(-12,12),lvl:rnd()<0.6?r(0.15,0.6):0,uni:pick([1,2,3])};
  P.sub={lvl:rnd()<0.3?r(0.2,0.7):0,shape:pick(["sine","square"])}; P.noise={lvl:rnd()<0.25?r(0.05,0.4):0};
  P.fm={amt:rnd()<0.3?r(0.1,0.8):0,ratio:pick([1,2,3,3.5,5])};
  P.fil={type:pick(["lowpass","lowpass","lowpass","bandpass","highpass"]),cut:Math.exp(r(Math.log(300),Math.log(6000))),res:r(0.5,6),key:r(0,1),env:r(-1500,4000)};
  const slow=rnd()<0.5, env=()=>({a:slow?r(0.3,2):r(0.003,0.15),d:r(0.2,2),s:r(0.2,0.9),r:slow?r(0.8,3):r(0.1,0.8)});
  P.envA=env(); P.envA.s=Math.max(0.3,P.envA.s); P.envF=env(); P.env2=env();
  P.lfo1={shape:pick(["sine","triangle","sawtooth","square"]),rate:Math.exp(r(Math.log(0.08),Math.log(6)))}; P.lfo2={shape:pick(["sine","triangle"]),rate:Math.exp(r(Math.log(2),Math.log(9)))};
  P.mod=[0,1,2,3].map(()=>({src:pick(["lfo1","lfo2","env2","vel","none"]),dst:pick(["pitch","cutoff","cutoff","reso","amp","pan","fm","detuneb"]),amt:r(-0.4,0.5)}));
  P.mod.forEach(m=>{ if(m.dst==="pitch") m.amt=r(0,0.03); if(m.dst==="amp") m.amt=Math.abs(m.amt)*0.4; });
  P.vel={amt:r(0.2,0.8)}; P.fx={drive:rnd()<0.3?r(0.05,0.4):0,level:0.8};
  return P;
}
