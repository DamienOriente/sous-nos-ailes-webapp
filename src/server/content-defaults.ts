// Default editable texts. Stored in ContentBlock on first seed; Marie edits them
// from the admin. Keys are stable identifiers used by the public pages.

export const CONTENT_DEFAULTS: Record<string, { title: string; body: string }> = {
  "home.intro": {
    title: "Accroche de la page d’accueil",
    body:
      "Marie travaille auprès des tout-petits en crèche. Avec un réseau d’intervenantes et d’intervenants indépendants qu’elle choisit elle-même, elle organise la garde et l’animation des enfants pendant votre mariage, votre fête ou votre événement professionnel. Vous profitez du moment, les enfants aussi.",
  },
  "about.marie": {
    title: "À propos de Marie",
    body:
      "Marie exerce en crèche auprès des jeunes enfants. Elle a souhaité prolonger ce métier en proposant, lors d’événements, un accueil pensé pour les enfants : un espace à eux, des activités adaptées à leur âge, et des adultes attentifs.\n\nElle reste votre interlocutrice de la première demande jusqu’au jour J : c’est elle qui qualifie votre besoin, prépare la proposition, constitue l’équipe et valide chaque prestation.\n\nCe texte est un brouillon à compléter par Marie. Aucun diplôme, ancienneté ou agrément n’est affiché tant qu’il n’est pas confirmé.",
  },
  "approach.body": {
    title: "L’approche",
    body:
      "Un espace repéré avec vous ou avec le lieu, sécurisé et adapté aux âges présents.\n\nDes activités calmes ou animées selon le moment de la soirée : ateliers, lectures, jeux, temps de repos pour les plus petits.\n\nUne équipe dimensionnée selon les effectifs et les âges, composée de personnes que Marie connaît et a rencontrées.\n\nUn seul fil : Marie suit chaque dossier et reste joignable avant et pendant la prestation.",
  },
  "organisation.body": {
    title: "Notre organisation",
    body:
      "Chaque demande est étudiée par Marie. Elle revient vers vous pour préciser les horaires, l’espace prévu et le nombre d’enfants, puis vous transmet une proposition datée. Une fois votre accord de principe donné, elle propose la mission à des intervenantes et intervenants de son réseau, qui acceptent ou refusent librement. La prestation n’est confirmée qu’une fois l’équipe au complet et les points pratiques validés.\n\nLes intervenants sont des indépendants ; les qualifications qu’ils déclarent sont indiquées comme vérifiées seulement lorsque Marie a pu les contrôler. Le cadre contractuel et économique de cette activité est en cours de validation.",
  },
  "legal.mentions": {
    title: "Mentions légales (brouillon)",
    body:
      "Éditeur du site : à compléter (nom, statut, adresse, SIREN).\n\nResponsable de la publication : Marie (nom complet à compléter).\n\nHébergement : à compléter.\n\nCe texte est un brouillon généré pour la démonstration. Il doit être relu et complété avant toute mise en ligne.",
  },
  "legal.privacy": {
    title: "Politique de confidentialité (brouillon)",
    body:
      "Les données saisies dans le formulaire de demande (coordonnées de l’organisateur, caractéristiques de l’événement, effectifs par tranche d’âge) servent exclusivement à étudier et préparer la prestation demandée. La base légale est l’exécution de mesures précontractuelles prises à votre demande.\n\nAucune donnée nominative concernant les enfants n’est collectée : ni nom, ni date de naissance, ni photographie, ni information médicale.\n\nLes données sont conservées pendant la durée définie dans les paramètres (par défaut 36 mois après le dernier échange), sauf obligation légale de conservation à valider. Vous pouvez demander l’accès, la rectification ou la suppression de vos données à l’adresse de contact indiquée.\n\nAucun traceur publicitaire n’est déposé. Un cookie technique de session sert uniquement à la connexion aux espaces privés ; un cookie technique de courte durée mémorise le lieu partenaire qui vous a orienté vers nous.\n\nCe texte est un brouillon à faire valider avant exploitation réelle.",
  },
  "faq.body": {
    title: "Questions fréquentes",
    body: "Les questions fréquentes sont rédigées directement dans la page FAQ et peuvent être adaptées dans le code ou via ce bloc à venir.",
  },
};
