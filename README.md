# Empire — bot Discord

Musique YouTube, anniversaires (rôle + annonce + événements), météo
quotidienne et hebdomadaire, et `/gaydar`.

## Commandes

| Commande | Effet |
| --- | --- |
| `/aide [commande]` | Liste toutes les commandes, ou détaille l'une d'elles |
| `/play <lien ou recherche>` | Joue une vidéo, une playlist, ou cherche sur YouTube |
| `/skip` | Passe à la piste suivante |
| `/stop` | Vide la file et quitte le vocal |
| `/queue` | Affiche la file d'attente |
| `/anniversaire definir <jour> <mois> [année] [membre]` | Enregistre un anniversaire, le sien ou celui d'un membre |
| `/anniversaire voir [membre]` | Affiche un anniversaire et le prochain passage |
| `/anniversaire liste` | Les prochains anniversaires du serveur |
| `/anniversaire supprimer [membre]` | Efface un anniversaire |
| `/anniversaire verifier` | Relance le passage quotidien (admin) |
| `/meteo [ville] [jours]` | Prévisions sur 1 à 16 jours (7 par défaut) |
| `/annonce <type>` | Publie tout de suite une annonce météo planifiée (admin) |
| `/villeconin` | Météo de Villeconin pour la semaine 32 |
| `/gaydar <membre>` | Scanne un membre et renvoie une image au hasard |
| `/ping` | Test de vie |

## Installation

```sh
npm install
npm run ytdlp     # télécharge le binaire yt-dlp dans bin/
```

`ffmpeg` et l'encodeur Opus arrivent par npm : rien à installer sur le système.

### 1. Fichier `.env`

Copie `.env.example` en `.env` et remplis `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`.

### 2. Portail développeur Discord

Onglet **Bot** → *Privileged Gateway Intents* → active **SERVER MEMBERS INTENT**.
Sans lui, le bot ne peut pas attribuer les rôles d'anniversaire.

### 3. Inviter le bot avec les bonnes permissions

```
https://discord.com/api/oauth2/authorize?client_id=TON_CLIENT_ID&permissions=8861764608&scope=bot%20applications.commands
```

Ce total couvre : voir/écrire dans les salons, joindre des fichiers, intégrer des
liens, mentionner `@here`, se connecter et parler en vocal, gérer les rôles,
gérer les événements.

### 4. Côté serveur Discord

- Crée un rôle nommé **Joyeux anniversaire** (le nom est réglable dans `config.js`).
- Dans *Paramètres du serveur → Rôles*, place le rôle du bot **au-dessus** de
  celui-ci, sinon Discord refuse l'attribution.
- Vérifie qu'un salon **general** existe (nom réglable aussi).

### 5. Images du `/gaydar`

Dépose des `.png`, `.jpg`, `.gif` ou `.webp` dans `assets/gaydar/`.
Le bot en pioche une au hasard à chaque appel.

### 6. Lancer

```sh
npm run deploy    # enregistre les commandes (à relancer après tout ajout)
npm start
```

## Fonctionnement des anniversaires

Un passage automatique a lieu chaque jour à l'heure définie dans `config.js`
(9 h, fuseau `Europe/Paris`), plus un passage au démarrage du bot :

1. le rôle est attribué aux membres dont c'est l'anniversaire ;
2. il est retiré à ceux dont l'anniversaire est terminé ;
3. un message est publié dans le salon d'annonce ;
4. un événement Discord est créé pour la prochaine occurrence de chaque
   anniversaire enregistré.

Les événements sont ponctuels et recréés automatiquement chaque année après leur
passage. Un anniversaire au 29 février est fêté le 28 les années non bissextiles.

N'importe qui peut renseigner l'anniversaire d'un autre membre avec l'option
`membre`. Pour réserver ça aux modérateurs, mets `ajoutParTous: false` dans
`config.js` : il faudra alors la permission « Gérer le serveur ». Chacun reste
toujours libre de renseigner ou d'effacer le sien. `/anniversaire voir` indique
qui a renseigné une date quand ce n'est pas la personne elle-même.

Les dates sont stockées dans `data/anniversaires.json`, exclu de git.

## Météo

Les données viennent d'[Open-Meteo](https://open-meteo.com) : gratuit, sans clé
API ni inscription, donc rien à ajouter dans `.env`.

Chaque jour à 8 h, le bot publie la météo du jour pour les villes configurées
(Caen, Paris, Toulouse, Saint-Brieuc, Pouxeux), et chaque lundi à 8 h les
prévisions de la semaine. Villes, salon, jours et heures se règlent dans `config.js`.

## Hébergement

Le bot doit tourner en permanence pour que les annonces planifiées partent.
Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) pour la mise en ligne sur Fly.io
(`Dockerfile` et `fly.toml` sont déjà prêts).

Variable facultative : `DEPLOY_AU_DEMARRAGE=1` enregistre les commandes auprès
de Discord à chaque démarrage, ce qui évite d'avoir à lancer `npm run deploy`
là où l'on n'a pas d'accès en ligne de commande.

## Maintenance

YouTube casse régulièrement les anciennes versions de yt-dlp. Si `/play` ne
répond plus :

```sh
npm run ytdlp
```

## Structure

```
config.js              réglages (fuseau, noms de rôle/salon, heure, délais)
index.js               démarrage, routage des commandes, tâche quotidienne
deploy-commands.js     enregistrement des commandes auprès de Discord
commands/              une commande par fichier, chargées automatiquement
lib/musique.js         file d'attente, connexion vocale, streaming yt-dlp
lib/anniversaires.js   calcul des dates, rôles, annonces, événements
lib/meteo.js           géocodage, prévisions Open-Meteo, annonces planifiées
lib/salon.js           résolution d'un salon par nom ou identifiant
lib/store.js           persistance JSON
lib/chargeur.js        découverte des commandes
scripts/               installation de yt-dlp
```

Pour ajouter une commande : crée un fichier dans `commands/` exportant
`{ data, execute }` par défaut, puis relance `npm run deploy`.

Champs facultatifs de cet export :

- `categorie` — rubrique sous laquelle `/aide` range la commande
  (`Musique`, `Anniversaires`, `Météo`, `Fun`, `Divers`, ou un nouveau nom).
  Sans ce champ, la commande atterrit dans « Divers ».
- `autocomplete(interaction)` — suggestions pendant la frappe, pour les options
  déclarées avec `.setAutocomplete(true)`.

`/aide` se construit toute seule à partir des commandes chargées : une nouvelle
commande y apparaît sans qu'il y ait quoi que ce soit à modifier.
