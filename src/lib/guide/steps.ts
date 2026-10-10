import type { Capability } from "@/lib/guide/capabilities";

/** Det guiden ved om holdet og brugeren. Hentes på serveren (se `loadGuideFacts`). */
export type GuideFacts = {
  team: {
    mobilePayBox: boolean;
    calendarImported: boolean;
    eventSeries: boolean;
    fineTemplates: boolean;
    fineAutomation: boolean;
    openAiKey: boolean;
    otherMembers: boolean;
    assignedRoles: boolean;
    customTheme: boolean;
  };
  user: {
    pushEnabled: boolean;
    signedUp: boolean;
    avatar: boolean;
    reportedAbsence: boolean;
    createdEvent: boolean;
    createdFine: boolean;
    approvedFine: boolean;
    markedFinePaid: boolean;
    createdCollection: boolean;
    decidedAbsence: boolean;
    createdMotmPoll: boolean;
  };
};

/**
 * setup: noget holdet skal have sat op én gang – klaret uanset hvem der gjorde det.
 * skill: noget brugeren selv skal lære – klaret når brugeren har gjort det.
 * info: ren forklaring – klaret når brugeren har set den.
 */
export type GuideStepKind = "setup" | "skill" | "info";

export type GuideStep = {
  id: string;
  capability: Capability;
  kind: GuideStepKind;
  title: string;
  description: string;
  href: string;
  /** `data-guide`-ankeret på siden, som markeres */
  anchor?: string;
  /** Trinet vises kun, når det giver mening for holdet */
  isRelevant?: (facts: GuideFacts) => boolean;
  /** Afledt af data. Mangler den, er trinet klaret, når brugeren har set det. */
  isDone?: (facts: GuideFacts) => boolean;
};

