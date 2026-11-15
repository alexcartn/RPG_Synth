# Bourdon

Machine à ambiances modales pour dungeon synth et ambiances de taverne. Une page statique, sans build ni dépendance : tout l'audio est synthétisé dans le navigateur (Web Audio), rien n'est joué à partir de samples. Une graine donne une pièce, la même graine redonne la même pièce.

Usage prévu : composer hors ligne. On règle, on écoute, puis on rend en WAV (mix, boucle sans couture, stems) et en MIDI pour retravailler dans un logiciel de musique.

## Lancer

Ouvrir `index.html` dans un navigateur récent (Chrome, Firefox, Safari). Les polices sont dans le dépôt (`fonts/`, licence SIL OFL), aucune requête externe sauf l'encodeur MP3 à la demande.

## Jeu et réponse immédiate

- Mode Jeu (bouton à droite d'Eventus) : un panneau sans défilement avec huit boutons rotatifs (volume, tension, densité, bourdon, nappes, canon, brume, chaleur), un pad XY dont on choisit les deux axes, et le cercle des hauteurs qui devient un clavier. On glisse un bouton vers le haut ou le bas (Maj pour affiner), on utilise la molette ou les flèches. Le choix du mode est mémorisé.
- Jouer par-dessus la machine : le cercle joue les notes de la gamme courante (les autres sont ignorées, pour que ça sonne toujours juste). Au clavier, trois rangées de la gamme, du grave à l'aigu : Z X C V B N M , . / puis A S D F G H J K L ; puis Q W E R T Y U I O P, repérées par position physique de la touche donc valables en AZERTY. Instrument, registre et niveau de ton jeu se règlent sous le cercle ; si le canon est actif, il reprend ce que tu joues.
- Figer : la dernière phrase et le dernier accord tournent en boucle jusqu'à ce qu'on relâche. Autre phrase : la mémoire est oubliée et la machine repart sur du neuf.
- Réponse immédiate : la planification en direct est de 4 secondes (10 si la page est en arrière-plan) au lieu de 8, et `replan()` coupe d'un coup les notes déjà planifiées d'une voix pour en planifier de nouvelles avec les réglages actuels. Mesuré : un changement de réglage de la mélodie s'entendait après environ 9 secondes, maintenant après 0,3 seconde. Instrument, densité, registre, gamme, nappes, boucles, pendules, déjà-vu, durée de section et courbe de tension ne redémarrent plus le moteur. Tonalité, tempérament, diapason, tempo, mesure, graine et timbre du bourdon passent toujours par un fondu enchaîné, raccourci à 0,6 seconde.
- Les notes que tu joues s'affichent en sombre sur la partition. Elles ne sont pas dans l'export.

## Univers, timbres et extinction

- Dix-neuf préréglages en cinq univers, choisis par un menu dans la marge : Médiéval (Taberna, Chorea, Crypta, Scriptorium, Turris, Tripudium), Calme (Somnus pour dormir, Meditatio, Labor pour travailler), Espace (Sidera, Nebula, Abyssus), Orient et quarts de ton (Aegyptus, Eremus, Hortus, Bayati, Enharmonia), Nature (Pluvia, Mare, Silva, Nox). Chacun a une glose française. Ils sont réglés sur le papier et mesurés au niveau sonore, pas écoutés : les ajuster à l'oreille est normal.
- Timbres ajoutés : oud (corde pincée), ney (flûte soufflée), kalimba, bol chantant, cloches de verre, synthé doux pour les voix ; synthé doux et verre pour les nappes ; sinus pur et bol chantant pour le bourdon.
- Extinction progressive : dans 15 minutes à 2 heures, le niveau tient puis descend en courbe douce sur les 20 % finaux (entre 1 et 5 minutes), et la lecture s'arrête au silence. Le compte à rebours démarre à la mise en lecture.
- Volume général (chapitre Spatium) : pour que les ambiances calmes restent calmes. L'export est toujours normalisé en crête.
- Quarts de ton : quatre gammes à 24 notes par octave (Maqam Rast, Bayati, Saba, enharmonique grec ancien). Une note à un quart de ton est placée au milieu (en proportion) de ses deux voisines, dans le tempérament choisi. Le cercle des hauteurs a 24 positions (les petits points sont les quarts de ton), cliquables pour dessiner une gamme libre ; la gamme libre garde son ancien format à 12 cases tant qu'on n'utilise pas de quart de ton. Une note à un quart de ton s'écrit avec une flèche : Mi↓ est un Mi demi-bémol. En MIDI, elles passent en pitch bend de 50 cents (plage de 2 demi-tons) sur mélodie, canon, boucles et pendules, et sont arrondies sur les nappes, qui sont polyphoniques.
- Natura : cinq sons de nature (pluie, vagues, nuit avec grillons, ruisseau, oiseaux), chapitre Locus. Les textures sont des boucles précalculées construites seulement quand on les active (environ 1 % d'un cœur chacune), les oiseaux sont des phrases tirées au hasard. Un univers Nature les met en avant : Pluvia, Mare, Silva, Nox. Les maqams ont leurs préréglages dans l'univers Orient : Bayati et Enharmonia.
- Limites connues : les quarts de ton sont ceux de la théorie à 24 notes égales, pas les intonations exactes de chaque maqam ; pas de bruit continu rose ou brun ; la percussion reste le bodhrán et le shaker.

## Table de jeu

- Eventus : huit sons à la demande (porte, cloche, tonnerre, cor, coups, verre, magie, loup), touches 1 à 8, tous synthétisés et accordés sur la gamme courante. Ils apparaissent sur la partition. Ils ne sont pas dans l'export.
- Itinerarium : une campagne, c'est-à-dire une suite d'étapes (préréglage ou scène mémorisée, durée, fondu). Elle avance seule ou à la touche N / au bouton « Suivant », se répète si on veut, et se mémorise dans le navigateur.
- Tensio : un curseur, ou une courbe de tension dessinée au doigt (répétée ou jouée une fois) qui module percussion, nappes, bourdon, ambiance et densité mélodique. La courbe est rendue dans l'export.

## Application installable (PWA)

Bourdon s'installe comme une application (Chrome, Edge, Android : « Installer l'application » ; iPhone : Partager, puis « Sur l'écran d'accueil ») et fonctionne hors ligne : les polices sont hébergées dans `fonts/` et un service worker (`sw.js`) met toute l'application en cache.

- Mise à jour : à chaque déploiement, `sw.js` reçoit l'identifiant du commit (`__VERSION__`), ce qui crée un nouveau cache. La page détecte la nouvelle version et affiche « Une nouvelle version est disponible. Recharger / Plus tard ». Rien ne recharge tout seul, la lecture en cours n'est jamais coupée sans accord.
- En local (`__VERSION__` non remplacé), le cache ne change pas : pour tester une mise à jour, change la valeur à la main.
- Pendant la lecture, l'écran reste allumé (Wake Lock) : sur téléphone, un écran qui se verrouille coupe le son du navigateur.
- Si tu ajoutes un fichier à l'application, ajoute-le à la liste `SHELL` de `sw.js` (le test vérifie que tout ce qui est listé existe et que les scripts et styles de `index.html` y sont).
- Les icônes viennent de `icons/icon.svg` et `icons/maskable.svg`, rendues en PNG.

## Publier sur GitHub Pages

Le workflow `.github/workflows/pages.yml` lance les tests puis déploie le site à chaque push sur `main`. Une seule fois : dans le dépôt, Settings, Pages, Source : GitHub Actions. Le site est ensuite servi sur `https://<utilisateur>.github.io/RPG_Synth/`.

## Ce que fait l'outil

- Gammes : 28 gammes et modes (diatoniques, harmonique, mélodique, double harmonique, pentatoniques, hexacorde de Guido, organum, symétriques) et une gamme libre dessinée sur le cercle des 12 hauteurs.
- Structure : jusqu'à trois gammes qui se succèdent par sections de N mesures, tonique et tempérament au choix (égal, juste, pythagoricien, mésotonique), diapason réglable.
- Rythme : tempo 40 à 180, mesures 4/4, 6/8, 3/4, 2/4, 7/8, 12/8, swing, percussion (bodhrán et shaker).
- Voix : bourdon (anche, orgue, chœur) dont la quinte glisse vers un degré voisin, mélodie (luth, harpe, flûte, carillon, orgue positif), canon décalé, nappes d'accords (chœur, cordes, orgue).
- Lieu : murmure de salle, tintements, feu, vent, gouttes.
- Espace et patine : réverb (taille et ombre), écho en ping-pong, saturation, ondulation de bande, voile, souffle.
- Déjà-vu : la mélodie et les nappes se souviennent de leurs dernières phrases ou accords et les rejouent avec une probabilité réglable (1 = boucle exacte, 0,9 = boucle qui mute lentement, 0 = jamais), comme le bouton Déjà Vu de Marbles ou le Turing Machine.
- Boucles de bande : jusqu'à 5 boucles de longueurs premières entre elles (à la Eno, Music for Airports), qui ne se retrouvent presque jamais en phase.
- Pendules : de 3 à 10 pendules qui se désynchronisent puis se resynchronisent à chaque période. Un coup est joué à chaque passage par le bas, sur un degré de la gamme (le plus long donne le plus grave). Les positions sont dessinées sous l'oscilloscope.
- Tension : un curseur toujours visible (calme à tendue) qui joue en direct sur la percussion, la mélodie, les nappes et le murmure, pour passer de la taverne au combat.
- Scènes : les préréglages et les scènes personnelles (mémorisées dans le navigateur) se rappellent par fondu enchaîné pendant la lecture, de 0,5 à 25 secondes. Un second moteur démarre pendant que le premier s'éteint, donc même un changement de tempo ou de gamme se fait sans coupure.
- Évolution : l'intensité module percussion, nappes, éclat du bourdon et densité (constante, arche, vagues, escalier).
- Export : WAV 16 bits ou MP3 (192 ou 320 kb/s) stéréo 44,1 kHz avec progression affichée, boucle sans couture, stems séparés (sans compresseur), MIDI (mélodie, canon, nappes, boucles, pendules), réglages en JSON, et code de partage des réglages. L'encodeur MP3 (lamejs) est chargé à la demande depuis cdnjs, avec vérification d'intégrité : il faut une connexion la première fois, le WAV n'en a pas besoin.

## Partition et charge audio

- Une partition défile sous le titre pendant la lecture : à gauche ce qui vient de sonner, à droite ce qui est déjà planifié (le moteur planifie 8 secondes d'avance). Mélodie en cinabre, canon en or, nappes en bandes grises, boucles et pendules en vert-de-gris, percussion en traits en bas, changements de gamme en lignes rouges avec le nom de la gamme. Les notes à venir sont creuses, elles se remplissent quand elles sonnent. Elle est dans `js/viz.js`.
- Les modules à zéro sont débranchés du graphe audio (réverb, écho, souffle, wow, murmure, feu, vent, canon, bourdon) : le navigateur ne les calcule plus. Le feu est une boucle précalculée au lieu de cinq petits nœuds par seconde.
- Le contexte audio utilise `latencyHint: "playback"` (moins de réveils du processeur) et l'oscilloscope a disparu (plus d'analyseur).
- Qualité audio Haute ou Économe (marge, mémorisée dans le navigateur ; Économe par défaut sur téléphone et machines à 4 cœurs ou moins) : réverbération plafonnée à 5 s, un bourdon de moins, 3 voix de nappe au plus, saturation sans suréchantillonnage, 30 images par seconde. L'export est toujours en qualité haute.
- Mesures (rendu de 20 s dans un Chromium sans GPU, en part d'un cœur) : réglages par défaut 26 % puis 21 %, tout activé 42 % puis 39 %. Sur un ordinateur courant, compte quelques pour cent d'un cœur.

## Vocabulaire

Les titres sont en latin, avec le français en sous-titre, comme sur les instruments médiévaux de fantaisie : Modus (gamme et accord), Tempus (rythme), Bordunus (bourdon), Voces (voix : Cantus, Canon, Concentus, Memoria), Locus (lieu), Spatium et Patina, Mutatio (évolution), Rotae et Pendula, Transcriptio (export). Les contrôles restent en français pour ne pas ralentir l'usage. Une table des matières collée en haut permet de sauter d'un chapitre à l'autre. Sur téléphone, la tension est dans la barre du bas, à côté du bouton Incipe.

## Architecture

Des scripts classiques chargés dans l'ordre par `index.html`, sans module ni build (ça marche aussi en `file://`), et `css/style.css`.

1. `js/data.js` : données musicales (`SCALE_GROUPS`, `RAT` tempéraments, `METERS` motifs de percussion, `DEFAULT`, `PRESETS`) et état `S`.
2. `js/engine.js` : `buildEngine(ctx, S, opts)`, le moteur. Il fonctionne indifféremment sur un `AudioContext` (lecture en direct) et un `OfflineAudioContext` (export). Un ordonnanceur `schedule(until)` planifie à l'avance bourdon, mélodie, canon, nappes, percussion, lieu, boucles et pendules. Chaque famille a son propre générateur pseudo-aléatoire dérivé de la graine : désactiver une voix ne change pas les autres, ce qui rend les stems cohérents avec le mix.
3. `js/ui.js` : contrôles générés depuis la structure `UI`, cercle des hauteurs en SVG, lecture en direct.
4. `js/export.js` : `renderOffline`, `wavFromChannels`, `zipStore`, `midiFile`, code de partage.
5. `js/main.js` : démarrage.

Points d'attention pour la suite :

- Les paramètres marqués `restart: true` dans `UI` relancent la lecture (ils changent la structure du moteur). Les autres s'appliquent à chaud via `setLevels()` ou au prochain planning (anticipation de 8 s).
- La réverb est une réponse impulsionnelle bruitée normalisée en énergie, régénérée au relâchement du curseur.
- Le déjà-vu mémorise des phrases dans `recall()` ; à 0 il ne consomme aucun tirage, donc une graine existante donne exactement la même pièce qu'avant.
- Le fondu enchaîné (`crossfade` dans `ui.js`) crée un nouveau moteur sur le même `AudioContext` et appelle `fadeOut()` sur l'ancien, qui libère ses oscillateurs à la fin.
- La boucle sans couture rend 8 s de plus, puis fond la queue sur le début en puissance égale.

## Tests

Test de fumée de l'interface dans un DOM simulé, avec un faux moteur audio :

```
npm install
npm test
```

Il construit la page, lance la lecture, applique chaque préréglage, exécute les exports (mix, boucle, stems, MIDI) et bascule une note du cercle. Il ne juge pas le son : l'écoute reste manuelle.

## Pistes

- Plus de motifs rythmiques et de formes de mélodie (gigue, motifs répétés, développement de cellule).
- Presets sauvegardés dans le navigateur.
- Rendu mp3 direct (encodeur WASM).
- Instruments supplémentaires (vielle à roue, cornemuse, cromorne).
