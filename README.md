# Bourdon

Machine à ambiances modales pour dungeon synth et ambiances de taverne. Une page statique, sans build ni dépendance : tout l'audio est synthétisé dans le navigateur (Web Audio), rien n'est joué à partir de samples. Chaque lecture tire une pièce nouvelle : le hasard est voulu, et un bouton de capture garde les prises qui plaisent.

Usage prévu : composer hors ligne. On règle, on écoute, puis on rend en WAV (mix, boucle sans couture, stems) et en MIDI pour retravailler dans un logiciel de musique.

## Lancer

Ouvrir `index.html` dans un navigateur récent (Chrome, Firefox, Safari). Les polices sont dans le dépôt (`fonts/`, licence SIL OFL), aucune requête externe sauf l'encodeur MP3 à la demande.

## La page d'accueil

On arrive sur Conduire : un univers (Médiéval, Aventure, Pirates, Nordique, Féerie, Horreur, Far West, Cyberpunk, Espace, Orient, Nature, Calme, ou Au hasard) et ce qu'on cherche (quatorze émotions), le bouton Jouer, huit boutons (volume, tension, densité, bourdon, nappes, brume, nuage, chaleur), un pad XY et le cercle des hauteurs. Les réglages fins sont dans Composer, en neuf chapitres repliés. L'en-tête est réduit au titre, la légende de la partition n'apparaît qu'en lecture, l'extinction a rejoint « Séance » dans la marge.

## Réverbération vivante, nuage de grains, liens

Ces trois ajouts tournent dans un AudioWorklet (`js/fx.js`), en direct comme à l'export. Si le navigateur n'en a pas, la réverbération à convolution reste seule et le nuage est absent.

- Réverbération vivante (Spatium, « Type de réverbération », par défaut) : un réseau de huit lignes à retard bouclées, amorties, dont les longueurs bougent lentement. « Mouvement » règle cette modulation, « Scintillement » renvoie la queue une octave plus haut. « Lieu » garde l'ancienne réverbération à convolution, avec ses premières réflexions. Mesuré : durée de décroissance conforme au réglage (7,9 s pour 9 s demandées), niveau aligné sur la convolution (0,4 dB d'écart sur un rendu de 30 s), stable même à scintillement maximal, environ 1 % d'un cœur.
- Nuage de grains (Spatium et Patina, groupe Grain ; bouton Nuage en Conduire) : la mélodie, les nappes ou les boucles s'écrivent dans une bande de 8 secondes, relue par petits grains tirés dans le passé récent, parfois à l'octave ou à la quinte. « Geler le nuage » (Conduire) arrête l'écriture : les grains font tourner ce que la bande contient. Le gel ne fait pas partie de l'export.
- Liens (Mutatio) : chaque note de la mélodie ouvre le filtre des nappes, qui se referme ensuite ; à zéro, le filtre est neutre. Les notes jouées à la main l'ouvrent aussi.
- Dérives liées (Mutatio, Deriva) : chaque dérive peut promener une seconde cible (« et aussi »), dans le même sens ou à l'envers, par exemple l'éclat du bourdon qui monte quand le voile se lève. Nouvelle cible : le nuage de grains.
- Pas écouté par moi : tout cela est vérifié par mesure (niveaux, stabilité, absence de valeurs aberrantes), les dosages par défaut et ceux des préréglages Meditatio, Sidera et Nebula restent à ajuster à l'oreille.

## Forger : le synthé perso

Depuis la refonte, deux choses ont changé ; le détail plus bas décrit l'ancienne disposition.

