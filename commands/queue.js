import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { formaterDuree, obtenirSession } from '../lib/musique.js';

export default {
  categorie: 'Musique',

  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Affiche la file d’attente')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const session = obtenirSession(interaction.guildId);
    if (!session?.enCours) {
      return interaction.reply({
        content: '🔇 Rien en cours de lecture.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const suite = session.attente
      .slice(0, 10)
      .map((p, i) => `\`${i + 1}.\` ${p.titre} — ${formaterDuree(p.duree)}`)
      .join('\n');

    const reste = session.attente.length - 10;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('File d’attente')
      .addFields({
        name: 'En cours',
        value: `▶️ **${session.enCours.titre}** — ${formaterDuree(session.enCours.duree)}`,
      });

    if (suite) {
      embed.addFields({
        name: `À suivre (${session.attente.length})`,
        value: reste > 0 ? `${suite}\n… et ${reste} de plus` : suite,
      });
    }

    return interaction.reply({ embeds: [embed] });
  },
};
