import { and, eq } from "drizzle-orm";
import { channelMembers, eventChannels, messageAttachments, messages } from "@/db/schema";
import { buildDemoPdf, demoActor, slugFileName, uploadDemoFile } from "./_demo-files";
import type { SeedContext } from "./context";

/**
 * Demo messaging: channels and three months of realistic coordination for the
 * wedding (plus a lighter thread for the two other events). Idempotent:
 * channels are upserted by (event, name); the demo messages of those channels
 * are wiped and recreated so the thread always reads the same (dates are
 * relative to the seed run). Attachments go through the real file pipeline.
 */
type Msg = { from: string; body: string; d: number; t: string; files?: string[] };
type ChannelSpec = { name: string; kind: "general" | "topic" | "coordination"; description: string; memberKeys: string[] | "all"; messages: Msg[] };
type AttachmentSpec = { key: string; uploaderKey: string; title: string; lines: string[] };

const FIRST_NAMES: Record<string, string> = { louis: "Louis", lisa: "Lisa", camille: "Camille", marie: "Marie", nora: "Nora", julien: "Julien", helene: "Hélène", theo: "Théo", ines: "Inès", paul: "Paul", sofia: "Sofia" };

const WEDDING_ATTACHMENTS: AttachmentSpec[] = [
  { key: "plan", uploaderKey: "helene", title: "Plan de l'orangerie — implantation 12 tables", lines: ["Orangerie 24 × 12 m : 12 tables rondes de 10, piste 6 × 6 m au centre", "Régie DJ à droite de la piste, buffet desserts côté terrasse", "Issues de secours : 3, à laisser dégagées"] },
  { key: "programme", uploaderKey: "marie", title: "Programme de l'espace enfants (version 2)", lines: ["14h30 accueil et pointage", "15h chasse au trésor dans le parc (pendant la cérémonie)", "16h30 goûter sans fruits à coque · 18h atelier masques", "19h dîner des enfants · 21h film et coucher des petits"] },
  { key: "fiche-tech", uploaderKey: "theo", title: "Fiche technique sonorisation", lines: ["Façade : 2 × 15\" actives + 2 caissons 18\"", "Alimentation : 2 × 16A dédiés en régie + 1 × 16A terrasse", "2 micros HF main (discours), 1 micro serre-tête (cérémonie)", "Installation 16h → 17h30, balances 17h30"] },
];

