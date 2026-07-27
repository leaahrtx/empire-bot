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
 * La tranche est tirée selon les poids de config.gaydar.bandes, puis la valeur
 * exacte est répartie uniformément dans cette tranche. Les membres listés dans
 * config.gaydar.toujoursZero sont forcés à 0 %.
 */
function score(userId) {
  if (config.gaydar.toujoursZero.includes(userId)) return 0;

  const { jour, mois, annee } = aujourdhui();
  const cle = `${userId}-${annee}-${mois}-${jour}`;

  // Deux tirages indépendants issus de la même clé : l'un choisit la tranche,
  // l'autre la position dedans. Deux sels différents évitent qu'ils soient
  // corrélés, ce qui déformerait la répartition.
  const choixBande = hacher(`bande:${cle}`);
  const position = hacher(`position:${cle}`);

  const { bandes } = config.gaydar;
  const total = bandes.reduce((somme, b) => somme + b.poids, 0);

  let seuil = choixBande * total;
  for (const bande of bandes) {
    seuil -= bande.poids;
    if (seuil < 0) return bande.min + position * (bande.max - bande.min);
  }
  return bandes.at(-1).max; // filet de sécurité contre les arrondis flottants
}

/** FNV-1a, ramené dans [0, 1[. Bien mieux réparti qu'un simple hash *31. */
function hacher(chaine) {
  let hash = 2166136261 >>> 0;
  for (const caractere of chaine) {
    hash ^= caractere.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash / 2 ** 32;
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
