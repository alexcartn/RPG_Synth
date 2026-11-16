"use strict";
/* ============================================================
   DAW : mixeur (machine et pistes), enregistrement au clavier, piano roll
   La machine continue de générer ; les pistes sont des clips en boucle posés par-dessus.
   ============================================================ */
const DW={tab:"clip", machFold:false, lv:{}, view:"roll", seqOct:0, seqStep:1, seqDens:0.4, recDirty:false, rec:false, held:new Map(), undo:[], drag:null, snap:true, raf:0, scrolled:false, built:false, hov:null};
const DCOL=["#a3301c","#2f6f5b","#b0801f","#4a5a8a","#7a4a7a","#4a7a8a","#8a6a3a","#5a5a5a"];
const MACH=[["drone","Bourdon","drone.lvl"],["mel","Mélodie et canon","mel.lvl"],["pad","Nappes","pad.lvl"],["perc","Percussion","perc.lvl"],["loops","Boucles","loops.lvl"],["pend","Pendules","pend.lvl"],["amb","Lieu",null]];
const GRIDS=[[2,"Noire"],[1,"Croche"],[0.5,"Double-croche"],[0.25,"Libre"]];
const ROW=12, GUT=44;
const curTrack=()=>S.daw.tracks[S.daw.sel]||S.daw.tracks[0];
const dawE=()=>30/S.tempo, dawBarE=()=>METERS[S.meter].p.length;
const dawL=tr=>Math.max(1,tr.bars)*dawBarE();
const tcol=i=>DCOL[i%DCOL.length];
const dawEl=(tag,cls,html)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; };

/* ---------- annulation ---------- */
function dawSnap(tr){ DW.undo.push({id:tr.id,notes:JSON.parse(JSON.stringify(tr.notes)),bars:tr.bars}); if(DW.undo.length>80) DW.undo.shift(); dawUndoUI(); }
function dawUndo(){
  const u=DW.undo.pop(); dawUndoUI(); if(!u) return;
  const tr=S.daw.tracks.find(t=>t.id===u.id); if(!tr) return;
  tr.notes=u.notes; tr.bars=u.bars; dawReplan(tr); dawMixDraw(); dawRollHead();
}
function dawUndoUI(){ const b=$("dawUndo"); if(b) b.disabled=!DW.undo.length; }
function dawReplan(tr){ if(live) live.eng.dawReplan(tr?tr.id:undefined); }

/* ---------- jeu au clavier : l'instrument de la piste choisie, et l'enregistrement ---------- */
function dawHand(off,op){ if(S.daw.arp.on) return {release(){}}; return live.eng.dawOn(curTrack(),off,0.7,op); }
function dawRecOn(id,off){ if(DW.rec&&live&&!S.daw.arp.on) DW.held.set(id,{off,t:live.ctx.currentTime}); }
function dawRecOff(id){
  const h=DW.held.get(id); if(!h||!live) return; DW.held.delete(id);
  const tr=curTrack(), E=dawE(), L=dawL(tr), g=S.daw.grid, pos=(h.t-live.eng.t0f())/E;
  let s=((pos%L)+L)%L; s=Math.round(s/g)*g; if(s>=L) s-=L;
  const d=Math.min(L-s,Math.max(g,Math.round((live.ctx.currentTime-h.t)/E/g)*g));
  if(tr.notes.some(n=>Math.abs(n.s-s)<1e-6&&n.off===h.off)) return;
  tr.notes.push({s,off:h.off,d,v:0.7}); DW.recDirty=true; dawMixDraw();
}

