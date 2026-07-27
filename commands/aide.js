import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';

// Ordre d'affichage des rubriques ; toute catégorie inconnue passe à la fin.
const ORDRE = ['Musique', 'Anniversaires', 'Météo', 'Fun', 'Divers'];

const EMOJIS = {
  Musique: '🎵',
  Anniversaires: '🎂',
  Météo: '🌤️',
  Fun: '🎉',
  Divers: '🔧',
};

/** `/play <musique> [jours]` : <> pour un argument requis, [] pour optionnel. */
function signature(nom, options = []) {
  const arguments_ = options
    .filter(
      (o) =>
        o.type !== ApplicationCommandOptionType.Subcommand &&
        o.type !== ApplicationCommandOptionType.SubcommandGroup,
    )
    .map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`));
  return `/${nom}${arguments_.length > 0 ? ` ${arguments_.join(' ')}` : ''}`;
}

/** Une entrée par commande, ou une par sous-commande si elle en possède. */
function lignes(commande) {
  const json = commande.data.toJSON();
  const sous = (json.options ?? []).filter(
    (o) => o.type === ApplicationCommandOptionType.Subcommand,
  );

  if (sous.length === 0) {
    return [`\`${signature(json.name, json.options)}\`\n　${json.description}`];
  }
  return sous.map(
    (s) => `\`${signature(`${json.name} ${s.name}`, s.options)}\`\n　${s.description}`,
  );
}

function detailler(commande) {
  const json = commande.data.toJSON();
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`/${json.name}`)
    .setDescription(json.description);

  const sous = (json.options ?? []).filter(
    (o) => o.type === ApplicationCommandOptionType.Subcommand,
  );

  if (sous.length > 0) {
    embed.addFields({
      name: 'Sous-commandes',
      value: sous
        .map((s) => `\`${signature(`${json.name} ${s.name}`, s.options)}\` — ${s.description}`)
        .join('\n'),
    });
    return embed;
  }

  const options = json.options ?? [];
  if (options.length > 0) {
    embed.addFields({
      name: 'Arguments',
      value: options
        .map(
          (o) => `\`${o.name}\`${o.required ? ' *(requis)*' : ' *(facultatif)*'} — ${o.description}`,
        )
        .join('\n'),
    });
  }
  embed.addFields({ name: 'Utilisation', value: `\`${signature(json.name, options)}\`` });
  return embed;
}

export default {
  categorie: 'Divers',

  data: new SlashCommandBuilder()
    .setName('aide')
    .setDescription('Liste toutes les commandes du bot')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('commande')
        .setDescription('Détail d’une commande précise')
        .setAutocomplete(true),
    ),

  async autocomplete(interaction) {
    const saisie = interaction.options.getFocused().toLowerCase();
    const noms = [...interaction.client.commands.keys()]
      .filter((nom) => nom.includes(saisie))
      .slice(0, 25)
      .map((nom) => ({ name: `/${nom}`, value: nom }));
    await interaction.respond(noms);
  },

  async execute(interaction) {
    const commandes = interaction.client.commands;
    const demandee = interaction.options.getString('commande');

    if (demandee) {
      const commande = commandes.get(demandee.replace(/^\//, ''));
      if (!commande) {
        return interaction.reply({
          content: `❓ Commande inconnue : **${demandee}**. Fais \`/aide\` pour la liste complète.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return interaction.reply({
        embeds: [detailler(commande)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const rubriques = new Map();
    for (const commande of commandes.values()) {
      const categorie = commande.categorie ?? 'Divers';
      if (!rubriques.has(categorie)) rubriques.set(categorie, []);
      rubriques.get(categorie).push(...lignes(commande));
    }

    const triees = [...rubriques.entries()].sort(
      ([a], [b]) =>
        (ORDRE.indexOf(a) + 1 || ORDRE.length + 1) - (ORDRE.indexOf(b) + 1 || ORDRE.length + 1),
    );

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📖 Commandes disponibles')
      .setDescription(
        'Utilise `/aide commande:<nom>` pour le détail des arguments d’une commande.',
      )
      .addFields(
        triees.map(([categorie, entrees]) => ({
          name: `${EMOJIS[categorie] ?? '•'} ${categorie}`,
          value: entrees.join('\n'),
        })),
      )
      .setFooter({ text: `${commandes.size} commandes` });

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
