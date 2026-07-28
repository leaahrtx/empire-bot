import { EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { resoudreSalon } from './salon.js';

// Open-Meteo : gratuit, sans clé API, sans inscription.
const API_GEOCODAGE = 'https://geocoding-api.open-meteo.com/v1/search';
const API_PREVISIONS = 'https://api.open-meteo.com/v1/forecast';

// Codes météo WMO renvoyés par l'API.
const CODES = {
  0: ['☀️', 'Ciel dégagé'],
  1: ['🌤️', 'Plutôt dégagé'],
  2: ['⛅', 'Partiellement nuageux'],
  3: ['☁️', 'Couvert'],
  45: ['🌫️', 'Brouillard'],
  48: ['🌫️', 'Brouillard givrant'],
  51: ['🌦️', 'Bruine légère'],
  53: ['🌦️', 'Bruine'],
  55: ['🌦️', 'Bruine dense'],
  56: ['🌧️', 'Bruine verglaçante'],
  57: ['🌧️', 'Bruine verglaçante dense'],
  61: ['🌦️', 'Pluie faible'],
  63: ['🌧️', 'Pluie'],
  65: ['🌧️', 'Pluie forte'],
  66: ['🌧️', 'Pluie verglaçante'],
  67: ['🌧️', 'Pluie verglaçante forte'],
  71: ['🌨️', 'Neige faible'],
  73: ['🌨️', 'Neige'],
  75: ['❄️', 'Neige abondante'],
  77: ['🌨️', 'Grains de neige'],
  80: ['🌦️', 'Averses éparses'],
  81: ['🌧️', 'Averses'],
  82: ['⛈️', 'Averses violentes'],
  85: ['🌨️', 'Averses de neige'],
  86: ['❄️', 'Fortes averses de neige'],
  95: ['⛈️', 'Orage'],
  96: ['⛈️', 'Orage et grêle'],
  99: ['⛈️', 'Orage et forte grêle'],
};

function decrire(code) {
  return CODES[code] ?? ['❔', 'Conditions inconnues'];
}

async function recuperer(url) {
  // Sans limite de temps, une API muette bloquerait la commande jusqu'au timeout
  // de Discord ; 10 s laissent la marge pour répondre proprement.
  const reponse = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!reponse.ok) throw new Error(`Open-Meteo a répondu ${reponse.status}`);
  return reponse.json();
}

const cacheLieux = new Map();

/** Convertit un nom de ville en coordonnées. Résultat mis en cache. */
export async function geocoder(ville) {
  const cle = ville.trim().toLowerCase();
  if (cacheLieux.has(cle)) return cacheLieux.get(cle);

  const url = new URL(API_GEOCODAGE);
  url.searchParams.set('name', ville);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'fr');
  url.searchParams.set('format', 'json');

  const donnees = await recuperer(url);
  const trouve = donnees.results?.[0];
  if (!trouve) return null;

  const lieu = {
    nom: trouve.name,
    region: trouve.admin1 ?? null,
    pays: trouve.country ?? null,
    latitude: trouve.latitude,
    longitude: trouve.longitude,
    timezone: trouve.timezone ?? config.timezone,
  };
  cacheLieux.set(cle, lieu);
  return lieu;
}

export async function previsions(lieu, jours = 7) {
  const url = new URL(API_PREVISIONS);
  url.searchParams.set('latitude', lieu.latitude);
  url.searchParams.set('longitude', lieu.longitude);
  url.searchParams.set('timezone', lieu.timezone);
  url.searchParams.set('forecast_days', String(jours));
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'wind_speed_10m_max',
    ].join(','),
  );

  const donnees = await recuperer(url);
  const d = donnees.daily;

  return d.time.map((date, i) => ({
    date,
    code: d.weather_code[i],
    tempMax: d.temperature_2m_max[i],
    tempMin: d.temperature_2m_min[i],
    probaPluie: d.precipitation_probability_max[i],
    cumulPluie: d.precipitation_sum[i],
    vent: d.wind_speed_10m_max[i],
  }));
}

function nomJour(dateISO, options = { weekday: 'long', day: 'numeric', month: 'short' }) {
  // La date arrive en AAAA-MM-JJ : on la lit en UTC pour éviter tout décalage.
  const libelle = new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(
    new Date(`${dateISO}T12:00:00Z`),
  );
  return libelle.charAt(0).toUpperCase() + libelle.slice(1);
}

export function construireEmbed(lieu, jours, titre = null) {
  const lignes = jours.map((j, index) => {
    const [emoji, description] = decrire(j.code);
    const etiquette = index === 0 ? "Aujourd'hui" : nomJour(j.date);
    const pluie =
      j.probaPluie > 0 ? ` · 💧 ${j.probaPluie}%${j.cumulPluie > 0 ? ` (${j.cumulPluie} mm)` : ''}` : '';
    return (
      `${emoji} **${etiquette}** — ${description}\n` +
      `　${Math.round(j.tempMin)}° / **${Math.round(j.tempMax)}°**${pluie} · 💨 ${Math.round(j.vent)} km/h`
    );
  });

  const localisation = [lieu.nom, lieu.region, lieu.pays].filter(Boolean).join(', ');
  const maxima = Math.max(...jours.map((j) => j.tempMax));

  return new EmbedBuilder()
    .setColor(maxima >= 30 ? 0xed4245 : maxima <= 5 ? 0x5865f2 : 0x57f287)
    .setTitle(titre ?? `Météo — ${lieu.nom}`)
    .setDescription(lignes.join('\n'))
    .setFooter({ text: `${localisation} · données Open-Meteo` })
    .setTimestamp();
}