/* ---------- lignes de temps (arrangement) et mixeur ---------- */
function dawParam(k,v){ const prev=getP(k); setP(k,v); refreshKeys([k]); paramChanged(k,prev,v,false,false); }
function dawLevels(){ if(live) live.eng.setLevels(); }
function dawBtn(txt,label,on,fn,cls){ const b=dawEl("button","dw-b"+(cls?" "+cls:""),txt); b.type="button"; b.title=label; b.setAttribute("aria-label",label); b.setAttribute("aria-pressed",on?"true":"false"); b.onclick=e=>{ e.stopPropagation(); fn(); }; return b; }
function dawRange(v,min,max,step,label,fn){ const r=dawEl("input"); r.type="range"; r.min=min; r.max=max; r.step=step; r.value=v; r.setAttribute("aria-label",label); r.oninput=()=>fn(parseFloat(r.value)); r.onclick=e=>e.stopPropagation(); return r; }
function dawSel(opts,val,label,fn){ const s=dawEl("select"); s.setAttribute("aria-label",label); opts.forEach(([v,n])=>{ const o=dawEl("option"); o.value=v; o.textContent=n; s.appendChild(o); }); s.value=String(val); s.onchange=()=>fn(s.value); s.onclick=e=>e.stopPropagation(); return s; }
const LH={ruler:24, sec:22, mach:22, trk:56}, HEADW=236;
function dawRows(){
  const rows=[]; let y=LH.ruler;
  rows.push({type:"sec",key:"mach",y,h:LH.sec}); y+=LH.sec;
  if(!DW.machFold) MACH.forEach(m=>{ rows.push({type:"mach",m,y,h:LH.mach}); y+=LH.mach; });
  rows.push({type:"sec",key:"trk",y,h:LH.sec}); y+=LH.sec;
  S.daw.tracks.forEach((tr,i)=>{ rows.push({type:"trk",tr,i,y,h:LH.trk}); y+=LH.trk; });
  return {rows,H:y};
}
const dawWindowBars=()=>Math.max(4,Math.min(8,Math.max(...S.daw.tracks.map(t=>t.bars))));
function dawSelect(i,open){ const D=S.daw; if(i!==D.sel){ D.sel=i; DW.scrolled=false; } if(open) dawTab("clip"); dawMixDraw(); dawRollHead(); }
/* colonne de gauche : l'en-tête de chaque ligne, aligné sur le canvas */
function dawLanesDraw(){
  const host=$("dawHeads"); if(!host) return; host.innerHTML=""; const D=S.daw, {rows,H}=dawRows(); host.style.height=H+"px";
  host.appendChild(Object.assign(dawEl("div","dw-hrule"),{}));
  host.firstChild.style.height=LH.ruler+"px"; host.firstChild.innerHTML='<span>Mesure</span>';
  rows.forEach(r=>{
    const d=dawEl("div","dw-h "+r.type); d.style.height=r.h+"px";
    if(r.type==="sec"){
      if(r.key==="mach"){ const b=dawEl("button","dw-fold"); b.type="button"; b.setAttribute("aria-expanded",DW.machFold?"false":"true"); b.innerHTML=(DW.machFold?"▸ ":"▾ ")+"La machine<em>générative</em>"; b.onclick=()=>{ DW.machFold=!DW.machFold; dawMixDraw(); }; d.appendChild(b); }
      else{ d.appendChild(dawEl("span","",'Tes pistes<em>clips en boucle</em>')); const b=dawEl("button","lnk","+ piste"); b.type="button"; b.disabled=D.tracks.length>=8; b.onclick=dawAddTrack; d.appendChild(b); }
    }else if(r.type==="mach"){
      const [id,name]=r.m; d.appendChild(dawEl("span","nm",name));
      const mt=dawEl("span","dw-mt"); mt.innerHTML='<i></i>'; mt.dataset.k=id; d.appendChild(mt);
      d.appendChild(dawBtn("M","Couper : "+name,!!D.mix.mute[id],()=>{ D.mix.mute[id]=!D.mix.mute[id]; dawLevels(); dawMixDraw(); },"m"));
      d.appendChild(dawBtn("S","Solo : "+name,!!D.mix.solo[id],()=>{ D.mix.solo[id]=!D.mix.solo[id]; dawLevels(); dawMixDraw(); },"s"));
    }else{
      const tr=r.tr, i=r.i; d.classList.toggle("sel",i===D.sel); d.style.setProperty("--tc",tcol(i)); d.onclick=()=>dawSelect(i,false); d.ondblclick=()=>dawSelect(i,true);
      const l1=dawEl("div","l1"), l2=dawEl("div","l2");
      const nm=dawEl("input","nm"); nm.type="text"; nm.value=tr.name; nm.maxLength=24; nm.setAttribute("aria-label","Nom de la piste"); nm.onfocus=()=>{ if(D.sel!==i) dawSelect(i,false); }; nm.oninput=()=>{ tr.name=nm.value; dawRollHead(true); }; nm.onclick=e=>e.stopPropagation();
      l1.appendChild(nm);
      l1.appendChild(dawBtn("M","Couper : "+tr.name,tr.mute,()=>{ tr.mute=!tr.mute; dawLevels(); dawMixDraw(); },"m"));
      l1.appendChild(dawBtn("S","Solo : "+tr.name,tr.solo,()=>{ tr.solo=!tr.solo; dawLevels(); dawMixDraw(); },"s"));
      const del=dawBtn("×","Supprimer la piste "+tr.name,false,()=>{ if(D.tracks.length<2) return; D.tracks.splice(i,1); D.sel=Math.min(D.sel,D.tracks.length-1); dawLevels(); if(live) live.eng.dawReplan(); dawMixDraw(); dawRollHead(); },"x"); del.disabled=D.tracks.length<2; l1.appendChild(del);
      l2.appendChild(dawSel(INST_OPTS,tr.inst,"Instrument de "+tr.name,v=>{ tr.inst=v; dawReplan(tr); dawLevels(); dawChainDraw(); }));
      const mt=dawEl("span","dw-mt"); mt.innerHTML='<i></i>'; mt.dataset.k="t"+tr.id; l2.appendChild(mt);
      d.appendChild(l1); d.appendChild(l2);
    }
    host.appendChild(d);
  });
  const cv=$("dawTime"); if(cv) cv.style.height=H+"px";
}
/* le canvas de la ligne de temps : règle, clips en boucle avec leurs notes, tête de lecture */
function dawTimeDraw(){
  if(!DW.built||MODE!=="daw") return; const cv=$("dawTime"); if(!cv) return;
  const {rows,H}=dawRows(); cv.style.height=H+"px"; const g=fit(cv); if(!g) return; const {c,W}=g;
  const bars=dawWindowBars(), barE=dawBarE(), total=bars*barE, xs=s=>s/total*W, D=S.daw;
  c.fillStyle="rgba(60,40,20,0.05)"; c.fillRect(0,0,W,LH.ruler);
  rows.forEach(r=>{
    if(r.type==="sec"){ c.fillStyle="rgba(60,40,20,0.07)"; c.fillRect(0,r.y,W,r.h); }
    else if(r.type==="mach"){
      const lv=live?Math.min(1,Math.pow(live.eng.meter(r.m[0]),0.5)*1.5):0; DW.lv[r.m[0]]=lv;
      c.save(); c.beginPath(); c.rect(0,r.y,W,r.h); c.clip(); c.strokeStyle="rgba(120,100,70,0.2)"; c.lineWidth=1;
      for(let x=-r.h;x<W;x+=9){ c.beginPath(); c.moveTo(x,r.y+r.h); c.lineTo(x+r.h,r.y); c.stroke(); }
      if(lv>0.02){ c.fillStyle="rgba(163,48,28,"+(0.04+lv*0.16).toFixed(3)+")"; c.fillRect(0,r.y,W,r.h); } c.restore();
    }else{
      if(r.i===D.sel){ c.fillStyle="rgba(163,48,28,0.06)"; c.fillRect(0,r.y,W,r.h); }
      const tr=r.tr, L=dawL(tr), reps=Math.max(1,Math.round(total/L)), col=tcol(r.i), lo0=tr.notes.length?Math.min(...tr.notes.map(n=>n.off)):0, hi0=tr.notes.length?Math.max(...tr.notes.map(n=>n.off)):12, lo=Math.min(lo0,hi0-11), hi=Math.max(hi0,lo+11);
      for(let k=0;k<reps;k++){
        const x0=xs(k*L)+1, x1=xs((k+1)*L)-1, w=x1-x0, top=r.y+4, hh=r.h-8, first=k===0;
        c.globalAlpha=first?1:0.5; c.fillStyle=col+(first?"2e":"1c"); c.fillRect(x0,top,w,hh); c.strokeStyle=col; c.lineWidth=r.i===D.sel?2:1; c.strokeRect(x0+0.5,top+0.5,w-1,hh-1);
        c.fillStyle=col; c.fillRect(x0,top,w,11); c.fillStyle="#f6efde"; c.font='italic 10px "Alegreya", Georgia, serif'; if(first) c.fillText(tr.name+" · "+tr.bars+" mes.",x0+4,top+9);
        if(!tr.notes.length){ c.fillStyle=col; c.globalAlpha=first?0.6:0.3; c.font='italic 11px "Alegreya", Georgia, serif'; if(first) c.fillText("vide : double-clique pour écrire",x0+8,top+hh/2+9); }
        tr.notes.forEach(n=>{ const nx=x0+n.s/L*w, nw=Math.max(2,n.d/L*w-1), ny=top+13+(1-(n.off-lo)/(hi-lo))*(hh-18); c.fillStyle=col; c.globalAlpha=first?0.95:0.5; c.fillRect(nx,ny,nw,3); });
        c.globalAlpha=1;
      }
    }
  });
  for(let s=0;s<=total;s++){
    const x=Math.round(xs(s))+0.5, bar=s%barE===0, beat=s%2===0; if(!bar&&!beat&&W/total<9) continue;
    c.strokeStyle=bar?g.ink:(beat?"rgba(120,100,70,0.28)":"rgba(120,100,70,0.12)"); c.lineWidth=bar?1.1:1; c.beginPath(); c.moveTo(x,bar?0:LH.ruler); c.lineTo(x,H); c.stroke();
    if(bar&&s<total){ c.fillStyle=g.ink2; c.font='italic 11px "Alegreya", Georgia, serif'; c.fillText(String(s/barE+1),x+4,LH.ruler-8); }
  }
  c.strokeStyle=g.rule; c.beginPath(); c.moveTo(0,LH.ruler-0.5); c.lineTo(W,LH.ruler-0.5); c.stroke();
  if(live){ const p=(((live.ctx.currentTime-live.eng.t0f())/dawE())%total+total)%total, x=xs(p); c.strokeStyle=g.rub; c.lineWidth=1.8; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); c.fillStyle=g.rub; c.beginPath(); c.moveTo(x-5,0); c.lineTo(x+5,0); c.lineTo(x,7); c.closePath(); c.fill(); }
}
function dawTimeEvents(){
  const cv=$("dawTime"), rowAt=e=>{ const r=cv.getBoundingClientRect(), y=e.clientY-r.top; return dawRows().rows.find(q=>y>=q.y&&y<q.y+q.h); };
  cv.addEventListener("click",e=>{ const r=rowAt(e); if(r&&r.type==="trk") dawSelect(r.i,false); });
  cv.addEventListener("dblclick",e=>{ const r=rowAt(e); if(r&&r.type==="trk") dawSelect(r.i,true); });
}
/* le mixeur : un faders vertical par voix et par piste, avec vumètre */
function dawMixerDraw(){
  ["dawMixer","jeuMixer"].forEach(id=>{ const h=$(id); if(h) dawMixerFill(h,id==="dawMixer"); });
}
function dawMixerFill(host,inDaw){
  host.innerHTML=""; const D=S.daw;
  const strip=(name,color,val,set,mute,solo,key,hasFader)=>{
    const s=dawEl("div","dw-strip"); s.style.setProperty("--tc",color);
    s.appendChild(dawEl("span","nm",name));
    const m=dawEl("div","dw-fader"); const meter=dawEl("span","dw-vu"); meter.innerHTML="<i></i>"; meter.dataset.k=key; m.appendChild(meter);
    if(hasFader){ const r=dawRange(val,0,1,0.01,"Niveau : "+name,set); r.className="vert"; m.appendChild(r); } else m.appendChild(dawEl("span","dw-nofd","—"));
    s.appendChild(m);
    const bt=dawEl("div","dw-sm"); bt.appendChild(dawBtn("M","Couper : "+name,mute.get(),()=>{ mute.set(); dawLevels(); dawMixDraw(); },"m")); bt.appendChild(dawBtn("S","Solo : "+name,solo.get(),()=>{ solo.set(); dawLevels(); dawMixDraw(); },"s")); s.appendChild(bt);
    return s;
  };
  MACH.forEach(([id,name,k])=>host.appendChild(strip(name,"var(--ink-2)",k?getP(k):0,v=>dawParam(k,v),{get:()=>!!D.mix.mute[id],set:()=>{ D.mix.mute[id]=!D.mix.mute[id]; }},{get:()=>!!D.mix.solo[id],set:()=>{ D.mix.solo[id]=!D.mix.solo[id]; }},id,!!k)));
  host.appendChild(dawEl("span","dw-sep"));
  D.tracks.forEach((tr,i)=>{ const s=strip(tr.name,tcol(i),tr.vol,v=>{ tr.vol=v; dawLevels(); },{get:()=>tr.mute,set:()=>{ tr.mute=!tr.mute; }},{get:()=>tr.solo,set:()=>{ tr.solo=!tr.solo; }},"t"+tr.id,true); s.classList.toggle("sel",i===D.sel); if(inDaw) s.firstChild.onclick=()=>dawSelect(i,false); const pan=dawRange(tr.pan,-1,1,0.05,"Pan de "+tr.name,v=>{ tr.pan=v; dawLevels(); }); pan.className="pan"; s.insertBefore(pan,s.lastChild); host.appendChild(s); });
}
function dawMetersTick(){
  if(!live) return;
  document.querySelectorAll("#dawMixer .dw-vu, #jeuMixer .dw-vu").forEach(m=>{ const pk=live.eng.meter(m.dataset.k), v=Math.min(1,Math.pow(pk,0.5)*1.25); m.firstChild.style.transform="scaleY("+v.toFixed(3)+")"; });
  document.querySelectorAll("#dawHeads .dw-mt").forEach(m=>{ const pk=live.eng.meter(m.dataset.k), v=Math.min(1,Math.pow(pk,0.5)*1.25); m.firstChild.style.transform="scaleX("+v.toFixed(3)+")"; });
}
/* chaîne de la piste choisie : instrument, arpégiateur, niveau (comme les « devices » d'Ableton) */
function dawChainDraw(){
  const host=$("dawChainTrk"); if(!host) return; const keep=$("daw"), arp0=$("dawArp"); if(arp0&&arp0.parentNode===host) keep.appendChild(arp0); host.innerHTML=""; const tr=curTrack(), D=S.daw, i=D.sel;
  const dev=(title,note)=>{ const d=dawEl("div","dw-dev"); d.innerHTML='<h4>'+title+(note?'<em>'+note+'</em>':'')+'</h4>'; return d; };
  const d1=dev("Instrument","de la piste "+(i+1)); d1.style.setProperty("--tc",tcol(i)); d1.appendChild(dawSel(INST_OPTS,tr.inst,"Instrument",v=>{ tr.inst=v; dawReplan(tr); dawLevels(); dawMixDraw(); }));
  if(tr.inst==="atelier"){ const b=dawEl("button","lnk","Forger le synthé ›"); b.type="button"; b.onclick=()=>setMode("atelier"); d1.appendChild(b); }
  host.appendChild(d1); host.appendChild(dawEl("span","dw-arrow","→"));
  const arp=$("dawArp"); host.appendChild(arp); host.appendChild(dawEl("span","dw-arrow","→"));
  const d3=dev("Piste","niveau et position"); const f=dawEl("div","dw-f g2");
  f.appendChild(dawEl("label","","Niveau")); f.appendChild(dawRange(tr.vol,0,1,0.01,"Niveau de "+tr.name,v=>{ tr.vol=v; dawLevels(); dawMixDraw(); }));
  f.appendChild(dawEl("label","","Pan")); f.appendChild(dawRange(tr.pan,-1,1,0.05,"Pan de "+tr.name,v=>{ tr.pan=v; dawLevels(); dawMixDraw(); }));
  d3.appendChild(f); host.appendChild(d3);
}
function dawMixDraw(){ dawLanesDraw(); dawMixerDraw(); dawChainDraw(); }
function dawAddTrack(){
  const D=S.daw; if(D.tracks.length>=8) return;
  const id=Math.max(0,...D.tracks.map(t=>t.id))+1, insts=["luth","harpe","flute","carillon","oud","kalimba","atelier","orgue"];
  D.tracks.push({id,name:"Piste "+(D.tracks.length+1),inst:insts[D.tracks.length%insts.length],vol:0.8,pan:0,mute:false,solo:false,bars:2,notes:[]});
  D.sel=D.tracks.length-1; DW.scrolled=false; dawLevels(); dawMixDraw(); dawRollHead();
}
function dawTab(t){
  DW.tab=t; ["clip","trk","mixer"].forEach(k=>{ const b=$("dawT_"+k), p=$("dawP_"+k); if(b) b.setAttribute("aria-pressed",k===t?"true":"false"); if(p) p.hidden=k!==t; });
  DW.scrolled=false; dawRollDraw();
}

