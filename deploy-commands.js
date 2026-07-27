import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { chargerCommandes } from './lib/chargeur.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('DISCORD_TOKEN, CLIENT_ID et GUILD_ID sont requis dans .env');
  process.exit(1);
}

const commandes = await chargerCommandes();
const rest = new REST().setToken(DISCORD_TOKEN);

// Enregistrement au niveau du serveur : immédiat (le global met jusqu'à 1h).
const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
  body: commandes.map((c) => c.data.toJSON()),
});

console.log(`${data.length} commande(s) enregistrée(s) : ${data.map((c) => `/${c.name}`).join(', ')}`);
