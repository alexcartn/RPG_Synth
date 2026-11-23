# Bourdon pour Owlbear Rodeo

Une extension Owlbear Rodeo qui pilote Bourdon : chaque scène garde son ambiance (ou ses émotions et sa tension), et le meneur joue en direct la tension, les gestes et le mode Sous la voix.

## Installer

Dans Owlbear Rodeo, profil, Extensions, Ajouter une extension, coller l'adresse du manifeste :

```
https://alexcartn.github.io/RPG_Synth/owlbear/manifest.json
```

Puis l'activer dans la salle.

## Utiliser

- Ouvre l'extension (l'icône de note dans la barre du haut), puis « Ouvrir ou relier Bourdon » : Bourdon s'ouvre dans sa propre fenêtre. Clique une fois dedans pour autoriser le son. Le navigateur doit autoriser les fenêtres pour Owlbear Rodeo.
- Cette scène : une ambiance (Crypta, Vigilia…), ou des émotions et un univers, et une tension. « Garder pour cette scène » les range dans la scène, pour toutes les parties suivantes.
- « Jouer l'ambiance de la scène dès qu'elle change » : quand l'extension est ouverte et qu'on change de scène, ou qu'on modifie son ambiance, Bourdon la joue, avec le point de sortie et le signal choisis dans Bourdon (Séance, Transitus).
- En direct : la tension, les gestes (suspense, révélation, apaisement, surprise), et Sous la voix.
- Fermer l'extension ne coupe pas la musique. En la rouvrant, « Ouvrir ou relier Bourdon » retrouve la fenêtre déjà ouverte sans la recharger.

## Ce qu'il faut savoir

- La musique sonne sur l'ordinateur du meneur. Pour une partie en ligne, partage le son par le logiciel de voix. Les joueurs voient seulement un message qui le dit.
- Owlbear Rodeo ne laisse pas une extension ouvrir une fenêtre sans un clic : au début de la partie, il faut cliquer « Ouvrir ou relier Bourdon ». Les changements de scène sont suivis tant que la fenêtre de l'extension est ouverte ; sinon, l'ambiance de la nouvelle scène se joue quand on rouvre l'extension.
- L'extension est publiée sur le même site que Bourdon : Bourdon accepte ses ordres parce qu'ils viennent de son propre site. Les ordres sont ceux de la télécommande, décrits dans [foundry/README.md](../foundry/README.md).
- Testé avec une imitation du SDK d'Owlbear Rodeo (version 3.1), pas encore dans une vraie salle.