/* ---------- piano roll ---------- */
function dawRange_(tr){ let lo=-12,hi=36; tr.notes.forEach(n=>{ lo=Math.min(lo,Math.floor(n.off/12)*12); hi=Math.max(hi,Math.ceil((n.off+1)/12)*12); }); return {lo,hi}; }
function dawGeom(){
  const tr=curTrack(), cv=$("dawRoll"), wrap=$("dawWrap"), {lo,hi}=dawRange_(tr), L=dawL(tr), W=Math.max(300,wrap.clientWidth);
  return {tr,cv,wrap,lo,hi,L,W,sw:(W-GUT)/L,H:(hi-lo)*ROW};
}
function dawRollHead(light){
  const tr=curTrack(), t=$("dawRollTitle"); if(t) t.textContent=tr.name;
  const rb=$("dawRec"); if(rb) rb.textContent="Enregistrer sur « "+tr.name+" »"; const bs=$("dawBars"); if(bs) bs.value=String(tr.bars);
  if(!light) dawRollDraw();
}
function dawRollDraw(){
  if(!DW.built||MODE!=="daw") return;
  if(DW.view==="seq"){ dawSeqDraw(); return; }
  const G=dawGeom(), {tr,cv,wrap,lo,hi,L,W,H}=G; cv.style.height=H+"px"; cv.style.width="100%";
  const g=fit(cv); if(!g) return; const c=g.c, iv=ivOf(S,curScaleKey()), ivi=iv.filter(Number.isInteger).map(v=>((v%12)+12)%12), sw=G.sw, barE=dawBarE();
  if(!DW.scrolled){ DW.scrolled=true; wrap.scrollTop=Math.max(0,(hi-1-26)*ROW); }
  const ink=g.ink, rub=g.rub, rule=g.rule, ink2=g.ink2;
  for(let off=lo;off<hi;off++){
    const y=(hi-1-off)*ROW, pc=((off%12)+12)%12, inS=ivi.indexOf(pc)>=0;
    if(!inS){ c.fillStyle="rgba(60,40,20,0.07)"; c.fillRect(GUT,y,W-GUT,ROW); }
    if(pc===0){ c.fillStyle="rgba(163,48,28,0.13)"; c.fillRect(GUT,y,W-GUT,ROW); }
    c.strokeStyle=pc===0?rule:"rgba(120,100,70,0.16)"; c.lineWidth=1; c.beginPath(); c.moveTo(GUT,y+ROW-0.5); c.lineTo(W,y+ROW-0.5); c.stroke();
    if(inS){ c.fillStyle=pc===0?rub:ink2; c.font=(pc===0?"600 ":"")+'10px "Alegreya", Georgia, serif'; c.fillText(NOTES[(S.root+pc)%12]+(pc===0?String(Math.floor(off/12)+3):""),4,y+ROW-3); }
  }
  for(let s=0;s<=L;s++){
    const x=Math.round(GUT+s*sw)+0.5, bar=s%barE===0, beat=s%2===0;
    if(!bar&&!beat&&sw<9) continue;
    c.strokeStyle=bar?ink:(beat?"rgba(120,100,70,0.35)":"rgba(120,100,70,0.16)"); c.lineWidth=bar?1.2:1; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke();
    if(bar&&s<L){ c.fillStyle=ink2; c.font='italic 10px "Alegreya", Georgia, serif'; c.fillText(String(s/barE+1),x+3,hi*0+10+wrap.scrollTop); }
  }
  const col=tcol(S.daw.sel);
  tr.notes.forEach(n=>{
    const x=GUT+n.s*sw, y=(hi-1-n.off)*ROW, w=Math.max(4,n.d*sw-1);
    c.globalAlpha=0.55+0.45*Math.min(1,n.v); c.fillStyle=col; c.fillRect(x,y+1,w,ROW-2);
    c.globalAlpha=1; c.fillStyle="rgba(255,255,255,0.35)"; c.fillRect(x+w-3,y+1,3,ROW-2);
  });
  if(live){ const p=live.eng.dawPos(tr), x=GUT+p*sw; c.strokeStyle=rub; c.lineWidth=1.6; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); }
  c.fillStyle=g.rule; c.fillRect(GUT-1,0,1,H);
}
/* position du pointeur dans le piano roll */
function dawPt(e){
  const G=dawGeom(), r=G.cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top;
  const s=(x-GUT)/G.sw, off=G.hi-1-Math.floor(y/ROW);
  return {G,x,y,s,off};
}
function dawHit(G,s,off){ for(let i=G.tr.notes.length-1;i>=0;i--){ const n=G.tr.notes[i]; if(Math.floor(n.off)===off&&s>=n.s&&s<n.s+n.d) return n; } return null; }
function dawSnapPitch(off){
  if(!DW.snap) return off;
  const ivi=ivOf(S,curScaleKey()).filter(Number.isInteger).map(v=>((v%12)+12)%12); if(!ivi.length) return off;
  for(let d=0;d<=6;d++){ for(const o of [off+d,off-d]) if(ivi.indexOf(((o%12)+12)%12)>=0) return o; }
  return off;
}
function dawAudition(off){
  if(!live) return; try{ const h=dawHand(off); setTimeout(()=>h.release(),260); }catch(e){}
}
function dawRollEvents(){
  const cv=$("dawRoll"), gq=()=>S.daw.grid;
  cv.addEventListener("pointerdown",e=>{
    if(e.button!==0) return; const p=dawPt(e); if(p.x<GUT){ dawAudition(dawSnapPitch(p.off)); return; }
    e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(x){}
    const {G}=p, tr=G.tr, g=gq(), n=dawHit(G,p.s,p.off);
    if(n&&e.shiftKey){ dawSnap(tr); tr.notes.splice(tr.notes.indexOf(n),1); dawReplan(tr); dawRollDraw(); return; }
    if(n){
      dawSnap(tr); const edge=p.x>GUT+(n.s+n.d)*G.sw-7;
      DW.drag={n,mode:edge?"size":"move",ds:p.s-n.s,off:n.off,tr}; if(!edge) dawAudition(n.off);
    }else{
      const s=Math.max(0,Math.min(G.L-g,Math.floor(p.s/g+1e-6)*g)), off=dawSnapPitch(p.off), nn={s,off,d:g,v:0.7};
      dawSnap(tr); tr.notes.push(nn); DW.drag={n:nn,mode:"size",ds:0,off,tr}; dawAudition(off);
    }
    dawRollDraw();
  });
  cv.addEventListener("pointermove",e=>{
    const p=dawPt(e), d=DW.drag;
    if(!d){ const n=p.x>=GUT?dawHit(p.G,p.s,p.off):null; cv.style.cursor=n?(p.x>GUT+(n.s+n.d)*p.G.sw-7?"ew-resize":"grab"):(p.x<GUT?"pointer":"crosshair"); return; }
    const g=gq(), G=p.G, n=d.n;
    if(d.mode==="size"){ const end=Math.max(n.s+g,Math.round(p.s/g)*g); n.d=Math.min(G.L-n.s,end-n.s); }
    else{
      n.s=Math.max(0,Math.min(G.L-n.d,Math.round((p.s-d.ds)/g)*g));
      const no=dawSnapPitch(p.off); if(no!==n.off){ n.off=no; dawAudition(no); }
    }
    dawRollDraw();
  });
  const end=()=>{ const d=DW.drag; if(!d) return; DW.drag=null; dawReplan(d.tr); };
  cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
  cv.addEventListener("contextmenu",e=>{ e.preventDefault(); const p=dawPt(e), n=dawHit(p.G,p.s,p.off); if(n){ dawSnap(p.G.tr); p.G.tr.notes.splice(p.G.tr.notes.indexOf(n),1); dawReplan(p.G.tr); dawRollDraw(); } });
}