- Moteur à tables d'ondes en AudioWorklet (`js/fx.js`, processeur `bourdon-synth`) : toutes les voix d'une destination sont calculées échantillon par échantillon. Tables de 2 048 points sur 256 harmoniques, filtrées par octave ; position de table réellement balayable (destinations « Position de table » A et B) ; unisson à phases libres ; torsion de la forme d'onde ; modulation de phase ; filtre à variables d'état 12 ou 24 dB ; matrice calculée dans le processeur ; quatre macros comme sources. Les réglages agissent sur les notes déjà tenues. Vol de voix au-delà de 20 voix (10 en Économe). Sans AudioWorklet, l'ancien moteur à nœuds natifs prend le relais (`synthVoice`).
- Mesuré contre l'ancien moteur, note de 220 Hz sur les dix patches : même justesse (écart de 0 à 3 centièmes de ton), niveau à 0,5 dB près sauf Pad doux (1,7 dB plus bas, les phases d'unisson sont maintenant aléatoires). Accord de huit notes à sept voix d'unisson sur deux oscillateurs : 9,5 % d'un cœur contre 20 %. À l'export, `synFlush()` attend que le worklet ait reçu toutes les notes avant de lancer le rendu.
- Interface sur un seul écran (environ 520 px de haut, clavier compris) : un bandeau (patch, précédent et suivant, au sort, enregistrer, oscilloscope, machine, aide), une rangée de sources (oscillateurs A et B, compléments, filtre), une rangée de ce qui bouge (enveloppes et LFO en onglets avec un seul graphe, macros, sortie), puis les liaisons de modulation, où seules celles qui servent sont affichées. Octave, demi-tons, unisson et type de filtre sont des valeurs qu'on tire. L'enveloppe se règle aussi en tirant sur son graphe. Effets, table dessinée et échange de patch sont sur une seconde page. Le clavier est réduit et repliable.
- Modulation par glisser-déposer : une rangée de douze sources (LFO 1 à 3, enveloppes, vélocité, clavier, hasard, macros) se tire sur un bouton marqué d'un point (table A et B, torsion, niveau et désaccord de B, coupure, résonance, FM, niveau). La liaison apparaît dans la matrice, et un anneau de profondeur entoure le bouton : tirer l'anneau règle la profondeur (Maj pour affiner), un double-clic le retire. Les sources bipolaires (LFO, clavier, hasard) dessinent un anneau de part et d'autre de la valeur, les autres d'un seul côté. Sans souris : cliquer une source l'arme, puis cliquer un bouton. Un point vivant suit le LFO sur le bouton.
- LFO dessinés et synchronisés : chaque LFO a une cinquième forme, dessinée sur 64 points (sans composante continue, crête normalisée), et un bouton Tempo qui remplace la vitesse en hertz par une division du tempo, de quatre mesures à la triple croche. Les trois LFO dessinés ou synchronisés passent par le moteur à tables d'ondes comme par le moteur natif de secours.
- Import d'une table depuis un fichier audio : on en tire un cycle de 256 points. La partie la plus forte du son est choisie, la période est trouvée par autocorrélation (40 à 1200 Hz), puis la moyenne de quelques cycles est rééchantillonnée, sans composante continue et sans cassure au raccord. Un son sans hauteur nette donne une table de timbre. Le fichier peut aussi être glissé sur la courbe de la table dessinée. Le spectre garde jusqu'à 120 harmoniques pour une table importée (48 pour une table dessinée à la main).
- Affichage de table animé : la tranche rouge des oscillateurs A et B suit les LFO qui modulent la position de table, avec la position de base en pointillé. Pendant une note tenue la phase repart du début de la note, comme le moteur ; sans note, l'aperçu tourne en roue libre. Les enveloppes ne sont pas animées dans l'aperçu. Rien ne bouge si le système demande moins d'animations.
- Pas encore fait : l'aperçu animé des enveloppes, la vitesse d'un LFO modulée par une autre source, les divisions pointées et en triolets.

Troisième mode, Forger (interrupteur « Composer · Conduire · Forger · Arranger » sous la partition, le mode courant est souligné), indépendant de la génération : un synthétiseur qu'on programme et qu'on joue.

