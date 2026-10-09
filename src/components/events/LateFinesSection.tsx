"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import type { DashboardTeamMember } from "@/components/DashboardTeamProvider";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import { Card, Section, inputClass } from "@/components/ui/primitives";
import { computeLateGroups, type SignupLog } from "@/lib/events/eventUtils";
import type { EventSignup } from "@/lib/events/client";
import { formatDayTime, formatKr } from "@/lib/format";

type FineTemplate = { id: string; title: string; amount: number; status?: string };

export default function LateFinesSection({
  teamId,
  eventId,
  deadlineAt,
  members,
  signups,
  logs
}: {
  teamId: string;
  eventId: string;
  deadlineAt: string | null;
  members: DashboardTeamMember[];
  signups: EventSignup[];
  logs: SignupLog[];
}) {
  const { pushToast } = useToast();
  const [templates, setTemplates] = useState<FineTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    let alive = true;
    fetch(`/api/fine-templates?teamId=${teamId}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { templates: [] }))
      .then((data) => {
        if (!alive) return;
        const approved = ((data.templates ?? []) as FineTemplate[]).filter(
          (template) => template.status === "APPROVED" || !template.status
        );
        setTemplates(approved);
        setTemplateId((prev) => prev || approved.find((t) => t.title.toLowerCase().includes("for sen"))?.id || "");
      })
      .catch(() => alive && setTemplates([]));
    return () => {
      alive = false;
    };
  }, [teamId]);

  const statusByUser = useMemo(() => new Map(signups.map((signup) => [signup.userId, signup.status])), [signups]);
  const groups = useMemo(
    () => computeLateGroups({ members: members.filter((m) => m.status === "ACTIVE"), statusByUser, logs, deadlineAt }),
    [members, statusByUser, logs, deadlineAt]
  );
  const candidates = useMemo(
    () => Array.from(new Set([...groups.lateResponses, ...groups.missingAfterDeadline].map((m) => m.user.id))),
    [groups]
  );

  useEffect(() => {
    setSelected(candidates);
  }, [candidates]);

  if (candidates.length === 0) return null;

  const template = templates?.find((t) => t.id === templateId);

  async function assign() {
    setSaving(true);
    try {
      const results = await Promise.all(
        selected.map((targetUserId) =>
          fetch("/api/fines", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, userId: targetUserId, templateId, eventId })
          }).then((response) => response.ok)
        )
      );
      const ok = results.filter(Boolean).length;
      if (ok === selected.length) pushToast(`Bøde givet til ${ok} spiller${ok === 1 ? "" : "e"}`, "success");
      else if (ok > 0) pushToast(`Bøde givet til ${ok} af ${selected.length} – prøv igen for resten`, "error");
      else pushToast("Kunne ikke give bøder", "error");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const renderGroup = (title: string, list: DashboardTeamMember[]) =>
    list.length === 0 ? null : (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/50">
          {title} · {list.length}
        </p>
        {list.map((member) => {
          const checked = selected.includes(member.user.id);
          return (
            <button
              key={member.user.id}
              type="button"
              onClick={() => toggle(member.user.id)}
              aria-pressed={checked}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3 text-left transition active:scale-[0.99]",
                checked ? "border-out/40 bg-out/[0.06]" : "border-line"
              )}
            >
              <Avatar name={member.user.name} image={member.user.image} size="sm" />
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{member.user.name}</span>
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-lg border-2",
                  checked ? "border-out bg-out text-white" : "border-ink/20"
                )}
              >
                {checked ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    );

  return (
    <Section title="Bøder for sene svar">
      <Card className="space-y-4">
        <p className="text-sm text-ink/60">
          Svarfrist: {groups.deadlineAt ? formatDayTime(groups.deadlineAt) : "ukendt"}. Vælg hvem der skal have en bøde.
        </p>
        {renderGroup("Svarede for sent", groups.lateResponses)}
        {renderGroup("Svarede ikke", groups.missingAfterDeadline)}
        {templates && templates.length === 0 ? (
          <p className="text-sm text-ink/60">Opret en godkendt bødeskabelon under Bøder først.</p>
        ) : (
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputClass} aria-label="Bødeskabelon">
            <option value="">Vælg bødeskabelon</option>
            {(templates ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({formatKr(t.amount)})
              </option>
            ))}
          </select>
        )}
        <Button
          block
          size="lg"
          icon="receipt"
          disabled={!templateId || selected.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Giv bøde til {selected.length}
        </Button>
      </Card>
      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={assign}
        loading={saving}
        tone="primary"
        title={`Giv ${selected.length} bøde${selected.length === 1 ? "" : "r"}?`}
        description={template ? `${template.title} · ${formatKr(template.amount)} pr. spiller` : undefined}
        confirmLabel="Ja, giv bøder"
      />
    </Section>
  );
}
