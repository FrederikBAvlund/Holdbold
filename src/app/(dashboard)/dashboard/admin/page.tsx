"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useDashboardTeam } from "@/components/DashboardTeamProvider";
import { useToast } from "@/components/ToastProvider";
import Button from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { Chip, ListGroup, ListRow, PageHeader, Section, Skeleton, inputClass } from "@/components/ui/primitives";

type AdminTeam = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  activeMembers: number;
  isMember: boolean;
  /** Alle andre medlemmer end dig selv (også afventende) */
  otherMembers: number;
};

export default function AdminPage() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const { pushToast } = useToast();
  const { setTeamId, teamId, memberships, refreshDashboardTeam } = useDashboardTeam();
  const [teams, setTeams] = useState<AdminTeam[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<AdminTeam | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/teams", { cache: "no-store" });
    if (!response.ok) {
      setTeams([]);
      return;
    }
    const data = await response.json();
    setTeams(data.teams ?? []);
  }, []);

  const allowed = session?.user?.isSuperAdmin === true;

  useEffect(() => {
    if (status === "loading") return;
    if (!allowed) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [status, allowed, router, load]);

  async function openTeam(id: string) {
    // Hent medlemskaber først, ellers nulstiller dashboardet valget til det første hold.
    if (!memberships.some((m) => m.team?.id === id)) {
      await refreshDashboardTeam();
    }
    setTeamId(id);
    router.push("/dashboard");
  }

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug })
      });
      const data = await response.json();
      if (!response.ok) {
        pushToast(data.error ?? "Kunne ikke oprette holdet", "error");
        return;
      }
      pushToast(`${data.team.name} er oprettet`, "success");
      setName("");
      setSlug("");
      await refreshDashboardTeam();
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function joinTeam(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/admin/teams/${id}/join`, { method: "POST" });
      if (!response.ok) {
        pushToast("Kunne ikke give adgang", "error");
        return;
      }
      await load();
      await openTeam(id);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteTeam() {
    if (!teamToDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/teams/${teamToDelete.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke slette holdet", "error");
        return;
      }
      pushToast(`${teamToDelete.name} er slettet`, "success");
      setTeamToDelete(null);
      await refreshDashboardTeam();
      await load();
    } finally {
      setDeleting(false);
    }
  }

  if (!allowed) return null;

  return (
    <div className="min-w-0 flex-1 space-y-6">
      <PageHeader title="Admin" subtitle="Opret og administrér hold. Kun synligt for dig." />

      <Section title="Opret nyt hold">
        <form onSubmit={createTeam} className="space-y-3 rounded-[1.375rem] border border-line bg-surface p-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink/80">Holdnavn</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="fx Serie 4 Herrer"
              required
              minLength={2}
              maxLength={60}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink/80">Holdkode</label>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className={inputClass}
              placeholder="fx serie-4-herrer"
              required
              minLength={2}
              maxLength={40}
            />
            <p className="mt-1 text-xs text-ink/55">Unik kode, som spillere bruger, når de opretter sig på holdet. Små bogstaver, tal og bindestreg.</p>
          </div>
          <p className="text-xs text-ink/55">Du bliver selv admin på det nye hold.</p>
          <Button type="submit" size="lg" block loading={creating}>
            Opret hold
          </Button>
        </form>
      </Section>

      <Section title="Alle hold">
        {teams === null ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ListGroup>
            {teams.map((team) => (
              <ListRow
                key={team.id}
                title={team.name}
                subtitle={`${team.slug} · ${team.activeMembers} aktive medlemmer`}
                trailing={
                  <div className="flex items-center gap-2">
                    {team.otherMembers === 0 ? (
                      <Button size="sm" variant="secondary" onClick={() => setTeamToDelete(team)}>
                        Slet
                      </Button>
                    ) : null}
                    {team.isMember ? (
                      <Button size="sm" variant={team.id === teamId ? "secondary" : "primary"} onClick={() => openTeam(team.id)}>
                        {team.id === teamId ? "Aktivt" : "Åbn"}
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" loading={busyId === team.id} onClick={() => joinTeam(team.id)}>
                        Tilføj mig som admin
                      </Button>
                    )}
                  </div>
                }
              />
            ))}
            {teams.length === 0 ? <p className="p-4 text-sm text-ink/60">Ingen hold endnu.</p> : null}
          </ListGroup>
        )}
      </Section>
      <p className="text-xs text-ink/55">
        Et hold kan kun slettes, når der ingen spillere er på det. Åbn holdet under Hold for at fjerne spillere enkeltvis.
      </p>
      <ConfirmSheet
        open={teamToDelete !== null}
        onClose={() => setTeamToDelete(null)}
        onConfirm={deleteTeam}
        loading={deleting}
        title={`Slet ${teamToDelete?.name ?? "holdet"}?`}
        description="Holdet slettes permanent inkl. begivenheder, bøder og skabeloner. Det kan ikke fortrydes."
        confirmLabel="Slet hold"
      />
      <Chip tone="neutral">{teams?.length ?? 0} hold i alt</Chip>
    </div>
  );
}
