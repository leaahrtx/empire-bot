import { REST, Routes } from 'discord.js';

/**
 * Déclare les commandes auprès de Discord, au niveau du serveur (effet
 * immédiat, contrairement aux commandes globales qui mettent jusqu'à 1 h).
 * Partagé entre le script `npm run deploy` et l'enregistrement automatique
 * au démarrage, indispensable chez les hébergeurs sans accès shell.
 */
export async function enregistrerCommandes(commandes, { token, clientId, guildId }) {
  if (!token || !clientId || !guildId) {
    throw new Error('DISCORD_TOKEN, CLIENT_ID et GUILD_ID sont requis.');
  }

  const rest = new REST().setToken(token);
  return rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commandes.map((c) => c.data.toJSON()),
  });
}
