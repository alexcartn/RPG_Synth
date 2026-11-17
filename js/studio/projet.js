"use strict";
/* ============================================================
   STUDIO : le projet (pistes, scènes, clips, arrangement) et la lecture des clips en notes
   ============================================================ */
const PJ=(()=>{
  let uid=Date.now()%100000;
  const nid=p=>(p||"x")+(uid++).toString(36);
  const ROLE={
    harmonie:{n:"Harmonie", kind:"harm", color:"#7a5a2a", inst:{k:"pad",name:"orgue"}, vol:-8, mute:true, a:0.2},
    nappe:{n:"Nappe", kind:"mel", color:"#2f6f5b", inst:{k:"pad",name:"machine"}, vol:-3, a:0.35, b:0, gen:"nappe"},
    bourdon:{n:"Bourdon", kind:"mel", color:"#4a5a8a", inst:{k:"pad",name:"choeur"}, vol:-6, a:0.3, gen:"bourdon"},
    basse:{n:"Basse", kind:"mel", color:"#5a4a3a", inst:{k:"inst",name:"basse"}, vol:-6, a:0.05, gen:"basse"},
    arpege:{n:"Arpège", kind:"mel", color:"#a3301c", inst:{k:"inst",name:"harpe"}, vol:-4, a:0.3, b:0.15, gen:"arpege"},
    melodie:{n:"Mélodie", kind:"mel", color:"#b0801f", inst:{k:"inst",name:"flute"}, vol:-3, a:0.3, b:0.12},
    percu:{n:"Percussion", kind:"drums", color:"#5a5a5a", vol:-4, a:0.15},
    texture:{n:"Texture", kind:"mel", color:"#4a7a8a", inst:{k:"pad",name:"vecteur"}, vol:-8, a:0.5, gen:"nappe"}
  };
  const LANES_DEF=[{n:"Grave",kit:"taiko",part:"stomp",lvl:1},{n:"Frappe",kit:"taiko",part:"tap",lvl:0.8},{n:"Bois",kit:"taiko",part:"shaker",lvl:0.6}];
  function newTrack(role,nScenes){
    const R=ROLE[role]||ROLE.melodie;
    const t={id:nid("t"), name:R.n, role, kind:R.kind, color:R.color, inst:R.inst?JSON.parse(JSON.stringify(R.inst)):null, devs:[], vol:R.vol||0, pan:0, a:R.a||0, b:R.b||0, mute:!!R.mute, solo:false, arm:false, clips:Array(nScenes||0).fill(null)};
    if(R.kind==="drums") t.lanes=LANES_DEF.map(l=>({...l}));
    if(role==="nappe") t.devs.push(dev("eq",{cut:140}));
    if(role==="bourdon") t.devs.push(dev("filtre",{freq:900,res:0.8,rate:4,depth:0.35}));
    if(role==="texture") t.devs.push(dev("filtre",{freq:2400,res:2,rate:6,depth:0.5}));
    return t;
  }
  function dev(type,p){ const D=(typeof SON!=="undefined"&&SON.DEV[type])||null, def={}; if(D) D.p.forEach(s=>def[s.k]=s.def); return {id:nid("d"),type,on:true,p:Object.assign(def,p||{})}; }
  const parse=(s,iv)=>s.split(/\s+/).map(r=>TH.parseRoman(r,iv)).filter(Boolean);
  function blank(){
    return {v:1, name:"Sans titre", tempo:76, meter:"4/4", key:2, mode:"eolien", quant:1, step:0,
      tracks:[newTrack("harmonie",4)], scenes:[{name:"Intro"},{name:"Thème"},{name:"Pont"},{name:"Fin"}],
      ret:[{name:"A · Réverb", devs:[dev("reverb",{decay:4.5,damp:0.55,pre:30,mix:1})], vol:-3},{name:"B · Écho", devs:[dev("delay",{time:0.75,fb:0.4,pp:1,tone:3500,mix:1})], vol:-6}],
      master:{devs:[dev("comp",{thr:-14,ratio:2,att:20,rel:250,gain:2})], vol:0},
      arr:{segs:{}, len:0}, sel:{t:0,r:0}};
  }
  function template(kind){
    const P=blank();
    if(kind==="vide"){ P.step=0; P.tracks[0].mute=false; P.tracks[0].vol=-6; return P; }
    if(kind==="dark"){
      P.name="Dark ambient"; P.tempo=60; P.key=4; P.mode="phrygien";
      const iv=TH.MODES[P.mode].iv; P.tracks[0].clips[0]={name:"Rituel",chords:parse("i bII i bII",iv).map(c=>({...c,b:2}))};
      ["bourdon","nappe","texture","melodie"].forEach(r=>P.tracks.push(newTrack(r,4)));
      P.tracks[1].clips[0]={name:"Pédale",type:"gen",gen:"bourdon",g:{note:"tonique",quinte:true,oct:2,tenue:"boucle"}};
      P.tracks[2].inst={k:"pad",name:"choeur"}; P.tracks[2].clips[0]={name:"Chœur",type:"gen",gen:"nappe",g:{voicing:"ouverte",oct:3,rythme:"tenue"}};
      P.tracks[3].clips[0]={name:"Brume",type:"gen",gen:"nappe",g:{voicing:"quintes",oct:5,rythme:"tenue",vel:0.5}};
      P.tracks[4].inst={k:"inst",name:"carillon"};
      P.ret[0].devs[0].p.decay=9; P.master.devs.unshift(dev("bande",{wow:0.35,flutter:0.2,wear:0.4,hiss:0.15}));
      P.step=2; return P;
    }
    /* dungeon synth : nappe de machine à cordes, bourdon, arpège de harpe, timbales lointaines */
    P.name="Dungeon synth"; P.tempo=76; P.key=2; P.mode="eolien";
    const iv=TH.MODES[P.mode].iv;
    P.tracks[0].clips[0]={name:"Descente épique",chords:parse("i bVI bIII bVII",iv)};
    P.tracks[0].clips[1]={name:"Balancier",chords:parse("i bVII bVI bVII",iv)};
    ["nappe","bourdon","arpege","melodie","percu"].forEach(r=>P.tracks.push(newTrack(r,4)));
    P.tracks[1].clips[0]={name:"Nappe",type:"gen",gen:"nappe",g:{}}; P.tracks[1].clips[1]={name:"Nappe",type:"gen",gen:"nappe",g:{}};
    P.tracks[2].clips[0]={name:"Pédale",type:"gen",gen:"bourdon",g:{}}; P.tracks[2].clips[1]={name:"Pédale",type:"gen",gen:"bourdon",g:{}};
    P.tracks[3].clips[1]={name:"Arpège",type:"gen",gen:"arpege",g:{}};
    P.tracks[4].clips[1]={name:"Thème",type:"notes",bars:4,notes:[]};
    const pc=P.tracks[5]; pc.clips[1]=drumClip(pc,1,P.meter); const st=pc.clips[1].steps; st[0][0]=0.9; st[1][8]=0.6; st[2][12]=0.35;
    P.master.devs.unshift(dev("bande",{wow:0.25,flutter:0.15,wear:0.3,hiss:0.08}));
    P.step=2; return P;
  }
  const stepsPerBar=meter=>(TH.METER[meter]||TH.METER["4/4"]).div;
  function drumClip(tr,bars,meter){ const n=bars*stepsPerBar(meter); return {name:"Rythme",bars,steps:tr.lanes.map(()=>Array(n).fill(0))}; }
  function fixDrum(tr,c,meter){ const n=c.bars*stepsPerBar(meter); while(c.steps.length<tr.lanes.length) c.steps.push([]); c.steps.length=tr.lanes.length; c.steps.forEach((a,i)=>{ while(a.length<n) a.push(0); a.length=n; }); return c; }

  /* ---------- lecture : un clip → ses notes et sa longueur (en temps) ---------- */
  const memo=new Map();
  const ctxOf=P=>({iv:TH.MODES[P.mode].iv,key:P.key,meter:P.meter,mode:P.mode});
  const harmTrack=P=>P.tracks.find(t=>t.kind==="harm");
  /* la progression à suivre pour un clip généré : celle qu'on lui donne (en lecture), sinon celle de sa scène, sinon la première */
  function harmFor(P,row){ const h=harmTrack(P); if(!h) return null; return h.clips[row]||h.clips.find(Boolean)||null; }
  /* cache par clip, invalidé à chaque modification du projet (bump) : la lecture ne recalcule plus rien */
  let ver=0; const fast=new WeakMap();
  const bump=()=>{ ver++; };
  function clipData(P,tr,clip,harm){
    if(!clip) return {notes:[],len:TH.bb(P.meter)};
    const hit=fast.get(clip); if(hit&&hit.ver===ver&&hit.harm===harm&&hit.P===P) return hit.d;
    const d=clipData0(P,tr,clip,harm); fast.set(clip,{ver,harm,P,d}); return d;
  }
  function clipData0(P,tr,clip,harm){
    const B=TH.bb(P.meter);
    if(tr.kind==="harm"){ const ch=clip.chords||[]; const len=TH.progLen(ch,P.meter);
      const k="h|"+JSON.stringify(ch)+P.key+P.mode+P.meter;
      if(!memo.has(k)){ const out=[]; TH.timeline(ch,P.meter).forEach(({ch:c,s,d})=>{ const lo=48+P.key; TH.tones(c,TH.MODES[P.mode].iv).forEach((p,i)=>out.push({s,d,p:lo+p+(i===0?-12:0),v:0.6})); }); memo.set(k,out); }
      return {notes:memo.get(k),len}; }
    if(tr.kind==="drums"){ fixDrum(tr,clip,P.meter); const per=stepsPerBar(P.meter), stp=B/per, out=[];
      clip.steps.forEach((row,li)=>row.forEach((v,i)=>{ if(v>0) out.push({s:i*stp,d:stp,p:li,v}); }));
      return {notes:out,len:clip.bars*B}; }
    if(clip.type==="gen"){ const ch=(harm&&harm.chords)||[]; if(!ch.length) return {notes:[],len:B,sync:true};
      const k=clip.gen+"|"+JSON.stringify(clip.g)+JSON.stringify(ch)+P.key+P.mode+P.meter;
      if(!memo.has(k)){ if(memo.size>200) memo.clear(); memo.set(k,TH.generate(clip.gen,clip.g,ch,ctxOf(P))); }
      return {notes:memo.get(k),len:TH.progLen(ch,P.meter),sync:true}; }
    return {notes:clip.notes||[],len:Math.max(1,clip.bars||1)*B};
  }
  /* longueur naturelle d'une scène (en mesures) : le plus long de ses clips */
  function sceneBars(P,row){ const B=TH.bb(P.meter); let m=0; const h=harmFor(P,row);
    P.tracks.forEach(t=>{ const c=t.clips[row]; if(!c) return; m=Math.max(m,clipData(P,t,c,h).len/B); });
    return Math.max(1,Math.round(m)||(h?TH.progLen(h.chords,P.meter)/B:4)); }
  /* arrangement construit depuis les scènes, dans l'ordre, chacune répétée */
  function arrFromScenes(P,rows,rep){
    const segs={}; let at=0;
    rows.forEach(r=>{ const L=sceneBars(P,r)*(rep||2); P.tracks.forEach(t=>{ if(t.clips[r]){ (segs[t.id]=segs[t.id]||[]).push({at,len:L,row:r}); } }); at+=L; });
    return {segs,len:at};
  }
  const arrLen=A=>{ let m=A.len||0; Object.values(A.segs||{}).forEach(l=>l.forEach(s=>m=Math.max(m,s.at+s.len))); return m; };

  /* ---------- collecte des notes entre deux temps (lecture en direct et rendu) ----------
     state(tr) → {row, anchor (temps où le clip a démarré), harm (clip d'harmonie), hAnchor} ou null */
  function collect(P,tr,st,b0,b1,emit){
    if(!st||st.row===null||st.row===undefined) return;
    const clip=tr.clips[st.row]; if(!clip) return;
    const D=clipData(P,tr,clip,st.harm), L=D.len; if(!L) return;
    const anchor=D.sync&&st.hAnchor!==undefined?st.hAnchor:st.anchor;
    let pos=((b0-anchor)%L+L)%L; const span=b1-b0;
    D.notes.forEach(n=>{ if(n.s>=L-1e-9) return; let x=n.s-pos; if(x<-1e-9) x+=L; if(x<span-1e-9&&x>=-1e-9) emit(n,b0+x); });
  }
  return {bump,nid,ROLE,newTrack,dev,blank,template,stepsPerBar,drumClip,fixDrum,clipData,harmFor,harmTrack,sceneBars,arrFromScenes,arrLen,collect,ctxOf,parse,LANES_DEF};
})();
