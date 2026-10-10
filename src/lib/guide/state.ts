import type { Role } from "@/lib/roles";
import { capabilitiesForRole, newCapabilities, type Capability } from "@/lib/guide/capabilities";
import { GUIDE_STEPS, type GuideFacts, type GuideStep, type GuideStepKind } from "@/lib/guide/steps";

export type GuideProgressStatus = "SEEN" | "DONE" | "SKIPPED";

export type GuideStepState = {
  id: string;
  capability: Capability;
  kind: GuideStepKind;
  title: string;
  description: string;
  href: string;
  anchor: string | null;
  status: "todo" | "done" | "skipped";
  /** team: holdet har det allerede (fx en anden har sat MobilePay op). you: brugeren har selv klaret det. */
  doneBy: "team" | "you" | null;
};

export type GuidePromotion = {
  from: Role;
  to: Role;
  capabilities: Capability[];
  /** Trin i de nye rettigheder, der ikke allerede er klaret */
  stepIds: string[];
};

export type GuideState = {
  role: Role;
  capabilities: Capability[];
  /** Brugeren har aldrig fået guide på holdet og har ikke sprunget den over */
  intro: boolean;
  dismissed: boolean;
  promotion: GuidePromotion | null;
  steps: GuideStepState[];
  summary: { total: number; done: number; skipped: number; todo: number };
};

export type GuideStateInput = {
  role: Role;
  guideRole: Role | null;
  dismissed: boolean;
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
    status,
    doneBy
  };
}

export function computeGuideState(input: GuideStateInput): GuideState {
  const caps = capabilitiesForRole(input.role);
  const steps = GUIDE_STEPS.filter(
    (step) => caps.includes(step.capability) && (step.isRelevant?.(input.facts) ?? true)
  ).map((step) => stepState(step, input));

  let promotion: GuidePromotion | null = null;
  if (input.guideRole && input.guideRole !== input.role) {
    const gained = newCapabilities(input.guideRole, input.role);
    if (gained.length > 0) {
      promotion = {
        from: input.guideRole,
        to: input.role,
        capabilities: gained,
        stepIds: steps.filter((s) => gained.includes(s.capability) && s.status === "todo").map((s) => s.id)
      };
    }
  }

  const count = (status: GuideStepState["status"]) => steps.filter((s) => s.status === status).length;

  return {
    role: input.role,
    capabilities: caps,
    intro: input.guideRole === null && !input.dismissed,
    dismissed: input.dismissed,
    promotion,
    steps,
    summary: { total: steps.length, done: count("done"), skipped: count("skipped"), todo: count("todo") }
  };
}

/**
 * Hvilken `guideRole` en membership skal have efter et rolleskift.
 * Ved forfremmelse beholdes den gamle, så guiden kan vise de nye dele. Uden nye rettigheder er der intet at vise.
 */
export function guideRoleAfterRoleChange(guideRole: Role | null, newRole: Role): Role | null {
  if (guideRole === null) return null;
  return newCapabilities(guideRole, newRole).length > 0 ? guideRole : newRole;
}
