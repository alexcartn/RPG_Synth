/* Bourdon pour Foundry VTT : une télécommande.
   Bourdon s'ouvre dans sa propre fenêtre (chez le meneur seulement) ; ce module lui envoie des ordres par postMessage.
   La musique sonne sur l'ordinateur du meneur : à la table, c'est ce qu'on veut ; en ligne, partager le son par le logiciel de voix. */
const MOD = "bourdon";
const t = (k, d) => (game.i18n?.has?.(`BOURDON.${k}`) ? game.i18n.localize(`BOURDON.${k}`) : d);
const GESTES = { aucun: "—", suspense: "Suspense", revelation: "Révélation", apaisement: "Apaisement", surprise: "Surprise", danger: "Danger", poursuite: "Poursuite", triomphe: "Triomphe" };

const Bourdon = {
  win: null, ready: false, queue: [], id: 0, state: null,
  url() { return game.settings.get(MOD, "url"); },
  origin() { try { return new URL(this.url(), location.href).origin; } catch (e) { return "*"; } },
  /* ouvre (ou retrouve) la fenêtre de Bourdon, avec la télécommande permise */
  ouvrir() {
    if (this.win && !this.win.closed) { this.win.focus(); return this.win; }
    const u = new URL(this.url(), location.href); u.searchParams.set("telecommande", "1");
    this.ready = false;
    this.win = window.open(u.toString(), "bourdon", "width=1180,height=860");
    if (!this.win) ui.notifications?.warn(t("popup", "Bourdon : le navigateur a bloqué la fenêtre. Autorise les fenêtres pour ce site."));
    return this.win;
  },
  /* envoie un ordre ; s'il n'y a pas encore de fenêtre, on l'ouvre et l'ordre attend qu'elle soit prête */
  envoyer(msg) {
    if (!game.user?.isGM) return;
    const m = { bourdon: 1, id: ++this.id, ...msg };
    if (!this.win || this.win.closed) { this.queue.push(m); this.ouvrir(); return; }
    if (!this.ready) { this.queue.push(m); return; }
    this.win.postMessage(m, this.origin());
  },
  vider() { const q = this.queue.splice(0); q.forEach(m => this.win?.postMessage(m, this.origin())); },
  jouer() { this.envoyer({ cmd: "jouer" }); },
  arreter() { this.envoyer({ cmd: "arreter" }); },
  ambiance(nom, fondu) { this.envoyer({ cmd: "ambiance", nom, fondu, jouer: true }); },
  emotions(liste, univers) { this.envoyer({ cmd: "emotions", liste, univers }); },
  tension(valeur) { this.envoyer({ cmd: "tension", valeur }); },
  geste(nom, ampleur = 1) { this.envoyer({ cmd: "geste", nom, ampleur }); },
  volume(valeur) { this.envoyer({ cmd: "volume", valeur }); },
  sousLaVoix(actif) { this.envoyer({ cmd: "sousLaVoix", actif }); },
  /* la scène : son ambiance nommée, ou ses émotions, puis sa tension */
  scene(scene) {
    if (!scene) return;
    const f = scene.flags?.[MOD] || {};
    if (f.ambiance) this.ambiance(f.ambiance);
    else if (f.emotions) { this.emotions(String(f.emotions).split(",").map(s => s.trim()).filter(Boolean), f.univers || undefined); this.jouer(); }
    else return;
    if (f.tension !== undefined && f.tension !== null && f.tension !== "") this.tension(Number(f.tension));
  }
};

window.addEventListener("message", e => {
  const m = e.data; if (!m || m.bourdon !== 1) return;
  if (Bourdon.win && e.source !== Bourdon.win) return;
  if (m.pret) { Bourdon.ready = true; Bourdon.vider(); return; }
  if (m.etat) Bourdon.state = m.etat;
  if (m.ok === false && m.erreur) ui.notifications?.warn("Bourdon : " + m.erreur);
});

Hooks.once("init", () => {
  game.settings.register(MOD, "url", { name: t("url.name", "Adresse de Bourdon"), hint: t("url.hint", "La page de Bourdon. Par défaut, la version publiée en ligne."), scope: "world", config: true, type: String, default: "https://alexcartn.github.io/RPG_Synth/" });
  game.settings.register(MOD, "suivre", { name: t("suivre.name", "Suivre la scène active"), hint: t("suivre.hint", "Quand une scène devient active, Bourdon joue son ambiance."), scope: "world", config: true, type: Boolean, default: true });
  game.settings.register(MOD, "combatTension", { name: t("combat.name", "Tension en combat"), hint: t("combat.hint", "La tension quand un combat commence (0 calme, 1 tendu). Vide : ne rien changer."), scope: "world", config: true, type: Number, default: 0.8, range: { min: 0, max: 1, step: 0.05 } });
  game.settings.register(MOD, "combatGeste", { name: t("geste.name", "Geste au début du combat"), scope: "world", config: true, type: String, default: "aucun", choices: GESTES });
  game.settings.register(MOD, "finGeste", { name: t("fin.name", "Geste à la fin du combat"), scope: "world", config: true, type: String, default: "apaisement", choices: GESTES });
  game.bourdon = Bourdon;
});

