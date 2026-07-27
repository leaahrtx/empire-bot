import { SlashCommandBuilder } from 'discord.js';

export default {
  categorie: 'Divers',

  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Vérifie que le bot répond'),

  async execute(interaction) {
    await interaction.reply(`🏓 Pong ! (${interaction.client.ws.ping} ms)`);
  },
};
