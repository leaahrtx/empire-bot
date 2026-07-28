import { InteractionContextType, SlashCommandBuilder } from 'discord.js';
import {
  bornesSemaineISO,
  construireEmbed,
  geocoder,
  previsionsIntervalle,
} from '../lib/meteo.js';

const VILLE = 'Villeconin';
const SEMAINE = 32;

/** « 3 au 9 août » à partir de deux dates AAAA-MM-JJ. */
function periodeLisible(debut, fin) {
  const lire = (iso, options) =>
    new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(
      new Date(`${iso}T12:00:00Z`),
    );
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7);
  return `${lire(debut, memeMois ? { day: 'numeric' } : { day: 'numeric', month: 'long' })} au ${lire(fin, { day: 'numeric', month: 'long' })}`;
}

export default {
  categorie: 'Météo',

  data: new SlashCommandBuilder()
    .setName('villeconin')
    .setDescription(`Météo de ${VILLE} pour la semaine ${SEMAINE}`)
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    await interaction.deferReply();

    const annee = new Date().getUTCFullYear();
    const { debut, fin } = bornesSemaineISO(annee, SEMAINE);

    // Hors de la fenêtre de prévision, l'API répond 400 : on filtre avant
    // d'appeler, pour renvoyer une explication plutôt qu'un code d'erreur.
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10);

    if (fin < aujourdhui) {
      return interaction.editReply(
        `📅 La semaine ${SEMAINE} (${periodeLisible(debut, fin)}) est passée : les prévisions ne sont plus disponibles.`,
      );
    }
    if (debut > horizon) {
      return interaction.editReply(
        `📅 La semaine ${SEMAINE} (${periodeLisible(debut, fin)}) est encore trop loin. ` +
          'Les prévisions ne portent qu\'à seize jours, reviens plus près de la date.',
      );
    }

    const lieu = await geocoder(VILLE);
    if (!lieu) {
      return interaction.editReply(`🗺️ ${VILLE} est introuvable côté service météo.`);
    }

    let jours;
    try {
      jours = await previsionsIntervalle(lieu, debut, fin);
    } catch (error) {
      return interaction.editReply(`❌ Prévisions indisponibles : ${error.message}`);
    }

    if (jours.length === 0) {
      return interaction.editReply(
        `📅 Aucune donnée pour la semaine ${SEMAINE} (${periodeLisible(debut, fin)}).`,
      );
    }

    return interaction.editReply({
      embeds: [
        construireEmbed(
          lieu,
          jours,
          `📍 ${lieu.nom} — semaine ${SEMAINE} (${periodeLisible(debut, fin)})`,
        ),
      ],
    });
  },
};
