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
 * Score tiré au hasard à chaque appel : deux scans du même membre donnent des
 * résultats différents. La tranche est choisie selon les poids de
 * config.gaydar.bandes, puis la valeur est répartie uniformément dedans.
 * Les membres listés dans config.gaydar.toujoursZero sont forcés à 0 %.
 */
function score(userId) {
  if (config.gaydar.toujoursZero.includes(userId)) return 0;

  const { bandes } = config.gaydar;
  const total = bandes.reduce((somme, b) => somme + b.poids, 0);

  let seuil = Math.random() * total;
  for (const bande of bandes) {
    seuil -= bande.poids;
    if (seuil < 0) return Math.round(bande.min + Math.random() * (bande.max - bande.min));
  }
  return bandes.at(-1).max; // filet de sécurité contre les arrondis flottants
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
