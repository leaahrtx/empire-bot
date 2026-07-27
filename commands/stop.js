import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { detruireSession, obtenirSession } from '../lib/musique.js';

export default {
  categorie: 'Musique',

  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Vide la file d’attente et quitte le salon vocal')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    if (!obtenirSession(interaction.guildId)) {
      return interaction.reply({
        content: '🔇 Je ne suis dans aucun salon vocal.',
        flags: MessageFlags.Ephemeral,
      });
    }

    detruireSession(interaction.guildId);
    return interaction.reply('⏹️ Lecture arrêtée, file vidée, je quitte le vocal.');
  },
};