const WEDDING_CHANNELS: ChannelSpec[] = [
  {
    name: "Général",
    kind: "general",
    description: "Canal ouvert à toute l'équipe de l'évènement.",
    memberKeys: "all",
    messages: [
      { from: "louis", body: "Bienvenue à toute l'équipe du mariage ! Ce canal est ouvert à tous les prestataires. Le planning du jour J est dans l'onglet Planning, les documents utiles dans Documents.", d: 92, t: "18:40" },
      { from: "camille", body: "Hello ! Je suis Camille, wedding planner. Je centralise les questions d'organisation : n'hésitez pas à me mentionner avec @Camille.", d: 92, t: "19:05" },
      { from: "helene", body: "Bonjour à tous, Hélène du Domaine des Tilleuls. Ravie de vous accueillir le 12 juin. Les visites techniques se font le samedi matin sur rendez-vous.", d: 91, t: "09:30" },
      { from: "ines", body: "Bonjour ! Inès, photographe. J'arriverai à midi pour les préparatifs. @Camille peux-tu me dire où se préparent les mariés ?", d: 88, t: "11:12" },
      { from: "camille", body: "@Inès : Lisa dans la suite du domaine (1er étage), Louis dans le gîte à côté de la grange. Je te mets le plan dans Documents.", d: 88, t: "11:40" },
      { from: "theo", body: "Salut tout le monde, Théo (DJ). Je confirme ma dispo. @Louis je t'envoie le brief musical à remplir cette semaine, c'est dans l'onglet Brief musical.", d: 85, t: "20:15" },
      { from: "lisa", body: "Merci à tous ! On est tellement contents de vous avoir avec nous. 💐", d: 85, t: "21:02" },
      { from: "julien", body: "Bonjour, Julien de Rossi Traiteur. Dégustation prévue le 3 octobre à Albi avec Louis et Lisa, je vous dirai ensuite ce qui change au menu.", d: 70, t: "08:50" },
      { from: "marie", body: "Bonjour à tous ! Marie, responsable de l'espace enfants, avec @Nora en renfort. 14 enfants de 2 à 11 ans : on prépare un vrai programme, pas juste une garderie.", d: 66, t: "12:20" },
      { from: "nora", body: "Hâte d'y être ! Je m'occupe du coin sieste et des petits.", d: 66, t: "12:35" },
      { from: "camille", body: "Compte rendu de la visite technique du 8 septembre en ligne dans Documents. Points clés : portail ouest dès 9h pour les livraisons, régie DJ à droite de la piste, plan B pluie dans l'orangerie.", d: 39, t: "17:10" },
      { from: "helene", body: "Petit rappel : stationnement prestataires derrière la grange, l'allée principale reste libre pour les invités.", d: 30, t: "10:05" },
      { from: "lisa", body: "Les invitations sont parties ! 25 envoyées, déjà 13 réponses. Les enfants inscrits par leurs parents apparaissent automatiquement dans l'espace enfants.", d: 20, t: "19:30" },
      { from: "julien", body: "Le devis v2 (menu enfants + option brunch) est en ligne. @Louis @Lisa à vous de jouer avant le 30 octobre pour bloquer la date 😊", d: 9, t: "14:22" },
      { from: "louis", body: "Merci @Julien, on regarde ça ce week-end. Et merci à tous pour la réactivité, on avance bien : 11 tâches sur 35 sont déjà faites.", d: 8, t: "21:45" },
      { from: "camille", body: "Rappel à tous : merci de vérifier vos horaires dans le planning, j'ai ajusté l'installation du DJ à 16h et le goûter des enfants à 16h30.", d: 1, t: "09:15" },
      { from: "ines", body: "Vu, c'est bon pour moi. Je serai sur la terrasse pour le cocktail à 17h.", d: 1, t: "09:48" },
      { from: "theo", body: "Parfait pour 16h. Je dépose la fiche technique dans le canal Musique.", d: 0, t: "08:30" },
    ],
  },
  {
    name: "Logistique lieu & traiteur",
    kind: "coordination",
    description: "Accès, horaires de livraison, cuisine, plan de salle.",
    memberKeys: ["helene", "julien", "camille", "louis", "lisa"],
    messages: [
      { from: "camille", body: "Bonjour à tous ! Canal dédié à la logistique entre le domaine et le traiteur. @Hélène peux-tu confirmer l'heure d'ouverture de l'accès livraisons ?", d: 80, t: "10:02" },
      { from: "helene", body: "Bonjour ! Le portail livraisons (ouest) est ouvert dès 9h le samedi. La cuisine traiteur est équipée : 2 fours, chambre froide 4 m³, plonge.", d: 80, t: "10:40" },
      { from: "julien", body: "Parfait, merci @Hélène. Nous arriverons vers 10h avec deux véhicules. Combien de prises 32A dans l'office ?", d: 79, t: "08:15" },
      { from: "helene", body: "Deux prises 32A triphasé + six 16A, toutes à côté du passe. Je vous envoie le plan de l'orangerie en pièce jointe.", d: 79, t: "09:02", files: ["plan"] },
      { from: "julien", body: "Impeccable, le plan est clair. Le buffet desserts côté terrasse me convient, on gardera la piste dégagée.", d: 78, t: "12:30" },
      { from: "lisa", body: "Question vaisselle : @Hélène tu fournis les assiettes et couverts, @Julien la verrerie ? C'est bien ça ?", d: 60, t: "20:10" },
      { from: "helene", body: "Oui : vaisselle et nappage par le domaine (120 couverts), verrerie par le traiteur.", d: 60, t: "20:25" },
      { from: "julien", body: "Exact, j'apporte la verrerie cocktail + dîner. Il me faudra juste 4 mange-debout supplémentaires sur la terrasse.", d: 59, t: "07:55" },
      { from: "camille", body: "Les mange-debout sont dans le devis LocDéco (livraison vendredi 14h). Je l'ajoute au planning d'installation.", d: 59, t: "09:10" },
      { from: "louis", body: "Pour le goûter des enfants à 16h30, @Julien tu peux prévoir une version sans fruits à coque ? Marie a quelques consignes des parents.", d: 45, t: "13:05" },
      { from: "julien", body: "Oui bien sûr : madeleines, fruits frais, jus. Je note « sans fruits à coque » pour tout le goûter et le dîner des enfants.", d: 45, t: "13:40" },
      { from: "camille", body: "Plan B pluie validé avec Hélène : cérémonie dans l'orangerie, chaises installées dès 8h, dressage des tables décalé à 12h. @Julien ça te va ?", d: 29, t: "16:20" },
      { from: "julien", body: "Oui si l'orangerie est libre à 12h précises. Au-delà on dresse pendant la cérémonie, c'est jouable.", d: 29, t: "16:48" },
      { from: "helene", body: "Coupure d'eau programmée par la commune le 10 juin de 9h à 12h : sans impact sur le 12, mais je vous préviens au cas où vous passiez déposer du matériel.", d: 12, t: "11:00" },
      { from: "camille", body: "Merci pour l'info. Dernier point : tri des déchets obligatoire, @Julien tu as des bacs identifiés ?", d: 12, t: "11:30" },
      { from: "julien", body: "Oui, trois bacs (verre, emballages, bio) avec mon équipe. On repart avec tout le dimanche à midi.", d: 12, t: "12:05" },
      { from: "lisa", body: "Vous êtes au top. On valide le devis v2 lundi, promis !", d: 8, t: "22:00" },
    ],
  },
  {
    name: "Espace enfants",
    kind: "coordination",
    description: "Coordination de la garde : effectifs, activités, consignes.",
    memberKeys: ["marie", "nora", "camille", "louis", "lisa"],
    messages: [
      { from: "marie", body: "Bonjour ! Nous serons deux sur place avec @Nora. Pour 14 enfants de 2 à 11 ans c'est confortable. @Louis les inscriptions des parents sont bien ouvertes ?", d: 64, t: "09:20" },
      { from: "louis", body: "Oui, 9 enfants déjà inscrits par leurs parents. Les 5 derniers d'ici fin du mois.", d: 64, t: "12:45" },
      { from: "nora", body: "Super. On prévoit un coin sieste séparé pour les 2 petits de moins de 3 ans ?", d: 63, t: "08:30" },
      { from: "camille", body: "Oui, Hélène nous laisse le fond de la grange avec deux lits parapluie et des matelas. Je l'ajoute au brief logistique.", d: 63, t: "09:05" },
      { from: "marie", body: "Programme prévu : jeux calmes à l'arrivée, chasse au trésor dans le parc à 15h (pendant la cérémonie), goûter 16h30, atelier masques 18h, film + coucher des petits 21h. Version 2 en pièce jointe.", d: 50, t: "14:10", files: ["programme"] },
      { from: "lisa", body: "C'est parfait, les enfants vont adorer la chasse au trésor ! Pour le film, quelque chose de doux pour les 2-5 ans ?", d: 50, t: "19:30" },
      { from: "nora", body: "Oui, un film d'animation calme, lumière tamisée, matelas et duvets. Les grands pourront rester au dîner ou nous rejoindre.", d: 49, t: "07:45" },
      { from: "louis", body: "Les consignes de santé sont dans les fiches enfants, visibles uniquement par vous deux et Camille, avec un motif à chaque consultation.", d: 40, t: "21:15" },
      { from: "marie", body: "Bien noté, nous ne consultons que ce qui est nécessaire pour les enfants qui nous sont confiés. 👍", d: 40, t: "21:30" },
      { from: "marie", body: "Point effectifs : 9 fiches complètes sur 14. Il manque les familles Perrin, Costa et Fontaine pour les autorisations de récupération.", d: 7, t: "10:00" },
      { from: "lisa", body: "Je les relance ce soir. @Marie pour le goûter, Julien a confirmé : tout sans fruits à coque.", d: 7, t: "18:20" },
      { from: "marie", body: "Merci ! Dernière chose : il me manque 2 lits parapluie. @Camille tu confirmes que Hélène les prête ?", d: 5, t: "09:12" },
      { from: "camille", body: "Confirmé : deux lits parapluie + matelas de sieste dans la grange dès le vendredi. C'est dans la tâche « kit de survie des enfants ».", d: 5, t: "09:40" },
      { from: "nora", body: "Génial. J'apporte les coloriages et les Kapla, Marie la trousse de secours et la malle d'activités.", d: 4, t: "13:05" },
    ],
  },
  {
    name: "Musique & moments clés",
    kind: "coordination",
    description: "Entrée, ouverture de bal, discours : qui lance quoi et quand.",
    memberKeys: ["theo", "camille", "louis", "lisa", "ines"],
    messages: [
      { from: "theo", body: "Salut ! Ce canal pour caler les moments clés. @Lisa @Louis le brief musical est pré-rempli, dites-moi ce qui ne vous plaît pas.", d: 58, t: "19:00" },
      { from: "lisa", body: "Entrée de cérémonie : A Thousand Years. Ouverture de bal : Perfect, puis September pour lancer la piste. Pas de Macarena, pas de chenille 🙏", d: 57, t: "20:30" },
      { from: "theo", body: "Noté et validé ! Pour l'entrée en salle je propose Can't Stop the Feeling, et Sugar pour la pièce montée.", d: 57, t: "21:05" },
      { from: "louis", body: "Parfait pour nous. Les discours : Maxime (témoin) au cocktail vers 18h30, les parents au dîner vers 21h. Deux micros HF ?", d: 50, t: "12:00" },
      { from: "theo", body: "Oui, deux micros HF main pour les discours + un serre-tête pour l'officiante de la cérémonie. Tout est dans la fiche technique.", d: 50, t: "12:40" },
      { from: "camille", body: "@Inès pour l'ouverture de bal à 23h30 tu veux une lumière particulière ? Théo a une machine à brouillard légère.", d: 25, t: "15:10" },
      { from: "ines", body: "Brouillard léger oui, mais lumière chaude et pas de stroboscope pendant la première minute, sinon mes photos sont inexploitables.", d: 25, t: "15:35" },
      { from: "theo", body: "Reçu : chaud et fixe la première minute, puis je monte progressivement. Fiche technique ci-jointe pour Hélène et Camille.", d: 0, t: "08:35", files: ["fiche-tech"] },
      { from: "camille", body: "Merci Théo ! Je l'ajoute aux documents de l'équipe.", d: 0, t: "09:02" },
    ],
  },
  {
    name: "Photos & vidéo",
    kind: "topic",
    description: "Liste des photos de groupe, lieux de shooting, autorisations de diffusion.",
    memberKeys: ["ines", "camille", "louis", "lisa", "theo"],
    messages: [
      { from: "ines", body: "Bonjour ! Pour les photos de groupe après la cérémonie, j'ai besoin d'une liste des groupes dans l'ordre. @Camille tu t'en occupes ?", d: 44, t: "10:15" },
      { from: "camille", body: "Oui : 1) tous les invités depuis l'escalier 2) famille Marchand 3) famille Bertrand 4) témoins 5) amis d'enfance 6) collègues. Je l'ajoute dans la liste de prises de vue.", d: 44, t: "11:00" },
      { from: "lisa", body: "On aimerait aussi des photos de couple à la golden hour, vers 21h15 dans l'allée de platanes. C'est possible pendant le dîner ?", d: 40, t: "22:10" },
      { from: "ines", body: "Oui, 20 minutes entre le plat et le fromage, c'est le moment idéal. Je préviens Julien pour caler le service.", d: 39, t: "08:05" },
      { from: "louis", body: "Pour la diffusion sur ton site : d'accord pour les photos de couple et de décoration, pas celles des enfants sans accord des parents.", d: 30, t: "19:40" },
      { from: "ines", body: "Évidemment. Les autorisations de diffusion sont suivies ligne par ligne dans l'onglet Images, je ne publie rien qui n'est pas coché.", d: 30, t: "20:00" },
      { from: "theo", body: "@Inès pour la vidéo de l'ouverture de bal, tu veux que je te laisse 30 secondes de silence avant Perfect pour ton plan d'entrée ?", d: 3, t: "17:25" },
      { from: "ines", body: "Oui, parfait ! 30 secondes, lumière chaude, et je me place face à l'escalier.", d: 3, t: "17:50" },
    ],
  },
];