/* ---------- construction ---------- */
function dawMachUI(){ const b=$("dawMach"); if(!b) return; b.setAttribute("aria-pressed",S.mach!==false?"true":"false"); b.textContent=S.mach!==false?"La machine joue":"La machine est en sourdine"; }
function dawRecUI(){ const b=$("dawRec"); if(b) b.setAttribute("aria-pressed",DW.rec?"true":"false"); }
function buildDaw(){
  if(!S.daw) return;
  const host=document.querySelector(".folio"), sec=dawEl("section","daw"); sec.id="daw"; sec.hidden=true; sec.setAttribute("aria-label","Arranger");
  /* transport */
  const bar=dawEl("div","dw-bar");
  bar.innerHTML='<button class="seal sm" id="play4" aria-pressed="false">Jouer</button>'+
    '<button class="btn rec" id="dawRec" type="button" aria-pressed="false">Enregistrer</button>'+
    '<button class="btn" id="dawMach" type="button" aria-pressed="true">La machine joue</button>'+
    '<span class="dw-info" id="dawInfo"></span>'+
    '<div class="ctl"><label for="dawGrid">Grille</label><select id="dawGrid"></select></div>'+
    '<button class="btn" id="dawSnapB" type="button" aria-pressed="true" title="Les notes posées à la souris tombent dans la gamme du thème">Dans la gamme</button>'+
    '<button class="btn" id="dawUndo" type="button" disabled>Annuler</button>';
  sec.appendChild(bar);
  /* arrangement : en-têtes à gauche, ligne de temps à droite */
  const arr=dawEl("div","dw-arr"); arr.innerHTML='<div class="dw-heads" id="dawHeads"></div><div class="dw-time"><canvas id="dawTime" role="img" aria-label="Ligne de temps : les clips de chaque piste en boucle et l\'activité de la machine"></canvas></div>';
  sec.appendChild(arr);
  /* détail : clip, chaîne de la piste, mixeur */
  const det=dawEl("div","dw-detail");
  det.innerHTML='<div class="dw-dtabs"><button class="lnk" id="dawT_clip" type="button" aria-pressed="true">Clip</button><button class="lnk" id="dawT_trk" type="button" aria-pressed="false">Piste</button><button class="lnk" id="dawT_mixer" type="button" aria-pressed="false">Mixeur</button><span class="dw-tip">Double-clic sur un clip pour l\'écrire. Barre d\'espace : jouer ou arrêter.</span></div>'+
    '<div class="dw-pane" id="dawP_clip"><div class="dw-roll"><div class="dw-tabs"><button class="lnk" id="dawTabRoll" type="button" aria-pressed="true">Piano roll</button><button class="lnk" id="dawTabSeq" type="button" aria-pressed="false">Séquenceur</button><span class="dw-tools"><label class="at-sel">Boucle <select id="dawBars"></select></label><button class="lnk" id="dawDouble" type="button">Doubler</button><button class="lnk" id="dawClear" type="button">Vider</button></span></div><div class="dw-rh"><h3 id="dawRollTitle"></h3></div><div class="dw-wrap" id="dawWrap"><canvas id="dawRoll" role="img" aria-label="Piano roll de la piste choisie"></canvas></div><div class="dw-seq" id="dawSeqBox" hidden><div class="dw-sbar"><label>Pas <select id="dawSStep"></select></label><label>Octave <select id="dawSOct"></select></label><label>Densité <select id="dawSDens"></select></label><button class="btn" id="dawSRand" type="button">Au hasard</button><button class="btn" id="dawSShift" type="button">Décaler d\'un pas</button></div><canvas id="dawSeq" role="img" aria-label="Séquenceur à pas de la piste choisie"></canvas></div></div></div>'+
    '<div class="dw-pane" id="dawP_trk" hidden><div class="dw-chain" id="dawChainTrk"></div></div>'+
    '<div class="dw-pane" id="dawP_mixer" hidden><div class="dw-mixer" id="dawMixer"></div></div>';
  sec.appendChild(det);
  const arpBox=dawEl("div","dw-dev"); arpBox.id="dawArp";
  arpBox.innerHTML='<h4>Arpégiateur<em>sur le clavier</em></h4><div class="dw-f"><button class="btn" id="arpOn" type="button" aria-pressed="false">Activé</button><label>Ordre <select id="arpMode"></select></label><label>Vitesse <select id="arpRate"></select></label><label>Octaves <select id="arpOct"></select></label><label>Durée <input type="range" id="arpGate" min="0.15" max="1" step="0.05"></label></div><span class="hint" id="arpHint"></span>';
  sec.appendChild(arpBox);
  sec.appendChild(dawEl("div","dw-kb")).id="dawKb";
  host.insertBefore(sec,document.querySelector(".cols"));
  const gs=$("dawGrid"); GRIDS.forEach(([v,n])=>{ const o=dawEl("option"); o.value=v; o.textContent=n; gs.appendChild(o); }); gs.value=String(S.daw.grid); gs.onchange=()=>{ S.daw.grid=parseFloat(gs.value); };
  const bs=$("dawBars"); [1,2,4,8].forEach(v=>{ const o=dawEl("option"); o.value=v; o.textContent=v+(v>1?" mesures":" mesure"); bs.appendChild(o); });
  bs.onchange=()=>{ const tr=curTrack(); dawSnap(tr); tr.bars=parseInt(bs.value,10); dawReplan(tr); dawMixDraw(); dawRollDraw(); };
  $("play4").onclick=()=>{ live?stopLive():startLive(); };
  $("dawRec").onclick=()=>{ DW.rec=!DW.rec; DW.held.clear(); dawRecUI(); if(DW.rec){ dawSnap(curTrack()); if(!live) startLive({fade:0.25}); } else dawRecStop(); };
  $("dawMach").onclick=()=>{ setMach(S.mach===false); };
  $("dawSnapB").onclick=()=>{ DW.snap=!DW.snap; $("dawSnapB").setAttribute("aria-pressed",DW.snap?"true":"false"); };
  $("dawUndo").onclick=dawUndo;
  $("dawClear").onclick=()=>{ const tr=curTrack(); if(!tr.notes.length) return; dawSnap(tr); tr.notes=[]; dawReplan(tr); dawRollDraw(); };
  $("dawDouble").onclick=()=>{ const tr=curTrack(); if(tr.bars>=8) return; dawSnap(tr); const L=dawL(tr); tr.notes=tr.notes.concat(tr.notes.map(n=>({...n,s:n.s+L}))); tr.bars*=2; dawReplan(tr); dawMixDraw(); dawRollDraw(); };
  ["clip","trk","mixer"].forEach(k=>{ $("dawT_"+k).onclick=()=>dawTab(k); });
  dawRollEvents(); dawTimeEvents(); arpInit(); seqInit();
  document.addEventListener("keydown",e=>{
    if(MODE!=="daw") return;
    const tg=e.target&&e.target.tagName, typing=tg==="SELECT"||tg==="TEXTAREA"||(tg==="INPUT"&&e.target.type!=="range"&&e.target.type!=="checkbox");
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"&&!typing){ e.preventDefault(); dawUndo(); return; }
    if(e.code==="Space"&&!typing&&tg!=="BUTTON"){ e.preventDefault(); live?stopLive():startLive(); }
  });
  if(window.ResizeObserver) new ResizeObserver(()=>{ dawRollDraw(); dawTimeDraw(); }).observe(sec);
  DW.built=true; dawMixDraw(); dawRollHead(); dawMachUI();
}
/* entrée et sortie du mode : le clavier de l'atelier se déplace sous le détail */
function dawEnter(){
  const kb=$("atKb"), slot=$("dawKb"); if(kb&&slot){ if(!AT.kbHome){ AT.kbHome=kb.parentNode; AT.kbNext=kb.nextSibling; } slot.appendChild(kb); }
  DW.scrolled=false; dawMixDraw(); dawRollHead(); dawMachUI(); dawRecUI(); arpUI(); buildPiano(); dawTab(DW.tab||"clip");
  if(!DW.raf){ let n=0; const f=()=>{ if(MODE!=="daw"){ DW.raf=0; return; } dawTimeDraw(); if(DW.tab==="clip") dawRollDraw(); if(++n%3===0) dawMetersTick(); const inf=$("dawInfo"); if(inf){ const k=curScaleKey(), t=S.tempo+" ♩/min · "+NOTES[S.root]+" "+(SC[k]||SC.mixolydien).n.toLowerCase(); if(inf.textContent!==t) inf.textContent=t; } DW.raf=requestAnimationFrame(f); }; DW.raf=requestAnimationFrame(f); }
}
function dawRecStop(){ if(DW.recDirty){ DW.recDirty=false; dawReplan(curTrack()); } }
function dawLeave(){
  dawRecStop();
  const kb=$("atKb"); if(kb&&AT.kbHome) AT.kbHome.insertBefore(kb,AT.kbNext&&AT.kbNext.parentNode===AT.kbHome?AT.kbNext:null);
  DW.rec=false; DW.held.clear(); dawRecUI();
}