export const GUIDE_STEPS: readonly GuideStep[] = [
  // Alle
  {
    id: "basis.push",
    capability: "basis",
    kind: "skill",
    title: "Få Holdbold på telefonen",
    description: "Føj appen til hjemmeskærmen og slå push til, så du får besked om begivenheder og bøder.",
    href: "/dashboard/profil",
    anchor: "push-settings",
    isDone: (f) => f.user.pushEnabled
  },
  {
    id: "basis.rsvp",
    capability: "basis",
    kind: "skill",
    title: "Meld til eller fra",
    description: "Sig til, om du kommer til næste træning eller kamp – så ved træneren, hvor mange I bliver.",
    href: "/dashboard/kalender",
    anchor: "rsvp",
    isDone: (f) => f.user.signedUp
  },
  {
    id: "basis.calendar-feed",
    capability: "basis",
    kind: "info",
    title: "Få kampene i din kalender",
    description: "Abonnér på holdets program i Apple, Google eller Outlook Kalender. Det opdaterer sig selv.",
    href: "/dashboard/profil",
    anchor: "calendar-feed"
  },
  {
    id: "basis.pay-fine",
    capability: "basis",
    kind: "info",
    title: "Sådan betaler du en bøde",
    description: "Se dine bøder under Bøder, betal med MobilePay direkte fra appen, og markér dem som betalt.",
    href: "/dashboard/boder",
    anchor: "my-fines"
  },
  {
    id: "basis.absence",
    capability: "basis",
    kind: "skill",
    title: "Meld skade eller fravær",
    description: "Er du skadet eller væk i en periode, så meld det her – så bliver du meldt fra automatisk.",
    href: "/dashboard/fravaer",
    anchor: "report-absence",
    isDone: (f) => f.user.reportedAbsence
  },
  {
    id: "basis.avatar",
    capability: "basis",
    kind: "skill",
    title: "Tilføj et profilbillede",
    description: "Så kan holdkammeraterne se, hvem der har meldt til.",
    href: "/dashboard/profil",
    anchor: "avatar",
    isDone: (f) => f.user.avatar
  },

  // Begivenheder (træner, bødekasseformand, admin)
  {
    id: "events.series",
    capability: "events",
    kind: "setup",
    title: "Opret faste træninger",
    description: "Lav en gentagende træning én gang, så kommer den automatisk i kalenderen hver uge.",
    href: "/dashboard/kalender/ny",
    anchor: "event-recurrence",
    isDone: (f) => f.team.eventSeries
  },
  {
    id: "events.create",
    capability: "events",
    kind: "skill",
    title: "Opret en begivenhed",
    description: "Lav en træning, kamp eller holdfest med tid, sted og tilmeldingsfrist.",
    href: "/dashboard/kalender/ny",
    anchor: "event-form",
    isDone: (f) => f.user.createdEvent
  },
  {
    id: "events.signups",
    capability: "events",
    kind: "info",
    title: "Se hvem der kommer",
    description: "Åbn en begivenhed for at se tilmeldinger og afbud – og hvem der ikke har svaret endnu.",
    href: "/dashboard/kalender",
    anchor: "event-signups"
  },
  {
    id: "events.cancel",
    capability: "events",
    kind: "info",
    title: "Aflys eller genåbn",
    description: "Bliver en træning aflyst, så aflys den i appen. Alle tilmeldte får besked.",
    href: "/dashboard/kalender",
    anchor: "event-admin"
  },
  {
    id: "events.duty-wheel",
    capability: "events",
    kind: "info",
    title: "Ting- og ølhjulet",
    description: "Lad hjulet vælge, hvem der tager bolde og øl med til næste kamp.",
    href: "/dashboard/kalender",
    anchor: "duty-wheel"
  },

  // Bødekassen (bødekasseformand, admin)
  {
    id: "fines.mobilepay",
    capability: "fines",
    kind: "setup",
    title: "Tilknyt MobilePay Box",
    description: "Så kan spillerne betale deres bøder direkte fra appen.",
    href: "/dashboard/boder?fane=kassen",
    anchor: "mobilepay-box",
    isDone: (f) => f.team.mobilePayBox
  },
  {
    id: "fines.templates",
    capability: "fines",
    kind: "setup",
    title: "Byg bødekataloget",
    description: "Opret holdets bøder én for én, eller importér jeres eksisterende liste fra et regneark.",
    href: "/dashboard/boder?fane=kassen",
    anchor: "fine-templates",
    isDone: (f) => f.team.fineTemplates
  },
  {
    id: "fines.automation",
    capability: "fines",
    kind: "setup",
    title: "Slå automatiske bøder til",
    description: "Giv automatisk bøde for sen eller manglende tilmelding – så slipper du for at holde øje.",
    href: "/dashboard/boder?fane=kassen",
    anchor: "fine-automation",
    isDone: (f) => f.team.fineAutomation
  },
  {
    id: "fines.assign",
    capability: "fines",
    kind: "skill",
    title: "Giv en bøde",
    description: "Vælg spiller og bøde fra kataloget. Spilleren får besked med det samme.",
    href: "/dashboard/boder?fane=kassen",
    anchor: "assign-fine",
    isDone: (f) => f.user.createdFine
  },
  {
    id: "fines.voice",
    capability: "fines",
    kind: "info",
    title: "Indtal bøder",
    description: "Sig bøderne højt efter kampen, så laver appen dem for dig.",
    href: "/dashboard/boder?fane=kassen",
    anchor: "voice-fines",
    isRelevant: (f) => f.team.openAiKey
  },
  {
    id: "fines.approve",
    capability: "fines",
    kind: "skill",
    title: "Godkend foreslåede bøder",
    description: "Spillerne kan foreslå bøder til hinanden. Du godkender eller afviser dem.",
    href: "/dashboard/boder?fane=kassen",
    anchor: "proposed-fines",
    isDone: (f) => f.user.approvedFine
  },
  {
    id: "fines.payment",
    capability: "fines",
    kind: "skill",
    title: "Registrér en betaling",
    description: "Bekræft betalinger, når pengene er gået ind på MobilePay Box.",
    href: "/dashboard/boder?fane=kassen",
    anchor: "pending-payments",
    isDone: (f) => f.user.markedFinePaid
  },
  {
    id: "fines.collection",
    capability: "fines",
    kind: "skill",
    title: "Start en indsamling",
    description: "Opkræv et fast beløb fra alle med en frist – fx til holdfesten. Appen rykker selv.",
    href: "/dashboard/boder?fane=kassen",
    anchor: "fine-collection",
    isDone: (f) => f.user.createdCollection
  },

  // Fravær og MOTM (bødekasseformand, admin)
  {
    id: "absences.approve",
    capability: "absences",
    kind: "skill",
    title: "Godkend fravær",
    description: "Godkendt fravær melder spilleren fra automatisk og fritager for bøder i perioden.",
    href: "/dashboard/fravaer",
    anchor: "absence-requests",
    isDone: (f) => f.user.decidedAbsence
  },
  {
    id: "motm.poll",
    capability: "motm",
    kind: "skill",
    title: "Kør en MOTM-afstemning",
    description: "Åbn afstemningen om kampens spiller efter kampen, og afslør vinderen.",
    href: "/dashboard/kalender",
    anchor: "motm-poll",
    isDone: (f) => f.user.createdMotmPoll
  },

  // Admin
  {
    id: "admin.invite",
    capability: "admin",
    kind: "setup",
    title: "Få spillerne med",
    description: "Del holdkoden med holdet, og godkend dem, når de melder sig ind.",
    href: "/dashboard/hold",
    anchor: "team-code",
    isDone: (f) => f.team.otherMembers
  },
  {
    id: "admin.calendar-import",
    capability: "admin",
    kind: "setup",
    title: "Importér kampprogrammet",
    description: "Indsæt DBU-kalenderlinket eller upload et regneark, så kommer kampene ind af sig selv.",
    href: "/dashboard/hold/indstillinger",
    anchor: "calendar-import",
    isDone: (f) => f.team.calendarImported
  },
  {
    id: "admin.roles",
    capability: "admin",
    kind: "setup",
    title: "Fordel rollerne",
    description: "Udnævn trænere og en bødekasseformand, så du ikke skal klare det hele selv.",
    href: "/dashboard/hold",
    anchor: "member-list",
    isDone: (f) => f.team.assignedRoles
  },
  {
    id: "admin.theme",
    capability: "admin",
    kind: "setup",
    title: "Giv appen holdets farver",
    description: "Vælg et tema, der passer til jeres trøjer.",
    href: "/dashboard/hold/indstillinger",
    anchor: "team-theme",
    isDone: (f) => f.team.customTheme
  },
  {
    id: "admin.seasons",
    capability: "admin",
    kind: "info",
    title: "Afslut en sæson",
    description: "Ved sæsonafslutning nulstilles statistik og bødetavle. Ubetalte bøder følger med.",
    href: "/dashboard/hold/indstillinger",
    anchor: "season"
  }
];

const STEP_BY_ID = new Map(GUIDE_STEPS.map((step) => [step.id, step]));

export function getGuideStep(id: string) {
  return STEP_BY_ID.get(id);
}