const BAPTEME_CHANNELS: ChannelSpec[] = [
  {
    name: "Général",
    kind: "general",
    description: "Canal ouvert à toute l'équipe de l'évènement.",
    memberKeys: "all",
    messages: [
      { from: "paul", body: "Bienvenue Sofia ! Hâte de voir le programme pour les 9 enfants.", d: 21, t: "18:00" },
      { from: "sofia", body: "Merci Paul ! Je prévois maquillage, bulles géantes et un petit spectacle à 16h, juste avant le gâteau.", d: 21, t: "18:30" },
      { from: "paul", body: "Top. La salle annexe est à vous dès 13h30, il y a un coin moquette pour les tout-petits.", d: 10, t: "12:15" },
      { from: "sofia", body: "Parfait, j'apporte un tapis d'éveil et des coussins. Je vous mets le programme dans Documents cette semaine.", d: 10, t: "12:40" },
    ],
  },
];

const SEMINAIRE_CHANNELS: ChannelSpec[] = [
  { name: "Général", kind: "general", description: "Canal ouvert à toute l'équipe de l'évènement.", memberKeys: "all", messages: [{ from: "paul", body: "Espace de coordination du séminaire 2027. Prestataires à venir : traiteur et animation en cours de sélection.", d: 15, t: "09:00" }] },
];

