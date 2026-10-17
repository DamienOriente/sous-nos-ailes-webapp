/**
 * Register of processing activities (GDPR art. 30), single source for the
 * admin page and docs/privacy.md. Values marked "[À COMPLÉTER]" are business or
 * legal decisions the owner must take; nothing is asserted on their behalf.
 */
export type ProcessingActivity = {
  key: string;
  name: string;
  purpose: string;
  legalBasis: string;
  subjects: string;
  dataCategories: string[];
  recipients: string;
  retention: string;
  security: string;
  tables: string[];
  /** Sensitive = health data or minors: appears in the DPIA. */
  sensitive?: boolean;
  openPoints?: string[];
};

export const PROCESSOR_LIST: Array<{ role: string; name: string; location: string; purpose: string; status: string }> = [
  { role: "Hébergement applicatif et base de données", name: "[À COMPLÉTER — OVHcloud pressenti]", location: "Union européenne (France)", purpose: "Exécution du service", status: "À contractualiser (DPA)" },
  { role: "Stockage de fichiers (S3)", name: "[À COMPLÉTER — Scaleway ou OVH Object Storage pressenti]", location: "Union européenne", purpose: "Fichiers déposés, sauvegardes chiffrées", status: "À contractualiser (DPA)" },
  { role: "Paiement", name: "Stripe (mode test uniquement en V1)", location: "UE/États-Unis (clauses contractuelles types)", purpose: "Abonnements payants", status: "Aucune donnée réelle tant que le mode live est inactif" },
  { role: "E-mails transactionnels", name: "[À COMPLÉTER — relais SMTP, Brevo pressenti]", location: "Union européenne", purpose: "Vérification d'e-mail, notifications, invitations", status: "À contractualiser (DPA)" },
  { role: "Calendriers externes (optionnel, à l'initiative de l'utilisateur)", name: "Google Calendar, Microsoft 365", location: "Hors UE possible", purpose: "Synchronisation d'agenda demandée par l'utilisateur", status: "Consentement par connexion OAuth ; jetons chiffrés" },
];

