# Références et chantiers

Ce que Bourdon sait déjà, ce qu'il lui manque, et où l'apprendre. Chaque source dit ce qu'elle apporte au projet. La mention « utilisé » signale ce qui est déjà dans le code, « à exploiter » ce qui ne l'est pas encore.

Les sources sont classées par domaine. Quand un lien libre existe, il est donné ; sinon, la référence suffit pour la trouver en bibliothèque.

---

## 1. Émotion musicale et cognition

C'est la zone la plus faible du projet au départ : la table Affectus reposait pour un tiers sur les caractères baroques des tonalités, que la recherche ne retrouve pas en tempérament égal. Depuis la refonte (voir les chantiers), les émotions sont placées sur deux axes et pilotent les indices qui portent vraiment l'émotion.

### Modèles de l'émotion

- James A. Russell, « A circumplex model of affect », *Journal of Personality and Social Psychology* 39(6), 1980. Le cercle valence × éveil sur lequel les quatorze affects sont maintenant placés. Utilisé.
- Tuomas Eerola et Jonna K. Vuoskoski, « A comparison of the discrete and dimensional models of emotion in music », *Psychology of Music* 39(1), 2011. Les émotions perçues en musique se ramènent bien à deux dimensions. [PDF](https://is.muni.cz/el/phil/jaro2017/PS_BA007/um/A_comparison_of_the_discrete_and_dimensional_models_of_emotion_in_music.pdf). Utilisé.
- Julian Cespedes-Guevara et Tuomas Eerola, « Music communicates affects, not basic emotions », *Frontiers in Psychology* 9, 2018 : l'expression musicale repose sur l'éveil et la valence, les catégories viennent après. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5836201). Utilisé.
- Marcel Zentner, Didier Grandjean et Klaus R. Scherer, « Emotions evoked by the sound of music », *Emotion* 8(4), 2008. Le modèle GEMS : neuf émotions vraiment ressenties en musique (émerveillement, transcendance, tendresse, nostalgie, paix, puissance, activation joyeuse, tension, tristesse). Une grille pour revoir la liste des quatorze affects. À exploiter.

### Mécanismes : pourquoi la musique émeut

