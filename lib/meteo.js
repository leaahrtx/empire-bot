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

function nomJour(dateISO, timezone) {
  // La date arrive en AAAA-MM-JJ : on la lit en UTC pour éviter tout décalage.
  const libelle = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${dateISO}T12:00:00Z`));
  return libelle.charAt(0).toUpperCase() + libelle.slice(1);
}

export function construireEmbed(lieu, jours, titre = null) {
  const lignes = jours.map((j, index) => {
    const [emoji, description] = decrire(j.code);
    const etiquette = index === 0 ? "Aujourd'hui" : nomJour(j.date, lieu.timezone);
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

/** Annonce hebdomadaire postée dans le salon configuré de chaque serveur. */
export async function annoncerMeteo(client) {
  const lieu = await geocoder(config.meteo.ville);
  if (!lieu) {
    console.error(`[meteo] Ville « ${config.meteo.ville} » introuvable, annonce annulée.`);
    return;
  }

  const jours = await previsions(lieu, 7);
  const embed = construireEmbed(lieu, jours, `🗓️ La météo de la semaine à ${lieu.nom}`);

  for (const guild of client.guilds.cache.values()) {
    const salon = resoudreSalon(guild, config.meteo.salonAnnonce);
    if (!salon) {
      console.warn(`[meteo] Salon « ${config.meteo.salonAnnonce} » introuvable sur ${guild.name}.`);
      continue;
    }
    await salon.send({ embeds: [embed] }).catch((e) => console.error('[meteo] Envoi :', e.message));
  }
}