Hooks.once("ready", () => {
  if (!game.user.isGM) return;
  const s = game.scenes?.active; if (s && game.settings.get(MOD, "suivre") && s.flags?.[MOD]) Bourdon.scene(s);
});

Hooks.on("updateScene", (scene, change) => {
  if (!game.user.isGM || !game.settings.get(MOD, "suivre")) return;
  if (change.active === true || (scene.active && change.flags?.[MOD])) Bourdon.scene(scene);
});

Hooks.on("combatStart", () => {
  if (!game.user.isGM) return;
  const g = game.settings.get(MOD, "combatGeste"), v = game.settings.get(MOD, "combatTension");
  if (v !== null && v !== undefined && v !== "") Bourdon.tension(Number(v));
  if (g && g !== "aucun") Bourdon.geste(g, 1);
});
Hooks.on("deleteCombat", () => {
  if (!game.user.isGM) return;
  const s = game.scenes?.active, f = s?.flags?.[MOD] || {}, g = game.settings.get(MOD, "finGeste");
  Bourdon.tension(f.tension !== undefined && f.tension !== "" ? Number(f.tension) : 0.45);
  if (g && g !== "aucun") Bourdon.geste(g, 1);
});

/* configuration de la scène : un bloc Bourdon dans l'onglet Ambiance (V12 et V13) */
Hooks.on("renderSceneConfig", (app, html) => {
  if (!game.user.isGM) return;
  const root = html instanceof HTMLElement ? html : html?.[0]; if (!root || root.querySelector(".bourdon-scene")) return;
  const doc = app.document || app.object, f = doc?.flags?.[MOD] || {};
  const tab = root.querySelector('.tab[data-tab="ambience"]') || root.querySelector('.tab[data-tab="basics"]') || root.querySelector("form") || root;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const amb = (Bourdon.state?.ambiances || []).map(n => `<option value="${esc(n)}"></option>`).join("");
  const box = document.createElement("fieldset"); box.className = "bourdon-scene";
  box.innerHTML = `<legend>Bourdon</legend>
    <div class="form-group"><label>${t("scene.ambiance", "Ambiance")}</label><div class="form-fields"><input type="text" name="flags.${MOD}.ambiance" value="${esc(f.ambiance)}" list="bourdon-ambiances" placeholder="Crypta, Vigilia, Taberna…"><datalist id="bourdon-ambiances">${amb}</datalist></div>
      <p class="hint">${t("scene.ambianceHint", "Le nom d'une ambiance de Bourdon. Laisse vide pour partir des émotions.")}</p></div>
    <div class="form-group"><label>${t("scene.emotions", "Émotions")}</label><div class="form-fields"><input type="text" name="flags.${MOD}.emotions" value="${esc(f.emotions)}" placeholder="mystérieux, sacré"></div></div>
    <div class="form-group"><label>${t("scene.univers", "Univers")}</label><div class="form-fields"><input type="text" name="flags.${MOD}.univers" value="${esc(f.univers)}" placeholder="dungeon, dark, medieval…"></div></div>
    <div class="form-group"><label>${t("scene.tension", "Tension")}</label><div class="form-fields"><input type="number" name="flags.${MOD}.tension" value="${esc(f.tension)}" min="0" max="1" step="0.05"></div></div>`;
  tab.appendChild(box);
  app.setPosition?.({ height: "auto" });
});

/* un bouton dans les contrôles de son (V12 : tableau ; V13 : objet) */
Hooks.on("getSceneControlButtons", controls => {
  if (!game.user?.isGM) return;
  try {
    const tool = { name: "bourdon", title: "Bourdon", icon: "fas fa-music", button: true, onClick: () => Bourdon.ouvrir(), onChange: () => Bourdon.ouvrir() };
    if (Array.isArray(controls)) { const s = controls.find(c => c.name === "sounds"); if (s) s.tools.push(tool); }
    else if (controls?.sounds?.tools) { controls.sounds.tools.bourdon = { ...tool, order: 99 }; }
  } catch (e) { console.warn("Bourdon", e); }
});