- Patrik N. Juslin et Daniel Västfjäll, « Emotional responses to music: the need to consider underlying mechanisms », *Behavioral and Brain Sciences* 31(5), 2008. Les mécanismes BRECVEMA : réflexe du tronc cérébral (attaques soudaines, grave fort), entraînement rythmique, conditionnement, contagion (la musique imite la voix émue), imagerie visuelle, mémoire épisodique, attente musicale, puis jugement esthétique. [PDF](https://resolve.cambridge.org/core/services/aop-cambridge-core/content/view/DEEDFFC61393C84BB417AE8B132EB34E/S0140525X08005293a.pdf/emotional-responses-to-music-the-need-to-consider-underlying-mechanisms.pdf). À exploiter : chaque geste de Conduire devrait dire quel mécanisme il active.
- Patrik N. Juslin, « From everyday emotions to aesthetic emotions: towards a unified theory of musical emotions », *Physics of Life Reviews* 10(3), 2013. La version complète de BRECVEMA.
- Patrik N. Juslin, *Musical Emotions Explained*, Oxford University Press, 2019. La synthèse en un livre.
- Juslin et al., révision de 2022 sur le rôle du contexte d'écoute. [PDF](https://duo.uio.no/bitstream/handle/10852/96023/Juslin%2Bet%2Bal%2B2022.pdf?sequence=1)
- David Huron, *Sweet Anticipation: Music and the Psychology of Expectation*, MIT Press, 2006. La théorie ITPRA (imagination, tension, prédiction, réaction, évaluation) : l'émotion vient des attentes tenues ou déjouées. C'est le cadre théorique du Déjà-vu, de l'Exigence et des gestes Suspense et Révélation. À exploiter : un geste « surprise » (cadence évitée, accord inattendu) manque.
- David Huron, *Voice Leading: The Science Behind a Musical Art*, MIT Press, 2016. Pourquoi les règles de conduite des voix tiennent à la perception : éclaire la conduite des nappes et le contrepoint.

### Les indices : ce qui porte l'émotion

- Alf Gabrielsson et Erik Lindström, « The role of structure in the musical expression of emotions », dans Juslin et Sloboda (dir.), *Handbook of Music and Emotion*, Oxford University Press, 2010. Le tableau de référence : tempo, mode, registre, nuance, articulation, timbre, rythme, et l'émotion que chacun porte. Utilisé pour la refonte d'Affectus.
- Tuomas Eerola, Anders Friberg et Roberto Bresin, « Emotional expression in music: contribution, linearity, and additivity of primary musical cues », *Frontiers in Psychology* 4, 2013. Mesure le poids de chaque indice : le mode et le tempo dominent, puis le registre, la nuance, l'articulation et le timbre. Les poids de la refonte en sont tirés. Utilisé.
- David Temperley et Daphne Tan, « Emotional connotations of diatonic modes », *Music Perception* 30(3), 2013. Le classement des modes du plus clair au plus sombre (ionien, puis mixolydien et lydien, dorien, éolien, phrygien) : il confirme l'échelle de couleur du mode (`LADDER`). Utilisé.
- Patrik N. Juslin et John A. Sloboda (dir.), *Handbook of Music and Emotion: Theory, Research, Applications*, Oxford University Press, 2010. Le manuel du domaine.
- Anders Friberg, Roberto Bresin et Johan Sundberg, « Overview of the KTH rule system for musical performance », *Advances in Cognitive Psychology* 2(2-3), 2006. Les règles de jeu expressif (arche de phrase, notes longues plus longues, accent des sauts) : de quoi rendre la mélodie moins mécanique. À exploiter.

### Les caractères des tonalités : l'histoire et ses limites

- Marc-Antoine Charpentier, *Règles de composition*, vers 1690 : « énergie des modes ».
- Johann Mattheson, *Das neu-eröffnete Orchestre*, 1713.
- Christian Friedrich Daniel Schubart, *Ideen zu einer Ästhetik der Tonkunst*, écrit vers 1784, publié en 1806.
- Rita Steblin, *A History of Key Characteristics in the Eighteenth and Early Nineteenth Centuries*, University of Rochester Press, 1983, 2e éd. 2002. L'histoire de ces caractères : ils tenaient aux tempéraments inégaux et aux instruments de l'époque.
- Jonathan Powell et Nicola Dibben, « Key-mood association: a self perpetuating myth », *Musicae Scientiae* 9(2), 2005. En tempérament égal, l'effet propre de la tonalité ne résiste pas à l'examen. D'où la baisse de son poids dans Affectus (35 % à 10 %), le reste passant au registre. Utilisé.

### Tension et attente dans la durée

- Fred Lerdahl et Ray Jackendoff, *A Generative Theory of Tonal Music*, MIT Press, 1983.
- Fred Lerdahl, *Tonal Pitch Space*, Oxford University Press, 2001.
- Fred Lerdahl et Carol L. Krumhansl, « Modeling tonal tension », *Music Perception* 24(4), 2007. Un modèle chiffré de la tension harmonique : de quoi relier le curseur Tension à l'harmonie, pas seulement à la percussion et aux nappes. À exploiter.
- Morwaread M. Farbood, « A parametric, temporal model of musical tension », *Music Perception* 29(4), 2012. La tension perçue à partir de la nuance, du registre, du tempo, de la densité et de l'harmonie. À exploiter pour les courbes de tension.
- Carol L. Krumhansl, *Cognitive Foundations of Musical Pitch*, Oxford University Press, 1990. Les profils de tonalité : ils serviraient à mesurer si une mélodie « sonne » dans son mode.

### Répétition, fatigue et musique de fond

- Elizabeth Hellmuth Margulis, *On Repeat: How Music Plays the Mind*, Oxford University Press, 2014. Pourquoi la répétition plaît, et jusqu'où. [Résumé](https://www.themarginalian.org/2014/09/18/on-repeat-margulis/), [essai Aeon](https://aeon.co/essays/why-repetition-can-turn-almost-anything-into-music). Utile pour régler le Déjà-vu sur des heures.
- Juliane Kämpfe, Peter Sedlmeier et Frank Renkewitz, « The impact of background music on adult listeners: a meta-analysis », *Psychology of Music* 39(4), 2011. Ce que la musique de fond fait à l'attention et à la mémoire. Une partie de jeu, c'est de l'écoute de fond pendant une tâche.
- Adrian C. North et David J. Hargreaves, *The Social and Applied Psychology of Music*, Oxford University Press, 2008.
- Étude de 2025 : la compréhension de la parole baisse davantage avec une musique familière, chantée ou non. [Indiana](https://acnl.sitehost.iu.edu/pdfs/bl2025.pdf). Argument pour le renouvellement génératif face aux playlists.

---

## 2. La voix du meneur : musique sous la parole

- Matteo Torcoli et al., travaux du Fraunhofer IIS sur les niveaux de ducking préférés à la télévision. Environ 10 LU entre commentaire et musique, au moins 15 LU avec une ambiance. [Salford](https://salford-repository.worktribe.com/OutputFile/1486952). Utilisé pour le mode Sous la voix.
- Université de Salford, revue sur le voice-over-voice : 16 à 23 LU recommandés quand le fond contient de la parole. [Dépôt](https://salford-repository.worktribe.com/OutputFile/1489990)
- ANSI S3.5-1997, *Speech Intelligibility Index* : le poids de chaque bande dans la compréhension de la parole, maximal entre 1 et 4 kHz environ. C'est la bande que le creux « place pour la voix » doit dégager. Utilisé.
- Masquage énergétique et informationnel : une musique qui contient des voix, ou qui ressemble à de la parole, gêne plus qu'un bruit au même niveau. D'où le choix de garder la mélodie rare sous la voix.
- ITU-R BS.1770 (sonie pondérée K) et EBU R128 (niveau cible, plage de sonie, Tech 3341 et 3342). Utilisé pour la normalisation des ambiances.
- W3C, *Media Capture and Streams* (`getUserMedia`, contraintes `echoCancellation`, `noiseSuppression`, `autoGainControl`). Utilisé pour le ducking au micro.

---

## 3. Musique adaptative et musique de jeu

- Karen Collins, *Game Sound: An Introduction to the History, Theory, and Practice of Video Game Music and Sound Design*, MIT Press, 2008. La base théorique du domaine.
- Karen Collins, *Playing with Sound: A Theory of Interacting with Sound and Music in Video Games*, MIT Press, 2013.
- Winifred Phillips, *A Composer's Guide to Game Music*, MIT Press, 2014. Couches verticales, séquences horizontales, transitions. Et son exposé GDC 2021 sur les structures hybrides. [Game Developer](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-)
- Michael Sweet, *Writing Interactive Music for Video Games: A Composer's Guide*, Addison-Wesley, 2014. Points de sortie, stingers, transitions quantifiées. [O'Reilly](https://www.oreilly.com/library/view/writing-interactive-music/9780133563528/). Utilisé pour les enchaînements.
- Tim Summers, *Understanding Video Game Music*, Cambridge University Press, 2016.
- Michiel Kamp, Tim Summers et Mark Sweeney (dir.), *Ludomusicology: Approaches to Video Game Music*, Equinox, 2016.
- Elizabeth Medina-Gray, *Modular Structure and Function in Early 21st-Century Video Game Music*, thèse, Yale, 2014. Comment des modules musicaux se combinent sans couture : la théorie de ce que fait le moteur.
- Richard Stevens et Dave Raybould, *The Game Audio Tutorial*, Focal Press, 2011.
- Michael Z. Land et Peter N. McConnell, iMUSE (LucasArts), brevet US 5 315 057, 1994. Le premier système à attendre un point de sortie musical avant de changer de morceau. Utilisé, dans l'esprit, pour les enchaînements.
- Documentation Audiokinetic Wwise, *Interactive Music* : matrice de transitions, points de sortie, stingers. Documentation FMOD Studio : régions de transition et quantification. Les deux vocabulaires de métier.
- [Wikipédia : Adaptive music](https://en.wikipedia.org/wiki/Adaptive_music)

---

## 4. Le jeu de rôle sur table : outils et usages

- [Syrinscape](https://syrinscape.com/about-syrinscape/) : moteur génératif à base d'échantillons, payant, très riche. Certains joueurs le trouvent trop présent en ligne : c'est le créneau planant de Bourdon.
- [Tabletop Audio](https://siskoid.blogspot.com/2024/03/rpg-tools-tabletop-audio.html) : boucles de dix minutes, gratuites, et un Sound Pad pour superposer.
- Kenku FM : lecteur de l'équipe d'Owlbear Rodeo, pour la table en ligne.
- Michael Ghelfi Studios : ambiances musicales de jeu de rôle très écoutées.
- RPG Sounds, Battlebards, Bardic Tools : autres lecteurs pour meneurs.
- Foundry VTT : [API](https://foundryvtt.com/api/), [listes de lecture](https://foundryvtt.com/article/playlists/), pour mémoire, si l'on relie un jour Bourdon à une table virtuelle : modules [Video Game Music](https://foundryvtt.com/packages/vgmusic), [Crossblade](https://foundryvtt.com/packages/crossblade), [Scene Tracks](https://foundryvtt.com/packages/scene-tracks), [Soundscape](https://github.com/CDeenen/Soundscape/wiki).
- Owlbear Rodeo, SDK des extensions (docs.owlbear.rodeo).

---

## 5. Musique générative et composition algorithmique

### Ouvrages et synthèses

- Gerhard Nierhaus, *Algorithmic Composition: Paradigms of Automated Music Generation*, Springer, 2009. Chaînes de Markov, grammaires, automates cellulaires, systèmes de Lindenmayer, algorithmes génétiques. [Springer](https://link.springer.com/book/9783211999158)
- Jose D. Fernández et Francisco Vico, « AI methods in algorithmic composition: a comprehensive survey », *Journal of Artificial Intelligence Research* 48, 2013. [arXiv](https://arxiv.org/pdf/1402.0585.pdf)
- Dorien Herremans, Ching-Hua Chuan et Elaine Chew, « A functional taxonomy of music generation systems », *ACM Computing Surveys* 50(5), 2017.
- Curtis Roads, *The Computer Music Tutorial*, MIT Press, 1996, 2e éd. 2023. L'encyclopédie.
- Curtis Roads, *Microsound*, MIT Press, 2001. La synthèse granulaire : la référence du nuage de grains et de la Nuée.
- Iannis Xenakis, *Formalized Music*, 1971, éd. augmentée Pendragon, 1992. Processus stochastiques : la base des tirages pondérés.
- David Cope, *Computer Models of Musical Creativity*, MIT Press, 2005.
- Nick Collins, *Introduction to Computer Music*, Wiley, 2010.
- Jean-Pierre Briot, Gaëtan Hadjeres et François-David Pachet, *Deep Learning Techniques for Music Generation*, Springer, 2019. Pour savoir ce que Bourdon choisit de ne pas faire.

### Méthodes précises

- Charles Ames, « The Markov process as a compositional model: a survey and tutorial », *Leonardo* 22(2), 1989. À exploiter : des chaînes de Markov apprises sur de vraies mélodies modales.
- Przemyslaw Prusinkiewicz, « Score generation with L-systems », ICMC, 1986. À exploiter : l'Arbre pousse en fractale, sa mélodie pourrait suivre une grammaire.
- Godfried Toussaint, « The Euclidean algorithm generates traditional musical rhythms », Bridges, 2005, et *The Geometry of Musical Rhythm*, CRC Press, 2013. Utilisé (rythmes euclidiens).
- Eric Bjorklund, « The theory of rep-rate pattern generation in the SNS timing system », note technique SNS, 2003 : l'algorithme d'origine des rythmes euclidiens.
- Tom Whitwell, Turing Machine (Music Thing Modular). Utilisé.
- Émilie Gillet, Marbles (Mutable Instruments), manuel : le Déjà Vu. Utilisé.
- Steve Reich, « Music as a Gradual Process », 1968 (dans *Writings on Music*, Oxford University Press, 2002). Le déphasage : la logique des pendules et des boucles.
- Terry Riley, *In C*, 1964 : des cellules qui se chevauchent librement.

### Eno et la lignée des applications

- Brian Eno, notes de *Ambient 1: Music for Airports*, 1978, et conférence « Generative Music » (1996, transcription dans *In Motion Magazine*). Utilisé (boucles de longueurs premières).
- Brian Eno, *A Year with Swollen Appendices*, Faber, 1996.
- Eric Tamm, *Brian Eno: His Music and the Vertical Color of Sound*, Faber, 1989.
- SSEYO Koan (1994), puis Noatikl (2007) et Wotja (2017), d'Intermorphic. [Historique](https://intermorphic.com/sseyo/koan/)
- Brian Eno et Peter Chilvers, Bloom (2008), Trope, Scape, Reflection (2017). [Bloom](https://en.wikipedia.org/wiki/Bloom_(software))
- [Wikipédia : Generative music](https://en.wikipedia.org/wiki/Generative_music)

### Les pairs dans le navigateur

- Tero Parviainen, *How Generative Music Works* (exposé interactif, 2017) et *JavaScript Systems Music* (Tone.js et Web Audio). [Résumé](https://musicmachinery.com/2019/12/02/how-generative-music-works/)
- Alex Bainter, Generative.fm, et « Making generative music in the browser ». [Medium](https://medium.com/@metalex9/making-generative-music-in-the-browser-bfb552a26b0b)
- Strudel et TidalCycles (Alex McLean) : écrire des motifs qui tournent, dans le navigateur.
- Dillon Bastan, *Inspired by Nature* pour Ableton (Emit, Tree Tone, Bouncy Notes…). Utilisé (Nuée, Arbre, Billes).

---

## 6. Ambient, dark ambient, dungeon synth : la culture des genres

### Ambient

- David Toop, *Ocean of Sound: Aether Talk, Ambient Sound and Imaginary Worlds*, Serpent's Tail, 1995. [Wikipédia](https://en.wikipedia.org/wiki/Ocean_of_Sound)
- David Toop, *Haunted Weather: Music, Silence and Memory*, Serpent's Tail, 2004.
- Mark Prendergast, *The Ambient Century: From Mahler to Trance*, Bloomsbury, 2000. [Wikipédia](https://en.wikipedia.org/wiki/The_Ambient_Century)
- Pauline Oliveros, *Deep Listening: A Composer's Sound Practice*, iUniverse, 2005.
- R. Murray Schafer, *The Soundscape: Our Sonic Environment and the Tuning of the World*, 1977. Tonalité de fond, signaux, marqueurs sonores : exactement les trois rôles du Lieu (murmure, tintements, bruits qui situent). À exploiter.
- Bernie Krause, *The Great Animal Orchestra*, Little, Brown, 2012. Chaque espèce occupe sa bande de fréquences : de quoi ranger les bêtes de Natura sans qu'elles se masquent.

### Dark ambient

- Lustmord : enregistrements dans les cryptes, les grottes et « les lieux sombres de la terre », et un grave que peu d'enceintes restituent. [Red Bull Music Academy](https://daily.redbullmusicacademy.com/2015/10/lustmord-feature), [FACT](https://factmag.com/2010/11/03/lustmord-the-last-heretic/2), [blog Ableton](https://ableton.com/en/blog/lustmord-layers-meaning), [Bandcamp Daily](https://daily.bandcamp.com/lists/lustmord-albums-list)
- Cryo Chamber (label fondé par Simon Heath, Atrium Carceri) et ses collaborations lovecraftiennes annuelles depuis 2014. [Rhan-Tegoth](https://cryochamber.bandcamp.com/album/rhan-tegoth). Utilisé (mixages pensés pour la voix).
- Raison d'être, Kammarheit, Thomas Köner : autres repères du genre.
- [Dark ambient 101](https://www.thisisdarkness.com/2018/03/17/dark-ambient-101/), [Wikipédia](https://en.wikipedia.org/wiki/Dark_ambient)

### Dungeon synth

- Jordan Whiteman, *Dark Dungeon Music: The Unlikely Story of Dungeon Synth*, Cult Never Dies, 2024. Le livre de référence, par le fondateur d'Ancient Meadow Records. [Extrait chez Decibel](https://www.decibelmagazine.com/2024/12/17/read-an-exclusive-excerpt-from-the-new-dark-dungeon-music-the-unlikely-story-of-dungeon-synth-book/), [entretien dans The Quietus](https://thequietus.com/?p=255008), [critique](https://boolintunes.com/?p=26748)
- Andrew Werdna, blog *Dungeon Synth* (2011) : celui qui a donné son nom au genre. [Historique](https://dungeon-synth.neocities.org/history), [sous-genres](https://dungeon-synth.neocities.org/subgenres)
- Robert Newsome, « A Guide Through the Darkened Passages of Dungeon Synth » (2017) et « Back to the Dungeon » (2018), Bandcamp Daily. [1](https://daily.bandcamp.com/2017/03/30/dungeon-synth-list), [2](https://daily.bandcamp.com/2018/04/02/dungeon-synth-2-back-to-the-dungeon)
- [Wikipédia : Dungeon synth](https://en.wikipedia.org/wiki/Dungeon_synth), [Grammy.com : état des lieux](https://www.grammy.com/news/dungeon-synth-scene-report-mortiis-fen-walker-siege-malfet-black-metal), [The Quietus : Organic Intelligence](https://thequietus.com/articles/33615-dungeon-synth-quietus-subscribers), [Invisible Oranges : dungeon synth et chiptune](https://www.invisibleoranges.com/?p=52334)
- Les écoles, telles qu'elles servent de repères aux nouvelles ambiances (chantier 5) :
  - les années 90 sombres, nées du black metal norvégien : Mortiis (première période, sa « dark dungeon music », nourrie de la musique cosmique allemande), Wongraven, Depressive Silence, Summoning (marches lentes et répétitives, cors et chœurs, inspiration tolkienienne). Les albums d'ambient de Burzum appartiennent aussi à cette origine ; leur auteur a été condamné pour meurtre et diffuse des idées d'extrême droite, ce que la scène discute ouvertement ;
  - un précurseur des années 80 : Jim Kirkwood ;
  - le renouveau des années 2010 : Old Tower (lent, caverneux), Fief (chaleureux, médiéval), Erang (nostalgie des jeux de rôle et des jeux vidéo des années 80), Lord Lovidicus, Thangorodrim ;
  - le comfy synth (Hole Dweller et d'autres) : naïf, chaleureux, claviers jouets ; le winter synth : clochettes, scintillements, neige ;
  - les branches plus récentes : dino synth, crypt hop, dungeon synth à la chiptune.
- Le matériel d'origine : claviers Casio et jouets des années 80, banques General MIDI, synthétiseurs à échantillons des années 90 (Korg M1, Roland JV, Ensoniq). Le son « vieux clavier » tient à ces sons d'usine filtrés, pas à la bande magnétique.
- Les cousins : Tangerine Dream et Klaus Schulze (la musique cosmique), Vangelis, Dead Can Dance.

---

## 7. Théorie musicale, harmonie, accordages

### Harmonie et conduite des voix

- Dmitri Tymoczko, *A Geometry of Music: Harmony and Counterpoint in the Extended Common Practice*, Oxford University Press, 2011. Les accords comme points, la conduite des voix comme déplacement. À exploiter pour les nappes.
- Richard Cohn, *Audacious Euphony: Chromatic Harmony and the Triad's Second Nature*, Oxford University Press, 2012. Les transformations P, L et R. [Wikipédia](https://en.wikipedia.org/wiki/Neo-Riemannian_theory)
- Frank Lehman, *Hollywood Harmony: Musical Wonder and the Sound of Cinema*, Oxford University Press, 2018. Les enchaînements chromatiques du merveilleux et de la menace au cinéma : tout ce qui manque pour des accords « épiques » hors du mode. À exploiter.
- Vincent Persichetti, *Twentieth-Century Harmony*, Norton, 1961. Harmonie modale, accords par quartes, pédales.
- Nicole Biamonte, « Triadic modal and pentatonic patterns in rock music », *Music Theory Spectrum* 32(2), 2010. Les boucles i-bVII-bVI et compagnie, celles du dungeon synth.
- Johann Joseph Fux, *Gradus ad Parnassum*, 1725 ; Knud Jeppesen, *Counterpoint: The Polyphonic Vocal Style of the Sixteenth Century*, 1931. Le contrepoint de la voix sous la mélodie.

### Accordages et tempéraments

- J. Murray Barbour, *Tuning and Temperament: A Historical Survey*, 1951.
- Ross W. Duffin, *How Equal Temperament Ruined Harmony (and Why You Should Care)*, Norton, 2007.
- William A. Sethares, *Tuning, Timbre, Spectrum, Scale*, Springer, 2e éd. 2005. La rugosité dépend du spectre : un accordage peut être accordé au timbre (cloches, bols). À exploiter.
- Reinier Plomp et Willem J. M. Levelt, « Tonal consonance and critical bandwidth », *JASA* 38, 1965.
- Archive Scala (Manuel Op de Coul) : des milliers de gammes au format `.scl`. À exploiter : importer une gamme Scala.
- MIDI Tuning Standard et MTS-ESP (ODDSound) : exporter les micro-intervalles sans pitch bend. À exploiter.

### Maqams et makams

- Johnny Farraj et Sami Abu Shumays, *Inside Arabic Music: Arabic Maqam Performance and Theory in the 20th Century*, Oxford University Press, 2019, et leur site maqamworld.com.
- Scott L. Marcus, *Music in Egypt*, Oxford University Press, 2007.
- Habib Hassan Touma, *The Music of the Arabs*, Amadeus Press, 1996.
- Karl Signell, *Makam: Modal Practice in Turkish Art Music*, 1977, et le système Arel-Ezgi-Uzdilek (comma de Holder, 53 divisions de l'octave).
- Le système à 24 quarts de ton est une convention d'écriture, pas l'intonation jouée, qui varie selon l'époque et la région. [Wikipédia](https://en.wikipedia.org/wiki/Arabic_maqam), [guide Ableton des maqams](https://tuning.ableton.com/arabic-maqam/maqam-guide), [mesures en cents, 2026](https://dergipark.org.tr/en/pub/rastmd/article/1932527). À exploiter : des intonations propres à chaque maqam (tierce du Rast vers 27/22, seconde du Bayati plus basse).

### Antiquité grecque

- Martin L. West, *Ancient Greek Music*, Oxford University Press, 1992.
- Stefan Hagel, *Ancient Greek Music: A New Technical History*, Cambridge University Press, 2010.
- Egert Pöhlmann et Martin L. West, *Documents of Ancient Greek Music*, Oxford University Press, 2001 : les hymnes delphiques, l'épitaphe de Seikilos. Utile pour le péan et l'enharmonique.

### Moyen Âge

- Christopher Page, *Voices and Instruments of the Middle Ages: Instrumental Practice and Songs in France 1100-1300*, Dent, 1987.
- Tess Knighton et David Skinner (dir.), *Music and Instruments of the Middle Ages: Essays in Honour of Christopher Page*, Boydell, 2020 (dont Manuel Pedro Ferreira sur les Cantigas, et le chapitre sur les estampies du manuscrit Douce 308). [Cambridge](https://cambridge.org/core/books/music-and-instruments-of-the-middle-ages/estampies-of-douce-308/008263550B9DB54DFA8C1178D7F119D9)
- Timothy J. McGee, *Medieval Instrumental Dances*, Indiana University Press, 1989. Les estampies et les saltarelles notées : des formes de danse exactes pour Chorea et Tripudium. À exploiter.
- Richard H. Hoppin, *Medieval Music*, Norton, 1978.
- Johannes de Grocheio, *De musica*, vers 1300 : la seule description d'époque de l'estampie et de la ductia.
- Guido d'Arezzo, *Micrologus*, vers 1026 (hexacorde, utilisé) ; *Musica enchiriadis*, IXe siècle (organum, utilisé).
- *Liber Usualis*, Solesmes, 1961 : les airs grégoriens du Dies irae, du Kyrie, de l'Agnus Dei. Utilisé (plain-chant).
- Sources jouables : *Cantigas de Santa Maria* (XIIIe siècle), *Llibre Vermell de Montserrat* (XIVe siècle), *Carmina Burana*, la *Symphonia* de Hildegard de Bingen.
- Interprètes qui servent d'oreille : Ensemble Organum (Marcel Pérès), Sequentia, Hespèrion XXI (Jordi Savall), Clemencic Consort, Estampie.

---

## 8. Synthèse et traitement du signal

### Modèles physiques

- Julius O. Smith III, *Physical Audio Signal Processing*, W3K, 2010, libre en ligne. [CCRMA](https://ccrma.stanford.edu/~jos/pasp). Utilisé (guides d'onde). À exploiter : vielle à roue et cornemuse.
- Julius O. Smith III, *Introduction to Digital Filters*, *Spectral Audio Signal Processing*, *Mathematics of the DFT*, libres sur le même site.
- Kevin Karplus et Alex Strong, « Digital synthesis of plucked-string and drum timbres », *Computer Music Journal* 7(2), 1983 ; David A. Jaffe et Julius O. Smith, « Extensions of the Karplus-Strong plucked-string algorithm », même revue, 1983. Utilisé.
- Michael E. McIntyre, Robert T. Schumacher et James Woodhouse, « On the oscillations of musical instruments », *JASA* 74(5), 1983. Utilisé (archet, anche).
- Perry R. Cook et Gary P. Scavone, *The Synthesis ToolKit (STK)*, 1999. Utilisé (clarinette de l'aulos).
- Perry R. Cook, *Real Sound Synthesis for Interactive Applications*, A K Peters, 2002. Synthèse modale et sons procéduraux temps réel.
- Stefan Bilbao, *Numerical Sound Synthesis*, Wiley, 2009.
- Jean-Marie Adrien, « The missing link: modal synthesis », dans De Poli, Piccialli et Roads (dir.), *Representations of Musical Signals*, MIT Press, 1991. Utilisé (cloches, bols).

### Sons procéduraux

- Andy Farnell, *Designing Sound*, MIT Press, 2010. Feu, pluie, vent, eau, animaux, en Pure Data. [Chapitre pluie et vent](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical15.html), [entretien](https://designingsound.org/2012/01/18/procedural-audio-interview-with-andy-farnell/). À exploiter : feu et pluie vraiment procéduraux.
- Revue de l'audio procédural, Queen Mary University of London, 2023. [PDF](https://www.eecs.qmul.ac.uk/~josh/documents/2023/Procedural%20audio%20review.pdf)

### Réverbération

- Manfred R. Schroeder, « Natural sounding artificial reverberation », *JAES* 10(3), 1962.
- James A. Moorer, « About this reverberation business », *Computer Music Journal* 3(2), 1979.
- Jean-Marc Jot et Antoine Chaigne, « Digital delay networks for designing artificial reverberators », 90e convention AES, 1991. Les réseaux de délais rebouclés (FDN). À exploiter.
- Jon Dattorro, « Effect Design, Part 1: Reverberator and Other Filters », *JAES* 45(9), 1997. Utilisé.
- Vesa Välimäki, Julian D. Parker, Lauri Savioja, Julius O. Smith et Jonathan S. Abel, « Fifty Years of Artificial Reverberation », *IEEE Transactions on Audio, Speech, and Language Processing* 20(5), 2012. [DOI](https://doi.org/10.1109/TASL.2012.2189567)
- Les mêmes, « More Than 50 Years of Artificial Reverberation », AES, 2016 : bruit velours, réseaux de diffusion, réverbération modale. [AES](https://aes2.org/publications/elibrary-page/?id=18061)
- Matti Karjalainen et Hanna Järveläinen, bruit velours, AES, 2007 ; réverbération par bruit velours entrelacé. [Aalto](https://acris.aalto.fi/ws/portalfiles/portal/94807831/Late_Reverberation_Synthesis_Using_Interleaved_Velvet_Noise_Sequences.pdf). À exploiter : une réverbération plus légère sur téléphone.

### Oscillateurs, effets, synthèse

- John Chowning, « The synthesis of complex audio spectra by means of frequency modulation », *JAES* 21(7), 1973. Utilisé (FM).
- Tim Stilson et Julius O. Smith, « Alias-free digital synthesis of classic analog waveforms », ICMC, 1996 ; Vesa Välimäki et Antti Huovilainen, « Antialiasing oscillators in subtractive synthesis », *IEEE Signal Processing Magazine*, 2007. À exploiter pour le synthé de Forger.
- Udo Zölzer (dir.), *DAFX: Digital Audio Effects*, Wiley, 2e éd. 2011.
- Joshua D. Reiss et Andrew McPherson, *Audio Effects: Theory, Implementation and Application*, CRC Press, 2014.
- Will Pirkle, *Designing Software Synthesizer Plug-ins in C++*, Focal Press, 2014, et *Designing Audio Effect Plugins in C++*, 2e éd. 2019.
- Miller Puckette, *The Theory and Technique of Electronic Music*, World Scientific, 2007, libre en ligne.
- Eberhard Zwicker et Hugo Fastl, *Psychoacoustics: Facts and Models*, Springer, 3e éd. 2007.

### Web Audio

- W3C, *Web Audio API* (spécification) et AudioWorklet ; Hongchan Choi, « AudioWorklet: the future of web audio », ICMC, 2018.
- Boris Smus, *Web Audio API*, O'Reilly, 2013.
- Tone.js : à connaître, même si Bourdon s'en passe.

---

## 9. Méthode : évaluer une musique générative

Les ambiances sont réglées et mesurées, pas écoutées à l'aveugle. C'est le trou de méthode le plus important.

- Søren Bech et Nick Zacharov, *Perceptual Audio Evaluation: Theory, Method and Application*, Wiley, 2006.
- ITU-R BS.1534 (MUSHRA) et BS.1116 : les protocoles d'écoute comparée.
- Li-Chia Yang et Alexander Lerch, « On the evaluation of generative models in music », *Neural Computing and Applications* 32, 2020.
- Anna Jordanous, « A standardised procedure for evaluating creative systems (SPECS) », *Cognitive Computation* 4(3), 2012.
- Teresa M. Amabile, la technique d'évaluation consensuelle par des juges du domaine (1982), souvent reprise pour la musique générée.
- Ableton, *Learning Music* et *Learning Synths* (learningmusic.ableton.com) : la pédagogie dont le Studio s'inspire.
- WCAG 2.2 pour l'accessibilité de l'interface.

---

## Chantiers

Classés par utilité à la table. Les vingt premiers sont traités (deux retirés), puis six de plus (22 à 27).

### Faits

1. Sous la voix et ducking au micro. Un mode qui place la musique environ 10 LU sous une voix de meneur, creuse la bande de la parole (1 à 4 kHz) et raréfie la mélodie ; et, au choix, l'écoute du micro : la musique s'efface quand le meneur parle et revient quand il se tait. Rien n'est enregistré ni envoyé. Sources : Torcoli et al., ANSI S3.5, Media Capture.
2. Affectus sur valence et éveil. Chaque émotion a une place sur le cercle de Russell ; choisir des émotions règle le tempo, le registre, la densité, la lumière, l'articulation et la tension, d'après Gabrielsson et Lindström et Eerola, Friberg et Bresin. La gamme reste le premier choix (le mode est l'indice le plus fort), le poids de la tonalité tombe de 35 % à 10 %. Sources : section 1.
3. Enchaînements musicaux. Un changement d'ambiance peut attendre la prochaine mesure, la fin de la phrase ou le retour sur la tonique, et se ponctuer d'un stinger (cloche, timbale, souffle, accord). Sources : Sweet, Phillips, Wwise et FMOD, iMUSE.
4. Module Foundry VTT et télécommande : faits puis retirés, pour se concentrer d'abord sur la musique. On pourra les reprendre dans l'historique du dépôt.
5. Le dungeon synth élargi. Six ambiances qui couvrent les écoles du genre au lieu d'un seul album : les années 90 sombres, la marche épique, la tour caverneuse, le fief chaleureux, le comfy synth et la nostalgie des vieux jeux. Sources : Whiteman, Werdna, Newsome, section 6.

6. Banc d'écoute et notes en séance. Pendant la partie, « Ça porte » et « Ça distrait » notent l'instant avec la scène, la tension et les émotions. Le banc à l'aveugle rend deux versions d'une même pièce (même graine, une seule différence), les égalise en niveau, les présente en A et B dans un ordre tiré au sort, et fait le bilan par comparaison avec un test du signe. Export CSV, protocole dans [ECOUTE.md](ECOUTE.md). Sources : Bech et Zacharov, MUSHRA, SPECS. L'écoute avec des meneurs reste à faire : l'outil est prêt.
7. Extension Owlbear Rodeo : faite puis retirée, pour la même raison.
8. Geste Surprise : un silence brusque d'un ou deux temps, un accord hors de la gamme frappé fort (bVI majeur en calme, pôle hexatonique mineur en tension), et la cadence suivante évitée (le retour à la tonique remplacé par le sixième degré). Source : Huron.
9. Tension harmonique : la tension choisit aussi les accords. Leur distance à la tonique (quintes entre les fondamentales, changement de couleur, accord diminué) pèse dans le tirage : loin en tension, près au calme ; la tension ajoute la septième, le calme la remplace par l'octave, et l'harmonie idiomatique cède la moitié de sa place en tension forte. Mesuré : 0,83 quinte de distance moyenne à tension 0,1, 1,31 à tension 0,9. Sources : Lerdahl, Lerdahl et Krumhansl.
10. Harmonie de cinéma : médiantes chromatiques (bVI, III, bIII, VI) et majeur sur la même fondamentale pour le merveilleux ; mineur sur la même fondamentale, pôle hexatonique et triton pour la menace ; ou selon la tension. Un accord sur huit environ par défaut, toujours relié au précédent ; la mélodie, les boucles et la basse suivent. Les émotions féeriques ou majestueuses l'appellent, les inquiétantes ou tragiques aussi. Sources : Lehman, Cohn.

11. Jeu expressif : règles KTH (aigu plus fort, charge mélodique, contraste des durées, souffle avant les sauts, fin de phrase retenue) sur la mélodie et l'arpège, sans changer les notes. Sources : Friberg, Bresin et Sundberg ; Sundberg pour la charge mélodique.
12. Accordage turc Arel-Ezgi-Uzdilek (53 commas), import de gammes Scala, MIDI à la hauteur exacte pour tous les accordages, en pitch bend ou en MTS. Les mesures de la pratique arabe restent proches des 24 quarts de ton égaux (tierce du Rast vers 351 cents, [Rast Musicology Journal](https://dergipark.org.tr/en/download/article-file/5923425)) : le tempérament égal les rend déjà. Sources : Signell, Farraj et Abu Shumays, archive Scala, MIDI Tuning Standard.
13. Feu, vent et pluie procéduraux dans un processeur audio, sans boucle, aux niveaux de l'ancien lieu. Source : Farnell ; van den Doel pour la bulle.
14. Réverbération du mode économe : le réseau à 8 lignes à retard bouclées existait déjà (la « vivante ») et c'est la moins chère mesurée ; le mode économe l'utilise maintenant pour toutes les réverbérations. Le bruit velours n'a pas été nécessaire. Avec la caisse de résonance partagée des cordes pincées, c'est la réponse aux saccades sur téléphone. Sources : Jot et Chaigne, Välimäki et al.
15. Estampie et saltarelle : puncta repris, fins ouverte et close communes, rythme sautillant pour la saltarelle ; ambiances Estampida et Saltarellus. Sources : Grocheio, McGee.

16. Lieu en trois rôles : fond continu ; signaux (bêtes, oiseaux) placés dans les silences de la mélodie et dans leur bande de fréquences ; marqueurs par univers. Sources : Schafer, Krause.
17. Mélodie par chaîne de Markov d'ordre 2 apprise sur un petit corpus d'airs anciens notés en degrés (logique « Corpus »). Source : Ames.
18. Grammaire de Lindenmayer pour la ramure de l'arbre, et lecture d'une branche dans l'ordre de la grammaire. Source : Prusinkiewicz.
19. Vielle à roue (mélodie, bourdons et chien) et cornemuse (chalumeau) en modèle physique. Source : Smith pour les guides d'onde.
20. Émotions revues avec GEMS : tendre, puissant, transcendant ajoutés. Source : Zentner, Grandjean et Scherer.

22. Leitmotiv : un motif par personnage, lieu ou faction, gravé, tiré ou écrit, qui suit la table et revient transformé selon la scène (apaisé, menaçant, tendu, glorieux, lointain). Sources : Phillips, Summers, section 3.
23. Juste adaptatif : chaque accord pur sur sa fondamentale, chaque fondamentale pure sur la tonique du bourdon. Sources : Barbour, Duffin ; le Hermode Tuning pour l'idée.
24. Résonateur modal (frappé, frotté, cordes sympathiques). Sources : Adrien ; Rings et Elements de Mutable Instruments (Émilie Gillet).

25. Tintinnabuli : une voix qui ne joue que l'accord de tonique sous la mélodie. Source : Paul Hillier, *Arvo Pärt*, Oxford University Press, 1997.
26. Isorythmie : couleur et talea de longueurs premières entre elles. Sources : Hoppin, *Medieval Music* ; Machaut et Vitry.
27. Série harmonique du bourdon : partiels 2 à 12 qui entrent et sortent lentement. Sources : La Monte Young, *The Well-Tuned Piano* ; Éliane Radigue.

### À faire, par ordre d'utilité

21. Mesure de la fatigue : un test qui rend une heure et compte les phrases réentendues, les motifs qui reviennent trop, la variété des accords (Margulis).
