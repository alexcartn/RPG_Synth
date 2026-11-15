# Bourdon

Machine à ambiances modales pour dungeon synth et ambiances de taverne. Une page statique, sans build ni dépendance : tout l'audio est synthétisé dans le navigateur (Web Audio), rien n'est joué à partir de samples. Une graine donne une pièce, la même graine redonne la même pièce.

Usage prévu : composer hors ligne. On règle, on écoute, puis on rend en WAV (mix, boucle sans couture, stems) et en MIDI pour retravailler dans un logiciel de musique.

## Lancer

Ouvrir `index.html` dans un navigateur récent (Chrome, Firefox, Safari). Les polices viennent de Google Fonts, sans elles la page reste utilisable avec les polices de secours.

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
