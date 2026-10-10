"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import { invalidateDashboardTeam, useDashboardTeam, type DashboardTeamMember } from "@/components/DashboardTeamProvider";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Sheet, { ConfirmSheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/primitives";
import { ROLE_LABELS, roleLabel } from "@/lib/roleLabels";

const ROLE_HINTS: Record<string, string> = {
  ADMIN: "Styrer alt på holdet",
  TRAENER: "Opretter og aflyser begivenheder",
  BOEDEKASSEFORMAND: "Styrer bødekassen",
  SPILLER: "Almindelig spiller",
  SOME: "Sociale medier – får ikke automatiske bøder"
};

const ROLES = ["ADMIN", "TRAENER", "BOEDEKASSEFORMAND", "SPILLER", "SOME"] as const;

/** Medlem: rolle (gemmes ved valg) og fjernelse. Kun admin kan ændre noget. */
export default function MemberSheet({
  member,
  isSelf,
  canEdit,
  onClose,
  onChanged
}: {
  member: DashboardTeamMember | null;
  isSelf: boolean;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const { pushToast } = useToast();
  const { removeMemberLocally } = useDashboardTeam();
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function setRole(role: string) {
    if (!member || role === member.role) return;
    setSaving(role);
    try {
      const response = await fetch(`/api/team-members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke ændre rollen", "error");
        return;
      }
      pushToast(`${member.user.name?.split(" ")[0] ?? "Medlemmet"} er nu ${roleLabel(role).toLowerCase()}`, "success");
      invalidateDashboardTeam();
      await onChanged();
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!member) return;
    setSaving("remove");
    try {
      const response = await fetch(`/api/team-members/${member.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Serveren kan nå at fjerne medlemmet, selvom svaret fejler – hent listen igen, så den er sand.
        invalidateDashboardTeam();
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke fjerne medlemmet", "error");
        return;
      }
      removeMemberLocally(member.id);
      setConfirmRemove(false);
      onClose();
      pushToast(typeof data.warning === "string" ? data.warning : "Medlemmet er fjernet fra holdet", "success");
      invalidateDashboardTeam();
      await onChanged();
    } finally {
      setSaving(null);
    }
  }

  // Nulstil bekræftelsen, når der vælges et andet (eller intet) medlem, så dialogen aldrig hænger fast.
  useEffect(() => {
    setConfirmRemove(false);
  }, [member?.id]);

  const name = member?.user.name ?? "Medlem";

  return (
    <>
      <Sheet open={Boolean(member) && !confirmRemove} onClose={onClose} dismissible={saving === null} title={name}>
        {member ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={member.user.name} image={member.user.image} size="xl" />
              <div className="min-w-0">
                <p className="truncate text-sm text-ink/60">{member.user.email ?? "Ingen email"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip tone="primary">{roleLabel(member.role)}</Chip>
                  {member.status !== "ACTIVE" ? <Chip tone="pending">Afventer</Chip> : null}
                  {isSelf ? <Chip>Dig</Chip> : null}
                </div>
              </div>
            </div>

            {canEdit ? (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-ink/80">Rolle</p>
                  {isSelf ? (
                    <p className="text-sm text-ink/55">Du kan ikke ændre din egen rolle. Bed en anden admin om det.</p>
                  ) : null}
                  <ul className="space-y-1.5">
                    {ROLES.map((role) => {
                      const selected = member.role === role;
                      return (
                        <li key={role}>
                          <button
                            type="button"
                            disabled={isSelf || saving !== null}
                            onClick={() => setRole(role)}
                            aria-pressed={selected}
                            className={cn(
                              "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 text-left transition active:scale-[0.99] disabled:opacity-60",
                              selected ? "border-moss bg-moss/10" : "border-line hover:bg-ink/[0.03]"
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold text-ink">{ROLE_LABELS[role]}</span>
                              <span className="block text-sm text-ink/55">{ROLE_HINTS[role]}</span>
                            </span>
                            {saving === role ? (
                              <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
                            ) : selected ? (
                              <Icon name="check" className="h-5 w-5 text-moss" strokeWidth={2.6} />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {!isSelf ? (
                  <Button block variant="danger" icon="x" onClick={() => setConfirmRemove(true)}>
                    Fjern fra holdet
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={remove}
        loading={saving === "remove"}
        title={`Fjern ${name.split(" ")[0]}?`}
        description="Medlemmet mister adgang til holdet. Historik som bøder og svar bliver gemt."
        confirmLabel="Fjern fra holdet"
      />
    </>
  );
}
