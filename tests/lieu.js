/* Lieu procédural : le processeur du worklet, exécuté hors navigateur avec un faux environnement de worklet.
   Il doit sonner quand on le règle, se taire à zéro, ne pas se répéter (pas de boucle), rester identique à graine égale. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','js','fx.js'),'utf8');
const procs={};
const ctx={sampleRate:44100, AudioWorkletProcessor:class{}, registerProcessor:(n,c)=>{ procs[n]=c; }, Float32Array, Math, console};
vm.createContext(ctx); vm.runInContext(src+'\nfxWorkletBody();',ctx);
const Lieu=procs['bourdon-lieu']; let fail=0; const ck=(c,m)=>{ console.log((c?'  ok   ':'  ECHEC ')+m); if(!c) fail++; };
if(!Lieu){ console.log('ECHEC : processeur bourdon-lieu absent'); process.exit(1); }
function render(params,seed,secs){
  const p=new Lieu({processorOptions:{seed}}), N=128, blocks=Math.round(secs*44100/N), out=[[],[],[]];
  for(let b=0;b<blocks;b++){ const o=[0,1,2].map(()=>[new Float32Array(N),new Float32Array(N)]); p.process([],o,{feu:[params.feu||0],vent:[params.vent||0],pluie:[params.pluie||0]}); for(let k=0;k<3;k++) out[k].push(o[k][0]); }
  return out.map(l=>{ const a=new Float32Array(l.length*N); l.forEach((x,i)=>a.set(x,i*N)); return a; });
}
const rms=a=>Math.sqrt(a.reduce((s,x)=>s+x*x,0)/a.length);
const seg=(a,s0,s1)=>a.subarray(Math.floor(s0*44100),Math.floor(s1*44100));
console.log('lieu procédural');
const z=render({},1,1); ck(z.every(c=>rms(c)===0),'tout à zéro : silence');
const r=render({feu:0.8,vent:0.6,pluie:0.6},7,12);
['feu','vent','pluie'].forEach((k,i)=>{ const v=rms(r[i]); ck(v>1e-3&&v<1 &&r[i].every(Number.isFinite),k+' sonne, sans valeur folle (efficace '+v.toFixed(4)+')'); });
/* pas de boucle : deux fenêtres de 2 s, à 12 s d'écart dans l'ancienne boucle de feu, ne sont pas identiques */
const a=seg(r[0],0.5,2.5), b=seg(r[0],8.5,10.5); let diff=0; for(let i=0;i<a.length;i++) diff+=Math.abs(a[i]-b[i]); ck(diff>1,'le feu ne se répète pas');
/* le vent a des rafales : son niveau varie d'une seconde à l'autre */
const lv=[]; for(let s=1;s<11;s++) lv.push(rms(seg(r[1],s,s+1))); const mn=Math.min(...lv), mx=Math.max(...lv); ck(mx/mn>1.3,'le vent souffle par rafales (écart '+(20*Math.log10(mx/mn)).toFixed(1)+' dB)');
/* plus de feu, plus de craquements : le niveau des aigus monte avec l'intensité */
const f1=render({feu:0.2},7,4)[0], f2=render({feu:1},7,4)[0]; ck(rms(f2)>rms(f1),'l\'intensité change le feu');
const r2=render({feu:0.8,vent:0.6,pluie:0.6},7,2); ck(r2[0].every((x,i)=>x===r[0][i])&&r2[2].every((x,i)=>x===r[2][i]),'même graine, même son (export et stems alignés)');
console.log(fail?'ECHEC lieu':'Lieu : tout passe'); process.exit(fail?1:0);
