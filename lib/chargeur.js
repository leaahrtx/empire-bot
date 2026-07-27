import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { racineProjet } from './store.js';

/**
 * Charge tous les fichiers de commands/. Ajouter une commande = ajouter un
 * fichier exportant { data, execute } par défaut, rien d'autre à brancher.
 */
export async function chargerCommandes() {
  const dossier = join(racineProjet, 'commands');
  const fichiers = (await readdir(dossier)).filter((f) => f.endsWith('.js'));
  const commandes = [];

  for (const fichier of fichiers) {
    const module = await import(pathToFileURL(join(dossier, fichier)).href);
    const commande = module.default;

    if (!commande?.data || typeof commande?.execute !== 'function') {
      console.warn(`[chargeur] commands/${fichier} ignoré : export { data, execute } manquant.`);
      continue;
    }
    commandes.push(commande);
  }

  return commandes.sort((a, b) => a.data.name.localeCompare(b.data.name));
}
