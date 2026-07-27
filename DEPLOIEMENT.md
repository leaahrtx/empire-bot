# Déploiement sur Fly.io

Le bot tourne dans une microVM Linux : `ffmpeg`, `yt-dlp` et la connexion vocale
fonctionnent comme en local. Compter environ 3 à 4 $/mois pour la machine
512 Mo, plus quelques centimes de volume.

## 1. Installer flyctl

```sh
curl -L https://fly.io/install.sh | sh
```

Ajoute la ligne `export PATH="$HOME/.fly/bin:$PATH"` à ton `~/.zshrc`, puis
ouvre un nouveau terminal.

```sh
fly auth signup   # ou « fly auth login » si tu as déjà un compte
```

Une carte bancaire est nécessaire : le tier gratuit permanent n'existe plus
depuis 2024, il reste 5 $ de crédits d'essai.

## 2. Créer l'application

Depuis le dossier du projet :

```sh
fly apps create empire-bot-leaahrtx
```

Si le nom est déjà pris, choisis-en un autre et corrige la ligne `app = ` dans
`fly.toml`.

## 3. Créer le volume persistant

Sans lui, `data/anniversaires.json` serait remis à zéro à chaque déploiement.

```sh
fly volumes create empire_data --size 1 --region ams
```

## 4. Déclarer les secrets

Ces valeurs ne doivent jamais entrer dans le dépôt ni dans l'image Docker.
Remplace les trois valeurs par les tiennes, celles de ton `.env` local :

```sh
fly secrets set DISCORD_TOKEN=xxx CLIENT_ID=xxx GUILD_ID=xxx
```

Fly les injecte comme variables d'environnement. Le code lit `process.env`, et
`dotenv` n'écrase jamais une variable déjà définie : le même code fonctionne
donc en local avec `.env` et sur Fly avec les secrets.

## 5. Déployer

```sh
fly deploy
```

La construction se fait chez Fly. Elle compile l'encodeur Opus et télécharge la
version Linux de yt-dlp — ton `bin/` local (macOS) est volontairement exclu.

`fly deploy` envoie le dossier local et non le contenu Git : les images de
`/gaydar`, absentes du dépôt, partent bien dans l'image.

## 6. Vérifier

```sh
fly logs
```

Tu dois voir l'enregistrement des commandes, puis `Connecté en tant que …`, puis
les deux lignes de planification (anniversaires et météo).

```sh
fly status
```

## Au quotidien

| Besoin | Commande |
| --- | --- |
| Publier une modification | `fly deploy` |
| Voir les journaux en direct | `fly logs` |
| Redémarrer | `fly apps restart empire-bot-leaahrtx` |
| Ouvrir un shell dans la machine | `fly ssh console` |
| Changer un secret | `fly secrets set CLE=valeur` |
| Suivre la dépense | `fly dashboard` |

### Mettre à jour yt-dlp

YouTube casse régulièrement les anciennes versions. Le binaire étant retéléchargé
à chaque construction, il suffit de redéployer :

```sh
fly deploy --no-cache
```

### Sauvegarder les anniversaires

```sh
fly ssh console -C "cat /app/data/anniversaires.json" > sauvegarde.json
```

## Points de vigilance

- **Ne jamais ajouter de section `[http_service]`** dans `fly.toml`. Le bot
  n'expose aucun port, et cette section activerait l'arrêt automatique pour
  inactivité : les annonces planifiées ne partiraient plus.
- **Mémoire.** 512 Mo couvrent la lecture musicale, qui fait tourner ffmpeg en
  parallèle de Node. Si les journaux montrent un `out of memory`, passe à
  `1gb` dans `fly.toml` puis redéploie.
- **Fuseau horaire.** Le code passe explicitement `Europe/Paris` aux
  planifications et aux calculs de dates : le fuseau de la machine n'a donc
  aucune influence sur l'heure des annonces.
- **Le conteneur tourne en root**, ce qui est nécessaire pour écrire sur le
  volume monté par Fly. Chaque machine étant une microVM isolée, c'est sans
  conséquence ici.

## YouTube et les IP de centres de données

Depuis 2026, YouTube exige un jeton de preuve d'origine (PO Token) pour les
requêtes venant d'un hébergeur. Sans lui, `/play` échoue avec
« Sign in to confirm you're not a bot », alors que la même commande fonctionne
depuis chez toi.

L'image règle ça de deux façons :

- **Moteur JavaScript.** yt-dlp n'active que `deno` par défaut, absent de
  l'image. On lui passe `--js-runtimes node`, déjà présent, sans quoi
  l'extraction est dégradée et la détection anti-robot bien plus fréquente.
- **Fournisseur de jetons.** `bgutil-ytdlp-pot-provider` tourne dans le
  conteneur sur `127.0.0.1:4416`, jamais exposé à l'extérieur. L'extension
  yt-dlp l'interroge automatiquement.

Les deux se lancent seuls via `scripts/demarrer.sh`. Pour vérifier que le
fournisseur répond :

```sh
flyempire logs | grep -i "fournisseur\|bgutil"
```

Si `/play` échoue toujours, l'IP de la machine est probablement grillée. Un
redéploiement dans une autre région en change souvent :

```sh
flyempire deploy --no-cache
```
