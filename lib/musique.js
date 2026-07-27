import { spawn } from 'node:child_process';
import { join } from 'node:path';
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from '@discordjs/voice';
import { config } from '../config.js';
import { racineProjet } from './store.js';

// Binaire autonome téléchargé par scripts/installer-ytdlp.sh (embarque son propre Python).
const YTDLP = join(racineProjet, 'bin', 'yt-dlp');

/** Une session par serveur : connexion vocale + lecteur + file d'attente. */
const sessions = new Map();

export function formaterDuree(secondes) {
  if (!secondes || !Number.isFinite(secondes)) return '??:??';
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = Math.floor(secondes % 60);
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/**
 * Interroge yt-dlp. Accepte un lien vidéo, un lien de playlist, ou du texte
 * libre (recherche YouTube). Renvoie une liste de pistes.
 */
export async function chercherPistes(requete) {
  const sortie = await execYtdlp([
    requete,
    '--dump-single-json',
    '--flat-playlist',
    '--default-search',
    'ytsearch1',
    '--no-warnings',
    '--ignore-config',
  ]);

  const info = JSON.parse(sortie);
  const entrees = info._type === 'playlist' ? (info.entries ?? []) : [info];

  return entrees
    .map((e) => e && { entree: e, url: urlCanonique(e) })
    .filter((p) => p?.url)
    .slice(0, config.musique.maxPlaylist)
    .map(({ entree, url }) => ({
      titre: entree.title ?? 'Titre inconnu',
      url,
      duree: entree.duration ?? null,
      auteur: entree.uploader ?? entree.channel ?? null,
    }));
}

/**
 * L'URL de la page YouTube, jamais celle du flux. Sur une extraction complète,
 * `url` pointe vers le CDN googlevideo avec une signature qui expire en
 * quelques heures : la rejouer plus tard échouerait.
 */
function urlCanonique(entree) {
  if (entree.webpage_url) return entree.webpage_url;
  if (entree.id) return `https://www.youtube.com/watch?v=${entree.id}`;
  if (entree.url?.startsWith('http') && !entree.url.includes('googlevideo.com')) return entree.url;
  return null;
}

function execYtdlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += c));
    proc.stderr.on('data', (c) => (stderr += c));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim().split('\n').at(-1) ?? `yt-dlp a échoué (code ${code})`));
    });
  });
}

function creerSession(salonVocal, salonTexte) {
  const connection = joinVoiceChannel({
    channelId: salonVocal.id,
    guildId: salonVocal.guild.id,
    adapterCreator: salonVocal.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
  });
  connection.subscribe(player);

  const session = {
    connection,
    player,
    salonTexte,
    attente: [],
    enCours: null,
    processus: null,
    minuteur: null,
  };
  sessions.set(salonVocal.guild.id, session);

  // Discord peut couper puis rebasculer la connexion (déplacement de salon,
  // coupure réseau) : on laisse 5 s pour reprendre avant d'abandonner.
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      detruireSession(salonVocal.guild.id);
    }
  });

  player.on(AudioPlayerStatus.Idle, () => {
    session.processus = null;
    jouerSuivant(salonVocal.guild.id).catch((e) => console.error('Lecture suivante :', e));
  });

  player.on('error', (error) => {
    console.error('Lecteur audio :', error);
    session.salonTexte?.send(`⚠️ Erreur de lecture sur **${session.enCours?.titre ?? '?'}**, je passe à la suite.`).catch(() => {});
    session.processus = null;
    jouerSuivant(salonVocal.guild.id).catch(() => {});
  });

  return session;
}

export function obtenirSession(guildId) {
  return sessions.get(guildId);
}

export function detruireSession(guildId) {
  const session = sessions.get(guildId);
  if (!session) return;
  clearTimeout(session.minuteur);
  session.attente = [];
  session.processus?.kill('SIGKILL');
  session.player.stop(true);
  if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
    session.connection.destroy();
  }
  sessions.delete(guildId);
}

function programmerInactivite(session, guildId) {
  clearTimeout(session.minuteur);
  session.minuteur = setTimeout(() => {
    session.salonTexte?.send('👋 Personne ne met de musique, je quitte le salon vocal.').catch(() => {});
    detruireSession(guildId);
  }, config.musique.inactiviteMs);
}

async function jouerSuivant(guildId) {
  const session = sessions.get(guildId);
  if (!session) return;

  const piste = session.attente.shift();
  if (!piste) {
    session.enCours = null;
    programmerInactivite(session, guildId);
    return;
  }

  clearTimeout(session.minuteur);
  session.enCours = piste;

  // yt-dlp écrit le flux audio sur sa sortie standard, @discordjs/voice le
  // transcode en Opus via ffmpeg (fourni par le paquet ffmpeg-static).
  const proc = spawn(
    YTDLP,
    [
      piste.url,
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      '--no-progress',
      '--ignore-config',
      '-f',
      'bestaudio[acodec=opus]/bestaudio/best',
      '-o',
      '-',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let erreurFlux = '';
  proc.stderr.on('data', (c) => (erreurFlux += c));
  proc.on('close', (code) => {
    if (code !== 0 && code !== null && erreurFlux) {
      console.error(`yt-dlp (${piste.url}) :`, erreurFlux.trim().split('\n').at(-1));
    }
  });

  session.processus = proc;
  session.player.play(
    createAudioResource(proc.stdout, { inputType: StreamType.Arbitrary }),
  );

  await session.salonTexte
    ?.send(`▶️ **${piste.titre}** — ${formaterDuree(piste.duree)}`)
    .catch(() => {});
}

/** Ajoute des pistes et démarre la lecture si le lecteur est au repos. */
export async function ajouterEtJouer(salonVocal, salonTexte, pistes) {
  const guildId = salonVocal.guild.id;
  let session = sessions.get(guildId);

  if (!session) {
    session = creerSession(salonVocal, salonTexte);
    await entersState(session.connection, VoiceConnectionStatus.Ready, 20_000);
  } else {
    session.salonTexte = salonTexte;
  }

  session.attente.push(...pistes);

  if (session.player.state.status === AudioPlayerStatus.Idle) {
    await jouerSuivant(guildId);
  }
  return session;
}

export function passer(guildId) {
  const session = sessions.get(guildId);
  if (!session?.enCours) return null;
  const passee = session.enCours;
  session.processus?.kill('SIGKILL');
  session.player.stop(true); // déclenche Idle, donc la piste suivante
  return passee;
}