- Voix : deux oscillateurs à table d'ondes (sinus, triangle, dent de scie, carré, impulsion, orgue, voyelle : la position entre deux formes est une interpolation de leurs harmoniques), chacun avec octave, intervalle, désaccord et unisson jusqu'à 7 voix avec écart et largeur stéréo ; un sous-oscillateur, du bruit, une modulation de fréquence (B module A).
- Filtre passe-bas, passe-haut, passe-bande ou coupe-bande avec coupure, résonance, suivi du clavier et quantité d'enveloppe ; la courbe de réponse est dessinée en direct.
- Trois enveloppes ADSR (volume, filtre, enveloppe 2) dessinées, deux LFO (sinus, triangle, dent de scie, carré), une matrice de modulation à quatre emplacements : source (LFO 1, LFO 2, enveloppe 2, vélocité) vers destination (hauteur, coupure, résonance, trémolo, panoramique, quantité de FM, désaccord de B) avec une quantité de -100 à +100 %.
- Saturation, niveau, sensibilité à la vélocité. Bibliothèque de dix patches (Pad doux, Basse sub, Pincé synthé, Cloche FM, Orgue, Cuivre doux, Voyelle chantée, Souffle, Lead brillant, Nappe de verre), tirage au sort de patches (valeurs musicales), enregistrement sous un nom dans le navigateur, échange par texte (JSON).
- Jeu : clavier à l'écran de trois octaves (multitouch, un doigt par note), et clavier d'ordinateur en disposition de piano (Z S X D C V G B H N J M pour la première octave, Q 2 W 3 E R 5 T 6 Y 7 U pour la suivante, repérées par position donc valables en AZERTY). Maintien pour prolonger les notes, « Tout couper ». Le clavier reste collé en bas de l'écran pour jouer en réglant.
- Speculum : un oscilloscope (déclenché sur le front montant, gain automatique) et un spectre en fréquences logarithmiques, au choix sur le synthé seul ou sur tout le mélange, avec la crête en dB.
- Tables d'ondes : treize tables (Sinus, Triangle, Dent de scie, Carré, Impulsion, Orgue, Voyelle, Creux, Cloche, Corde, Dentelle, Verre, Dessinée) vues en tranches 3D, la tranche courante en rouge ; on tire dessus pour changer de table. « Tabula » permet de dessiner sa propre période de 64 points, convertie en harmoniques, avec formes de départ, lissage et hasard.
- Filtres : passe-bas et passe-haut en 12 ou 24 dB, passe-bande, coupe-bande. Mode monophonique avec glissando.
- Matrice à huit emplacements : sources LFO 1 à 3, enveloppes de volume et 2, vélocité, hauteur de la note, hasard par note ; destinations hauteur, filtre, résonance, volume, pan, FM, désaccord de B, niveau de B et fondu de table de A (une jumelle sur la table voisine dont le niveau suit la source).
- Armarium : rack d'effets du synthé (chorus, écho, salle, égaliseur trois bandes, compresseur), sur le clavier de l'atelier et sur les pistes du DAW réglées sur le synthé perso, rendu dans l'export. Les anciens patchs et scènes sont complétés automatiquement.
- Clavier « dans la gamme » (activé par défaut, bouton « Dans la gamme ») : chaque touche est un degré de la gamme du thème qui joue, la tonique est marquée, et le clavier suit la gamme quand une section change. L'ordinateur joue Z X C V B N M , . / puis Q W E R T Y U I O P. Idéal pour improviser sur le thème sans fausse note, quarts de ton compris. Désactivé, on retrouve le clavier chromatique.
- La machine peut se mettre en sourdine (« La machine joue / en sourdine ») : l'atelier se joue alors seul. Au premier appui sur une touche, l'atelier démarre tout seul, machine en sourdine.
- Le synthé est aussi un instrument comme les autres : « Synthé perso (Atelier) » dans les instruments de la mélodie, du canon, des boucles, des pendules et du jeu, et dans les timbres de nappes. Le patch est enregistré avec les scènes et les réglages.
- Coût : une voix de l'atelier compte une trentaine de nœuds audio (unisson, filtre, enveloppes, LFO). Utilisé comme instrument de toutes les voix à la fois, le rendu coûte environ le double du préréglage par défaut (mesuré : 50 % d'un cœur contre 24 % dans un navigateur sans GPU). Le mode Économe limite l'unisson à 3 voix.
- Mesuré dans un navigateur : chaque patch est juste, sans valeur aberrante, et s'éteint complètement après le relâchement (niveau 0,00004 deux secondes et demie après). Les niveaux des patches sont égalisés.

## Timbres organiques

- Flûte et ney : guide d'onde avec jet et non-linéarité cubique (colonne d'air de deux périodes, la flûte sonne sur son deuxième mode comme une vraie flûte). Validé par analyse spectrale de 150 à 1100 Hz : le fondamental est juste à 2 centièmes de ton près. Le ney a plus de souffle, une attaque plus lente et une petite glissade d'attaque.
- Archet (violon, viole) : corde frottée avec loi de frottement de McIntyre et Schumacher, avec vibrato qui s'installe. Fondamental juste à 2 à 6 centièmes de ton près de 150 à 800 Hz (au-dessus, il bascule sur une synthèse classique).
- Cuivre doux : filtre qui s'ouvre à l'attaque, vibrato retardé et souffle des lèvres.
- Tambours : les frappes de bodhrán sont les modes d'une membrane circulaire (rapports de Bessel), amortis chacun à leur vitesse, avec une chute de hauteur à l'attaque.
- Chœur : un troisième formant vers 2,6 kHz donne le brillant de la voix chantée.
- Tout cela est actif avec « Cordes et timbres : modèle physique » (par défaut) ; « Synthèse classique » garde les anciens timbres. Les niveaux ont été alignés entre modèle physique et classique.

## Intelligence musicale, cordes physiques, acoustiques, adaptation

