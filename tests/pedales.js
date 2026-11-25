/* Pédales : la réverbération Chambres (d'après la Rooms de Death By Audio) et l'égaliseur de niveau de la fuzz,
   exécutés hors navigateur avec un faux environnement de worklet. Chaque mode doit rester fini, garder le niveau de la réverbération
   vivante (sauf la porte courte, plus sèche par nature), et faire ce qu'il annonce : la porte coupe, le gel tient, le gong est net au milieu. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','js','fx.js'),'utf8');
const procs={};
const ctx={sampleRate:44100, AudioWorkletProcessor:class{}, registerProcessor:(n,c)=>{ procs[n]=c; }, Float32Array, Math, console};
vm.createContext(ctx); vm.runInContext(src+'\nfxWorkletBody();',ctx);
let fail=0; const ck=(c,m)=>{ console.log((c?'  ok   ':'  ECHEC ')+m); if(!c) fail++; };
const V=procs['bourdon-verb'], M=procs['bourdon-match'], sr=44100, N=128;
if(!V||!M){ console.log('ECHEC : processeur absent'); process.exit(1); }
/* des notes qui retombent par-dessus un bourdon continu, puis le silence */
function sig(secs,stop){
  const n=Math.ceil(secs*sr/N)*N, a=new Float32Array(n); let s=12345; const r=()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; };
  const f=[110,165,220,247,330,392,440];
  for(let k=0;k<stop*2;k++){ const t0=Math.floor(k*0.5*sr+r()*2000), fq=f[Math.floor(r()*f.length)]*(r()<0.5?2:1); for(let i=0;i<sr*0.6&&t0+i<n;i++) a[t0+i]+=0.2*Math.sin(2*Math.PI*fq*i/sr)*Math.exp(-i/sr*5); }
  for(let i=0;i<stop*sr;i++) a[i]+=0.08*Math.sin(2*Math.PI*55*i/sr)+0.03*Math.sin(2*Math.PI*82.5*i/sr);
  return a;
}
function run(p,X){
  const v=new V(), P={decay:[3],damp:[0.5],mod:[0.5],shimmer:[0],pre:[0],mode:[0],fr:[0.5],dp:[0.3],hz:[220],dt:[0.3]}; for(const k in p) P[k]=[p[k]];
  const L=new Float32Array(X.length), R=new Float32Array(X.length);
  for(let b=0;b*N<X.length;b++){ const xi=X.subarray(b*N,b*N+N), o=[new Float32Array(N),new Float32Array(N)]; v.process([[xi,xi]],[o],P); L.set(o[0],b*N); R.set(o[1],b*N); }
  return {L,R};
}
const db=(o,s0,s1)=>{ let s=0,c=0; for(let i=Math.floor(s0*sr);i<Math.floor(s1*sr);i++){ s+=o.L[i]*o.L[i]+o.R[i]*o.R[i]; c+=2; } return 10*Math.log10(s/c+1e-30); };
const fin=o=>o.L.every(Number.isFinite)&&o.R.every(Number.isFinite);
console.log('chambres');
const X=sig(14,14), base=run({},X), b0=db(base,4,14);
const cas=[['pièce',{mode:1,dp:0.5}],['écho',{mode:2,dp:0.4}],['crête sur la tonique',{mode:3,dp:0.5,hz:220}],['crête très résonante',{mode:3,dp:1,hz:440}],['porte longue',{mode:4,dp:0.6}],['onde',{mode:5,dp:0.7,fr:0.6}],['gong, repliement',{mode:6,dp:0,hz:220}],['gong, anneau',{mode:6,dp:1,hz:220}]];
for(const [nm,p] of cas){ const o=run(p,X), d=db(o,4,14)-b0; ck(fin(o)&&Math.abs(d)<4,nm+' : fini, niveau de la vivante à 4 dB près ('+d.toFixed(1)+' dB)'); }
/* le gong au milieu ne touche presque pas la queue */
{ const o=run({mode:6,dp:0.5,hz:220},X); let e=0; for(let i=0;i<X.length;i++) e+=Math.abs(o.L[i]-base.L[i]); ck(e/X.length<1e-3,'gong au milieu : net (écart moyen '+(e/X.length).toExponential(1)+')'); }
/* la porte courte coupe la queue ; le gel la tient après que tout s'est tu */
{ const Y=sig(12,6), viv=run({decay:4},Y), courte=run({mode:4,dp:0,decay:4},Y), gel=run({mode:4,dp:1,decay:4},Y);
  ck(db(courte,2,6)<db(viv,2,6)-3,'porte courte : la queue se ferme ('+(db(courte,2,6)-db(viv,2,6)).toFixed(1)+' dB)');
  ck(db(gel,9,12)>db(viv,9,12)+15,'gel : la queue tient 3 à 6 s après le silence ('+(db(gel,9,12)-db(viv,9,12)).toFixed(1)+' dB de plus que la vivante)'); }
/* la pièce décale la droite */
{ const o=run({mode:1,dp:1},X), d=Math.round(0.06*sr); let eL=0, eR=0; for(let i=d;i<X.length;i++){ eL+=Math.abs(o.L[i]-base.L[i]); eR+=Math.abs(o.R[i]-base.R[i-d]); } ck(eL<1e-6&&eR<1e-6,'pièce : la gauche intacte, la droite 60 ms plus tard'); }
/* l'écho poussé au maximum ne s'emballe pas */
{ const o=run({mode:2,dp:1,dt:0.25},X); let pk=0; for(const x of o.L) pk=Math.max(pk,Math.abs(x)); ck(fin(o)&&pk<2,'écho au maximum : pas d\'emballement (crête '+pk.toFixed(2)+')'); }

console.log('égaliseur de niveau de la fuzz');
{ const m=new M(), n=sr*3; let eo=0, er=0;
  for(let b=0;b*N<n;b++){ const ref=new Float32Array(N), proc=new Float32Array(N), o=[new Float32Array(N),new Float32Array(N)];
    for(let i=0;i<N;i++){ const t=(b*N+i)/sr, x=0.05*Math.sin(2*Math.PI*110*t); ref[i]=x; proc[i]=Math.max(-0.9,Math.min(0.9,x*200)); }
    m.process([[ref,ref],[proc,proc]],[o]); if(b*N>sr*1.5) for(let i=0;i<N;i++){ eo+=o[0][i]*o[0][i]; er+=ref[i]*ref[i]; } }
  const d=10*Math.log10(eo/er); ck(Math.abs(d)<1,'une fuzz 46 dB plus forte revient au niveau du propre ('+d.toFixed(2)+' dB)'); }
{ const m=new M(), o=[new Float32Array(N),new Float32Array(N)], z=new Float32Array(N); for(let b=0;b<400;b++) m.process([[z,z],[z,z]],[o]); ck(o[0].every(x=>x===0)&&Number.isFinite(m.g),'silence : sortie nulle, gain stable'); }
console.log(fail?'ECHEC pédales':'Pédales : tout passe'); process.exit(fail?1:0);
