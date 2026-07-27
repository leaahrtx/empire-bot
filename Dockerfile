# Image Debian (« slim ») et non Alpine : le binaire fourni par ffmpeg-static
# est lié à la glibc et ne fonctionne pas sur la musl d'Alpine.
FROM node:24-slim AS build

# @discordjs/opus est un module natif : sans prebuild disponible pour cette
# version de Node, npm doit pouvoir le compiler. Ces outils restent dans
# l'étape de build et n'alourdissent pas l'image finale.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Le bin/ local contient la version macOS de yt-dlp : on récupère ici celle qui
# correspond à l'architecture de l'image.
COPY scripts/ ./scripts/
RUN sh scripts/installer-ytdlp.sh


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
COPY . .

# Le volume Fly est monté sur /app/data en appartenant à root : basculer sur un
# utilisateur non privilégié rendrait l'écriture des anniversaires impossible.
# Chaque machine Fly étant une microVM isolée, rester root est ici sans risque.
RUN mkdir -p /app/data

CMD ["node", "index.js"]
