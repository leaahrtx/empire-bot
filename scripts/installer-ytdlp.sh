#!/bin/sh
# Installe ou met à jour le binaire yt-dlp autonome dans bin/.
# Ces versions embarquent leur propre Python : rien à installer sur le système.
# À relancer de temps en temps, YouTube casse régulièrement les vieilles versions.
set -e

racine=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$racine/bin"

# Le binaire diffère selon la machine : indispensable pour que le projet
# fonctionne aussi bien en local (macOS) que sur un hébergeur (Linux).
case "$(uname -s)" in
  Darwin) fichier=yt-dlp_macos ;;
  Linux)
    case "$(uname -m)" in
      aarch64 | arm64) fichier=yt-dlp_linux_aarch64 ;;
      armv7l) fichier=yt-dlp_linux_armv7l ;;
      *) fichier=yt-dlp_linux ;;
    esac
    ;;
  *)
    echo "Système non géré : $(uname -s). Installe yt-dlp manuellement dans bin/yt-dlp." >&2
    exit 1
    ;;
esac

echo "Téléchargement de $fichier…"
curl -fL --progress-bar \
  -o "$racine/bin/yt-dlp" \
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/$fichier"

chmod +x "$racine/bin/yt-dlp"
echo "yt-dlp $("$racine/bin/yt-dlp" --version) installé dans bin/"
