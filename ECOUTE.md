# Protocole d'écoute

Les tests de Bourdon vérifient que la musique est correcte : accords sur les barres de mesure, basse qui ne frotte pas, sonie égale. Aucun ne dit si elle porte une scène. Ce protocole sert à le savoir, avec des meneurs et des joueurs, en peu de temps.

Tout se fait dans Bourdon et reste dans le navigateur : rien n'est envoyé. On exporte ensuite les résultats en CSV (Séance, Banc d'écoute, Exporter).

## Deux outils

### Notes en séance

Dans la marge, bloc « À la table » : deux boutons, « Ça porte » et « Ça distrait ». Pendant une vraie partie, le meneur (ou un joueur à qui on confie l'ordinateur) clique quand la musique aide la scène ou quand elle gêne. Bourdon note l'heure, l'ambiance, l'univers, la tension, les émotions choisies, et si le mode Sous la voix était actif.

Ce qu'on en tire : les ambiances qui distraient le plus souvent, les tensions où ça décroche, l'effet du mode Sous la voix.

### Essai à l'aveugle

Séance, « Banc d'écoute à l'aveugle ». Bourdon rend deux versions de la même pièce (même graine, une seule différence), les ramène au même niveau efficace, puis les présente en A et B dans un ordre tiré au sort. On écoute A et B autant qu'on veut, on note chacune de 1 (distrait) à 5 (porte la scène), on dit sa préférence, puis on découvre laquelle était laquelle.

Les comparaisons proposées :

| Comparaison | Ce qu'on teste |
| --- | --- |
| Logique modale ou hasard | La mélodie qui suit les accords, contre l'ancienne version au hasard |
| Tension harmonique ou non | Les accords qui s'éloignent de la tonique quand la tension monte |
| Harmonie de cinéma ou non | Les accords hors de la gamme (médiantes chromatiques) |
| Modèle physique ou synthèse classique | Les cordes, vents et cloches modélisés |
| Exigence ou premier tirage | La meilleure phrase sur douze, contre la première venue |

Le niveau est égalisé parce qu'entre deux versions, la plus forte est presque toujours préférée, sans rapport avec la musique (Bech et Zacharov, 2006).

## Le protocole

1. Recruter cinq ou six meneurs, et si possible quelques joueurs. Pas besoin d'être musicien.
2. Trois séances de jeu réelles par meneur, avec Bourdon en fond. Le meneur clique « Ça porte » ou « Ça distrait » quand il le remarque, sans se forcer : trois à dix notes par séance suffisent.
3. Après chaque séance, ou à un autre moment, dix minutes au banc d'écoute : deux ou trois essais par comparaison, sur des ambiances que le meneur utilise vraiment. Casque ou enceintes de la table, au volume de jeu.
4. Chacun exporte ses résultats (un zip avec `essais.csv` et `seance.csv`) et les envoie à qui rassemble.
5. On regroupe les fichiers et on lit :
   - pour chaque comparaison, le nombre de préférences de chaque côté et la probabilité que l'écart vienne du hasard (le banc l'affiche : test du signe). Une dizaine d'essais donne une tendance, une vingtaine avec plusieurs auditeurs un avis solide ; en dessous de 0,05, l'écart est net ;
   - les notes moyennes (de 1 à 5), qui disent si les deux versions portent la scène, pas seulement laquelle est préférée ;
   - pour les notes en séance, la part de « distrait » par ambiance et par tension.
6. Ce qui en sort devient une décision : garder un réglage par défaut, le changer, ou retoucher une ambiance qui distrait.

## Les fichiers

`essais.csv` : `date`, `auditeur`, `facteur`, `ambiance`, `graine`, `A`, `B` (ce qu'étaient A et B), `noteA`, `noteB`, `pref`.

`seance.csv` : `date`, `note` (porte ou distrait), `scene`, `univers`, `tension`, `emotions`, `sousLaVoix`, `joue`.

Séparateur : point-virgule, pour s'ouvrir directement dans un tableur réglé en français.

## Références

- Søren Bech et Nick Zacharov, *Perceptual Audio Evaluation: Theory, Method and Application*, Wiley, 2006.
- ITU-R BS.1534 (MUSHRA) et BS.1116 : protocoles d'écoute comparée.
- Anna Jordanous, « A standardised procedure for evaluating creative systems (SPECS) », *Cognitive Computation*, 2012.
- Li-Chia Yang et Alexander Lerch, « On the evaluation of generative models in music », *Neural Computing and Applications*, 2020.
