"use strict";
/* ============================================================
   MODÈLES PHYSIQUES calculés en JavaScript : flûte (guide d'onde avec jet) et corde frottée (archet)
   Chaque fonction rend un tampon mono ; les paramètres viennent d'un balayage de robustesse (150 à 1300 Hz pour la flûte,
   150 à 800 Hz pour l'archet) qui garde la hauteur juste sans saut de mode.
   ============================================================ */
class PhysDL{
  constructor(n){ this.n=Math.max(4,Math.ceil(n)+2); this.b=new Float32Array(this.n); this.w=0; }
  put(x){ this.b[this.w]=x; this.w=(this.w+1)%this.n; }
  get(d){ const r=this.w-1-d, i=Math.floor(r), f=r-i, a=((i%this.n)+this.n)%this.n, b=(a+1)%this.n; return this.b[a]*(1-f)+this.b[b]*f; }
}
function physRnd(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }

/* flûte : le souffle passe par un jet qui frappe le biseau, la colonne d'air renvoie l'onde (non-linéarité cubique) ; paramètres validés par analyse spectrale de 150 à 1100 Hz */
function physFlute(sr,f,vel,dur,o){
  o=o||{}; const n=Math.floor(sr*dur), out=new Float32Array(n), rnd=physRnd(Math.floor(f*100)*2654435761>>>0);
  /* la colonne d'air fait deux périodes : la flûte sonne sur son deuxième mode, comme une vraie flûte (et non sur un harmonique élevé) */
  const jr=0.36, D=sr/(f*0.6667)*(1-(0.0046+0.0070*Math.max(0,Math.min(1,(f-147)/150))))-2.0, dl=D, jl=D*jr, bore=new PhysDL(dl+4), jet=new PhysDL(jl+4);
  const P=Math.max(0.97,Math.min(1.08,0.97+0.35*vel))*(o.pressure||1), att=Math.floor(sr*(o.att||0.07)), rel=Math.floor(sr*0.12), noiseG=o.noise===undefined?0.12:o.noise, pole=0.7-0.1*22050/sr;
  let lp=0, dcx=0, dcy=0, ph=0, bo=0, pk=0;
  for(let i=0;i<n;i++){
    let env=i<att?i/att:1; if(i>n-rel) env*=(n-i)/rel;
    let br=P*env; br+=br*noiseG*(rnd()*2-1); ph+=2*Math.PI*5/sr; if(i>sr*0.25) br+=br*0.012*Math.sin(ph);
    let t=-((1-pole)*bo+pole*lp); lp=-t;
    const dc=t-dcx+0.995*dcy; dcx=t; dcy=dc; t=dc;
    let pd=br-0.5*t; jet.put(pd); pd=jet.get(jl);
    pd=pd*(pd*pd-1); if(pd>1) pd=1; if(pd<-1) pd=-1;
    pd=pd+0.5*t; bore.put(pd); bo=bore.get(dl);
    const v=0.3*bo; out[i]=v; const a=v<0?-v:v; if(a>pk) pk=a;
  }
  const sc=0.9/(pk||1); for(let i=0;i<n;i++) out[i]*=sc;
  return out;
}
/* archet : la corde est entraînée par le frottement (loi de frottement de McIntyre et Schumacher), chevalet et sillet réfléchissent */
function physBowed(sr,f,vel,dur,o){
  o=o||{}; const n=Math.floor(sr*dur), out=new Float32Array(n);
  const L=sr/f-3.1, beta=0.127236, bl=L*beta, nl=L*(1-beta), bridge=new PhysDL(bl+4), neck=new PhysDL(nl+4);
  const pole=0.6-0.1*22050/sr, att=Math.floor(sr*(o.att||0.2)), rel=Math.floor(sr*0.25), maxV=0.15+0.1*Math.min(1,vel*3), slope=2.0;
  let sf=0, bo=0, no=0, ph=0, pk=0;
  for(let i=0;i<n;i++){
    let env=i<att?i/att:1; if(i>n-rel) env*=(n-i)/rel;
    ph+=2*Math.PI*5.2/sr; const bowV=maxV*env*(i>sr*0.3?1+0.012*Math.sin(ph):1);
    sf=(1-Math.abs(pole))*(-bo)*0.95+pole*sf;
    const br=sf, nr=-no, sv=br+nr, vd=bowV-sv;
    let tb=Math.abs(slope*vd+0.2)+0.75; tb=Math.pow(tb,-4); if(tb>1) tb=1;
    const nv=vd*tb; neck.put(br+nv); bridge.put(nr+nv); no=neck.get(nl); bo=bridge.get(bl);
    const v=bo*0.35; out[i]=v; const a=v<0?-v:v; if(a>pk) pk=a;
  }
  const sc=0.9/(pk||1); for(let i=0;i<n;i++) out[i]*=sc;
  return out;
}
/* anche : colonne d'air cylindrique excitée par une anche battante (modèle de la clarinette de Cook et Scavone) ;
   la table d'anche est linéaire et écrêtée, la réflexion au bout du tube est un passe-bas ; le souffle porte un peu de bruit et un vibrato qui s'installe.
   Sert à l'aulos (double flûte à anche) : un son de bois creux, pas un cuivre. */
function physReed(sr,f,vel,dur,o){
  o=o||{}; const n=Math.floor(sr*dur), out=new Float32Array(n), rnd=physRnd(Math.floor(f*97)*2246822519>>>0);
  const D=Math.max(4,sr/f*0.5-1.5), bore=new PhysDL(D+4), att=Math.floor(sr*(o.att||0.05)), rel=Math.floor(sr*0.09);
  const maxP=Math.max(0.62,Math.min(0.9,0.62+1.1*vel))*(o.pressure||1), noiseG=o.noise===undefined?0.18:o.noise, off=0.7, slope=o.slope||-0.3;
  let x1=0, ph=0, pk=0, dcx=0, dcy=0;
  for(let i=0;i<n;i++){
    let env=i<att?i/att:1; if(i>n-rel) env*=(n-i)/rel;
    ph+=2*Math.PI*5.3/sr; const vib=i>sr*0.3?0.02*Math.sin(ph):0;
    const bp=maxP*env*(1+noiseG*(rnd()*2-1)*0.2+vib);
    const bo=bore.get(D), fl=0.5*(bo+x1); x1=bo;
    let pd=-0.95*fl-bp, rt=off+slope*pd; if(rt>1) rt=1; if(rt<-1) rt=-1;
    bore.put(bp+pd*rt);
    const dc=bo-dcx+0.995*dcy; dcx=bo; dcy=dc; out[i]=dc; const a=dc<0?-dc:dc; if(a>pk) pk=a;
  }
  const sc=0.9/(pk||1); for(let i=0;i<n;i++) out[i]*=sc;
  return out;
}
