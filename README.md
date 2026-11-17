# Bourdon

Machine à ambiances génératives : une composition modale qui se joue et se renouvelle sans fin (dungeon synth, taverne, espace, nature, cyberpunk…). Une page statique, sans build ni dépendance : tout l'audio est synthétisé dans le navigateur (Web Audio), rien n'est joué à partir de samples. Chaque lecture tire une pièce nouvelle : le hasard est voulu, et un bouton de capture garde les prises qui plaisent.

Usage prévu : composer hors ligne. On règle, on écoute, puis on rend en WAV (mix, boucle sans couture, stems) et en MIDI pour retravailler dans un logiciel de musique.

## Lancer

Ouvrir `index.html` dans un navigateur récent (Chrome, Firefox, Safari). Les polices sont dans le dépôt (`fonts/`, licence SIL OFL), aucune requête externe sauf l'encodeur MP3 à la demande.

## Studio : composer soi-même (studio.html)

Une page à part, reliée par le lien « Studio » de la barre des modes. Ici rien n'est tiré au hasard : l'outil conseille, tu décides. Le flux suit celui d'Ableton (vue Session, chaînes d'appareils, enregistrement de la Session dans l'arrangement) et le fil des étapes d'une pièce de dungeon synth ou d'ambient.

- I · Gamme : tonique et mode (sept modes d'église, mineurs harmonique et mélodique, phrygien dominant, roumain, byzantin, tzigane). Pour chaque mode : caractère, note caractéristique (marquée en rouge), usage dans le genre, ce qui le fait sonner, le piège. Écoute de la gamme et de ses sept accords.
- II · Accords : la piste Harmonie (première colonne) porte des progressions. Palette des accords de la gamme (tonique, accords qui portent la couleur du mode, accords diminués signalés), emprunts aux modes voisins avec leur raison, progressions typiques du mode en un clic, couleurs (sus2, sus4, quinte à vide, septième, add9, sixte), durées. Les conseils proposent l'accord suivant avec la raison (quinte descendante, glissement modal, notes communes, cadence) et relisent la progression (départ, relance de la boucle, couleur du mode présente ou non, emprunts, accords diminués tenus, nombre d'accords).
- III · Couches : des pistes Nappe, Bourdon, Basse, Arpège, Texture dont les clips suivent les accords de la scène (ou ceux qui tournent sur la piste Harmonie). Tout est réglé à la main : voicing (serré avec voix qui bougent le moins possible, ouvert, quintes à vide), rythme, registre, motif d'arpège (va-et-vient, Alberti, dungeon 1-5-8-5, cascade, pédale), vitesse, ambitus, accents. Aperçu des notes, et « Figer en notes » pour retoucher au piano roll.
- IV · Mélodie : clip Notes au piano roll (gamme seule ou chromatique, rangées teintées sur les notes de l'accord en cours, ligne d'accords au-dessus), ou enregistrement au clavier (piste armée ●, trois rangées de la gamme, Page ↑/↓ pour l'octave), quantification, transposition par degré, doublement. Relecture : notes de l'accord sur les temps forts, ambitus, grands sauts sans retour, note finale, usage de la note caractéristique, notes hors gamme, rythme.
- Jouer, comme un instrument : un clavier en bas de page (trois octaves, plus fort en bas de la touche), le clavier d'ordinateur (notes de la gamme sur trois rangées, ou chromatique comme Ableton : A W S E D F T G Y H U J K, Z/X pour l'octave, C/V pour la nuance) et un clavier MIDI (Chrome, Edge : nuance et pédale de maintien). Les notes tiennent tant que la touche est enfoncée, sur la piste armée (●) ou la piste choisie. Maintien, accord d'une touche (la triade de la gamme bâtie sur la note), notes de la gamme et de l'accord qui tourne marquées sur les touches, métronome.
- Au doigt, sans clavier (téléphone, tablette) : trois surfaces au choix. Pads : de grosses touches qui ne contiennent que les notes de la gamme (le grave en bas, la tonique et la note caractéristique marquées, les notes de l'accord qui tourne en vert), aucune fausse note possible. Accords : les sept accords de la gamme en grosses touches, une progression se joue d'un doigt. Piano : le clavier classique. On glisse le doigt d'une touche à l'autre pour enchaîner, plusieurs doigts à la fois. Sur une piste de percussion, une touche par voie. Le clavier se replie en une pastille « Clavier » qui ne cache plus rien.
- Enregistrer : ● Clip crée un clip Notes (1 à 8 mesures) dans la case choisie, le lance et enregistre en boucle par-dessus, avec ou sans quantification (aussi dans un clip de percussion). Capturer garde après coup ce que tu viens de jouer librement, même sans enregistrer, et en fait un clip.
- Effets MIDI, avant l'instrument comme dans Ableton : Arpégiateur (en direct sur les touches tenues, calé sur le tempo : montant, descendant, va-et-vient, ordre joué, accord répété ; vitesse, octaves, durée ; écrit dans le clip avec ● Clip), Accord (triade ou septième de la gamme, quinte, octave), Gamme (ramène toute note dans la gamme), Humain (décalages de temps et de nuance, identiques à chaque passage). Ils agissent sur le jeu, la lecture des clips, le rendu et l'export MIDI ; l'enregistrement garde ce qui a été joué, avant les effets.
- Piano roll : lasso (Maj + glisser), Ctrl+A, C, V, D (tout, copier, coller, dupliquer), couloir de vélocité sous la grille.
- Arrangement : boucle de 2 à 16 mesures depuis le curseur.
- Pistes séparées : export WAV d'une piste par fichier (dans un zip), au même gain, réverb et écho des retours inclus, pour mixer ailleurs.
- MIDI : export du morceau (une piste par piste, la percussion sur le canal 10 en notes General MIDI) ou d'un clip seul (menu du clip), à glisser dans Ableton.
- Percussion : séquenceur à pas, une batterie et un son par voie (grand tambour, tambour sur cadre, caisse, antique, darbouka, boîte à rythmes, balais), pour mélanger les moteurs ; grilles toutes faites tirées des batteries de la machine.
- Instruments : tous ceux de la machine (cordes physiques, vents, cloches modales, voix…), les nappes (machine à cordes, chœur, orgue, vectorielle, essaim…) et les patches du synthé de Forger, y compris les tiens.
- Appareils, à la Ableton : instrument puis effets de gauche à droite, chacun activable, déplaçable, retirable : EQ trois bandes, filtre auto au tempo, saturateur, chorus et ensemble à cordes, écho au tempo (ping-pong), réverbération, bande (pleurage, scintillement, usure, souffle), compresseur, utilitaire. Chaînes toutes faites (lo-fi années 90, machine à cordes, cathédrale, nappe qui respire, grave propre). Retours A (réverb) et B (écho) avec envois par piste, master avec limiteur.
- Vue Session : pistes en colonnes, scènes en rangées, lancement de clip ou de scène calé sur la mesure (ou 2, 4 mesures, un temps, aucun), arrêts par piste, mixeur (volume, pan, envois, sourdine, solo, vumètres).
- V · Arrangement : arme ● puis joue en vue Session, l'arrêt écrit l'arrangement ; ou construction depuis les scènes (×1, ×2, ×4). Blocs à déplacer, allonger (le clip boucle), dupliquer, supprimer, insertion de clips et de mesures, lecture depuis le curseur.
- VI · Export : MP3 (128 à 320 kb/s) ou MIDI de l'arrangement, ou des scènes dans l'ordre ; le MP3 est rendu hors temps réel et normalisé.
- Projet enregistré tout seul dans le navigateur, annulation (Ctrl+Z, Ctrl+Maj+Z), enregistrement et ouverture en fichier JSON, modèles (page blanche, dungeon synth, dark ambient).
- Limites : les notes sont au demi-ton (pas de quarts de ton) ; l'enregistrement de l'arrangement se fait à la mesure.

## La page d'accueil

On arrive sur Conduire : un univers (Médiéval, Aventure, Pirates, Nordique, Féerie, Horreur, Cyberpunk, Espace, Orient, Nature, Calme, ou Au hasard) et ce qu'on cherche (quatorze émotions), le bouton Jouer, huit boutons (volume, tension, densité, bourdon, nappes, brume, nuage, chaleur), un pad XY et le cercle des hauteurs. Les réglages fins sont dans Composer, en neuf chapitres repliés. L'en-tête est réduit au titre, la légende de la partition n'apparaît qu'en lecture, l'extinction a rejoint « Séance » dans la marge.

## Far West retiré

L'univers Far West et ses ambiances (Desertum, Saloon, Duellum, Equitatus) sont retirés : la machine se recentre sur les ambiances planantes. Ses instruments (guitare, piano de bastringue, harmonica, sifflet) et sa batterie aux balais restent disponibles, notamment dans le Studio.

## Sur téléphone

- Arrière-plan : le son passe par un lecteur audio, que le système traite comme une musique en cours (écran éteint, autre application, commandes sur l'écran verrouillé) ; 30 secondes d'avance en arrière-plan ; plus aucun travail visuel quand l'écran n'est pas visible.
- Veillée : la rosace se place sous le titre au lieu d'être recouverte ; titre plus petit et phrase de l'ambiance masquée sur les petits écrans.

## Conduire, recentré sur l'écoute planante

- Six boutons, plus le volume : Profondeur (la réverbération, de la chambre au gouffre), Lumière (de la nuit à la clarté : le voile des aigus et la brillance de la salle), Mouvement (vitesse et ampleur des lentes dérives du filtre, de l'espace, de la densité et du stéréo ; à zéro tout est immobile), Densité (de rares notes à un chant continu), Texture (des notes vers le souffle : nuage de grains, pierre qui chante, air), Lieu.
- Tension, bourdon, nappes, chaleur, canon et écho restent sur le pad XY (par défaut Lumière × Profondeur) et dans Composer. Le curseur Rituel ↔ Chanson quitte Conduire.
- Trois gestes : Suspense, Révélation, Apaisement. Danger, Poursuite et Triomphe, gestes d'action, sont retirés.

## Équilibre du lieu et du bourdon

- Le lieu reste un fond : feu, pluie, mer, ruisseau et nuit ont été recalés au niveau du murmure et du vent (ils sortaient 10 à 13 dB plus fort pour le même réglage). Mesuré en sonie pondérée sur les 65 ambiances, le lieu est maintenant au moins 12 dB sous la musique ; les ambiances où il restait présent (Desertum, Nox, Mare, Fjordus, Odyssea, Saloon, Silva…) ont leur niveau de lieu abaissé (table `PRESET_MIX`).
- Le bourdon est baissé de 3 dB là où il étouffait la mélodie (Larva, Mare, Abyssus, Nox, Sidera, Cella). Il reste dominant, par choix, dans Calme et Dark ambient. Le gain de sonie de ces ambiances est compensé pour que le volume ne bouge pas.

## Rythmes, sonie et mixage

- Chaque batterie a ses grilles, par mesure (4/4, 2/4, 3/4, 6/8, 7/8, 12/8 selon la batterie) : marche avec roulements pour la caisse claire, grosse caisse à chaque temps et charleston en doubles croches pour la boîte à rythmes, maqsoum et sama'i pour la darbouka, frappes espacées pour le grand tambour, « boum-tchac », gigue et valse pour les balais. Une case de la grille peut aussi frapper sur la double croche qui suit. Le tambour sur cadre garde la grille d'origine. Sans grille pour la mesure choisie, la batterie reprend la grille commune.
- Accents : le premier temps de la mesure ressort, puis les temps, puis les contretemps et les doubles croches ; chaque frappe varie un peu en nuance.
- Décalage humain, propre à chaque batterie : la caisse claire des balais traîne, le tambourin pousse, la darbouka flotte, le grand tambour est lent à venir ; la boîte à rythmes reste au cordeau.
- Sonie : chaque ambiance a été rendue hors ligne et mesurée en sonie pondérée (BS.1770, LUFS). Son gain (`norm`, en dB, table `PRESET_NORM`) la ramène à -13 LUFS (-15 pour Calme, plus doux pour dormir), le limiteur tenant les crêtes. Le gain s’applique après le compresseur et avant le limiteur. Vérifié : six ambiances re-mesurées tombent toutes à -13,0 (Somnus à -15,0). Avant, elles allaient de -15,6 à -4,9 LUFS. On ne saute plus de volume en passant d'une ambiance à l'autre.
- Mixage par voix : le grave est au bourdon. La mélodie et le canon passent un passe-haut à 140 Hz avec un peu de présence vers 2,8 kHz, les nappes un passe-haut à 170 Hz et un creux vers 380 Hz, boucles et pendules un passe-haut à 190 Hz. Une voix jouée à la basse synthé garde son grave. Rien sous 190 Hz n'entre dans la grande réverbération. La percussion a sa petite pièce (0,7 s, claire) et n'envoie presque plus rien dans la grande réverbération.

## Instruments plus riches, groove, master

- Synthèse modale (mode physique) : carillon, kalimba, verre et bol sont des sommes de 20 à 34 modes (cloche d'église avec son bourdon à l'octave inférieure et sa tierce mineure, lame de kalimba avec son déclic, verre frotté, bol aux modes dédoublés qui battent). Chaque mode a sa durée, les aigus s'éteignent plus vite, et plus on frappe fort plus les modes aigus ressortent. Le son est calculé une fois par hauteur et par nuance, puis rejoué.
- Caisses de résonance pour le luth, l'oud et la harpe (deux ou trois bosses dans le grave et le médium).
- Bruits de jeu : glissement de doigt sur les cordes (luth, oud, guitare, une note sur sept environ), souffle à la fin des notes de flûte et de ney, crin qui accroche à l'attaque de l'archet, étouffoir du piano qui retombe, bouton et soufflet de l'accordéon.
- Groove : une mesure sur quatre se finit par une relance sur le dernier temps, une autre anticipe sa frappe aiguë d'une double croche, et la fin de chaque section a un roulement propre à la batterie qui monte en nuance. La percussion écoute la mélodie : quand elle chante beaucoup, remplissage et frappes fantômes se raréfient et les frappes aiguës s'adoucissent ; dans ses silences, la percussion se fait plus présente.
- Master : limiteur en bout de chaîne (seuil -2,5 dB), qui laisse monter le niveau perçu sans écrêter. Les stems restent bruts.
- Image stéréo : bourdon au centre, mélodie un peu à gauche, canon à droite, nappes ouvertes (chaque hauteur a sa place), pendules plus larges, et pour la percussion le grave au centre, l'aigu un peu à droite, le remplissage à gauche.
- Compression douce sur la mélodie et les nappes, et les nappes s'effacent un peu (-2 dB) à chaque note de la mélodie, qui reste devant.
- Respirations (Composer, Forme) : dans la moitié des sections par défaut, une voix (nappes, percussion, boucles ou pendules) se retire au début de la section et revient à mi-section ou aux trois quarts, sur une mesure.

## Dark ambient : textures plutôt que notes

- Textures (Composer, Bourdon) : trois couches continues, chacune dans sa bande, qui évoluent sur des minutes. Le grondement grave (bruit brun sous 90 Hz et deux sons graves qui battent lentement, jamais dans la réverbération) ; la pierre qui chante (du souffle passé par des résonateurs très étroits accordés sur les harmoniques 2, 3, 5 et 7 de la tonique, qui dérivent) ; l'air (un souffle aigu dont la couleur se promène). C'est la recette du dark ambient : une couche par bande, un seul élément tient le grave.
- Place pour la voix (Espace et patine) : un creux doux vers 1,9 kHz pour que la musique passe sous la voix du meneur de jeu.
- Univers Dark ambient (Carcer, Vacuum, Ruinae, Sanctum, Glacies) : aucun tempo audible, une mélodie rare qui passe comme un souvenir, des chœurs lents, d'immenses réverbérations, pas de bruitage. Références : le label Cryo Chamber et ses mixages pensés pour passer sous des voix.
- Les ambiances de rituel et de ténèbres prennent aussi ces textures : Crypta, Cella, Hades, Abyssus, Larva, Nebula, Sidera, Domus Obscura, Fjordus.

## Anche physique, cor, plain-chant

- Aulos en modèle physique : une colonne d'air excitée par une anche battante (modèle de la clarinette de Cook et Scavone), avec un peu de nasal ; un son de bois creux, plus rien d'une trompette de clavier.
- Le « cuivre » devient un cor sombre et rond : harmoniques qui tombent vite (1/k^1,6), filtre qui ne s'ouvre qu'avec la nuance, attaque douce et prise par en dessous. Le cornu romain en hérite.
- Plain-chant (Voix) : une voix qui chante le vrai air grégorien du texte choisi (Dies irae, Kyrie, Alleluia, Sanctus, Agnus Dei, Gloria, péan grec), syllabe par syllabe, avec des respirations entre les phrases et un long silence avant de reprendre. Crypta chante le Dies irae, Scriptorium l'Alleluia, Sacrificium l'Agnus Dei, Delphi le péan.

## Rituel ↔ Chanson, veillée ou pièce, thème, Antiquité, bêtes, chant, Varier

- Rituel ↔ Chanson (curseur central de Conduire, au-dessus des boutons) : côté rituel, le bourdon est fort, les accords tiennent longtemps, les boucles et les pendules sont libres ; côté chanson, les accords avancent, l'arpège entre, la mélodie devient un thème qui revient, le bourdon n'est plus qu'une pédale. Chaque univers a son point de départ (Antiquité et Calme côté rituel, Dungeon synth et Far West côté chanson). Avec un plan de pièce, l'intro et la coda tirent vers le rituel, le thème et l'apogée vers la chanson.
- Façon de jouer (Composer, Gamme et accord) : Veillée, qui ne s'arrête jamais et fait revenir le plan en grands cycles, pour le fond sonore d'une partie ; Pièce, qui joue intro, thème, développement, apogée, retombée et coda, puis s'éteint et s'arrête.
- Forme « Thème » : deux phrases écrites au début, qui reviennent telles quelles au thème, variées à l'apogée, en fragments au développement, étirées dans l'intro et la coda. Côté chanson, la forme libre devient ce thème.
- Les modules dans l'orchestre : l'arpège peut être écrit par une machine de Turing (huit pas dans l'accord, qui mutent lentement, plus vite côté rituel) ; les boucles de longueurs inégales portent chacune une note du thème, qui se recompose à la manière d'Eno ; les pendules sonnent les notes de l'accord en cours.
- Univers Antiquité : aulos (double flûte à anche, aussi en bourdon), lyre, syrinx, cornu, hydraulis ; tympanon, crotales et cymbalettes ; péan en 5/8, dactyle en 2/4 ; gamme chromatique grecque. Agora, Delphi, Sparta, Thermopylae, Roma Triumphans, Odyssea, Hades.
- Bêtes (Lieu) : grenouilles, hibou, loups, corbeaux, chevaux, mouettes, chacune en petit modèle (coassement en train d'impulsions, hululement qui fléchit, hurlement qui monte et tient avec un second loup qui répond, croassement rauque, hennissement qui dégringole puis ébrouement, cri de mouette). Les grillons de la nuit chantent plus vite quand il fait chaud (loi de Dolbear), avec la météo réelle. Placées dans 25 ambiances.
- Chant (instrument « Chant ») : la voix articule les syllabes d'un texte, une par note (Kyrie, Alleluia, Dies irae, Sanctus, Agnus Dei, Gloria, péan grec), avec des consonnes simples (occlusives, s, m, n, l, r). Crypta chante le Dies irae, Scriptorium l'Alleluia, Sacrificium l'Agnus Dei, Delphi le péan.
- Varier (Conduire) : une variante proche de l'ambiance en cours (tonalité voisine, tempo, instruments de la même famille, densité, dosage rituel et chanson) ; Revenir défait la dernière.

## Dungeon synth : accords, arpège, et un univers à part

- Voix d'arpège (Composer, Voix, « Arpège ») : l'accord en cours égrené note à note, en va-et-vient, montant ou en Alberti (grave, aigu, milieu, aigu), en noires, croches ou doubles croches, sur un registre et une étendue choisis, avec l'instrument de son choix. C'est le pilier de l'accompagnement en dungeon synth.
- Univers « Dungeon synth » (Montagne, Custos, Hiems, Castellum, Silva Antiqua) : de vrais enchaînements d'accords (harmonie idiomatique du mode) tenus par une nappe avec sa basse, un arpège qui les égrène, une mélodie simple qui revient (forme en rondeau, déjà-vu élevé), presque pas de bourdon, des timbales lointaines, une grande salle de Dattorro, un peu de souffle et de flottement de bande. Références : Mountain Realm, la scène « comfy » et épique du genre.
- Médiéval repensé dans cette logique : Taberna (taverne au coin du feu, luth en arpège, flûte, foule), Chorea, Tripudium et Turris ont maintenant des accords, une basse et un arpège ; leur bourdon est réduit pour ne plus contredire les accords.

## FM, nappes vectorielles, essaim, distorsion de phase, plaque de Dattorro

- Piano électrique FM (à la DX7) : porteuse 1:1 dont l'indice retombe vite, plus une « lame » 1:14 très brève qui fait le tintement, deux voix un rien désaccordées, étouffoir au relâchement. Cloches FM : rapport 1:3,5 inharmonique et longue résonance.
- Nappe vectorielle : quatre timbres aux coins (chœur, verre, cordes, souffle accordé) ; un point tourne lentement entre eux (14 à 30 s par tour) et chaque coin monte puis descend à son tour. La nappe ne reste jamais figée.
- Essaim : sept scies désaccordées qui dérivent chacune à son rythme, sous un filtre qui respire (façon Plaits).
- Distorsion de phase (façon Casio CZ, onde « résonante ») : un sinus à un multiple glissant de la note, fenêtré par une dent de scie ; le multiple monte et redescend au fil de la note, comme un formant qui balaie. Calculé note par note.
- Réverbérations plaque et salle de Dattorro (Type de réverbération) : la cuve à deux branches croisées de Dattorro, en worklet ; la salle est la même cuve, une fois et demie plus grande. Niveaux alignés sur la réverbération vivante.
- Dans les ambiances : la voix chante dans Lullaby, Larva, Sylva Magica, Nebula, Crypta (en plus de Fjordus et Sacrificium) ; machine à cordes dans Abyssus, Cella, Skalda, Turris ; nappe vectorielle dans Sidera, Meditatio, Somnus ; essaim dans Nebula et Machina ; distorsion de phase dans Urbs Neon et Datum ; piano électrique FM dans Pluvia ; cloches FM dans Sidera et Imber Toxicus ; orgue à roues dans Imber Toxicus ; harmonica dans Saloon ; plaque de Dattorro dans Desertum, Duellum, Equitatus, Urbs Neon, Machina, Datum, Sidera ; salle dans Triumphus et Pugna ; Scriptorium en pythagoricien, Triumphus en Kirnberger ; porte passe-bas sur la harpe de Hortus.

## Voix, machine à cordes, orgues, rythmes euclidiens, porte passe-bas, tempéraments

- Moteur de voix : la source est la dérivée d'une impulsion glottale de Rosenberg (ouverture en cosinus, fermeture rapide), dont la série de Fourier est calculée une fois ; deux sources, tendue et soufflée. Elle passe par les cinq formants d'une voyelle (a, o, ou, é), pris dans la tessiture de la note (basse, ténor, alto, soprano) ; le premier formant monte avec la note quand elle le dépasse, comme chez les sopranos. Souffle filtré par les mêmes formants.
  - Instrument « Voix (vocalise) » : la voyelle glisse au fil de la note, la note est prise par en dessous, le vibrato s'installe, la hauteur dérive un peu, la source est soufflée dans les nuances douces. Utilisée en écho grave dans Fjordus et Sacrificium.
  - La nappe chœur et le bourdon chœur passent sur ce moteur (le bourdon chante un « o » qui respire vers le « a »).
- Machine à cordes (nappe et bourdon, « Machine à cordes ») : registres 16', 8' et 4' accordés pile, voix brillante, et l'effet d'ensemble qui fait tout : trois lignes à retard balancées par un LFO lent (0,63 Hz) et un rapide (5,9 Hz), décalés d'un tiers de tour, à gauche, au centre, à droite. Le son des vieilles machines à cordes du dungeon synth. Skalda et Turris s'en servent.
- Orgues : l'orgue positif (instrument), la nappe orgue et le bourdon orgue sont construits par jeux de tuyaux (bourdon bouché, principal, flûte ; plein-jeu avec nasard et fourniture), avec le chuintement d'attaque et un peu de vent ; le bourdon a deux rangs en voix céleste. Nouvel orgue à roues (instrument et nappe) : tirettes 88 8800 000, clic de touche, percussion, cabine rotative lente.
- Rythme euclidien (Rythme, réglages de la percussion) : une couche de frappes légères réparties au plus juste sur les doubles croches de la mesure ; nombre et décalage tirés à chaque section. Par défaut dans Cyberpunk (50 %) et Orient (35 %).
- Porte passe-bas (Mélodie) : sur les sons pincés et frappés, le filtre se referme avec le son, boisé et rond, à la manière d'une vactrol. Lullaby, Labor et Thesaurus l'utilisent sur la kalimba.
- Tempéraments Werckmeister III et Kirnberger III : définis depuis do, ils donnent à chaque tonalité sa couleur. Domus Obscura, l'orgue du manoir, est en Werckmeister.
- Niveaux : chaque nouveau timbre est aligné sur celui qu'il remplace ou côtoie (voix sur flûte, orgues sur les anciens, machine sur les cordes), puis toutes les ambiances ont été re-mesurées.

## Nappes chœur et cordes

- Chœur : quatre chanteurs (deux en mode Économe), chacun une scie légèrement fausse à sa manière, avec son propre vibrato (vitesse, ampleur, moment où il s'installe), placés en éventail, passés par les quatre formants d'une voyelle qui glisse au fil de la note (de « a » vers « o », ou de « o » vers « ou »), avec un peu de souffle.
- Cordes : un pupitre de quatre instrumentistes (trois en mode Économe), chacun désaccordé de quelques centièmes, avec son vibrato et sa respiration d'archet, répartis dans l'espace, une bosse de caisse en bois vers 290 Hz, un creux nasal vers 1,25 kHz et le frottement d'archet à peine audible.
- Niveaux alignés sur les anciennes nappes (à 0,4 dB près). Coût : environ deux fois celui des anciennes nappes. Le bourdon garde son chœur actuel.
- Equitatus refait : trompette en mixolydien, sifflet en écho, guitare battue, galop en 6/8 (sabot-sabot-sabot), forme en rondeau et en arche.

## Cohérence des univers

- Far West : plus de bourdon (c'est lui qui donnait un air médiéval). Trois sons propres : sifflet (presque un sinus, glissade d'attaque, vibrato qui s'installe), harmonica (anche libre nasillarde, note prise par en dessous, trémolo de la main) et guitare grattée en nappe (chaque note de l'accord est une corde, coups vers le bas sur les temps, vers le haut entre deux, étouffés au coup suivant). Desertum : guitare, sifflet en écho, guitare grattée. Duellum : sifflet sur mineur harmonique, guitare grave, battement de grand tambour. Equitatus : harmonica, trompette, guitare battue au galop. Saloon : piano et guitare.
- Nordique : flûte de bois au lieu du ney pour Fjordus, lyre et chœur au lieu du bol pour Runae, chœur au lieu de l'orgue d'église pour Bellum, tambour sur cadre (façon Sami) pour la veillée et le rituel.
- Pirates : tambour sur cadre (bodhrán) pour les chants de marins, plus de bourdon de cornemuse, violon et guitare grattée à la taverne du port, grand tambour et bourdon sans orgue pour la tempête.
- Nature : flûte de bois au lieu du ney en forêt.
- Les ambiances retouchées ont été re-mesurées : toutes à -13 LUFS.

## Veillée

Le bouton Veillée (au-dessus de la partition, en lecture) ouvre la machine en grand, à regarder en fond, dans le noir. Au centre, une rosace : chaque note s'allume à sa place dans la gamme (l'angle, la tonique en haut), plus loin du centre quand elle est plus aiguë. La mélodie trace sa constellation des neuf dernières secondes, le canon et les boucles s'y mêlent en points, les nappes font des arcs, les frappes des ondes depuis le centre, le bourdon respire au milieu et la forme d'onde court sur le pourtour. En titre, le nom de l'ambiance, sa phrase et son univers ; en bas, ton, tempo, section et affects, puis la partition en ruban. Chaque univers a ses couleurs (néon pour Cyberpunk, sang sur noir pour Horreur, mer et or pour Pirates...). Espace pour jouer, F pour le plein écran, Échap pour fermer ; les commandes s'effacent après quatre secondes sans geste.

## Batteries et nouveaux instruments

- Six batteries (Rythme, « Batterie ») : tambour sur cadre (celle d'origine), grosse caisse et caisse claire, grand tambour avec bâton et claquoir, darbouka et riqq, balais avec botte et tambourin, boîte à rythmes. Chaque univers a la sienne par défaut : caisse claire pour Aventure, grand tambour pour Nordique et Horreur, darbouka pour l'Orient, balais pour Far West et Pirates, boîte à rythmes pour Cyberpunk et Espace, tambour sur cadre ailleurs. Un préréglage peut en citer une autre.
- Quatre instruments : guitare d'acier (corde pincée près du chevalet, caisse de résonance), piano de bastringue (partiels inharmoniques, deux cordes désaccordées de 11 centièmes par note, étouffoir au relâchement), accordéon musette (trois anches, soufflet), basse synthé (toujours ramenée entre 40 et 160 Hz, filtre qui claque).
- Ils remplacent le synthé perso là où il imitait un instrument : Portus joue l'accordéon, Desertum la guitare (et retrouve son sifflet), Saloon le piano qu'il annonçait, Urbs Neon a sa basse en canon, Machina tourne ses boucles en basse. Les patchs Accordéon et Twang du synthé perso sont retirés.
- Mesuré dans un navigateur : aucun rendu ne produit de valeur aberrante, niveaux alignés à 1 ou 2 dB près sur le luth. Pas écouté par moi : les dosages restent à régler à l'oreille.

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

Troisième mode, Forger (interrupteur « Composer · Conduire · Forger » sous la partition, le mode courant est souligné), indépendant de la génération : un synthétiseur qu'on programme et qu'on joue.

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

- Mode Conduire (interrupteur « Conduire · Composer · Forger » sous la partition) : un panneau avec huit boutons rotatifs (volume, tension, densité, bourdon, nappes, brume, nuage, chaleur ; canon et écho restent disponibles sur le pad), un pad XY dont on choisit les deux axes, et le cercle des hauteurs qui devient un clavier. On glisse un bouton vers le haut ou le bas (Maj pour affiner), on utilise la molette ou les flèches. Le choix du mode est mémorisé.
- Jouer par-dessus la machine : le cercle joue les notes de la gamme courante (les autres sont ignorées, pour que ça sonne toujours juste). Au clavier, trois rangées de la gamme, du grave à l'aigu : Z X C V B N M , . / puis A S D F G H J K L ; puis Q W E R T Y U I O P, repérées par position physique de la touche donc valables en AZERTY. Instrument, registre et niveau de ton jeu se règlent sous le cercle ; si le canon est actif, il reprend ce que tu joues.
- Figer : la dernière phrase et le dernier accord tournent en boucle jusqu'à ce qu'on relâche. Autre phrase : la mémoire est oubliée et la machine repart sur du neuf.
- Réponse immédiate : la planification en direct est de 4 secondes (10 si la page est en arrière-plan) au lieu de 8, et `replan()` coupe d'un coup les notes déjà planifiées d'une voix pour en planifier de nouvelles avec les réglages actuels. Mesuré : un changement de réglage de la mélodie s'entendait après environ 9 secondes, maintenant après 0,3 seconde. Instrument, densité, registre, gamme, nappes, boucles, pendules, déjà-vu, durée de section et courbe de tension ne redémarrent plus le moteur. Tonalité, tempérament, diapason, tempo, mesure, graine et timbre du bourdon passent toujours par un fondu enchaîné, raccourci à 0,6 seconde.
- Les notes que tu joues s'affichent en sombre sur la partition. Elles ne sont pas dans l'export.

## Univers, timbres et extinction

- Quarante-six préréglages en douze univers (ajoutés : Aventure, Pirates, Nordique, Féerie, Horreur, Cyberpunk, de quatre ambiances chacun), choisis sur la première page ou par un menu dans la marge. Les cinq premiers : Médiéval (Taberna, Chorea, Crypta, Scriptorium, Turris, Tripudium), Calme (Somnus pour dormir, Meditatio, Labor pour travailler), Espace (Sidera, Nebula, Abyssus), Orient et quarts de ton (Aegyptus, Eremus, Hortus, Bayati, Enharmonia), Nature (Pluvia, Mare, Silva, Nox). Chacun a une glose française. Ils sont réglés sur le papier et mesurés au niveau sonore, pas écoutés : les ajuster à l'oreille est normal.
- Timbres ajoutés : oud (corde pincée), ney (flûte soufflée), kalimba, bol chantant, cloches de verre, synthé doux pour les voix ; synthé doux et verre pour les nappes ; sinus pur et bol chantant pour le bourdon.
- Extinction progressive : dans 15 minutes à 2 heures, le niveau tient puis descend en courbe douce sur les 20 % finaux (entre 1 et 5 minutes), et la lecture s'arrête au silence. Le compte à rebours démarre à la mise en lecture.
- Volume général (chapitre Spatium) : pour que les ambiances calmes restent calmes. L'export est toujours normalisé en crête.
- Quarts de ton : quatre gammes à 24 notes par octave (Maqam Rast, Bayati, Saba, enharmonique grec ancien). Une note à un quart de ton est placée au milieu (en proportion) de ses deux voisines, dans le tempérament choisi. Le cercle des hauteurs a 24 positions (les petits points sont les quarts de ton), cliquables pour dessiner une gamme libre ; la gamme libre garde son ancien format à 12 cases tant qu'on n'utilise pas de quart de ton. Une note à un quart de ton s'écrit avec une flèche : Mi↓ est un Mi demi-bémol. En MIDI, elles passent en pitch bend de 50 cents (plage de 2 demi-tons) sur mélodie, canon, boucles et pendules, et sont arrondies sur les nappes, qui sont polyphoniques.
- Natura : cinq sons de nature (pluie, vagues, nuit avec grillons, ruisseau, oiseaux), chapitre Locus. Les textures sont des boucles précalculées construites seulement quand on les active (environ 1 % d'un cœur chacune), les oiseaux sont des phrases tirées au hasard. Un univers Nature les met en avant : Pluvia, Mare, Silva, Nox. Les maqams ont leurs préréglages dans l'univers Orient : Bayati et Enharmonia.
- Limites connues : les quarts de ton sont ceux de la théorie à 24 notes égales, pas les intonations exactes de chaque maqam ; pas de bruit continu rose ou brun ; la percussion reste le bodhrán et le shaker.

## Arranger (retiré)

Le mode Arranger (pistes en boucle par-dessus la machine) a été retiré : le Studio le remplace, avec un vrai flux de composition. Les anciennes pistes enregistrées dans les scènes sont ignorées. Le mixeur des voix de la machine reste dans Conduire et dans la Veillée.

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
- Capturer la lecture (colonne de droite) : enregistre ce qu'on entend (WAV) et les notes jouées (MIDI), le tout dans un .zip, pour garder une prise qui plaît. Un menu choisit le format : WAV + MIDI dans un zip (défaut), WAV seul, MP3 seul (320 kb/s, sans MIDI, encodeur lamejs chargé à la première utilisation) ou WAV + MP3. Le choix est mémorisé.
- Fortuna (Voces) : chance sur chaque événement. Notes manquantes, roulements (une note répétée deux ou trois fois), mutations (une note change d'un ou deux degrés), sauts d'octave imprévus, silences imprévus entre les phrases. Les mutations touchent aussi la progression des nappes, et les notes manquantes les boucles. Par défaut un peu de chaque (de 5 à 12 %) ; à zéro, la musique reste dans sa grammaire.
- Deriva (Mutatio) : quatre marches aléatoires lentes, chacune promenant au choix l'éclat du bourdon, la réverbération, la densité de la mélodie, sa place dans le stéréo, la tension ou le voile. Profondeur et vitesse réglables.
- Machine de Turing (Voces, Musica, « Forme de la pièce ») : la mélodie est un registre de pas de 1, 2 ou 4 mesures, en croches ou en noires. Le verrou règle la résistance de chaque pas à la mutation : à 100 % le registre boucle à l'identique, à 0 % tout est tiré de nouveau à chaque tour. Les temps forts se calent sur l'accord du moment.

## Composition : caractère, formes, contrepoint, couleur de mode, gestes

- Ingenium (Voces) : cinq curseurs qui orientent le tirage de la mélodie. Gravité (retour vers la tonique et cadences), audace (taille des sauts), ornements (appoggiatures et, au-delà de 55 %, trilles), silences (souffles entre les notes et les phrases), répétition (retour des phrases déjà jouées). 50 % redonne l'ancien comportement. Chaque préréglage a son caractère : la crypte est lente et grave, la taverne dansante.
- Forme de la pièce (Voces, Musica) : libre (phrases et déjà-vu, comme avant), passacaille (une basse descendante qui revient, tonique, sensible, sus-dominante, dominante, avec des variations dont la densité grandit à chaque tour), ostinato (un court motif répété, renouvelé toutes les huit reprises, sur une pédale de tonique), rondeau (refrain de deux phrases, couplets nouveaux, refrain, couplet, refrain), thème et variations (quatre phrases de thème, puis reprises ornées, renversées, ralenties ou transposées). Les préréglages en choisissent une.
- Contrepoint (Voces, Canon, Transposition) : une voix sous la mélodie en tierces et sixtes, de préférence en mouvement contraire, sans quintes ni octaves parallèles, jouée en même temps que la mélodie.
- Couleur du mode (Voces, Musica) : suit la tension (du lydien, clair, au locrien, sombre), la météo du lieu (ciel dégagé clair, pluie et brouillard plus sombres, orage phrygien) ou les deux. Le mode est décidé au début de chaque section et remplace les gammes choisies tant que l'option n'est pas sur « Fixe ».
- Gestes musicaux (mode Conduire) : suspense (la mélodie se tait, une nappe tenue sur la dominante monte, le bourdon s'ouvre), révélation (l'accord s'ouvre vers le majeur, une montée claire), danger (motif de triton grave, percussion et bourdon qui montent), poursuite (ostinato rapide dans le grave, percussion qui galope), triomphe (fanfare de cuivres puis accord plein), apaisement (la percussion s'éteint, une nappe large revient). L'ampleur (discret, plein, immense) règle la durée, la force et la densité : discret dure environ deux mesures, immense plus de quatre, avec des voix d'accord supplémentaires. Ils partent sur la noire suivante, le bouton reste enfoncé le temps du geste, et tout retombe de soi-même.
- Veillée : le bouton Veillée, au bout de la barre des modes (toujours visible, même à l'arrêt), ouvre un panneau d'instrument sur parchemin, pour regarder la machine tourner en fond. Un afficheur à cristaux donne le ton, le tempo, la mesure en cours, la section et les affects ; quatre modules numérotés : 01 partition qui défile en grand, 02 oscilloscope sur graticule, 03 cadran gradué en quarts de ton dont les notes de la gamme s'allument quand une voix les joue, 04 spectre à segments avec crêtes. Plein écran en option (F), palette de nuit (N : la même planche en encre claire sur fond sombre, mémorisée), Espace lance ou arrête, Échap ferme ; les touches s'effacent après quelques secondes sans geste. Tant que la veillée est ouverte, le reste de la page est inerte (clavier et lecteurs d'écran).
- Mixeur dans la veillée : la touche Mixeur (ou M) ouvre un tiroir à droite avec les mêmes faders, pan, sourdines, solos et vumètres que Conduire et Arranger (Lieu compris) ; il suit les changements venus d'ailleurs et s'efface avec les touches après quelques secondes sans geste. L'état ouvert ou fermé est mémorisé.
- Dans la veillée : un volume général toujours visible, une touche Capturer (durée en direct, format choisi dans le tiroir, message à la fin), et le tiroir « Mixeur et jeu » avec l'instrument, le registre et le niveau de ton jeu. Les touches Z, A et Q y jouent aussi (les raccourcis M et F ont été retirés pour cette raison ; Espace et Échap restent). Un curseur du mixeur n'est plus jamais redessiné pendant qu'on le tient (la boucle de Conduire le remplaçait sous le doigt).
- Accueil et visite guidée : au premier lancement, un écran d'accueil en trois plaques (une machine, une pièce neuve, trois gestes) propose la visite guidée, d'écouter une ambiance tirée au hasard, ou de passer. La visite pose six bulles sur la vraie interface (univers, émotions, Jouer, boutons, gestes, autres modes), au clavier avec les flèches et Échap. C'est mémorisé ; le lien « Aide », à côté de Veillée, les rouvre.
- Icônes : une famille de 42 pictogrammes sobres (`js/icones.js`, sprite SVG injecté dans la page, `ic("nom")` pour en rendre une) : grille de 24, trait de 1,6 aux bouts carrés, un seul carré cinabre par icône. Placés sur les modes, Aide, Veillée, les gestes, Figer, Autre phrase, Geler le nuage, Capturer, les douze univers, Au hasard et les huit boutons. Les icônes héritent de la couleur du texte.
- Voix propres aux ambiances : plusieurs ambiances portent leur propre patch de synthé perso pour se distinguer vraiment (acide résonnant et échos pointés pour le cyberpunk, accordéon pour Portus, boîte à musique FM pour Fata, souffle filtré pour Larva et Imber Toxicus, guitare à vibrato pour Desertum). Le cyberpunk joue aussi sur des répétitions de séquenceur (Turing verrouillé, relances en rafale), une percussion saturée et un bourdon de basse ; le Nordique accorde en quintes pures.
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
