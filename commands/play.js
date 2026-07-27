import {
  InteractionContextType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  MessageFlags,
} from 'discord.js';
import { ajouterEtJouer, chercherPistes, formaterDuree } from '../lib/musique.js';

export default {
  categorie: 'Musique',

  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Joue un lien YouTube (vidéo ou playlist) ou lance une recherche')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('musique')
        .setDescription('Lien YouTube ou termes de recherche')
        .setRequired(true),
    ),

  async execute(interaction) {
    const salonVocal = interaction.member.voice?.channel;
    if (!salonVocal) {
      return interaction.reply({
        content: '🔇 Rejoins un salon vocal avant de lancer une musique.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const permissions = salonVocal.permissionsFor(interaction.guild.members.me);
    if (!permissions?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
      return interaction.reply({
        content: `🚫 Je n'ai pas le droit de me connecter ou de parler dans **${salonVocal.name}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // La résolution yt-dlp dépasse souvent les 3 s accordées par Discord.
    await interaction.deferReply();

    let pistes;
    try {
      pistes = await chercherPistes(interaction.options.getString('musique'));
    } catch (error) {
      return interaction.editReply(`❌ Impossible de lire ce lien : ${error.message}`);
    }

    if (pistes.length === 0) {
      return interaction.editReply('❌ Aucun résultat pour cette recherche.');
    }

    const session = await ajouterEtJouer(salonVocal, interaction.channel, pistes);
    const enAttente = session.attente.length;

    if (pistes.length > 1) {
      return interaction.editReply(
        `➕ **${pistes.length} pistes** ajoutées à la file (${enAttente} en attente).`,
      );
    }

    const [piste] = pistes;
    return interaction.editReply(
      enAttente > 0
        ? `➕ **${piste.titre}** — ${formaterDuree(piste.duree)} · position ${enAttente} dans la file`
        : `🎶 Lecture de **${piste.titre}** — ${formaterDuree(piste.duree)}`,
    );
  },
};
