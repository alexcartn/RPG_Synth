# Bourdon

Machine à ambiances modales pour dungeon synth et ambiances de taverne. Une seule page HTML, sans build ni dépendance : tout l'audio est synthétisé dans le navigateur (Web Audio), rien n'est joué à partir de samples. Une graine donne une pièce, la même graine redonne la même pièce.

Usage prévu : composer hors ligne. On règle, on écoute, puis on rend en WAV (mix, boucle sans couture, stems) et en MIDI pour retravailler dans un logiciel de musique.

## Lancer

Ouvrir `index.html` dans un navigateur récent (Chrome, Firefox, Safari). Les polices viennent de Google Fonts, sans elles la page reste utilisable avec les polices de secours.

## Ce que fait l'outil

- Gammes : 28 gammes et modes (diatoniques, harmonique, mélodique, double harmonique, pentatoniques, hexacorde de Guido, organum, symétriques) et une gamme libre dessinée sur le cercle des 12 hauteurs.
- Structure : jusqu'à trois gammes qui se succèdent par sections de N mesures, tonique et tempérament au choix (égal, juste, pythagoricien, mésotonique), diapason réglable.
- Rythme : tempo 40 à 180, mesures 4/4, 6/8, 3/4, 2/4, 7/8, 12/8, swing, percussion (bodhrán et shaker).
- Voix : bourdon (anche, orgue, chœur) dont la quinte glisse vers un degré voisin, mélodie (luth, harpe, flûte, carillon, orgue positif), canon décalé, nappes d'accords (chœur, cordes, orgue).
- Lieu : murmure de salle, tintements, feu, vent, gouttes.
- Espace et patine : réverb (taille et ombre), écho en ping-pong, saturation, ondulation de bande, voile, souffle.
- Évolution : l'intensité module percussion, nappes, éclat du bourdon et densité (constante, arche, vagues, escalier).
- Export : WAV 16 bits stéréo 44,1 kHz rendu plus vite que le temps réel, boucle sans couture, stems séparés (sans compresseur), MIDI (mélodie, canon, nappes), réglages en JSON, et code de partage des réglages.

## Architecture

Tout est dans `index.html`, en trois blocs dans l'ordre.

1. Données musicales : `SCALE_GROUPS`, `RAT` (tempéraments), `METERS` (motifs de percussion sur grille de croches), `DEFAULT` et `PRESETS`.
2. `buildEngine(ctx, S, opts)` : le moteur. Il fonctionne indifféremment sur un `AudioContext` (lecture en direct) et un `OfflineAudioContext` (export). Un ordonnanceur `schedule(until)` planifie à l'avance bourdon, mélodie, canon, nappes, percussion et lieu. Chaque famille a son propre générateur pseudo-aléatoire dérivé de la graine : désactiver une voix ne change pas les autres, ce qui rend les stems cohérents avec le mix.
3. Interface : contrôles générés depuis la structure `UI`, cercle des hauteurs en SVG, export (`renderOffline`, `wavFromChannels`, `zipStore`, `midiFile`).

Points d'attention pour la suite :

- Les paramètres marqués `restart: true` dans `UI` relancent la lecture (ils changent la structure du moteur). Les autres s'appliquent à chaud via `setLevels()` ou au prochain planning (anticipation de 8 s).
- La réverb est une réponse impulsionnelle bruitée normalisée en énergie, régénérée au relâchement du curseur.
- La boucle sans couture rend 8 s de plus, puis fond la queue sur le début en puissance égale.
- Dans l'artifact claude.ai, le téléchargement direct est bloqué : l'export passe par la capacité `downloads` et livre un zip.

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
