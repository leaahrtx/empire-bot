import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, MessageFlags } from 'discord.js';
import cron from 'node-cron';
import { config } from './config.js';
import { verifierAnniversaires } from './lib/anniversaires.js';
import { chargerCommandes } from './lib/chargeur.js';
import { enregistrerCommandes } from './lib/deploiement.js';
import { annoncerMeteo } from './lib/meteo.js';
import { detruireSession } from './lib/musique.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN manquant : copie .env.example en .env et remplis-le.');
  process.exit(1);
}

const commandes = await chargerCommandes();

// Chez un hébergeur à panel (Pterodactyl et dérivés), la console n'est pas un
// shell : impossible d'y lancer « npm run deploy ». Cette variable permet de
// faire l'enregistrement au démarrage, sans accès en ligne de commande.
if (process.env.DEPLOY_AU_DEMARRAGE === '1') {
  try {
    const data = await enregistrerCommandes(commandes, {
      token: process.env.DISCORD_TOKEN,
      clientId: process.env.CLIENT_ID,
      guildId: process.env.GUILD_ID,
    });
    console.log(`${data.length} commande(s) enregistrée(s) au démarrage.`);
  } catch (error) {
    // Un échec ici ne doit pas empêcher le bot de tourner avec les commandes
    // déjà déclarées lors d'un démarrage précédent.
    console.error('Enregistrement des commandes impossible :', error.message);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // savoir dans quel salon vocal se trouve l'utilisateur
    GatewayIntentBits.GuildMembers, // intent privilégié, requis pour les rôles d'anniversaire
  ],
});

client.commands = new Collection(commandes.map((c) => [c.data.name, c]));

client.once('clientReady', async (bot) => {
  console.log(`Connecté en tant que ${bot.user.tag} — ${client.commands.size} commandes chargées.`);

  // Passage immédiat : si le bot redémarre le jour d'un anniversaire, les rôles
  // et l'annonce ne sont pas perdus.
  await verifierAnniversaires(bot).catch((e) => console.error('[anniversaires] Démarrage :', e));

  cron.schedule(
    `0 ${config.anniversaires.heureVerification} * * *`,
    () => {
      verifierAnniversaires(client).catch((e) =>
        console.error('[anniversaires] Passage quotidien :', e),
      );
    },
    { timezone: config.timezone },
  );

  console.log(
    `Anniversaires vérifiés chaque jour à ${config.anniversaires.heureVerification}h (${config.timezone}).`,
  );

  if (config.meteo.annonceHebdo) {
    cron.schedule(
      `0 ${config.meteo.heure} * * ${config.meteo.jourSemaine}`,
      () => {
        annoncerMeteo(client).catch((e) => console.error('[meteo] Annonce hebdomadaire :', e));
      },
      { timezone: config.timezone },
    );

    const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, 0, 7 + config.meteo.jourSemaine)), // 7 janvier 2024 = dimanche
    );
    console.log(`Météo de la semaine annoncée chaque ${jour} à ${config.meteo.heure}h.`);
  }
});

client.on('interactionCreate', async (interaction) => {
  const commande = client.commands.get(interaction.commandName);
  if (!commande) return;

  // Suggestions pendant la frappe : à répondre en moins de 3 s, sans différer.
  if (interaction.isAutocomplete()) {
    try {
      await commande.autocomplete?.(interaction);
    } catch (error) {
      console.error(`Autocomplétion /${interaction.commandName} :`, error);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    await commande.execute(interaction);
  } catch (error) {
    console.error(`Erreur sur /${interaction.commandName} :`, error);
    const reponse = { content: '❌ Une erreur est survenue.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reponse).catch(() => {});
    } else {
      await interaction.reply(reponse).catch(() => {});
    }
  }
});

// Quitter proprement les salons vocaux plutôt que d'y laisser un bot fantôme.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const guildId of client.guilds.cache.keys()) detruireSession(guildId);
    client.destroy();
    process.exit(0);
  });
}

client.login(process.env.DISCORD_TOKEN);
