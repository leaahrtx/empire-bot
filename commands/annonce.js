import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { annoncerMeteoJour, annoncerMeteoSemaine } from '../lib/meteo.js';

export default {
  categorie: 'Météo',

  data: new SlashCommandBuilder()
    .setName('annonce')
    .setDescription('Publie tout de suite une annonce météo planifiée (admin)')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Annonce à déclencher')
        .setRequired(true)
        .addChoices(
          { name: 'Météo du jour', value: 'jour' },
          { name: 'Météo de la semaine', value: 'semaine' },
        ),
    ),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: '🚫 Réservé aux membres pouvant gérer le serveur.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const type = interaction.options.getString('type');

    // Le relevé des cinq villes dépasse largement les 3 s accordées par Discord.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let envoyes;
    try {
      const annoncer = type === 'jour' ? annoncerMeteoJour : annoncerMeteoSemaine;
      envoyes = await annoncer(interaction.client, interaction.guildId);
    } catch (error) {
      return interaction.editReply(`❌ Annonce impossible : ${error.message}`);
    }

    if (envoyes === 0) {
      return interaction.editReply(
        `❌ Rien n'a été publié. Vérifie que le salon \`${config.meteo.salonAnnonce}\` existe, ` +
          'qu\'il est bien textuel, et que le bot peut y écrire et y intégrer des liens.',
      );
    }

    return interaction.editReply(
      `✅ Annonce publiée (${type === 'jour' ? 'météo du jour' : 'météo de la semaine'}).`,
    );
  },
};