- Logique modale (défaut, réglable dans Voces, groupe Musica ; « Hasard » garde l'ancienne version, utile pour comparer à l'oreille). Les accords suivent des cycles de quatre : tonique, un accord libre pondéré par le mode, un accord de préparation (sous-tonique, dominante ou sous-dominante), puis retour. Les voix des accords se déplacent le moins possible d'un accord à l'autre. La mélodie connaît l'accord du moment : ses notes sur les temps forts sont des notes de l'accord, elle a un motif par section (énoncé, repris plus haut ou plus bas, puis question en arche et réponse qui descend vers la tonique), des souffles entre les phrases, des nuances qui suivent l'arche de la phrase et un léger décalage humain du jeu. Mesuré sur 15 minutes de musique : notes sur l'accord aux temps forts 42 % avant, 83 à 100 % selon le préréglage aujourd'hui (Scriptorium 78 %, le plus bas), mouvement moyen des voix d'accord 2,9 puis 0,8 demi-ton, frottements de seconde ou de septième avec l'accord 39 % puis 18 % (Crypta). Avec les phrases rejouées par le déjà-vu, elles sont recalées sur l'accord du moment.
- Cordes pincées par modèle physique : luth, harpe et oud sont une corde pincée de Karplus-Strong avec accord fin (écart mesuré de 2 centièmes de ton au plus, quarts de ton compris), point de pincement, amortissement qui dépend de la hauteur et de la force du jeu. Chaque note est calculée une fois et mise en cache (environ 0,6 ms par note). « Synthèse classique » garde les anciens timbres.
- Acoustiques du lieu : chapelle de pierre, salle de bois, grotte, plaque métallique, générique. Chacune a son prédélai, ses premières réflexions, sa vitesse de décroissance et sa brillance. Quelques préréglages en choisissent une (Taberna : salle, Crypta : grotte, Scriptorium : chapelle).
- Météo réelle (Mutatio, Adaptatio, « Selon l'heure et la météo du lieu ») : on tape une ville, la page interroge Open-Meteo (sans clé ni compte, seuls le nom saisi et les coordonnées du lieu partent) et relit toutes les 30 minutes. La météo s'ajoute à l'heure : la pluie fait monter les sons de pluie, le vent suit la vitesse réelle, une nuit claire appelle les grillons, un jour clair des oiseaux, et nuages, pluie, brouillard et neige baissent l'énergie alors qu'un orage la monte. La force de l'adaptation dose le tout. La dernière lecture est rendue dans l'export et mémorisée avec les scènes ; hors ligne, on garde la dernière lecture.
- Adaptation sans matériel (Mutatio, groupe Adaptatio) : « selon l'heure » fait suivre à l'énergie la courbe de la journée (creux vers 2 h, pic vers 14 h) et agit sur la tension (percussion, nappes, densité), l'éclat du bourdon et le voile ; « s'apaiser » fait baisser l'énergie sur la durée d'écoute choisie. Mesuré : 12 % de notes en moins à 3 h et 25 % de plus à 14 h qu'en l'absence d'adaptation. L'export capte l'heure du moment, donc il dépend de l'heure quand l'adaptation est active.
- Garde-fou : avec « Hasard » et « Synthèse classique », les six anciens préréglages donnent exactement les mêmes notes qu'avant.

## Conduire et réponse immédiate

- Mode Conduire (interrupteur « Conduire · Composer · Forger · Arranger » sous la partition) : un panneau avec huit boutons rotatifs (volume, tension, densité, bourdon, nappes, brume, nuage, chaleur ; canon et écho restent disponibles sur le pad), un pad XY dont on choisit les deux axes, et le cercle des hauteurs qui devient un clavier. On glisse un bouton vers le haut ou le bas (Maj pour affiner), on utilise la molette ou les flèches. Le choix du mode est mémorisé.
- Jouer par-dessus la machine : le cercle joue les notes de la gamme courante (les autres sont ignorées, pour que ça sonne toujours juste). Au clavier, trois rangées de la gamme, du grave à l'aigu : Z X C V B N M , . / puis A S D F G H J K L ; puis Q W E R T Y U I O P, repérées par position physique de la touche donc valables en AZERTY. Instrument, registre et niveau de ton jeu se règlent sous le cercle ; si le canon est actif, il reprend ce que tu joues.
- Figer : la dernière phrase et le dernier accord tournent en boucle jusqu'à ce qu'on relâche. Autre phrase : la mémoire est oubliée et la machine repart sur du neuf.
- Réponse immédiate : la planification en direct est de 4 secondes (10 si la page est en arrière-plan) au lieu de 8, et `replan()` coupe d'un coup les notes déjà planifiées d'une voix pour en planifier de nouvelles avec les réglages actuels. Mesuré : un changement de réglage de la mélodie s'entendait après environ 9 secondes, maintenant après 0,3 seconde. Instrument, densité, registre, gamme, nappes, boucles, pendules, déjà-vu, durée de section et courbe de tension ne redémarrent plus le moteur. Tonalité, tempérament, diapason, tempo, mesure, graine et timbre du bourdon passent toujours par un fondu enchaîné, raccourci à 0,6 seconde.
- Les notes que tu joues s'affichent en sombre sur la partition. Elles ne sont pas dans l'export.

## Univers, timbres et extinction

- Quarante-six préréglages en douze univers (ajoutés : Aventure, Pirates, Nordique, Féerie, Horreur, Far West, Cyberpunk, de quatre ambiances chacun), choisis sur la première page ou par un menu dans la marge. Les cinq premiers : Médiéval (Taberna, Chorea, Crypta, Scriptorium, Turris, Tripudium), Calme (Somnus pour dormir, Meditatio, Labor pour travailler), Espace (Sidera, Nebula, Abyssus), Orient et quarts de ton (Aegyptus, Eremus, Hortus, Bayati, Enharmonia), Nature (Pluvia, Mare, Silva, Nox). Chacun a une glose française. Ils sont réglés sur le papier et mesurés au niveau sonore, pas écoutés : les ajuster à l'oreille est normal.
- Timbres ajoutés : oud (corde pincée), ney (flûte soufflée), kalimba, bol chantant, cloches de verre, synthé doux pour les voix ; synthé doux et verre pour les nappes ; sinus pur et bol chantant pour le bourdon.
- Extinction progressive : dans 15 minutes à 2 heures, le niveau tient puis descend en courbe douce sur les 20 % finaux (entre 1 et 5 minutes), et la lecture s'arrête au silence. Le compte à rebours démarre à la mise en lecture.
- Volume général (chapitre Spatium) : pour que les ambiances calmes restent calmes. L'export est toujours normalisé en crête.
- Quarts de ton : quatre gammes à 24 notes par octave (Maqam Rast, Bayati, Saba, enharmonique grec ancien). Une note à un quart de ton est placée au milieu (en proportion) de ses deux voisines, dans le tempérament choisi. Le cercle des hauteurs a 24 positions (les petits points sont les quarts de ton), cliquables pour dessiner une gamme libre ; la gamme libre garde son ancien format à 12 cases tant qu'on n'utilise pas de quart de ton. Une note à un quart de ton s'écrit avec une flèche : Mi↓ est un Mi demi-bémol. En MIDI, elles passent en pitch bend de 50 cents (plage de 2 demi-tons) sur mélodie, canon, boucles et pendules, et sont arrondies sur les nappes, qui sont polyphoniques.
- Natura : cinq sons de nature (pluie, vagues, nuit avec grillons, ruisseau, oiseaux), chapitre Locus. Les textures sont des boucles précalculées construites seulement quand on les active (environ 1 % d'un cœur chacune), les oiseaux sont des phrases tirées au hasard. Un univers Nature les met en avant : Pluvia, Mare, Silva, Nox. Les maqams ont leurs préréglages dans l'univers Orient : Bayati et Enharmonia.
- Limites connues : les quarts de ton sont ceux de la théorie à 24 notes égales, pas les intonations exactes de chaque maqam ; pas de bruit continu rose ou brun ; la percussion reste le bodhrán et le shaker.

## Arranger : pistes par-dessus la machine

Quatrième mode (« Composer · Conduire · Forger · Arranger »), pensé pour l'ordinateur. La machine continue de générer, tes pistes bouclent par-dessus.

- Mixeur : une ligne par voix de la machine (bourdon, mélodie et canon, nappes, percussion, boucles, pendules, lieu) avec niveau, muet (M) et solo (S), puis jusqu'à huit pistes à toi avec instrument (n'importe lequel de la machine, dont le synthé perso), niveau, pan, muet, solo et longueur de boucle (1, 2, 4 ou 8 mesures). Le solo vaut pour les voix de la machine et les pistes à la fois.
- Piano roll : on pose une note d'un clic, on l'allonge en tirant, on la déplace, on l'efface avec Maj ou un clic droit. La grille est réglable (noire, croche, double-croche, libre) et les notes tombent dans la gamme du thème en cours (rangées de la gamme éclaircies, toniques marquées), au choix. « Doubler la boucle » copie le clip pour construire une phrase plus longue.
- Enregistrement : « Enregistrer » arme la piste choisie, on joue au clavier de l'ordinateur ou à l'écran (le clavier de l'atelier, dans la gamme) et la prise est calée sur la grille, en boucle, avec annulation (Ctrl+Z ou bouton). Barre d'espace : jouer ou arrêter.
- Arpégiateur : une barre au-dessus du mixeur. Activé, les touches tenues (ou « Maintien ») s'enchaînent en arpège sur la piste choisie, calé sur le tempo de la machine : montant, descendant, aller-retour, au hasard ou dans l'ordre joué, de la noire à la triple-croche, sur 1 à 3 octaves, avec une durée de note réglable. Avec « Enregistrer », l'arpège est écrit dans le clip.
- Séquenceur à pas : second onglet du piano roll, la même boucle en grille avec une rangée par degré de la gamme du thème. On clique ou on glisse pour allumer des pas, « Au hasard » remplit selon une densité (les degrés stables sont favorisés), « Décaler d'un pas » fait tourner le motif. Piano roll et séquenceur modifient les mêmes notes.
- Les pistes sont enregistrées avec les scènes, rendues dans l'export audio, présentes dans le MIDI (une piste par piste) et ont leur stem « pistes ».
- Limites : les notes du piano roll sont placées au demi-ton (une note enregistrée à un quart de ton est conservée et jouée, mais se déplace au demi-ton) ; les modifications s'entendent à la prochaine boucle ; pas de capture automatique de la machine en clip pour l'instant.

## Intelligence musicale, deuxième étage

- Exigence (Voces, Musica) : à chaque phrase la machine en tire jusqu'à douze et garde la meilleure. Elle compte les grands sauts (et leur retour en sens inverse), les tritons non voulus, les séries de notes répétées, la part de mouvement conjoint, l'unicité du point culminant et sa place dans la phrase, une fin stable (la tonique est favorisée par la gravité), l'étendue, et évite de recopier la phrase précédente. À zéro, un seul tirage comme avant. Mesuré sur six pièces de quatre minutes : les tritons passent de 24 à 14 et les séries de trois notes identiques de 56 à 27.
- Harmonie idiomatique (Voces, Musica, par défaut) : chaque mode diatonique suit ses progressions typiques, 72 % du temps (dorien i-IV-i-bVII, mixolydien I-bVII-IV-I, phrygien i-bII-i-bvii, éolien i-bVI-bVII-i, ionien I-IV-V-I, lydien I-II-I-V, locrien i-bII-i-bV, mineurs harmonique et mélodique i-iv-V-i). Les modes d'église gravitent autour d'un ton de récitation (la quinte, la sixte pour le phrygien) avant de revenir à la finale. Les gammes à quarts de ton suivent un chemin de maqam sur chaque section : installation sur la tonique, montée vers la dominante, point haut, retour à la tonique.
- Plan de la pièce (Voces, Musica) : « Arche » donne aux sections un rôle (intro, thème, développement, apogée, retombée, coda), affiché sur la partition à côté du mode. Chaque rôle porte une énergie, qui module la tension (donc percussion, nappes, bourdon et densité), le registre de la mélodie et l'ouverture du voile. Avant une section plus énergique : une mesure de silence de la mélodie et un roulement de percussion sur la demi-mesure. Le mode suit un trajet, plus sombre au développement et plus clair à l'apogée. Plusieurs préréglages le choisissent (Taberna, Chorea, Turris, Tripudium, Scriptorium, Aegyptus).

## Affectus : les émotions des gammes et des tonalités

- Table de correspondance (Modus) : chaque gamme (vingt-sept) et chaque tonalité, majeure ou mineure, porte des affects pondérés parmi quatorze : mystérieux, fataliste, héroïque, mélancolique, joyeux, féerique, inquiétant, majestueux, nostalgique, serein, tragique, étrange, sauvage, sacré. Les caractères des tonalités s'inspirent librement du caractère traditionnel des tons de l'époque baroque, sans en faire une règle.
- Lecture : sous les menus, la gamme et la tonalité choisies sont décrites en une phrase et résumées par leurs trois affects dominants (65 % gamme, 35 % tonalité). La même phrase s'affiche sous le cercle des hauteurs.
- Recherche, sur la première page (Conduire), plus dans Composer : on choisit un univers, puis une ou plusieurs émotions. L'univers donne la base (instrumentation, espace, rythme : un de ses préréglages) ; les émotions choisissent la gamme et la tonalité, et règlent la tension de départ (le serein tire vers 0,2, l'inquiétant vers 0,8, la moyenne des émotions choisies). Cinq propositions s'affichent, chacune une gamme dans sa meilleure tonalité sur le préréglage de l'univers qui lui ressemble le plus, avec une jauge ; la première s'applique tout de suite (fondu si la lecture tourne), les autres sont à un clic. Les gammes à quarts de ton ne sont proposées que dans l'univers Orient. Sans émotion, choisir un univers applique son premier préréglage. Les ambiances nommées de l'univers restent dans un volet replié, et « La table des affects en entier » liste tout.

## Hasard vivant : chance, dérives, machine de Turing, capture

- Plus de graine à choisir : chaque lecture et chaque export tirent une pièce nouvelle. Une graine interne reste, tirée au hasard à chaque export et partagée par toutes ses passes (mix, stems), pour que les fichiers restent alignés entre eux. Les scènes et préréglages gardent des réglages, pas une pièce.
- Capturer la lecture (colonne de droite) : enregistre ce qu'on entend (WAV) et les notes jouées (MIDI), le tout dans un .zip, pour garder une prise qui plaît.
- Fortuna (Voces) : chance sur chaque événement. Notes manquantes, roulements (une note répétée deux ou trois fois), mutations (une note change d'un ou deux degrés), sauts d'octave imprévus, silences imprévus entre les phrases. Les mutations touchent aussi la progression des nappes, et les notes manquantes les boucles. Par défaut un peu de chaque (de 5 à 12 %) ; à zéro, la musique reste dans sa grammaire.
- Deriva (Mutatio) : quatre marches aléatoires lentes, chacune promenant au choix l'éclat du bourdon, la réverbération, la densité de la mélodie, sa place dans le stéréo, la tension ou le voile. Profondeur et vitesse réglables.
- Machine de Turing (Voces, Musica, « Forme de la pièce ») : la mélodie est un registre de pas de 1, 2 ou 4 mesures, en croches ou en noires. Le verrou règle la résistance de chaque pas à la mutation : à 100 % le registre boucle à l'identique, à 0 % tout est tiré de nouveau à chaque tour. Les temps forts se calent sur l'accord du moment.

## Composition : caractère, formes, contrepoint, couleur de mode, gestes

- Ingenium (Voces) : cinq curseurs qui orientent le tirage de la mélodie. Gravité (retour vers la tonique et cadences), audace (taille des sauts), ornements (appoggiatures et, au-delà de 55 %, trilles), silences (souffles entre les notes et les phrases), répétition (retour des phrases déjà jouées). 50 % redonne l'ancien comportement. Chaque préréglage a son caractère : la crypte est lente et grave, la taverne dansante.
- Forme de la pièce (Voces, Musica) : libre (phrases et déjà-vu, comme avant), passacaille (une basse descendante qui revient, tonique, sensible, sus-dominante, dominante, avec des variations dont la densité grandit à chaque tour), ostinato (un court motif répété, renouvelé toutes les huit reprises, sur une pédale de tonique), rondeau (refrain de deux phrases, couplets nouveaux, refrain, couplet, refrain), thème et variations (quatre phrases de thème, puis reprises ornées, renversées, ralenties ou transposées). Les préréglages en choisissent une.
- Contrepoint (Voces, Canon, Transposition) : une voix sous la mélodie en tierces et sixtes, de préférence en mouvement contraire, sans quintes ni octaves parallèles, jouée en même temps que la mélodie.
- Couleur du mode (Voces, Musica) : suit la tension (du lydien, clair, au locrien, sombre), la météo du lieu (ciel dégagé clair, pluie et brouillard plus sombres, orage phrygien) ou les deux. Le mode est décidé au début de chaque section et remplace les gammes choisies tant que l'option n'est pas sur « Fixe ».
- Gestes musicaux (mode Conduire) : suspense (la mélodie se tait, une nappe tenue sur la dominante monte, le bourdon s'ouvre), révélation (l'accord s'ouvre vers le majeur, une montée claire), danger (motif de triton grave, percussion et bourdon qui montent), poursuite (ostinato rapide dans le grave, percussion qui galope), triomphe (fanfare de cuivres puis accord plein), apaisement (la percussion s'éteint, une nappe large revient). L'ampleur (discret, plein, immense) règle la durée, la force et la densité : discret dure environ deux mesures, immense plus de quatre, avec des voix d'accord supplémentaires. Ils partent sur la noire suivante, le bouton reste enfoncé le temps du geste, et tout retombe de soi-même.
- Veillée : le bouton en haut à droite de la partition ouvre une vue plein cadre, à la chandelle, pour regarder la machine tourner en fond : partition qui défile en grand, oscilloscope à persistance, cercle dont les notes de la gamme s'allument quand une voix les joue, spectre avec crêtes. Plein écran en option, Espace lance ou arrête, Échap ferme, et les commandes s'effacent après quelques secondes sans geste.
- Infobulles : tout élément qui porte un `title` reçoit une infobulle (survol, focus clavier, appui long au tactile) ; le `title` natif est retiré et recopié dans `aria-description`. Chaque émotion dit ce qu'elle veut dire et quelles gammes la portent le mieux.
- Le fader « Lieu » du mixeur règle l'ensemble des bruits de lieu (murmure, tintements, feu, vent, gouttes) ; les sons de nature gardent leurs propres curseurs. Hors du Moyen Âge, un préréglage qui ne cite pas un bruit de lieu n'en a plus (murmure et tintements de taverne se glissaient dans l'espace ou chez les pirates).
- Partir d'une émotion : la base est choisie parmi les ambiances de l'univers en tenant compte de l'agitation voulue (tension, percussion, tempo), puis la percussion et la densité de la mélodie suivent l'agitation des émotions choisies.

## Table de jeu

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

Les titres des chapitres sont en français : Gamme et accord, Rythme, Bourdon, Voix, Lieu, Espace et patine, Évolution, Boucles et pendules, Export. Les contrôles restent en français pour ne pas ralentir l'usage. Les chapitres se replient (une courte description reste visible quand ils sont fermés, le choix est mémorisé) ; une table des matières collée en haut permet de sauter d'un chapitre à l'autre. Sur téléphone, la tension est dans la barre du bas, à côté du bouton Incipe.

## Architecture

Des scripts classiques chargés dans l'ordre par `index.html`, sans module ni build (ça marche aussi en `file://`), et `css/style.css`.

1. `js/data.js` : données musicales (`SCALE_GROUPS`, `RAT` tempéraments, `METERS` motifs de percussion, `DEFAULT`, `PRESETS`) et état `S`.
2. `js/fx.js` : les processeurs AudioWorklet (réverbération vivante, nuage de grains) et `fxLoad(ctx)` qui les charge par URL de blob, ou `data:` en `file://`.
3. `js/engine.js` : `buildEngine(ctx, S, opts)`, le moteur. Il fonctionne indifféremment sur un `AudioContext` (lecture en direct) et un `OfflineAudioContext` (export). Un ordonnanceur `schedule(until)` planifie à l'avance bourdon, mélodie, canon, nappes, percussion, lieu, boucles et pendules. Chaque famille a son propre générateur pseudo-aléatoire dérivé de la graine : désactiver une voix ne change pas les autres, ce qui rend les stems cohérents avec le mix.
4. `js/ui.js` : contrôles générés depuis la structure `UI`, cercle des hauteurs en SVG, lecture en direct.
5. `js/export.js` : `renderOffline`, `wavFromChannels`, `zipStore`, `midiFile`, code de partage.
6. `js/main.js` : démarrage.

Points d'attention pour la suite :

- Les paramètres marqués `restart: true` dans `UI` relancent la lecture (ils changent la structure du moteur). Les autres s'appliquent à chaud via `setLevels()` ou au prochain planning (anticipation de 8 s).
- La réverb est une réponse impulsionnelle bruitée normalisée en énergie, régénérée au relâchement du curseur.
- Le déjà-vu mémorise des phrases dans `recall()` ; à 0 il ne consomme aucun tirage, donc la graine, désormais interne, donne la même suite de tirages à tous les rendus d'un même export (ce qui garde les stems alignés).
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

## Mesures de la musique

`npm test` lance aussi `tests/musique.js`, qui génère quatre graines de quatre minutes pour huit préréglages et échoue si un seuil n'est pas tenu. Les seuils décrivent une musique correcte, pas les résultats du jour : tous les changements d'accord tombent sur une barre de mesure, aucune note ne démarre avant la fin de la précédente, la basse ne frotte jamais contre le bourdon (ni seconde ni septième avec la tonique, ni demi-ton avec la quinte), au moins 75 % de notes d'accord sur les temps forts, au plus 15 % d'unissons et 22 % de tonique, une dynamique d'au moins 4 dB entre le 10e et le 90e centile, au plus 3 octaves de tessiture, des relances de percussion qui tombent toutes sur un début de phrase. Les danses (Taberna, Tripudium, Chorea) restent sur la grille (3 % de notes hors grille au plus) ; les ambiances lentes (Sidera, Somnus) doivent avoir des notes tenues et un placement libre. Aucun de ces chiffres ne dit que ça sonne bien : l'oreille reste juge.
