/**
 * Retrouve un salon textuel à partir de son identifiant ou de son nom.
 * La comparaison de nom tolère la casse : « general » et « General »
 * désignent le même salon.
 */
export function resoudreSalon(guild, cle) {
  const salon =
    guild.channels.cache.get(cle) ??
    guild.channels.cache.find((c) => c.isTextBased() && c.name === cle) ??
    guild.channels.cache.find((c) => c.isTextBased() && c.name.toLowerCase() === cle.toLowerCase());
  return salon?.isTextBased() ? salon : null;
}
