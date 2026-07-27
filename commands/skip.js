import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { obtenirSession, passer } from '../lib/musique.js';

export default {
  categorie: 'Musique',

  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Passe à la musique suivante')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const session = obtenirSession(interaction.guildId);
    if (!session?.enCours) {
      return interaction.reply({
        content: '🔇 Rien en cours de lecture.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const passee = passer(interaction.guildId);
    return interaction.reply(`⏭️ **${passee.titre}** passée.`);
  },
};