export const PROCESSING_REGISTRY: ProcessingActivity[] = [
  {
    key: "accounts",
    name: "Gestion des comptes et authentification",
    purpose: "Créer et sécuriser un compte, authentifier, gérer les sessions et la double authentification.",
    legalBasis: "Exécution du contrat (CGU) ; intérêt légitime pour la sécurité.",
    subjects: "Organisateurs, professionnels, invités disposant d'un compte, personnel de la plateforme.",
    dataCategories: ["Nom, e-mail, mot de passe haché", "Téléphone, ville (facultatif)", "Préférences (langue, fuseau, notifications)", "Sessions (IP, navigateur), secrets TOTP chiffrés par better-auth"],
    recipients: "Équipe interne ; hébergeur ; relais SMTP.",
    retention: "Durée du compte, puis demande de suppression automatique après {{retention.inactive_account_months}} mois d'inactivité ; sessions expirées purgées quotidiennement.",
    security: "better-auth, cookies HttpOnly/SameSite, rate limit Redis, 2FA TOTP, journal de sécurité.",
    tables: ["users", "sessions", "accounts", "verifications", "two_factors", "user_profiles", "notification_preferences", "login_attempts"],
  },
  {
    key: "professionals",
    name: "Fiches professionnelles et vérification",
    purpose: "Publier une fiche dans l'annuaire, vérifier les déclarations, modérer.",
    legalBasis: "Exécution du contrat ; intérêt légitime (fiabilité de la mise en relation). [À COMPLÉTER : base légale et durée pour les justificatifs — Kbis, attestation d'assurance, diplômes.]",
    subjects: "Professionnels et leurs organisations.",
    dataCategories: ["Identité professionnelle, coordonnées publiques, zone, tarifs", "Pièces justificatives (Kbis/SIRENE, assurance, qualification)", "Historique de modération et de vérification"],
    recipients: "Public (fiche publiée uniquement) ; équipe de modération (justificatifs).",
    retention: "Durée de la fiche ; justificatifs : [À COMPLÉTER].",
    security: "Fichiers en quarantaine puis ClamAV, URL signées courtes, accès justificatifs réservé à la permission moderation.documents.view, journal des accès fichiers.",
    tables: ["professionals", "professional_verifications", "professional_documents", "public_profiles", "profile_versions", "media_assets", "moderation_cases", "moderation_decisions"],
  },
  {
    key: "events",
    name: "Organisation d'évènements (tour de contrôle)",
    purpose: "Permettre à un organisateur de préparer un évènement : équipe, prestataires, tâches, budget, documents, planning.",
    legalBasis: "Exécution du contrat avec l'organisateur ; l'organisateur est responsable des données qu'il saisit sur des tiers (invités, prestataires externes).",
    subjects: "Organisateurs, membres de l'équipe, prestataires, personnes mentionnées dans les documents.",
    dataCategories: ["Détails de l'évènement (date, lieu, budget)", "Membres et rôles", "Tâches, planning, documents (devis, contrats)"],
    recipients: "Membres de l'évènement selon leur rôle et leurs permissions.",
    retention: "Durée de vie de l'évènement, puis archivage/suppression par l'organisateur ; suppression du compte propriétaire = DSR.",
    security: "RBAC + ABAC par évènement, deny by default, audit des changements de droits, isolation testée.",
    tables: ["events", "event_members", "event_permissions", "event_professionals", "event_tasks", "event_milestones", "event_budget_lines", "event_expenses", "event_documents"],
  },
  {
    key: "guests",
    name: "Invités, invitations, QR codes, plan de table",
    purpose: "Gérer la liste des invités, envoyer des invitations, contrôler l'accès le jour J, placer les invités.",
    legalBasis: "Exécution du contrat avec l'organisateur ; l'organisateur informe ses invités. [À COMPLÉTER : mention d'information à fournir aux invités dans les e-mails d'invitation.]",
    subjects: "Invités (y compris mineurs, âge seulement), contacts du carnet d'adresses.",
    dataCategories: ["Nom, e-mail, téléphone, groupe", "Réponse RSVP, préférence alimentaire (décompte, pas de donnée médicale)", "Jetons d'invitation hachés"],
    recipients: "Organisateurs ; prestataires autorisés (traiteur : décomptes alimentaires anonymisés ; lieu : effectifs).",
    retention: "Durée de l'évènement ; jetons expirés révoqués.",
    security: "QR = jeton opaque, jamais de donnée personnelle ; HMAC stocké ; usage limité.",
    tables: ["contacts", "event_guests", "guest_groups", "invitations", "invitation_tokens", "invitation_responses", "invitation_checkins", "seating_tables", "seating_assignments"],
  },
  {
    key: "children",
    name: "Garde d'enfants pendant l'évènement",
    purpose: "Permettre à l'équipe de garde de prendre en charge les enfants en sécurité : présence, remise aux personnes autorisées, consignes.",
    legalBasis: "Exécution de la prestation au nom de l'organisateur ; données de santé : consentement explicite du responsable légal (art. 9.2.a). [À COMPLÉTER : validation juridique, information des parents.]",
    subjects: "Enfants mineurs, responsables légaux, personnes autorisées, contacts d'urgence.",
    dataCategories: ["Prénom, âge (pas de date de naissance), responsable légal et téléphone", "Personnes autorisées à récupérer l'enfant", "Allergies et consignes médicales — chiffrées AES-256-GCM", "Présences, remises, journal des accès"],
    recipients: "Organisateur ; équipe de garde affectée uniquement (ABAC par enfant) ; jamais par e-mail ni QR code.",
    retention: "Anonymisation automatique {{retention.children_days_after_event}} jours après la fin de l'évènement (prénom, nom, contacts remplacés ; données de santé supprimées).",
    security: "Chiffrement colonne, permission children.view_sensitive restreinte, journal child_access_logs, aucune donnée de santé dans les logs/e-mails/exports.",
    tables: ["event_children", "child_sensitive_information", "child_emergency_contacts", "child_authorized_persons", "child_care_assignments", "child_attendance", "child_handover_records", "child_access_logs"],
    sensitive: true,
    openPoints: ["AIPD à finaliser et à faire valider", "Modèle d'information des parents / formulaire de consentement"],
  },
  {
    key: "collaboration",
    name: "Messagerie, demandes et notifications",
    purpose: "Coordonner les équipes d'un évènement, traiter les demandes de devis, notifier.",
    legalBasis: "Exécution du contrat.",
    subjects: "Membres d'un évènement, demandeurs (y compris sans compte), professionnels.",
    dataCategories: ["Messages et pièces jointes", "Demandes (nom, e-mail, téléphone, message, devis)", "Notifications et e-mails transactionnels"],
    recipients: "Membres du canal ; l'organisateur lit tous les canaux de son évènement (affiché).",
    retention: "Durée de l'évènement ; notifications lues purgées après 180 jours ; e-mails envoyés conservés dans l'outbox [À COMPLÉTER : durée].",
    security: "Pas de donnée de santé dans les e-mails, outbox avec reprise, signalement intégré.",
    tables: ["event_channels", "channel_members", "messages", "message_attachments", "inquiries", "inquiry_events", "notifications", "email_outbox"],
  },
  {
    key: "billing",
    name: "Abonnements et facturation",
    purpose: "Vendre et gérer les offres payantes.",
    legalBasis: "Exécution du contrat ; obligation légale (comptabilité).",
    subjects: "Abonnés.",
    dataCategories: ["Identifiant client Stripe, statut d'abonnement, historique des évènements de paiement"],
    recipients: "Stripe (sous-traitant) ; équipe interne.",
    retention: "[À COMPLÉTER : durée légale de conservation des pièces comptables.]",
    security: "Aucune donnée de carte stockée ; webhooks signés et idempotents ; droits vérifiés côté serveur.",
    tables: ["billing_customers", "subscriptions", "billing_events", "promo_codes", "featured_placements"],
  },
  {
    key: "moderation",
    name: "Modération, signalements et recours",
    purpose: "Garantir la fiabilité des contenus et traiter les signalements.",
    legalBasis: "Intérêt légitime ; obligations des plateformes en ligne [À COMPLÉTER : LCEN / DSA].",
    subjects: "Auteurs de contenus, signalants (e-mail facultatif).",
    dataCategories: ["Signalement (motif, détails, e-mail facultatif)", "Décisions motivées, recours"],
    recipients: "Équipe de modération ; autorités si la loi l'exige.",
    retention: "[À COMPLÉTER].",
    security: "Décisions tracées et non modifiables, rate limit du formulaire public.",
    tables: ["reports", "moderation_cases", "moderation_decisions", "appeals"],
  },
  {
    key: "security",
    name: "Journaux d'audit et de sécurité",
    purpose: "Détecter les abus, prouver qui a fait quoi sur les actions sensibles.",
    legalBasis: "Intérêt légitime (sécurité) ; obligation légale (traçabilité des accès aux données sensibles).",
    subjects: "Tous les utilisateurs.",
    dataCategories: ["Action, ressource, horodatage, IP, identifiant de requête — jamais de secret ni de contenu"],
    recipients: "Administrateurs de la plateforme.",
    retention: "{{retention.audit_logs_months}} mois (purge quotidienne).",
    security: "Rédaction des champs sensibles dans le logger, accès réservé à admin.security.view.",
    tables: ["audit_logs", "security_events", "file_access_logs", "retention_jobs"],
  },
  {
    key: "consent_rights",
    name: "Consentements et exercice des droits",
    purpose: "Prouver les consentements (cookies, données de santé, CGU) et traiter les demandes de droits dans le délai légal.",
    legalBasis: "Obligation légale (RGPD art. 7, 12-22, 30).",
    subjects: "Visiteurs (identifiant aléatoire), utilisateurs.",
    dataCategories: ["Finalité, décision, version de la politique, horodatage, IP tronquée/agent utilisateur", "Demandes (type, statut, échéance, fichier d'export)"],
    recipients: "Équipe interne (traitement des demandes).",
    retention: "Consentements : durée de validité + [À COMPLÉTER] ; demandes : [À COMPLÉTER].",
    security: "Identifiant visiteur aléatoire sans empreinte, export produit à la demande sans données de tiers.",
    tables: ["consent_records", "data_subject_requests"],
  },
  {
    key: "analytics",
    name: "Analytique produit interne",
    purpose: "Comprendre l'usage du produit (inscriptions, créations d'évènements, recherches) pour l'améliorer.",
    legalBasis: "Intérêt légitime pour les utilisateurs connectés (mesure minimisée, interne) ; consentement pour les visiteurs anonymes.",
    subjects: "Utilisateurs, visiteurs ayant consenti.",
    dataCategories: ["Nom de l'évènement produit, identifiant utilisateur ou identifiant aléatoire, propriétés énumérées (type d'évènement, catégorie) — jamais de texte libre"],
    recipients: "Équipe interne.",
    retention: "[À COMPLÉTER — 13 mois proposés].",
    security: "Aucun outil tiers, aucune empreinte, aucune donnée de santé.",
    tables: ["product_events"],
  },
];
