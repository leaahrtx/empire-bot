import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const racineProjet = dirname(dirname(fileURLToPath(import.meta.url)));
const fichier = join(racineProjet, 'data', 'anniversaires.json');

// Écriture atomique : on écrit à côté puis on renomme, pour ne jamais laisser
// un fichier à moitié écrit si le process meurt en plein enregistrement.
async function ecrire(donnees) {
  await mkdir(dirname(fichier), { recursive: true });
  const temporaire = `${fichier}.tmp`;
  await writeFile(temporaire, JSON.stringify(donnees, null, 2), 'utf8');
  await rename(temporaire, fichier);
}

async function lire() {
  try {
    return JSON.parse(await readFile(fichier, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

/** Toutes les entrées d'un serveur : { userId: { jour, mois, annee, eventId } } */
export async function lireServeur(guildId) {
  const donnees = await lire();
  return donnees[guildId] ?? {};
}

export async function definirAnniversaire(guildId, userId, valeur) {
  const donnees = await lire();
  donnees[guildId] ??= {};
  donnees[guildId][userId] = { ...donnees[guildId][userId], ...valeur };
  await ecrire(donnees);
  return donnees[guildId][userId];
}

export async function supprimerAnniversaire(guildId, userId) {
  const donnees = await lire();
  if (!donnees[guildId]?.[userId]) return false;
  delete donnees[guildId][userId];
  await ecrire(donnees);
  return true;
}
