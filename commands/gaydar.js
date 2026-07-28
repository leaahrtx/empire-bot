import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  AttachmentBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { racineProjet } from '../lib/store.js';

const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

async function imagesDisponibles() {
  const dossier = join(racineProjet, config.gaydar.dossierImages);
  try {
    const fichiers = await readdir(dossier);
    return fichiers
      .filter((f) => EXTENSIONS.has(extname(f).toLowerCase()))
      .map((f) => join(dossier, f));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Entier tiré au hasard entre 0 et 100, sans aucune pondération : chaque valeur
 * a la même chance de sortir, et deux scans du même membre diffèrent.
 * Seule exception, les membres de config.gaydar.toujoursZero, forcés à 0 %.
 */
function score(userId) {
  if (config.gaydar.toujoursZero.includes(userId)) return 0;
  return Math.floor(Math.random() * 101);
}

/** Pourcentage entier, sans décimale. */
function formaterScore(valeur) {
  return String(valeur);
}

function jauge(valeur) {
  const remplies = Math.round(valeur / 10);
  return `${'🟪'.repeat(remplies)}${'⬜'.repeat(10 - remplies)}`;
}

export default {
  categorie: 'Fun',

  data: new SlashCommandBuilder()
    .setName('gaydar')
    .setDescription('Passe un membre au gaydar (100 % scientifique)')
    .setContexts(InteractionContextType.Guild)
    .addUserOption((option) =>
      option.setName('membre').setDescription('La cible du scan').setRequired(true),
    ),

  async execute(interaction) {
    const cible = interaction.options.getUser('membre');
    const images = await imagesDisponibles();

    if (images.length === 0) {
      return interaction.reply({
        content:
          `🖼️ Aucune image dans \`${config.gaydar.dossierImages}\`. ` +
          'Dépose au moins un fichier .png / .jpg / .gif dans ce dossier.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const image = images[Math.floor(Math.random() * images.length)];
    const valeur = score(cible.id);

    return interaction.reply({
      content: `📡 Scan de ${cible} terminé…\n${jauge(valeur)} **${formaterScore(valeur)} %**`,
      files: [new AttachmentBuilder(image)],
      allowedMentions: { users: [] },
    });
  },
};
