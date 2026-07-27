import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { construireEmbed, geocoder, previsions } from '../lib/meteo.js';

export default {
  categorie: 'Météo',

  data: new SlashCommandBuilder()
    .setName('meteo')
    .setDescription('Affiche les prévisions météo de la semaine')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('ville')
        .setDescription(`Ville à consulter (par défaut : ${config.meteo.villes[0]})`),
    )
    .addIntegerOption((option) =>
      option
        .setName('jours')
        .setDescription('Nombre de jours (1 à 16, par défaut 7)')
        .setMinValue(1)
        .setMaxValue(16),
    ),

  async execute(interaction) {
    const ville = interaction.options.getString('ville') ?? config.meteo.villes[0];
    const jours = interaction.options.getInteger('jours') ?? 7;

    await interaction.deferReply();

    let lieu;
    try {
      lieu = await geocoder(ville);
    } catch (error) {
      return interaction.editReply(`❌ Service météo injoignable : ${error.message}`);
    }

    if (!lieu) {
      return interaction.editReply({
        content: `🗺️ Ville introuvable : **${ville}**. Essaie avec le nom exact de la commune.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const donnees = await previsions(lieu, jours);
      return interaction.editReply({ embeds: [construireEmbed(lieu, donnees)] });
    } catch (error) {
      return interaction.editReply(`❌ Prévisions indisponibles : ${error.message}`);
    }
  },
};
