# Bourdon pour Foundry VTT

Un module qui pilote Bourdon depuis Foundry VTT (versions 12 et 13). Bourdon s'ouvre dans sa propre fenêtre, chez le meneur, et le module lui envoie des ordres : l'ambiance de la scène active, la tension du combat, les gestes musicaux.

## Installer

Dans Foundry, Modules complémentaires, Installer un module, coller l'adresse du manifeste :

```
https://alexcartn.github.io/RPG_Synth/foundry/module.json
```

Puis activer « Bourdon : ambiances génératives » dans le monde.

## Utiliser

- Bouton Bourdon dans les contrôles de son (la note de musique) : ouvre la fenêtre de Bourdon. Le navigateur doit autoriser les fenêtres pour le site de Foundry. Au premier ordre, clique une fois dans la fenêtre de Bourdon (ou sur « Autoriser le son ») : le navigateur ne laisse pas une page jouer du son sans un geste de la personne.
- Configuration de la scène, onglet Ambiance, bloc Bourdon : le nom d'une ambiance (Crypta, Vigilia, Taberna…), ou à la place des émotions (« mystérieux, sacré ») et un univers (dungeon, dark, medieval…), et une tension de 0 à 1.
- Quand une scène devient active, Bourdon joue son ambiance (réglage « Suivre la scène active »), avec le point de sortie et le signal choisis dans Bourdon (Séance, Transitus).
- Quand un combat commence, la tension monte (0,8 par défaut) et un geste peut partir ; à la fin du combat, la tension revient à celle de la scène et l'apaisement joue.

## Macros

Le module expose `game.bourdon` :

```js
game.bourdon.ambiance("Crypta");             // change d'ambiance et lance la lecture
game.bourdon.emotions(["inquiétant"], "dark"); // part d'émotions, dans un univers
game.bourdon.tension(0.9);
game.bourdon.geste("suspense");               // suspense, revelation, apaisement, danger, poursuite, triomphe
game.bourdon.sousLaVoix(true);                // la musique passe sous la voix du meneur
game.bourdon.volume(0.6);
game.bourdon.arreter();
```

## Ce qu'il faut savoir

- La musique sonne sur l'ordinateur du meneur. À la table, c'est ce qu'on veut. En ligne, il faut partager le son par le logiciel de voix (Discord, par exemple) : Bourdon ne passe pas par les listes de lecture de Foundry, qui ne savent jouer que des fichiers.
- Bourdon n'accepte des ordres que de la fenêtre qui l'a ouvert, et seulement quand la télécommande est permise (le module l'ouvre avec `?telecommande=1`, ou la case Télécommande dans Séance). Les ordres sont limités à la lecture, à l'ambiance, aux émotions, à la tension, aux gestes, au volume et au mode Sous la voix.

## Le protocole, pour d'autres tables virtuelles

N'importe quelle page qui ouvre Bourdon avec `?telecommande=1` peut lui envoyer des messages `postMessage` de la forme `{bourdon: 1, cmd: "…", …}`. Bourdon répond à chaque ordre avec `{bourdon: 1, re: id, ok, etat}` et annonce `{bourdon: 1, pret: true}` quand il est chargé.

| Ordre | Paramètres |
| --- | --- |
| `jouer`, `arreter`, `etat` | aucun |
| `ambiance` | `nom`, `fondu` (secondes, facultatif), `jouer` (vrai pour lancer la lecture) |
| `univers` | `id` |
| `emotions` | `liste` (tableau ou texte séparé par des virgules), `univers` (facultatif) |
| `tension` | `valeur` de 0 à 1 |
| `geste` | `nom`, `ampleur` de 0 à 2 |
| `volume` | `valeur` de 0 à 1,5 |
| `sousLaVoix` | `actif` (vrai, faux, ou absent pour basculer) |

Sans télécommande, une adresse suffit pour ouvrir sur une scène : `?ambiance=Crypta`, `?univers=dark`, `?emotions=mystérieux,sacré`.
