# Image Debian (« slim ») et non Alpine : le binaire fourni par ffmpeg-static
# est lié à la glibc et ne fonctionne pas sur la musl d'Alpine.
FROM node:24-slim AS build

ARG POT_VERSION=1.3.1

# @discordjs/opus est un module natif : sans prebuild disponible pour cette
# version de Node, npm doit pouvoir le compiler. Ces outils restent dans
# l'étape de build et n'alourdissent pas l'image finale.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git unzip python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Le bin/ local contient la version macOS de yt-dlp : on récupère ici celle qui
# correspond à l'architecture de l'image.
COPY scripts/ ./scripts/
RUN sh scripts/installer-ytdlp.sh

# Fournisseur de jetons de preuve d'origine. YouTube en exige un pour les
# requêtes venant d'un centre de données : sans lui, l'extraction échoue avec
# « Sign in to confirm you're not a bot ». Le serveur tourne en local et
# l'extension yt-dlp l'interroge automatiquement.
RUN git clone --depth 1 --branch "${POT_VERSION}" \
      https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /pot \
    && cd /pot/server \
    && npm ci \
    && npx tsc \
    && npm prune --omit=dev

# L'extension doit être posée dans un dossier que yt-dlp inspecte au démarrage.
RUN mkdir -p /root/.config/yt-dlp/plugins \
    && curl -fL -o /tmp/pot.zip \
      "https://github.com/Brainicism/bgutil-ytdlp-pot-provider/releases/download/${POT_VERSION}/bgutil-ytdlp-pot-provider.zip" \
    && unzip -o /tmp/pot.zip -d /root/.config/yt-dlp/plugins \
    && rm /tmp/pot.zip


FROM node:24-slim AS runtime

# ffmpeg-static et yt-dlp joignent des serveurs en HTTPS : sans les certificats
# racine, tout échouerait à l'exécution.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV TZ=Europe/Paris

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/bin ./bin
COPY --from=build /pot/server/build /pot/server/build
COPY --from=build /pot/server/node_modules /pot/server/node_modules
COPY --from=build /root/.config/yt-dlp/plugins /root/.config/yt-dlp/plugins
COPY . .

# Le volume Fly est monté sur /app/data en appartenant à root : basculer sur un
# utilisateur non privilégié rendrait l'écriture des anniversaires impossible.
# Chaque machine Fly étant une microVM isolée, rester root est ici sans risque.
RUN mkdir -p /app/data

CMD ["sh", "scripts/demarrer.sh"]
