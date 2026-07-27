import {
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  time,
} from 'discord.js';
import {
  formaterDate,
  joursDansMois,
  nomMois,
  prochaineOccurrence,
  synchroniserServeur,
  verifierAnniversaires,
} from '../lib/anniversaires.js';
import { definirAnniversaire, lireServeur, supprimerAnniversaire } from '../lib/store.js';
import { config } from '../config.js';

const CHOIX_MOIS = Array.from({ length: 12 }, (_, i) => ({
  name: nomMois(i + 1),
  value: i + 1,
}));

/**
 * Contrôle le droit d'agir sur l'anniversaire d'un autre membre.
 * Renvoie le message de refus, ou null si l'action est permise.
 */
function refus(interaction, cible) {
  if (cible.id === interaction.user.id) return null;
  if (cible.bot) return '🤖 Les bots n’ont pas d’anniversaire.';
  if (
    !config.anniversaires.ajoutParTous &&
    !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return '🚫 Seuls les membres pouvant gérer le serveur peuvent modifier l’anniversaire de quelqu’un d’autre.';
  }
  return null;
}

export default {
  categorie: 'Anniversaires',

  data: new SlashCommandBuilder()
    .setName('anniversaire')
    .setDescription('Gère les anniversaires du serveur')
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName('definir')
        .setDescription('Enregistre une date d’anniversaire (la tienne ou celle d’un membre)')
        .addIntegerOption((o) =>
          o.setName('jour').setDescription('Jour du mois').setRequired(true).setMinValue(1).setMaxValue(31),
        )
        .addIntegerOption((o) =>
          o.setName('mois').setDescription('Mois').setRequired(true).addChoices(...CHOIX_MOIS),
        )
        .addIntegerOption((o) =>
          o
            .setName('annee')
            .setDescription('Année de naissance (facultatif, permet d’afficher l’âge)')
            .setMinValue(1900)
            .setMaxValue(new Date().getFullYear()),
        )
        .addUserOption((o) =>
          o.setName('membre').setDescription('Membre concerné (par défaut : toi)'),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('voir')
        .setDescription('Affiche un anniversaire enregistré')
        .addUserOption((o) => o.setName('membre').setDescription('Par défaut : toi')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('supprimer')
        .setDescription('Efface un anniversaire enregistré')
        .addUserOption((o) =>
          o.setName('membre').setDescription('Membre concerné (par défaut : toi)'),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('liste').setDescription('Liste les prochains anniversaires du serveur'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('verifier')
        .setDescription('Relance le passage quotidien maintenant (admin)'),
    ),

  async execute(interaction) {
    const sousCommande = interaction.options.getSubcommand();

    if (sousCommande === 'definir') {
      const jour = interaction.options.getInteger('jour');
      const mois = interaction.options.getInteger('mois');
      const annee = interaction.options.getInteger('annee') ?? null;
      const cible = interaction.options.getUser('membre') ?? interaction.user;

      const probleme = refus(interaction, cible);
      if (probleme) {
        return interaction.reply({ content: probleme, flags: MessageFlags.Ephemeral });
      }

      if (jour > joursDansMois(mois)) {
        return interaction.reply({
          content: `📅 Le mois de ${nomMois(mois)} ne compte que ${joursDansMois(mois)} jours.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const pourAutrui = cible.id !== interaction.user.id;

      await definirAnniversaire(interaction.guildId, cible.id, {
        jour,
        mois,
        annee,
        // Invalide l'événement existant : il sera recréé à la bonne date.
        eventAnnee: null,
        ajoutePar: pourAutrui ? interaction.user.id : null,
      });

      await interaction.reply({
        content: pourAutrui
          ? `✅ Anniversaire de ${cible} enregistré : **${formaterDate({ jour, mois, annee })}**.`
          : `✅ Anniversaire enregistré : **${formaterDate({ jour, mois, annee })}**.`,
        flags: MessageFlags.Ephemeral,
      });

      // Création de l'événement Discord en arrière-plan, sans faire attendre.
      synchroniserServeur(interaction.guild).catch((e) =>
        console.error('[anniversaires] Synchronisation :', e.message),
      );
      return;
    }

    if (sousCommande === 'voir') {
      const cible = interaction.options.getUser('membre') ?? interaction.user;
      const entrees = await lireServeur(interaction.guildId);
      const entree = entrees[cible.id];

      if (!entree) {
        return interaction.reply({
          content:
            cible.id === interaction.user.id
              ? '🤷 Tu n’as pas encore enregistré ton anniversaire (`/anniversaire definir`).'
              : `🤷 ${cible} n’a pas enregistré d’anniversaire.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const prochain = prochaineOccurrence(entree);
      const source = entree.ajoutePar ? ` *(renseigné par <@${entree.ajoutePar}>)*` : '';
      return interaction.reply({
        content: `🎂 ${cible} : **${formaterDate(entree)}** — prochain ${time(prochain, 'R')}.${source}`,
        allowedMentions: { users: [] },
      });
    }

    if (sousCommande === 'supprimer') {
      const cible = interaction.options.getUser('membre') ?? interaction.user;

      const probleme = refus(interaction, cible);
      if (probleme) {
        return interaction.reply({ content: probleme, flags: MessageFlags.Ephemeral });
      }

      const entrees = await lireServeur(interaction.guildId);
      const entree = entrees[cible.id];
      const supprime = await supprimerAnniversaire(interaction.guildId, cible.id);

      // Sans ça, l'événement Discord resterait orphelin dans le calendrier.
      if (entree?.eventId) {
        await interaction.guild.scheduledEvents.delete(entree.eventId).catch(() => {});
      }

      const pourAutrui = cible.id !== interaction.user.id;
      return interaction.reply({
        content: supprime
          ? pourAutrui
            ? `🗑️ Anniversaire de ${cible} effacé.`
            : '🗑️ Anniversaire effacé.'
          : pourAutrui
            ? `🤷 ${cible} n’avait rien d’enregistré.`
            : '🤷 Tu n’avais rien d’enregistré.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (sousCommande === 'liste') {
      const entrees = Object.entries(await lireServeur(interaction.guildId));
      if (entrees.length === 0) {
        return interaction.reply({
          content: '📭 Aucun anniversaire enregistré sur ce serveur.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const lignes = entrees
        .map(([userId, entree]) => ({ userId, entree, prochain: prochaineOccurrence(entree) }))
        .sort((a, b) => a.prochain - b.prochain)
        .slice(0, 25)
        .map(
          ({ userId, entree, prochain }) =>
            `<@${userId}> — **${formaterDate({ ...entree, annee: null })}** (${time(prochain, 'R')})`,
        );

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle('🎂 Prochains anniversaires')
        .setDescription(lignes.join('\n'))
        .setFooter({ text: `${entrees.length} membre(s) enregistré(s)` });

      return interaction.reply({ embeds: [embed] });
    }

    if (sousCommande === 'verifier') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({
          content: '🚫 Réservé aux membres pouvant gérer le serveur.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await verifierAnniversaires(interaction.client, interaction.guildId);
      return interaction.editReply('✅ Passage effectué : rôles, annonce et événements à jour.');
    }
  },
};