/* ---------- arpégiateur : les touches tenues deviennent un motif, calé sur la grille de la machine ---------- */
const ARP_MODES=[["up","Montant"],["down","Descendant"],["updown","Aller-retour"],["random","Au hasard"],["played","Dans l'ordre joué"]];
const ARP_RATES=[[2,"Noire"],[1,"Croche"],[0.5,"Double-croche"],[0.25,"Triple-croche"]];
const ARP={next:0, idx:0, had:false, timer:0};
function arpHeld(){
  const out=[], seen=new Set(), add=n=>{ const k=AT.keys[n.i]; if(k&&!seen.has(k.off)){ seen.add(k.off); out.push(k.off); } };
  AT.notes.forEach(add); AT.latch.forEach(add); return out;
}
function arpSeq(){
  const a=S.daw.arp, held=arpHeld(); if(!held.length) return [];
  const base=a.mode==="played"?held.slice():held.slice().sort((x,y)=>x-y); let seq=[];
  for(let o=0;o<a.oct;o++) base.forEach(x=>seq.push(x+12*o));
  if(a.mode==="down") seq.reverse();
  if(a.mode==="updown"&&seq.length>2) seq=seq.concat(seq.slice(1,-1).reverse());
  return seq;
}
function arpRecord(t,off,lenE){
  if(!DW.rec) return; const tr=curTrack(), E=dawE(), L=dawL(tr);
  let s=(((t-live.eng.t0f())/E)%L+L)%L; s=Math.round(s*1000)/1000;
  if(tr.notes.some(n=>Math.abs(n.s-s)<1e-3&&n.off===off)) return;
  tr.notes.push({s,off,d:Math.max(0.25,Math.min(L-s,lenE)),v:0.7}); DW.recDirty=true;
}
function arpTick(){
  const a=S.daw.arp;
  if(!live||!a.on||MODE!=="daw"){ ARP.next=0; ARP.had=false; return; }
  const ctx=live.ctx, t0=live.eng.t0f(), E=dawE(), step=a.rate*E, horizon=ctx.currentTime+0.12;
  if(!ARP.next||ARP.next<ctx.currentTime-0.05) ARP.next=t0+Math.ceil((ctx.currentTime+0.02-t0)/step-1e-6)*step;
  while(ARP.next<horizon){
    const seq=arpSeq();
    if(!seq.length){ ARP.had=false; }
    else{
      if(!ARP.had){ ARP.idx=0; ARP.had=true; }
      const off=a.mode==="random"?seq[Math.floor(Math.random()*seq.length)]:seq[ARP.idx%seq.length]; ARP.idx++;
      live.eng.dawNote(curTrack(),off,0.7,ARP.next,step*a.gate); arpRecord(ARP.next,off,a.rate*a.gate);
    }
    ARP.next+=step;
  }
}
function arpUI(){
  const a=S.daw.arp, b=$("arpOn"); if(!b) return;
  b.setAttribute("aria-pressed",a.on?"true":"false"); $("arpMode").value=a.mode; $("arpRate").value=String(a.rate); $("arpOct").value=String(a.oct); $("arpGate").value=a.gate;
  $("arpHint").textContent=a.on?"Tiens des touches (ou « Maintien ») : elles s'enchaînent en arpège, calées sur le tempo.":"Désactivé : le clavier joue les notes une à une.";
}
function arpInit(){
  const a=S.daw.arp, fill=(id,opts)=>{ const s=$(id); opts.forEach(([v,n])=>{ const o=document.createElement("option"); o.value=v; o.textContent=n; s.appendChild(o); }); };
  fill("arpMode",ARP_MODES); fill("arpRate",ARP_RATES); fill("arpOct",[[1,"1"],[2,"2"],[3,"3"]]);
  $("arpOn").onclick=()=>{ a.on=!a.on; if(!a.on) atReleaseAll(); arpUI(); };
  $("arpMode").onchange=()=>{ a.mode=$("arpMode").value; ARP.idx=0; };
  $("arpRate").onchange=()=>{ a.rate=parseFloat($("arpRate").value); ARP.next=0; };
  $("arpOct").onchange=()=>{ a.oct=parseInt($("arpOct").value,10); };
  $("arpGate").oninput=()=>{ a.gate=parseFloat($("arpGate").value); };
  arpUI(); ARP.timer=setInterval(arpTick,40);
}

