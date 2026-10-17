// Static editorial copy of the public site (French). Commercial facts stay in
// BusinessSettings/ContentBlock; this file holds structure and explanations.

export const NAV_PRIMARY = [
  { href: "/prestations", label: "Prestations" },
  { href: "/mariages", label: "Mariages" },
  { href: "/evenements", label: "Événements" },
  { href: "/lieux", label: "Lieux partenaires" },
  { href: "/a-propos", label: "À propos" },
  { href: "/faq", label: "FAQ" },
] as const;

export const NAV_SECONDARY = [
  { href: "/organisation", label: "Notre organisation" },
  { href: "/devenir-partenaire", label: "Devenir partenaire" },
  { href: "/rejoindre-le-reseau", label: "Rejoindre le réseau" },
  { href: "/contact", label: "Contact" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/mentions-legales", label: "Mentions légales" },
] as const;

export const CTA_LABEL = "Parler de mon événement";
export const CTA_HREF = "/demander-un-devis";

export const EVENT_FAMILIES = [
  {
    key: "weddings",
    sprig: "olive",
    title: "Mariages",
    href: "/mariages",
    summary:
      "Du vin d’honneur à l’ouverture du bal, les enfants ont leur espace, leurs activités et des adultes qui ne font que ça. Les parents dansent, les mariés profitent.",
  },
  {
    key: "private",
    sprig: "sage",
    title: "Fêtes privées",
    href: "/evenements",
    summary:
      "Anniversaires, baptêmes, réunions de famille : une garde encadrée pour que les grands discutent et que les petits aient leur fête à eux.",
  },
  {
    key: "professional",
    sprig: "eucalyptus",
    title: "Événements professionnels",
    href: "/evenements",
    summary:
      "Journées d’entreprise, séminaires ouverts aux familles, inaugurations : un accueil enfants organisé avec le lieu et l’organisateur.",
  },
] as const;

export const STEPS = [
  {
    label: "D’abord",
    title: "Vous décrivez votre événement",
    text: "Date, horaires, lieu, nombre d’enfants par âge : le formulaire guidé prend cinq minutes. Aucune information sur les enfants eux-mêmes n’est demandée.",
  },
  {
    label: "Ensuite",
    title: "Marie vous rappelle",
    text: "Elle précise avec vous l’espace prévu, le déroulé de la soirée et vos attentes, puis vous transmet une proposition datée dans votre espace.",
  },
  {
    label: "Puis",
    title: "Vous donnez votre accord de principe",
    text: "Un simple « cette proposition me convient » dans votre espace. Marie constitue alors l’équipe parmi les personnes de son réseau.",
  },
  {
    label: "Avant le jour J",
    title: "L’équipe se prépare",
    text: "Repérage du lieu quand c’est possible, matériel adapté aux âges, point de rendez-vous et contact sur place validés ensemble. La prestation est confirmée une fois tout en place.",
  },
  {
    label: "Le jour J",
    title: "Les enfants ont leur fête",
    text: "Accueil, activités, temps calmes pour les plus petits, retour aux familles aux horaires convenus. Marie reste joignable du début à la fin.",
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "À partir de quel âge accueillez-vous les enfants ?",
    answer:
      "Les prestations sont pensées pour les enfants de 3 à 12 ans environ. Pour les enfants de moins de 3 ans, chaque demande fait l’objet d’une étude spécifique avec Marie : la prise en charge n’est jamais automatique et dépend de l’espace, des horaires et de l’équipe disponible.",
  },
  {
    question: "Combien d’intervenants seront présents ?",
    answer:
      "L’équipe est dimensionnée selon le nombre d’enfants, leurs âges, la durée et le lieu. Marie vous indique l’effectif prévu dans la proposition ; il s’agit de repères internes de bonne organisation, validés avec vous, et non d’un ratio réglementaire.",
  },
  {
    question: "Faut-il prévoir un espace dédié ?",
    answer:
      "C’est fortement recommandé : une pièce ou une zone à l’écart du bruit, avec un point d’eau et des sanitaires à proximité. Si le lieu n’en dispose pas, nous aménageons un coin avec paravents et tapis ; on en parle lors de l’appel de qualification.",
  },
  {
    question: "Les intervenants sont-ils qualifiés ?",
    answer:
      "Marie travaille avec des personnes qu’elle connaît et a rencontrées. Les qualifications qu’elles déclarent (petite enfance, animation, premiers secours…) sont indiquées comme vérifiées uniquement lorsque Marie a pu les contrôler. Aucun agrément collectif ou label n’est revendiqué.",
  },
  {
    question: "Quelles informations devez-vous connaître sur les enfants ?",
    answer:
      "Uniquement leur nombre par tranche d’âge. Nous ne demandons ni nom, ni date de naissance, ni photo, ni information médicale. Les consignes particulières sont échangées de vive voix avec les parents le jour même.",
  },
  {
    question: "Comment se passe la réservation ?",
    answer:
      "Votre demande n’engage à rien. Marie vous transmet une proposition ; votre accord de principe lance la constitution de l’équipe ; la prestation n’est confirmée que lorsque l’équipe est au complet et les points pratiques validés. Vous suivez chaque étape dans votre espace.",
  },
  {
    question: "Est-ce éligible à un crédit d’impôt ?",
    answer:
      "Nous ne pouvons pas l’affirmer : la garde collective d’enfants lors d’un événement n’entre pas automatiquement dans le cadre des services à la personne. Le cadre fiscal et contractuel de l’activité est en cours de validation et n’est pas présenté comme acquis.",
  },
  {
    question: "Intervenez-vous partout en France ?",
    answer:
      "La zone d’intervention est en cours de définition et sera précisée ici. Indiquez simplement la commune de votre événement dans la demande : Marie vous dira rapidement si elle peut vous accompagner.",
  },
] as const;