/**
 * Récupère les prévisions de chaque ville configurée. Une ville en échec est
 * signalée puis ignorée : une commune introuvable ou une API capricieuse ne
 * doit pas faire sauter l'annonce entière.
 */
async function releverVilles(nombreJours) {
  const releves = [];

  for (const ville of config.meteo.villes) {
    try {
      const lieu = await geocoder(ville);
      if (!lieu) {
        console.warn(`[meteo] Ville « ${ville} » introuvable, ignorée.`);
        continue;
      }
      releves.push({ lieu, jours: await previsions(lieu, nombreJours) });
    } catch (error) {
      console.error(`[meteo] Relevé impossible pour « ${ville} » :`, error.message);
    }
  }

  return releves;
}

function construireEmbedJour(releves) {
  const lignes = releves.map(({ lieu, jours: [aujourdhui] }) => {
    const [emoji, description] = decrire(aujourdhui.code);
    const pluie =
      aujourdhui.probaPluie > 0
        ? ` · 💧 ${aujourdhui.probaPluie}%${aujourdhui.cumulPluie > 0 ? ` (${aujourdhui.cumulPluie} mm)` : ''}`
        : '';
    return (
      `${emoji} **${lieu.nom}** — ${description}\n` +
      `　${Math.round(aujourdhui.tempMin)}° / **${Math.round(aujourdhui.tempMax)}°**${pluie} · 💨 ${Math.round(aujourdhui.vent)} km/h`
    );
  });

  const maxima = Math.max(...releves.map((r) => r.jours[0].tempMax));

  return new EmbedBuilder()
    .setColor(maxima >= 30 ? 0xed4245 : maxima <= 5 ? 0x5865f2 : 0x57f287)
    .setTitle(`🌤️ La météo du jour — ${nomJour(releves[0].jours[0].date)}`)
    .setDescription(lignes.join('\n'))
    .setFooter({ text: 'données Open-Meteo' })
    .setTimestamp();
}

function construireEmbedSemaine(releves) {
  // Une ville par champ, une ligne compacte par jour : sur cinq villes, le
  // format détaillé de /meteo dépasserait la limite de taille d'un embed.
  const champs = releves.map(({ lieu, jours }) => ({
    name: `📍 ${lieu.nom}`,
    value: jours
      .map((j) => {
        const [emoji] = decrire(j.code);
        const jourCourt = nomJour(j.date, { weekday: 'short', day: 'numeric' });
        const pluie = j.probaPluie > 0 ? ` 💧${j.probaPluie}%` : '';
        return `${emoji} \`${jourCourt.padEnd(7)}\` ${Math.round(j.tempMin)}° / **${Math.round(j.tempMax)}°**${pluie}`;
      })
      .join('\n'),
    inline: false,
  }));

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🗓️ La météo de la semaine')
    .addFields(champs)
    .setFooter({ text: 'données Open-Meteo' })
    .setTimestamp();
}

/**
 * Publie l'embed dans le salon configuré de chaque serveur, ou d'un seul si
 * guildId est fourni. Renvoie le nombre d'envois réussis, ce qui permet à la
 * commande manuelle de dire si le message est réellement parti.
 */
async function diffuser(client, embed, guildId = null) {
  let envoyes = 0;

  for (const guild of client.guilds.cache.values()) {
    if (guildId && guild.id !== guildId) continue;

    const salon = resoudreSalon(guild, config.meteo.salonAnnonce);
    if (!salon) {
      console.warn(`[meteo] Salon « ${config.meteo.salonAnnonce} » introuvable sur ${guild.name}.`);
      continue;
    }

    const envoye = await salon
      .send({ embeds: [embed] })
      .then(() => true)
      .catch((e) => {
        console.error('[meteo] Envoi :', e.message);
        return false;
      });
    if (envoye) envoyes++;
  }

  return envoyes;
}

/** Météo du jour pour toutes les villes configurées. */
export async function annoncerMeteoJour(client, guildId = null) {
  const releves = await releverVilles(1);
  if (releves.length === 0) {
    throw new Error('aucune ville exploitable (géocodage ou API en échec)');
  }
  return diffuser(client, construireEmbedJour(releves), guildId);
}

/** Prévisions à sept jours pour toutes les villes configurées. */
export async function annoncerMeteoSemaine(client, guildId = null) {
  const releves = await releverVilles(7);
  if (releves.length === 0) {
    throw new Error('aucune ville exploitable (géocodage ou API en échec)');
  }
  return diffuser(client, construireEmbedSemaine(releves), guildId);
}
