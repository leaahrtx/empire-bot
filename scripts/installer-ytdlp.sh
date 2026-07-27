#!/bin/sh
# Installe ou met à jour le binaire yt-dlp autonome dans bin/.
# Cette version embarque son propre Python : rien à installer sur le système.
# À relancer de temps en temps, YouTube casse régulièrement les vieilles versions.
set -e

racine=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$racine/bin"

curl -fL --progress-bar \
  -o "$racine/bin/yt-dlp" \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos

chmod +x "$racine/bin/yt-dlp"
echo "yt-dlp $("$racine/bin/yt-dlp" --version) installé dans bin/"
