import 'dotenv/config';
import { chargerCommandes } from './lib/chargeur.js';
import { enregistrerCommandes } from './lib/deploiement.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('DISCORD_TOKEN, CLIENT_ID et GUILD_ID sont requis dans .env');
  process.exit(1);
}

const data = await enregistrerCommandes(await chargerCommandes(), {
  token: DISCORD_TOKEN,
  clientId: CLIENT_ID,
  guildId: GUILD_ID,
});

console.log(`${data.length} commande(s) enregistrée(s) : ${data.map((c) => `/${c.name}`).join(', ')}`);
