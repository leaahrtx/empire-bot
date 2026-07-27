import {
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from '../config.js';
import { resoudreSalon } from './salon.js';
import { definirAnniversaire, lireServeur } from './store.js';

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export function nomMois(mois) {
  return MOIS[mois - 1] ?? '?';
}

export function formaterDate({ jour, mois, annee }) {
  return annee ? `${jour} ${nomMois(mois)} ${annee}` : `${jour} ${nomMois(mois)}`;
}

/** Nombre de jours dans un mois (année bissextile incluse). */
export function joursDansMois(mois, annee = 2024) {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** Le jour courant tel que vu depuis le fuseau configuré. */
export function aujourdhui(timezone = config.timezone) {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { jour: +parties.day, mois: +parties.month, annee: +parties.year };
}

/** Décalage (ms) entre le fuseau configuré et UTC à un instant donné. */
function decalage(date, timezone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const commeUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return commeUTC - date.getTime();
}

/** Convertit une date locale (fuseau configuré) en instant UTC. */
function versUTC(annee, mois, jour, heure, timezone = config.timezone) {
  const candidat = Date.UTC(annee, mois - 1, jour, heure);
  // Deux passes : la première corrige le gros du décalage, la seconde gère les
  // bascules heure d'été / heure d'hiver.
  let date = new Date(candidat - decalage(new Date(candidat), timezone));
  date = new Date(candidat - decalage(date, timezone));
  return date;
}

/** Prochaine occurrence de l'anniversaire, strictement dans le futur. */
export function prochaineOccurrence({ jour, mois }, timezone = config.timezone) {
  const maintenant = Date.now();
  const { annee } = aujourdhui(timezone);
  for (const cible of [annee, annee + 1, annee + 2]) {
    // Un 29 février n'existe pas toutes les années : on décale au 1er mars.
    const jourValide = Math.min(jour, joursDansMois(mois, cible));
    const debut = versUTC(cible, mois, jourValide, 0, timezone);
    if (debut.getTime() > maintenant) return debut;
  }
  return null;
}

function resoudreRole(guild) {
  const cle = config.anniversaires.role;
  return guild.roles.cache.get(cle) ?? guild.roles.cache.find((r) => r.name === cle) ?? null;
}


/**
 * Crée (ou recrée) un événement Discord pour chaque anniversaire enregistré.
 * Les événements sont ponctuels et régénérés chaque année par le passage
 * quotidien : pas de règle de récurrence à maintenir côté API.
 */
async function synchroniserEvenements(guild, entrees) {
  if (!config.anniversaires.creerEvenements) return;
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageEvents)) {
    console.warn(`[anniversaires] Permission « Gérer les événements » manquante sur ${guild.name}.`);
    return;
  }

  const existants = await guild.scheduledEvents.fetch().catch(() => null);

  for (const [userId, entree] of Object.entries(entrees)) {
    const debut = prochaineOccurrence(entree);
    if (!debut) continue;

    const anneeCible = debut.getUTCFullYear();
    const dejaBon =
      entree.eventAnnee === anneeCible && entree.eventId && existants?.has(entree.eventId);
    if (dejaBon) continue;

    const membre = await guild.members.fetch(userId).catch(() => null);
    if (!membre) continue;

    // On nettoie l'ancien événement devenu obsolète avant d'en créer un nouveau.
    if (entree.eventId && existants?.has(entree.eventId)) {
      await existants.get(entree.eventId).delete().catch(() => {});
    }

    const fin = new Date(debut.getTime() + 24 * 60 * 60 * 1000 - 60_000);
    const age = entree.annee ? ` (${anneeCible - entree.annee} ans)` : '';

    try {
      const evenement = await guild.scheduledEvents.create({
        name: `🎂 Anniversaire de ${membre.displayName}`,
        description: `On souhaite un joyeux anniversaire à ${membre.displayName}${age} !`,
        scheduledStartTime: debut,
        scheduledEndTime: fin,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        entityMetadata: { location: guild.name },
      });
      await definirAnniversaire(guild.id, userId, {
        eventId: evenement.id,
        eventAnnee: anneeCible,
      });
    } catch (error) {
      console.error(`[anniversaires] Création d'événement échouée pour ${userId} :`, error.message);
    }
  }
}

/** Met à jour les seuls événements d'un serveur, sans toucher aux rôles. */
export async function synchroniserServeur(guild) {
  await synchroniserEvenements(guild, await lireServeur(guild.id));
}

/**
 * Passage quotidien : attribue le rôle aux membres du jour, le retire aux
 * autres, annonce dans le salon configuré, puis met à jour les événements.
 */
export async function verifierAnniversaires(client, guildId = null) {
  const { jour, mois, annee: anneeCourante } = aujourdhui();

  for (const guild of client.guilds.cache.values()) {
    if (guildId && guild.id !== guildId) continue;

    const entrees = await lireServeur(guild.id);
    if (Object.keys(entrees).length === 0) continue;

    const role = resoudreRole(guild);
    const salon = resoudreSalon(guild, config.anniversaires.salonAnnonce);
    // Un anniversaire au 29 février est fêté le 28 les années non bissextiles.
    const fetes = Object.entries(entrees).filter(
      ([, e]) => e.mois === mois && Math.min(e.jour, joursDansMois(e.mois, anneeCourante)) === jour,
    );

    if (role) {
      const peutGerer =
        guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles) &&
        guild.members.me.roles.highest.comparePositionTo(role) > 0;

      if (!peutGerer) {
        console.warn(
          `[anniversaires] Impossible de gérer le rôle « ${role.name} » sur ${guild.name} : ` +
            'permission manquante ou rôle du bot placé trop bas.',
        );
      } else {
        await guild.members.fetch().catch(() => null);
        const aLeRole = new Set(role.members.keys());
        const dev = new Set(fetes.map(([id]) => id));

        for (const userId of dev) {
          if (aLeRole.has(userId)) continue;
          await guild.members
            .fetch(userId)
            .then((m) => m.roles.add(role, "C'est son anniversaire"))
            .catch(() => {});
        }
        for (const userId of aLeRole) {
          if (dev.has(userId)) continue;
          await guild.members
            .fetch(userId)
            .then((m) => m.roles.remove(role, 'Anniversaire terminé'))
            .catch(() => {});
        }
      }
    } else {
      console.warn(`[anniversaires] Rôle « ${config.anniversaires.role} » introuvable sur ${guild.name}.`);
    }

    if (salon && fetes.length > 0) {
      const mentions = fetes.map(([id]) => `<@${id}>`).join(', ');
      const ages = fetes
        .filter(([, e]) => e.annee)
        .map(([id, e]) => `<@${id}> fête ses **${anneeCourante - e.annee} ans**`);

      await salon
        .send(
          `🎉 **Joyeux anniversaire ${mentions} !** 🎂\n` +
            (ages.length > 0 ? `${ages.join(' · ')}\n` : '') +
            '@here on lui souhaite un excellent anniversaire !',
        )
        .catch((e) => console.error('[anniversaires] Annonce impossible :', e.message));
    } else if (!salon) {
      console.warn(
        `[anniversaires] Salon « ${config.anniversaires.salonAnnonce} » introuvable sur ${guild.name}.`,
      );
    }

    await synchroniserEvenements(guild, entrees);
  }
}
