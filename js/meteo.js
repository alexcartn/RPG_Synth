"use strict";
/* ============================================================
   MÉTÉO : le lieu se saisit à la main, Open-Meteo (sans clé) donne le temps qu'il fait
   La météo s'ajoute à l'heure : pluie, vent, nuit claire, oiseaux, et l'énergie de la pièce.
   ============================================================ */
const WX_API="https://api.open-meteo.com/v1/forecast", WX_GEO="https://geocoding-api.open-meteo.com/v1/search", WX_KEY="bourdon.lieu", WX_EVERY=30*60*1000;

/* réponse d'Open-Meteo vers les valeurs utiles, toutes entre 0 et 1 */
function wxMap(c){
  const code=c.weather_code||0, mm=(c.rain||0)+(c.showers||0);
  const storm=code>=95, snow=(code>=71&&code<=77)||code===85||code===86||(c.snowfall||0)>0, fog=code===45||code===48;
  let rain=Math.min(1,mm/4); if(code>=51&&code<=57) rain=Math.max(rain,0.25); if((code>=61&&code<=67)||(code>=80&&code<=82)) rain=Math.max(rain,0.5); if(storm) rain=Math.max(rain,0.8);
  return {rain, snow:snow?1:0, fog:fog?1:0, storm:storm?1:0, clouds:Math.min(1,(c.cloud_cover||0)/100), wind:Math.min(1,(c.wind_speed_10m||0)/50), night:c.is_day===0, temp:c.temperature_2m};
}
function wxText(d){
  if(!d) return "";
  const sky=d.storm?"orage":d.snow?"neige":d.rain>0.5?"forte pluie":d.rain>0.1?"pluie":d.fog?"brouillard":d.clouds>0.7?"ciel couvert":d.clouds>0.3?"nuageux":d.night?"nuit claire":"ciel dégagé";
  return sky+(d.temp!==undefined?", "+Math.round(d.temp)+" °C":"")+(d.wind>0.2?", vent "+Math.round(d.wind*50)+" km/h":"");
}
function wxStatus(t){ const e=$("wxStatus"); if(e) e.textContent=t; }
function wxShow(){
  const p=S.wx&&S.wx.place, on=S.adapt.mode==="meteo";
  if(!p){ wxStatus("Entre une ville : la météo de ce lieu colore la musique quand l'adaptation est réglée sur « heure et météo »."); return; }
  const d=S.wx.d, age=S.wx.t?Math.max(0,Math.round((Date.now()-S.wx.t)/60000)):null;
  wxStatus(p.name+(d?" : "+wxText(d)+(age!==null?" (il y a "+age+" min)":""):" : météo pas encore lue")+(on?".":". Choisis « Selon l'heure et la météo » dans l'adaptation pour l'entendre."));
}
async function wxFetch(){
  const p=S.wx&&S.wx.place; if(!p) return;
  wxStatus("Lecture de la météo de "+p.name+"…");
  try{
    const r=await fetch(WX_API+"?latitude="+p.lat+"&longitude="+p.lon+"&current=temperature_2m,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,is_day&timezone=auto");
    if(!r.ok) throw new Error("http "+r.status);
    const j=await r.json(); S.wx.d=wxMap(j.current); S.wx.t=Date.now();
    if(live) live.eng.setLevels();
    wxShow();
  }catch(e){ wxStatus("Météo injoignable (hors ligne ?). "+(S.wx.d?"On garde la dernière lecture.":"")); }
}
function wxSetPlace(p){
  S.wx=S.wx||{}; S.wx.place=p; S.wx.d=null; S.wx.t=0;
  try{ localStorage.setItem(WX_KEY,JSON.stringify(p)); }catch(e){}
  const res=$("wxRes"); if(res) res.innerHTML=""; const c=$("wxCity"); if(c) c.value=p.name;
  wxFetch();
}
async function wxSearch(){
  const q=($("wxCity").value||"").trim(), res=$("wxRes"); if(!q) return; res.innerHTML="";
  wxStatus("Recherche de « "+q+" »…");
  try{
    const r=await fetch(WX_GEO+"?name="+encodeURIComponent(q)+"&count=5&language=fr&format=json"), j=await r.json(), l=j.results||[];
    if(!l.length){ wxStatus("Aucun lieu trouvé pour « "+q+" »."); return; }
    if(l.length===1){ wxSetPlace({name:l[0].name,lat:l[0].latitude,lon:l[0].longitude}); return; }
    wxStatus("Choisis le bon lieu :");
    l.forEach(x=>{ const b=document.createElement("button"); b.type="button"; b.className="lnk"; b.textContent=[x.name,x.admin1,x.country].filter(Boolean).join(", ");
      b.onclick=()=>wxSetPlace({name:x.name,lat:x.latitude,lon:x.longitude}); res.appendChild(b); });
  }catch(e){ wxStatus("Recherche impossible (hors ligne ?)."); }
}
/* le panneau, dans le chapitre Mutatio sous l'adaptation */
function wxPanel(){
  const w=document.createElement("div"); w.className="wx";
  w.innerHTML='<div class="ctl"><label for="wxCity">Lieu de la météo</label><div class="row"><input type="text" id="wxCity" placeholder="Une ville, par exemple Lyon" autocomplete="off"><button class="lnk" id="wxGo" type="button">Chercher</button><button class="lnk" id="wxRef" type="button">Actualiser</button></div></div><div class="row wxres" id="wxRes"></div><p class="hint" id="wxStatus" aria-live="polite"></p>';
  return w;
}
function wxInit(){
  if(!$("wxCity")) return;
  S.wx=S.wx||{place:null,d:null};
  if(!S.wx.place){ try{ const p=JSON.parse(localStorage.getItem(WX_KEY)); if(p&&p.lat!==undefined) S.wx.place=p; }catch(e){} }
  if(S.wx.place) $("wxCity").value=S.wx.place.name;
  $("wxGo").onclick=wxSearch; $("wxRef").onclick=wxFetch;
  $("wxCity").addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); wxSearch(); } });
  const sel=CTL.find(c=>c.it.k==="adapt.mode");
  if(sel) sel.el.addEventListener("change",()=>{ if(S.adapt.mode==="meteo"&&S.wx.place&&Date.now()-(S.wx.t||0)>WX_EVERY) wxFetch(); wxShow(); });
  setInterval(()=>{ if(S.adapt.mode==="meteo"&&S.wx&&S.wx.place&&Date.now()-(S.wx.t||0)>WX_EVERY) wxFetch(); },60000);
  wxShow();
}
