import type { Role } from "@/lib/roles";
import { capabilitiesForRoles, newCapabilities, type Capability } from "@/lib/guide/capabilities";
import { GUIDE_STEPS, type GuideEntry, type GuideFacts, type GuideStep, type GuideStepKind } from "@/lib/guide/steps";

export type GuideProgressStatus = "SEEN" | "DONE" | "SKIPPED";

export type GuideStepState = {
  id: string;
  capability: Capability;
  kind: GuideStepKind;
  title: string;
  description: string;
  href: string;
  anchor: string | null;
  entry: GuideEntry | null;
  status: "todo" | "done" | "skipped";
  /** team: holdet har det allerede (fx en anden har sat MobilePay op). you: brugeren har selv klaret det. */
  doneBy: "team" | "you" | null;
};

export type GuidePromotion = {
  from: Role[];
  to: Role[];
  /** De roller, brugeren har fået siden sidst */
  gainedRoles: Role[];
  capabilities: Capability[];
  /** Trin i de nye rettigheder, der ikke allerede er klaret */
  stepIds: string[];
};

/**
 * intro: nyt medlem – vis velkomsten.
 * announce: medlem fra før guiden fandtes – vis det diskrete "Nyt"-kort.
 * checklist: brugeren har sagt ja til guiden – vis "Kom i gang".
 * hidden: guiden er sprunget over.
 */
export type GuideMode = "intro" | "announce" | "checklist" | "hidden";

export type GuideState = {
  roles: Role[];
  capabilities: Capability[];
  mode: GuideMode;
  promotion: GuidePromotion | null;
  steps: GuideStepState[];
  summary: { total: number; done: number; skipped: number; todo: number };
};

export type GuideStateInput = {
  roles: Role[];
  /** Rollerne brugeren sidst fik guide til. Tom: har aldrig fået guiden. */
  guideRoles: Role[];
  dismissed: boolean;
  started: boolean;
  facts: GuideFacts;
  progress: Record<string, GuideProgressStatus>;
};

function stepState(step: GuideStep, input: GuideStateInput): GuideStepState {
  const saved = input.progress[step.id];
  const derivedDone = step.isDone?.(input.facts) ?? false;

  let status: GuideStepState["status"] = "todo";
  let doneBy: GuideStepState["doneBy"] = null;
  if (derivedDone) {
    status = "done";
    doneBy = step.kind === "setup" ? "team" : "you";
  } else if (saved === "DONE" || (saved === "SEEN" && !step.isDone)) {
    status = "done";
    doneBy = "you";
  } else if (saved === "SKIPPED") {
    status = "skipped";
  }

  return {
    id: step.id,
    capability: step.capability,
    kind: step.kind,
    title: step.title,
    description: step.description,
    href: step.href,
    anchor: step.anchor ?? null,
    entry: step.entry ?? null,
    status,
    doneBy
  };
}

export function computeGuideState(input: GuideStateInput): GuideState {
  const caps = capabilitiesForRoles(input.roles);
  const steps = GUIDE_STEPS.filter(
    (step) => caps.includes(step.capability) && (step.isRelevant?.(input.facts) ?? true)
  ).map((step) => stepState(step, input));

  let promotion: GuidePromotion | null = null;
  if (input.guideRoles.length > 0) {
    const gained = newCapabilities(input.guideRoles, input.roles);
    if (gained.length > 0) {
      promotion = {
        from: input.guideRoles,
        to: input.roles,
        gainedRoles: input.roles.filter((role) => !input.guideRoles.includes(role)),
        capabilities: gained,
        stepIds: steps.filter((s) => gained.includes(s.capability) && s.status === "todo").map((s) => s.id)
      };
    }
  }

  const count = (status: GuideStepState["status"]) => steps.filter((s) => s.status === status).length;

  return {
    roles: input.roles,
    capabilities: caps,
    mode: guideMode(input),
    promotion,
    steps,
    summary: { total: steps.length, done: count("done"), skipped: count("skipped"), todo: count("todo") }
  };
}

/** Det, rollen er til for, kommer først: en ny bødeformand skal i gang med bødekassen før profilbilledet. */
const NEXT_PRIORITY: readonly Capability[] = ["admin", "fines", "events", "absences", "motm", "basis"];

/** De næste trin, brugeren bør tage – rollens egne dele først, ellers i guidens rækkefølge. */
export function nextGuideSteps(steps: GuideStepState[], count: number) {
  return steps
    .filter((step) => step.status === "todo")
    .sort((a, b) => NEXT_PRIORITY.indexOf(a.capability) - NEXT_PRIORITY.indexOf(b.capability))
    .slice(0, count);
}

function guideMode(input: GuideStateInput): GuideMode {
  if (input.dismissed) return "hidden";
  if (input.started) return "checklist";
  return input.guideRoles.length === 0 ? "intro" : "announce";
}

/**
 * Hvilke `guideRoles` en membership skal have efter et rolleskift.
 * Giver de nye roller noget nyt, beholdes de gamle, så guiden kan vise de nye dele. Ellers er der intet at vise.
 */
export function guideRolesAfterRoleChange(guideRoles: readonly Role[], newRoles: readonly Role[]): Role[] {
  if (guideRoles.length === 0) return [];
  return newCapabilities(guideRoles, newRoles).length > 0 ? [...guideRoles] : [...newRoles];
}
