#!/bin/sh
# Point d'entrée du conteneur : lance le fournisseur de jetons puis le bot.
#
# Le fournisseur tourne en tâche de fond sur 127.0.0.1:4416, où l'extension
# yt-dlp le cherche par défaut. Il n'est jamais exposé à l'extérieur.
set -e

if [ -f /pot/server/build/main.js ]; then
  echo "Démarrage du fournisseur de jetons (port 4416)…"
  node /pot/server/build/main.js &
  fournisseur=$!

  # Si le bot s'arrête, l'hébergeur redémarre la machine entière : inutile de
  # laisser le fournisseur survivre seul.
  trap 'kill "$fournisseur" 2>/dev/null' EXIT INT TERM
else
  echo "Fournisseur de jetons absent : YouTube risque de refuser les requêtes." >&2
fi

exec node index.js