/* ---------- séquenceur à pas : la même boucle vue en grille, une rangée par degré de la gamme ---------- */
function seqGeom(){
  const tr=curTrack(), iv=ivOf(S,curScaleKey()), n=iv.length, rows=Math.max(8,Math.min(12,n+1)), step=DW.seqStep, L=dawL(tr), cols=Math.max(1,Math.round(L/step));
  const cv=$("dawSeq"), W=Math.max(300,$("dawSeqBox").clientWidth), RH=24;
  return {tr,iv,n,rows,step,L,cols,cv,W,RH,cw:(W-GUT)/cols,H:rows*RH,offOf:r=>12+12*DW.seqOct+degOff(iv,r)};
}
const seqHas=(G,r,c)=>G.tr.notes.some(n=>Math.abs(n.off-G.offOf(r))<0.01&&Math.abs(n.s-c*G.step)<1e-3);
function dawSeqDraw(){
  if(!DW.built||MODE!=="daw"||DW.view!=="seq") return;
  const G=seqGeom(), {tr,cv,rows,cols,cw,RH,W,H}=G; cv.style.height=H+"px"; cv.style.width="100%";
  const g=fit(cv); if(!g) return; const c=g.c, barE=dawBarE(), col=tcol(S.daw.sel);
  for(let r=0;r<rows;r++){
    const y=(rows-1-r)*RH, tonic=r%G.n===0;
    c.fillStyle=tonic?"rgba(163,48,28,0.12)":(r%2?"rgba(60,40,20,0.04)":"rgba(0,0,0,0)"); c.fillRect(GUT,y,W-GUT,RH);
    c.strokeStyle="rgba(120,100,70,0.22)"; c.lineWidth=1; c.beginPath(); c.moveTo(GUT,y+RH-0.5); c.lineTo(W,y+RH-0.5); c.stroke();
    const off=G.offOf(r), pc=((Math.round(off)%12)+12)%12; c.fillStyle=tonic?g.rub:g.ink2; c.font=(tonic?"600 ":"")+'11px "Alegreya", Georgia, serif'; c.fillText(NOTES[(S.root+pc)%12],5,y+RH-8);
  }
  for(let k=0;k<=cols;k++){
    const x=Math.round(GUT+k*cw)+0.5, s=k*G.step, bar=Math.abs(s%barE)<1e-6, beat=Math.abs(s%2)<1e-6;
    c.strokeStyle=bar?g.ink:(beat?"rgba(120,100,70,0.38)":"rgba(120,100,70,0.16)"); c.lineWidth=bar?1.2:1; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke();
  }
  for(let r=0;r<rows;r++) for(let k=0;k<cols;k++) if(seqHas(G,r,k)){ c.fillStyle=col; c.fillRect(GUT+k*cw+1.5,(rows-1-r)*RH+2.5,Math.max(3,cw-3),RH-5); }
  if(live){ const p=live.eng.dawPos(tr)/G.step, x=GUT+p*cw; c.strokeStyle=g.rub; c.lineWidth=1.6; c.beginPath(); c.moveTo(x,0); c.lineTo(x,H); c.stroke(); }
}
function seqRandom(){
  const G=seqGeom(), tr=G.tr; dawSnap(tr);
  const lo=G.offOf(0)-0.01, hi=G.offOf(G.rows-1)+0.01;
  const keep=tr.notes.filter(n=>!(n.off>=lo&&n.off<=hi&&Math.abs(n.s/G.step-Math.round(n.s/G.step))<1e-3));
  const weights=Array.from({length:G.rows},(_,r)=>[0,2,4].indexOf(r%G.n)>=0?3:1), tot=weights.reduce((a,b)=>a+b,0), perBeat=Math.max(1,Math.round(2/G.step));
  for(let k=0;k<G.cols;k++){
    if(Math.random()>DW.seqDens*(k%perBeat===0?1.5:0.8)) continue;
    let x=Math.random()*tot, r=0; while(r<G.rows-1&&x>weights[r]){ x-=weights[r]; r++; }
    keep.push({s:k*G.step,off:G.offOf(r),d:G.step,v:0.7});
  }
  tr.notes=keep; dawReplan(tr); dawRollDraw();
}
function seqShift(){
  const G=seqGeom(), tr=G.tr; if(!tr.notes.length) return; dawSnap(tr);
  tr.notes.forEach(n=>{ n.s=((n.s+G.step)%G.L+G.L)%G.L; }); dawReplan(tr); dawRollDraw();
}
function seqEvents(){
  const cv=$("dawSeq"); let paint=null;
  const cell=e=>{ const G=seqGeom(), r0=cv.getBoundingClientRect(), x=e.clientX-r0.left, y=e.clientY-r0.top; if(x<GUT||y<0) return null; const c=Math.floor((x-GUT)/G.cw), r=G.rows-1-Math.floor(y/G.RH); return (c<0||c>=G.cols||r<0||r>=G.rows)?null:{G,r,c}; };
  const apply=(p,on)=>{
    const {G,r,c}=p, tr=G.tr, off=G.offOf(r), has=seqHas(G,r,c);
    if(on&&!has){ tr.notes.push({s:c*G.step,off,d:G.step,v:0.7}); dawAudition(off); }
    else if(!on&&has) tr.notes=tr.notes.filter(n=>!(Math.abs(n.off-off)<0.01&&Math.abs(n.s-c*G.step)<1e-3));
  };
  cv.addEventListener("pointerdown",e=>{
    const p=cell(e); if(!p) return; e.preventDefault(); try{ cv.setPointerCapture(e.pointerId); }catch(x){}
    dawSnap(p.G.tr); paint=!seqHas(p.G,p.r,p.c); apply(p,paint); dawSeqDraw();
  });
  cv.addEventListener("pointermove",e=>{ if(paint===null) return; const p=cell(e); if(p){ apply(p,paint); dawSeqDraw(); } });
  const end=()=>{ if(paint===null) return; paint=null; dawReplan(curTrack()); };
  cv.addEventListener("pointerup",end); cv.addEventListener("pointercancel",end);
}
function seqInit(){
  const fill=(id,opts)=>{ const s=$(id); opts.forEach(([v,n])=>{ const o=document.createElement("option"); o.value=v; o.textContent=n; s.appendChild(o); }); };
  fill("dawSStep",[[2,"Noire"],[1,"Croche"],[0.5,"Double-croche"]]); fill("dawSOct",[[-1,"Grave"],[0,"Médium"],[1,"Aigu"]]); fill("dawSDens",[[0.2,"Rare"],[0.4,"Moyenne"],[0.65,"Dense"]]);
  $("dawSStep").value=String(DW.seqStep); $("dawSOct").value=String(DW.seqOct); $("dawSDens").value=String(DW.seqDens);
  $("dawSStep").onchange=()=>{ DW.seqStep=parseFloat($("dawSStep").value); dawSeqDraw(); };
  $("dawSOct").onchange=()=>{ DW.seqOct=parseInt($("dawSOct").value,10); dawSeqDraw(); };
  $("dawSDens").onchange=()=>{ DW.seqDens=parseFloat($("dawSDens").value); };
  $("dawSRand").onclick=seqRandom; $("dawSShift").onclick=seqShift;
  const view=v=>{ DW.view=v; $("dawTabRoll").setAttribute("aria-pressed",v==="roll"?"true":"false"); $("dawTabSeq").setAttribute("aria-pressed",v==="seq"?"true":"false"); $("dawWrap").hidden=v!=="roll"; $("dawSeqBox").hidden=v!=="seq"; dawRollDraw(); };
  $("dawTabRoll").onclick=()=>view("roll"); $("dawTabSeq").onclick=()=>view("seq");
  seqEvents();
}
