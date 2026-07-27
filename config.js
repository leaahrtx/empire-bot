// Réglages du bot. Modifie ici plutôt que dans le code des commandes.
export const config = {
  // Fuseau utilisé pour décider "quel jour on est" (anniversaires).
  timezone: 'Europe/Paris',

  anniversaires: {
    // Nom OU identifiant du rôle donné le jour J. Le rôle doit exister et être
    // placé SOUS le rôle du bot dans la hiérarchie du serveur.
    role: 'Joyeux anniversaire',
    // Nom OU identifiant du salon d'annonce.
    salonAnnonce: 'general',
    // Heure locale (0-23) du passage quotidien.
    heureVerification: 9,
    // Crée un événement Discord pour chaque anniversaire connu.
    creerEvenements: true,
    // Message d'annonce. Balises remplacées automatiquement :
    //   {membre} → mention des personnes fêtées
    //   {role}   → mention du rôle d'anniversaire
    //   {age}    → « fête ses 25 ans », vide si l'année n'est pas connue
    message: 'JOYEUX ANNIVERSAIRE à {membre} @everyone {role}',
    // true : n'importe qui peut renseigner l'anniversaire d'un autre membre.
    // false : réservé aux membres ayant la permission « Gérer le serveur ».
    ajoutParTous: true,
  },

  meteo: {
    // Villes suivies par les annonces automatiques. La première sert aussi de
    // valeur par défaut à la commande /meteo.
    villes: ['Caen', 'Paris', 'Toulouse', 'Saint-Brieuc', 'Pouxeux'],
    // Nom OU identifiant du salon où poster les annonces.
    salonAnnonce: 'general',

    // Météo du jour, tous les jours.
    annonceQuotidienne: true,
    heureQuotidienne: 8,

    // Météo de la semaine, une fois par semaine.
    annonceHebdo: true,
    jourSemaine: 1, // 0 = dimanche, 1 = lundi … 6 = samedi
    heureHebdo: 8,
  },

  gaydar: {
    // Les images sont piochées au hasard dans ce dossier (png, jpg, gif, webp).
    dossierImages: 'assets/gaydar',
    // Tranches de score et leur poids relatif. Les poids n'ont pas besoin de
    // totaliser 100 : ils sont ramenés à une probabilité automatiquement.
    // Une tranche absente d'ici ne sortira jamais.
    bandes: [
      { min: 90, max: 100, poids: 80 },
      { min: 70, max: 90, poids: 60 },
      { min: 40, max: 60, poids: 40 },
      { min: 20, max: 40, poids: 15 },
      { min: 10, max: 20, poids: 5 },
    ],
    // Membres dont le score est forcé à 0 %, quoi qu'il arrive.
    // Pour récupérer un identifiant : active Paramètres > Avancés > Mode
    // développeur, puis clic droit sur le membre > « Copier l'identifiant ».
    toujoursZero: [
      '304941638176735232',
      '346291372522995724',
    ],
  },

  musique: {
    // Déconnexion automatique après ce délai sans lecture (millisecondes).
    inactiviteMs: 5 * 60 * 1000,
    // Nombre maximum de pistes ajoutées d'un coup depuis une playlist.
    maxPlaylist: 50,
  },
};
