/** Retrouve un salon textuel à partir de son identifiant ou de son nom. */
export function resoudreSalon(guild, cle) {
  const salon =
    guild.channels.cache.get(cle) ??
    guild.channels.cache.find((c) => c.name === cle && c.isTextBased());
  return salon?.isTextBased() ? salon : null;
}
