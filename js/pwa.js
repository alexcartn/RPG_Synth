"use strict";
/* ============================================================
   APPLICATION INSTALLABLE : hors ligne, mise à jour, écran allumé
   ============================================================ */
(function(){
  /* bannière de mise à jour */
  let asked=false;
  function showUpdate(worker){
    if($("update")) return;
    const bar=document.createElement("div"); bar.id="update"; bar.setAttribute("role","status");
    bar.innerHTML='<span>Une nouvelle version est disponible.</span><button class="lnk" id="updNow" type="button">Recharger</button><button class="lnk" id="updLater" type="button">Plus tard</button>';
    document.body.appendChild(bar);
    $("updNow").onclick=()=>{ asked=true; worker.postMessage({type:"SKIP_WAITING"}); $("updNow").disabled=true; $("updNow").textContent="Chargement..."; };
    $("updLater").onclick=()=>bar.remove();
  }
  if("serviceWorker" in navigator && /^https?:$/.test(location.protocol)){
    navigator.serviceWorker.addEventListener("controllerchange",()=>{ if(asked) location.reload(); });
    navigator.serviceWorker.register("sw.js").then(reg=>{
      if(reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener("updatefound",()=>{
        const nw=reg.installing; if(!nw) return;
        nw.addEventListener("statechange",()=>{ if(nw.state==="installed" && navigator.serviceWorker.controller) showUpdate(nw); });
      });
      const check=()=>{ reg.update().catch(()=>{}); };
      document.addEventListener("visibilitychange",()=>{ if(!document.hidden) check(); });
      setInterval(check,3600*1000);
    }).catch(()=>{});
  }

  /* installation : le lien n'apparaît que si le navigateur la propose */
  let deferred=null;
  window.addEventListener("beforeinstallprompt",e=>{ e.preventDefault(); deferred=e; const b=$("install"); if(b) b.hidden=false; });
  window.addEventListener("appinstalled",()=>{ deferred=null; const b=$("install"); if(b) b.hidden=true; });
  const ib=$("install");
  if(ib) ib.onclick=async()=>{ if(!deferred) return; deferred.prompt(); try{ await deferred.userChoice; }catch(e){} deferred=null; ib.hidden=true; };

  /* écran allumé pendant la lecture : sur téléphone, un écran qui se verrouille coupe le son */
  let lock=null;
  window.keepAwake=async function(on){
    try{
      if(on){ if(!lock&&navigator.wakeLock){ lock=await navigator.wakeLock.request("screen"); lock.addEventListener("release",()=>{lock=null;}); } }
      else if(lock){ await lock.release(); lock=null; }
    }catch(e){ lock=null; }
  };
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden && typeof live!=="undefined" && live) window.keepAwake(true); });
})();
