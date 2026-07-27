import { readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  AttachmentBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { aujourdhui } from '../lib/anniversaires.js';
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
 * Score stable pour un membre sur une journée donnée : relancer la commande
 * renvoie le même résultat, ce qui évite le spam pour "retenter sa chance".
 * Le résultat couvre 0 à 100 % au millième près, avec un net penchant pour le
 * haut de l'échelle. Les membres listés dans config.gaydar.toujoursZero sont
 * forcés à 0 %.
 */
function score(userId) {
  if (config.gaydar.toujoursZero.includes(userId)) return 0;

  const { jour, mois, annee } = aujourdhui();
  let hash = 0;
  for (const caractere of `${userId}-${annee}-${mois}-${jour}`) {
    hash = (hash * 31 + caractere.codePointAt(0)) >>> 0;
  }

  // Élever un tirage uniforme à une puissance inférieure à 1 le pousse vers le
  // haut : le bas de l'échelle reste atteignable, mais devient rare.
  const uniforme = (hash % 1_000_001) / 1_000_000;
  return 100 * uniforme ** (1 / config.gaydar.biais);
}

/** Trois décimales, virgule française. */
function formaterScore(valeur) {
  return valeur.toLocaleString('fr-FR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
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