export async function seed(ctx: SeedContext): Promise<void> {
  await seedEventChannels(ctx, "louisLisa", WEDDING_CHANNELS, WEDDING_ATTACHMENTS);
  await seedEventChannels(ctx, "baptemeChloe", BAPTEME_CHANNELS, []);
  await seedEventChannels(ctx, "seminaireDiginumia", SEMINAIRE_CHANNELS, []);
}

async function seedEventChannels(ctx: SeedContext, eventKey: string, specs: ChannelSpec[], attachments: AttachmentSpec[]): Promise<void> {
  const { db, now } = ctx;
  const eventId = ctx.events[eventKey];
  if (!eventId) {
    process.stdout.write(`collaboration: event ${eventKey} missing, skipped\n`);
    return;
  }
  const memberIds = Object.entries(ctx.members)
    .filter(([k]) => k.startsWith(`${eventKey}:`))
    .map(([k, id]) => [k.slice(eventKey.length + 1), id] as const);
  const memberIdByUserKey = new Map(memberIds);
  const ownerUserId = ctx.users.louis && eventKey === "louisLisa" ? ctx.users.louis : ctx.users.paul;

  // Attachments: uploaded once per author (identical bytes are deduplicated by the pipeline).
  const fileIdByKey = new Map<string, string>();
  for (const a of attachments) {
    const actor = await demoActor(ctx, a.uploaderKey);
    if (!actor) continue;
    const bytes = await buildDemoPdf(a.title, a.lines);
    const fileId = await uploadDemoFile(actor, { scope: "event", scopeId: eventId, purpose: "attachment", originalName: slugFileName(a.title), bytes });
    if (fileId) fileIdByKey.set(a.key, fileId);
  }

  const existing = await db.select({ id: eventChannels.id, name: eventChannels.name }).from(eventChannels).where(eq(eventChannels.eventId, eventId));
  const channelIdByName = new Map(existing.map((c) => [c.name, c.id]));
  for (const spec of specs) {
    let channelId = channelIdByName.get(spec.name);
    const isOpen = spec.memberKeys === "all";
    if (channelId) {
      await db.update(eventChannels).set({ kind: spec.kind, description: spec.description, isOpenToAllMembers: isOpen }).where(eq(eventChannels.id, channelId));
    } else {
      const [row] = await db.insert(eventChannels).values({ eventId, kind: spec.kind, name: spec.name, description: spec.description, isOpenToAllMembers: isOpen, createdByUserId: ownerUserId ?? null }).returning({ id: eventChannels.id });
      if (!row) continue;
      channelId = row.id;
      channelIdByName.set(spec.name, channelId);
    }
    const members = isOpen ? memberIds.map(([, id]) => id) : (spec.memberKeys as string[]).map((k) => memberIdByUserKey.get(k)).filter((x): x is string => Boolean(x));
    if (members.length) {
      // Everyone read the thread two days ago: the latest messages show up as unread on the dashboards.
      await db
        .insert(channelMembers)
        .values(members.map((memberId) => ({ channelId: channelId!, memberId, lastReadAt: new Date(now.getTime() - 2 * 86_400_000) })))
        .onConflictDoNothing();
    }

    // Demo thread: wiped and recreated (attachments cascade).
    await db.delete(messages).where(and(eq(messages.channelId, channelId), eq(messages.eventId, eventId)));
    const rows = spec.messages
      .map((m) => {
        const authorUserId = ctx.users[m.from];
        if (!authorUserId) return null;
        const mentions = Object.entries(FIRST_NAMES)
          .filter(([key, first]) => key !== m.from && m.body.includes(`@${first}`) && ctx.users[key])
          .map(([key]) => ctx.users[key]!);
        const createdAt = atDaysAgo(now, m.d, m.t);
        return { channelId: channelId!, eventId, authorUserId, body: m.body, mentions, createdAt, updatedAt: createdAt, files: m.files ?? [] };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (!rows.length) continue;
    const inserted = await db
      .insert(messages)
      .values(rows.map((r) => ({ channelId: r.channelId, eventId: r.eventId, authorUserId: r.authorUserId, body: r.body, mentions: r.mentions, createdAt: r.createdAt, updatedAt: r.updatedAt })))
      .returning({ id: messages.id, createdAt: messages.createdAt });
    const attachmentRows = rows.flatMap((r, i) =>
      r.files
        .map((k) => fileIdByKey.get(k))
        .filter((x): x is string => Boolean(x))
        .map((fileId) => ({ messageId: inserted[i]!.id, fileId })),
    );
    if (attachmentRows.length) await db.insert(messageAttachments).values(attachmentRows);
  }

}

/** `d` days before the seed run, at local Paris time `HH:MM`. */
function atDaysAgo(now: Date, days: number, hm: string): Date {
  const [h = 9, m = 0] = hm.split(":").map(Number);
  const d = new Date(now.getTime() - days * 86_400_000);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  // Approximate offset (CET/CEST): good enough for relative demo timestamps.
  const month = Number(day.slice(5, 7));
  const offset = month >= 4 && month <= 10 ? "+02:00" : "+01:00";
  return new Date(`${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${offset}`);
}
