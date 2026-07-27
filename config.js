// Réglages du bot. Modifie ici plutôt que dans le code des commandes.
export const config = {
  // Fuseau utilisé pour décider "quel jour on est" (anniversaires).
  timezone: 'Europe/Paris',

  anniversaires: {
    // Nom OU identifiant du rôle donné le jour J. Le rôle doit exister et être
    // placé SOUS le rôle du bot dans la hiérarchie du serveur.
    role: 'Anniversaire',
    // Nom OU identifiant du salon d'annonce.
    salonAnnonce: 'general',
    // Heure locale (0-23) du passage quotidien.
    heureVerification: 9,
    // Crée un événement Discord pour chaque anniversaire connu.
    creerEvenements: true,
    // true : n'importe qui peut renseigner l'anniversaire d'un autre membre.
    // false : réservé aux membres ayant la permission « Gérer le serveur ».
    ajoutParTous: true,
  },

  meteo: {
    // Ville utilisée par défaut (commande et annonce hebdomadaire).
    ville: 'Paris',
    // Nom OU identifiant du salon où poster l'annonce de la semaine.
    salonAnnonce: 'general',
    // Annonce automatique chaque semaine. Passe à false pour ne garder que /meteo.
    annonceHebdo: true,
    // 0 = dimanche, 1 = lundi … 6 = samedi.
    jourSemaine: 1,
    // Heure locale (0-23) de l'annonce.
    heure: 8,
  },

  gaydar: {
    // Les images sont piochées au hasard dans ce dossier (png, jpg, gif, webp).
    dossierImages: 'assets/gaydar',
  },

  musique: {
    // Déconnexion automatique après ce délai sans lecture (millisecondes).
    inactiviteMs: 5 * 60 * 1000,
    // Nombre maximum de pistes ajoutées d'un coup depuis une playlist.
    maxPlaylist: 50,
  },
};
