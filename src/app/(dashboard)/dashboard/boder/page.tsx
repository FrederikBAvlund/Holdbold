"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDashboardTeam, type DashboardTeamMember } from "@/components/DashboardTeamProvider";
import { useToast } from "@/components/ToastProvider";
import Icon, { type IconName } from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import Button, { CountBadge } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/Sheet";
import {
  EmptyState,
  ListGroup,
  PageHeader,
  Section,
  SegmentedControl,
  Skeleton,
  inputClass
} from "@/components/ui/primitives";
import FineRow, { FineAmount } from "@/components/fines/FineRow";
import { formatDayTime, formatKr, formatRelativePast } from "@/lib/format";
import { FINE_MANAGER_ROLES } from "@/lib/roleLabels";
import { categoryLabel } from "./boderConstants";
import type { FineItem, FineTemplate } from "./boderTypes";
import { rankDebtors, summarizeFines } from "./boderUtils";
import { fetchMemberFines, useFineData } from "./hooks/useFineData";
import { useFineActions } from "./hooks/useFineActions";
import AssignFineSheet, { SearchInput } from "./components/AssignFineSheet";
import { CollectionSheet, MemberFinesSheet, PaySheet, TemplateSheet } from "./components/FineSheets";
import FineAutomationCard from "./components/FineAutomationCard";
import FineInbox from "./components/FineInbox";
import { VoiceFinesModal } from "./VoiceFinesModal";

type Tab = "mine" | "holdet" | "kassen";

export default function BoderPage() {
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const { teamId, userId, members, actingMember, seasonQuery, isReadOnlySeason } = useDashboardTeam();
  const canManage = FINE_MANAGER_ROLES.includes(actingMember?.role ?? "");
  const isAdmin = actingMember?.role === "ADMIN";

  const data = useFineData({ teamId, userId, seasonQuery, canManage, isAdmin });
  const { run, busyKey } = useFineActions(data.refresh);

  const [tab, setTab] = useState<Tab>("mine");
  const [assign, setAssign] = useState<{ templateId?: string } | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [templateSheet, setTemplateSheet] = useState<{ template: FineTemplate | null } | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [memberSheet, setMemberSheet] = useState<{ userId: string; fines: FineItem[] | null } | null>(null);
  const [deleteFine, setDeleteFine] = useState<FineItem | null>(null);

  useEffect(() => {
    const requested = searchParams.get("fane");
    if (requested === "holdet" || (requested === "kassen" && canManage)) setTab(requested);
  }, [searchParams, canManage]);

  const memberById = useMemo(() => new Map(members.map((member) => [member.user.id, member])), [members]);
  const pendingTemplates = data.templates.filter((t) => t.status === "PENDING");
  const inboxCount = data.pendingPayments.length + data.proposed.length + pendingTemplates.length;

  async function openMember(memberUserId: string) {
    setMemberSheet({ userId: memberUserId, fines: null });
    const fines = await fetchMemberFines(teamId, seasonQuery, memberUserId);
    setMemberSheet((prev) => (prev?.userId === memberUserId ? { userId: memberUserId, fines } : prev));
  }

  async function confirmDelete() {
    if (!deleteFine) return;
    const ok = await run(`delete-${deleteFine.id}`, `/api/fines/${deleteFine.id}`, {
      method: "DELETE",
      success: "Bøden er slettet",
      error: "Kunne ikke slette bøden"
    });
    if (ok) {
      setDeleteFine(null);
      if (memberSheet) openMember(memberSheet.userId);
    }
  }

  async function settleFine(fine: FineItem) {
    const ok = await run(`settle-${fine.id}`, `/api/fines/${fine.id}/settle`, {
      success: "Bøden er markeret som betalt",
      error: "Kunne ikke markere bøden som betalt"
    });
    if (ok) {
      window.dispatchEvent(new Event("nav:refresh"));
      if (memberSheet) openMember(memberSheet.userId);
    }
  }

  const assignLabel = canManage ? "Giv bøde" : "Foreslå bøde";
  const memberForSheet = memberSheet ? memberById.get(memberSheet.userId) : undefined;
  const debtorName = memberSheet
    ? memberForSheet?.user.name ?? data.debtors.find((d) => d.userId === memberSheet.userId)?.name ?? "Medlem"
    : null;

  return (
    <div className="space-y-5 pb-24">
      <PageHeader
        title="Bøder"
        subtitle={canManage ? "Holdets bødekasse – hold styr på det hele." : "Dine bøder og holdets bødetavle."}
        action={
          !isReadOnlySeason ? (
            <Button icon="plus" className="hidden sm:inline-flex" onClick={() => setAssign({})}>
              {assignLabel}
            </Button>
          ) : null
        }
      />

      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "mine", label: "Mine" },
          { value: "holdet", label: "Holdet" },
          ...(canManage
            ? [
                {
                  value: "kassen" as Tab,
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      Kassen
                      {inboxCount > 0 ? <CountBadge count={inboxCount} className="ring-0" /> : null}
                    </span>
                  )
                }
              ]
            : [])
        ]}
      />

      <div key={data.loading ? "loading" : tab} className="animate-rise">
      {data.loading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 rounded-[1.75rem]" />
          <Skeleton className="h-24 rounded-[1.375rem]" />
          <Skeleton className="h-24 rounded-[1.375rem]" />
        </div>
      ) : tab === "mine" ? (
        <MineTab
          fines={data.myFines}
          submitted={data.mySubmitted}
          templates={data.templates}
          userId={userId}
          memberById={memberById}
          onPay={() => setPayOpen(true)}
          readOnly={isReadOnlySeason}
        />
      ) : tab === "holdet" ? (
        <HoldetTab
          debtors={data.debtors}
          recent={data.recent}
          templates={data.templates}
          memberById={memberById}
          canManage={canManage}
          readOnly={isReadOnlySeason}
          onOpenMember={openMember}
          onAssignTemplate={(templateId) => setAssign({ templateId })}
          onEditTemplate={(template) => setTemplateSheet({ template })}
          onNewTemplate={() => setTemplateSheet({ template: null })}
        />
      ) : (
        <KassenTab
          teamId={teamId}
          data={data}
          memberById={memberById}
          isAdmin={isAdmin}
          readOnly={isReadOnlySeason}
          busyKey={busyKey}
          run={run}
          onVoice={() => setVoiceOpen(true)}
          onAssign={() => setAssign({})}
          onCollection={() => setCollectionOpen(true)}
          onEditTemplate={(template) => setTemplateSheet({ template })}
          onNewTemplate={() => setTemplateSheet({ template: null })}
          onSavedMobilePay={(value) => data.setData((prev) => ({ ...prev, mobilePayBox: value }))}
          pushError={(message) => pushToast(message, "error")}
        />
      )}
      </div>

      {!isReadOnlySeason ? (
        <button
          type="button"
          onClick={() => setAssign({})}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-on-primary shadow-[var(--shadow-lg)] transition active:scale-95 sm:hidden"
        >
          <Icon name="plus" strokeWidth={2.6} />
          {assignLabel}
        </button>
      ) : null}

      <AssignFineSheet
        open={assign !== null}
        onClose={() => setAssign(null)}
        teamId={teamId}
        templates={data.templates}
        members={members}
        canManage={canManage}
        initialTemplateId={assign?.templateId}
        onDone={data.refresh}
      />
      <PaySheet
        open={payOpen}
        onClose={() => setPayOpen(false)}
        teamId={teamId}
        amount={summarizeFines(data.myFines).unpaid}
        mobilePayBox={data.mobilePayBox}
        onPaid={data.refresh}
      />
      <TemplateSheet
        open={templateSheet !== null}
        onClose={() => setTemplateSheet(null)}
        teamId={teamId}
        template={templateSheet?.template ?? null}
        canManage={canManage}
        onSaved={data.refresh}
      />
      <CollectionSheet
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        teamId={teamId}
        templates={data.templates}
        onSaved={data.refresh}
      />
      <MemberFinesSheet
        open={memberSheet !== null && deleteFine === null}
        onClose={() => setMemberSheet(null)}
        member={memberSheet ? { name: debtorName, image: memberForSheet?.user.image } : null}
        fines={memberSheet?.fines ?? null}
        canManage={canManage && !isReadOnlySeason}
        onDelete={setDeleteFine}
        onSettle={settleFine}
        settlingId={busyKey?.startsWith("settle-") ? busyKey.slice("settle-".length) : null}
      />
      <ConfirmSheet
        open={deleteFine !== null}
        onClose={() => setDeleteFine(null)}
        onConfirm={confirmDelete}
        loading={busyKey === `delete-${deleteFine?.id}`}
        title="Slet bøden?"
        description={deleteFine ? `${deleteFine.reason} · ${formatKr(deleteFine.amount)}` : undefined}
        confirmLabel="Slet"
      />
      {canManage && voiceOpen ? (
        <VoiceFinesModal
          teamId={teamId}
          members={members as unknown as Parameters<typeof VoiceFinesModal>[0]["members"]}
          templates={data.templates}
          onClose={() => setVoiceOpen(false)}
          onCreated={data.refresh}
        />
      ) : null}
    </div>
  );
}

/* ================= Mine ================= */

function MineTab({
  fines,
  submitted,
  templates,
  userId,
  memberById,
  onPay,
  readOnly
}: {
  fines: FineItem[];
  submitted: FineItem[];
  templates: FineTemplate[];
  userId: string;
  memberById: Map<string, DashboardTeamMember>;
  onPay: () => void;
  readOnly: boolean;
}) {
  const [showPaid, setShowPaid] = useState(false);
  const totals = summarizeFines(fines);
  const unpaid = fines.filter((f) => f.status === "UNPAID");
  const pending = fines.filter((f) => f.status === "PAID_PENDING");
  const paid = fines.filter((f) => f.status === "PAID_APPROVED");
  const proposals = [
    ...submitted
      .filter((f) => (f.status === "FORESLAET" || f.status === "AFVIST") && f.user?.id !== userId)
      .map((f) => ({ kind: "fine" as const, id: f.id, createdAt: f.createdAt, fine: f })),
    ...templates
      .filter((t) => t.createdById === userId && t.status && t.status !== "APPROVED")
      .map((t) => ({ kind: "template" as const, id: t.id, createdAt: t.createdAt, template: t }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const renderFine = (fine: FineItem) => (
    <FineRow
      key={fine.id}
      title={fine.reason}
      description={fine.description}
      meta={`${formatRelativePast(fine.createdAt)}${creatorName(fine) ? ` · fra ${creatorName(fine)}` : ""}`}
      amount={fine.amount}
      status={fine.status}
      event={fine.event}
    />
  );

  return (
    <div className="space-y-6">
      <section className="hero-surface rounded-[1.75rem] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-primary/75">
          {totals.unpaid > 0 ? "Du skylder" : totals.pending > 0 ? "Betalingen er på vej" : "Din saldo"}
        </p>
        <p className="tabular mt-1 font-display text-[3.5rem] font-extrabold leading-none">
          {totals.unpaid > 0 ? formatKr(totals.unpaid) : totals.pending > 0 ? formatKr(totals.pending) : "0 kr"}
        </p>
        <p className="mt-2 text-sm text-on-primary/85">
          {totals.unpaid > 0
            ? `${unpaid.length} ubetalt${unpaid.length === 1 ? "" : "e"} bøde${unpaid.length === 1 ? "" : "r"}${
                totals.pending > 0 ? ` · ${formatKr(totals.pending)} venter på godkendelse` : ""
              }`
            : totals.pending > 0
              ? "Venter på, at bødekasseformanden godkender din betaling."
              : "Gældfri ✨ Bliv ved sådan."}
        </p>
        {totals.unpaid > 0 && !readOnly ? (
          <Button size="lg" icon="wallet" className="mt-4 w-full bg-white text-[#0b0f14] shadow-none hover:bg-white" onClick={onPay}>
            Betal med MobilePay
          </Button>
        ) : null}
      </section>

      {fines.length === 0 ? (
        <EmptyState icon="receipt" title="Ingen bøder" description="Du har ingen bøder i denne sæson. Godt gået!" />
      ) : (
        <>
          {unpaid.length > 0 ? (
            <Section title={`Ubetalt · ${unpaid.length}`}>
              <ListGroup>{unpaid.map(renderFine)}</ListGroup>
            </Section>
          ) : null}
          {pending.length > 0 ? (
            <Section title="Afventer godkendelse">
              <ListGroup>{pending.map(renderFine)}</ListGroup>
            </Section>
          ) : null}
          {paid.length > 0 ? (
            <Section
              title={`Betalt · ${paid.length}`}
              action={
                <button type="button" onClick={() => setShowPaid((v) => !v)} className="text-sm font-semibold text-moss">
                  {showPaid ? "Skjul" : "Vis"}
                </button>
              }
            >
              {showPaid ? <ListGroup>{paid.map(renderFine)}</ListGroup> : null}
            </Section>
          ) : null}
        </>
      )}

      {proposals.length > 0 ? (
        <Section title="Mine forslag">
          <ListGroup>
            {proposals.map((item) =>
              item.kind === "fine" ? (
                <FineRow
                  key={item.id}
                  title={item.fine.reason}
                  person={
                    item.fine.user
                      ? { name: item.fine.user.name, image: memberById.get(item.fine.user.id)?.user.image }
                      : null
                  }
                  meta={formatRelativePast(item.fine.createdAt)}
                  amount={item.fine.amount}
                  status={item.fine.status}
                />
              ) : (
                <FineRow
                  key={item.id}
                  title={item.template.title}
                  meta={`Ny bøde til kataloget · ${formatRelativePast(item.template.createdAt)}`}
                  amount={item.template.amount}
                  status={item.template.status === "REJECTED" ? "AFVIST" : "FORESLAET"}
                />
              )
            )}
          </ListGroup>
        </Section>
      ) : null}
    </div>
  );
}

function creatorName(fine: FineItem) {
  return fine.createdBy?.name ?? fine.createdByLabel ?? null;
}

/* ================= Holdet ================= */

function HoldetTab({
  debtors,
  recent,
  templates,
  memberById,
  canManage,
  readOnly,
  onOpenMember,
  onAssignTemplate,
  onEditTemplate,
  onNewTemplate
}: {
  debtors: Array<{ userId: string; name: string; total: number }>;
  recent: FineItem[];
  templates: FineTemplate[];
  memberById: Map<string, DashboardTeamMember>;
  canManage: boolean;
  readOnly: boolean;
  onOpenMember: (userId: string) => void;
  onAssignTemplate: (templateId: string) => void;
  onEditTemplate: (template: FineTemplate) => void;
  onNewTemplate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showAllCatalog, setShowAllCatalog] = useState(false);
  const ranked = rankDebtors(debtors);
  const total = ranked.reduce((sum, d) => sum + d.total, 0);
  const catalog = templates
    .filter((t) => !t.status || t.status === "APPROVED")
    .filter((t) => `${t.title} ${t.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title, "da"));
  const recentSorted = [...recent].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-7">
      <Section title="Bødetavlen" action={<span className="text-sm font-semibold text-ink/55">I alt {formatKr(total)}</span>}>
        {ranked.length === 0 ? (
          <EmptyState icon="trophy" title="Tom tavle" description="Ingen har bøder lige nu." />
        ) : (
          <ListGroup>
            {ranked.map((debtor) => {
              const member = memberById.get(debtor.userId);
              return (
                <button
                  key={debtor.userId}
                  type="button"
                  onClick={() => onOpenMember(debtor.userId)}
                  className="flex min-h-[3.75rem] w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-ink/[0.03]"
                >
                  <span
                    className={cn(
                      "tabular w-7 text-center font-display text-xl font-bold",
                      debtor.rank === 1 ? "text-out" : "text-ink/40"
                    )}
                  >
                    {debtor.rank}
                  </span>
                  <Avatar name={member?.user.name ?? debtor.name} image={member?.user.image} size="md" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{member?.user.name ?? debtor.name}</span>
                  <FineAmount amount={debtor.total} className="text-xl" />
                  <Icon name="chevron-right" className="h-4 w-4 text-ink/30" />
                </button>
              );
            })}
          </ListGroup>
        )}
      </Section>

      <Section title="Seneste 14 dage">
        {recentSorted.length === 0 ? (
          <p className="px-1 text-sm text-ink/55">Stille uge – ingen nye bøder.</p>
        ) : (
          <ListGroup>
            {recentSorted.slice(0, 20).map((fine) => (
              <FineRow
                key={fine.id}
                title={fine.reason}
                person={fine.user ? { name: fine.user.name, image: memberById.get(fine.user.id)?.user.image } : null}
                meta={formatRelativePast(fine.createdAt)}
                amount={fine.amount}
                status={fine.status}
                event={fine.event}
              />
            ))}
          </ListGroup>
        )}
      </Section>

      <Section
        title="Bødekataloget"
        action={
          !readOnly ? (
            <button type="button" onClick={onNewTemplate} className="inline-flex items-center gap-1 text-sm font-semibold text-moss">
              <Icon name="plus" className="h-4 w-4" />
              {canManage ? "Ny" : "Foreslå ny"}
            </button>
          ) : null
        }
      >
        <SearchInput value={query} onChange={setQuery} placeholder="Søg i kataloget" />
        {catalog.length === 0 ? (
          <p className="px-1 text-sm text-ink/55">{query ? "Ingen bøder matcher." : "Kataloget er tomt."}</p>
        ) : (
          <ListGroup>
            {(query || showAllCatalog ? catalog : catalog.slice(0, 8)).map((template) => (
              <div key={template.id} className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-ink">{template.title}</p>
                  {template.description ? <p className="mt-0.5 text-sm text-ink/55">{template.description}</p> : null}
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
                    {categoryLabel[template.category] ?? template.category}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <FineAmount amount={template.amount} />
                  {!readOnly ? (
                    <div className="flex gap-1.5">
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => onEditTemplate(template)}
                          aria-label={`Rediger ${template.title}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink/[0.06] text-ink/70 transition hover:bg-ink/10"
                        >
                          <Icon name="settings" className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onAssignTemplate(template.id)}
                        className="season-lock inline-flex min-h-9 items-center rounded-full bg-primary/12 px-3.5 text-sm font-semibold text-moss transition hover:bg-primary/20"
                      >
                        {canManage ? "Giv" : "Foreslå"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {!query && catalog.length > 8 ? (
              <button
                type="button"
                onClick={() => setShowAllCatalog((v) => !v)}
                className="flex min-h-12 w-full items-center justify-center gap-1 text-sm font-semibold text-moss"
              >
                {showAllCatalog ? "Vis færre" : `Vis alle ${catalog.length}`}
                <Icon name="chevron-down" className={cn("h-4 w-4 transition", showAllCatalog && "rotate-180")} />
              </button>
            ) : null}
          </ListGroup>
        )}
      </Section>
    </div>
  );
}

/* ================= Kassen ================= */

function KassenTab({
  teamId,
  data,
  memberById,
  isAdmin,
  readOnly,
  busyKey,
  run,
  onVoice,
  onAssign,
  onCollection,
  onEditTemplate,
  onNewTemplate,
  onSavedMobilePay,
  pushError
}: {
  teamId: string;
  data: ReturnType<typeof useFineData>;
  memberById: Map<string, DashboardTeamMember>;
  isAdmin: boolean;
  readOnly: boolean;
  busyKey: string | null;
  run: ReturnType<typeof useFineActions>["run"];
  onVoice: () => void;
  onAssign: () => void;
  onCollection: () => void;
  onEditTemplate: (template: FineTemplate) => void;
  onNewTemplate: () => void;
  onSavedMobilePay: (value: string) => void;
  pushError: (message: string) => void;
}) {
  const pendingTemplates = data.templates.filter((t) => t.status === "PENDING");
  const actions: Array<{ icon: IconName | "mic"; label: string; hint: string; onClick: () => void; hero?: boolean }> = [
    { icon: "mic", label: "Indtal bøder", hint: "Hold knappen nede og rems dem op – så laves forslagene", onClick: onVoice, hero: true },
    { icon: "receipt", label: "Giv bøde", hint: "Én eller flere spillere", onClick: onAssign },
    { icon: "hourglass", label: "Indsamling", hint: "Bøde ved for sen betaling", onClick: onCollection }
  ];

  return (
    <div className="space-y-7">
      {!readOnly ? (
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={cn(
                "flex min-h-[5.5rem] flex-col justify-between gap-2 rounded-[1.375rem] p-4 text-left transition active:scale-[0.98]",
                action.hero ? "hero-surface col-span-2" : "border border-line bg-surface hover:border-ink/20"
              )}
            >
              <span className="flex items-center gap-2">
                {action.icon === "mic" ? (
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
                  </svg>
                ) : (
                  <Icon name={action.icon} className="h-5 w-5 text-moss" />
                )}
                <span className="font-display text-xl font-bold uppercase leading-none">{action.label}</span>
              </span>
              <span className={cn("text-sm", action.hero ? "text-on-primary/80" : "text-ink/55")}>{action.hint}</span>
            </button>
          ))}
        </div>
      ) : null}

      <FineInbox teamId={teamId} data={data} memberById={memberById} readOnly={readOnly} />

      {data.collections.length > 0 ? (
        <Section title="Aktive indsamlinger">
          <ListGroup>
            {data.collections.map((collection) => (
              <FineRow
                key={collection.id}
                title={collection.template.title}
                meta={`Frist ${formatDayTime(collection.deadlineAt).toLowerCase()} · derefter hver ${
                  collection.intervalHours === 24 ? "dag" : `${collection.intervalHours}. time`
                }`}
                amount={collection.template.amount}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      <Section
        title="Kataloget"
        action={
          !readOnly ? (
            <button type="button" onClick={onNewTemplate} className="inline-flex items-center gap-1 text-sm font-semibold text-moss">
              <Icon name="plus" className="h-4 w-4" />
              Ny bøde
            </button>
          ) : null
        }
      >
        <ListGroup>
          {data.templates
            .filter((t) => !t.status || t.status === "APPROVED")
            .sort((a, b) => a.title.localeCompare(b.title, "da"))
            .slice(0, 6)
            .map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => !readOnly && onEditTemplate(template)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ink/[0.03]"
              >
                <span className="min-w-0 flex-1 font-semibold leading-snug text-ink">{template.title}</span>
                <FineAmount amount={template.amount} className="text-xl" />
              </button>
            ))}
        </ListGroup>
        <p className="px-1 text-sm text-ink/50">Hele kataloget findes under fanen Holdet.</p>
      </Section>

      <Section title="MobilePay">
        <MobilePayCard
          teamId={teamId}
          value={data.mobilePayBox}
          editable={isAdmin && !readOnly}
          onSaved={onSavedMobilePay}
          pushError={pushError}
        />
      </Section>

      <Section title="Automatiske bøder">
        <FineAutomationCard teamId={teamId} />
      </Section>
    </div>
  );
}

function MobilePayCard({
  teamId,
  value,
  editable,
  onSaved,
  pushError
}: {
  teamId: string;
  value: string;
  editable: boolean;
  onSaved: (value: string) => void;
  pushError: (message: string) => void;
}) {
  const { pushToast } = useToast();
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobilePayBox: draft.trim() || null })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushError(typeof data.error === "string" ? data.error : "Kunne ikke gemme");
        return;
      }
      onSaved(draft.trim());
      pushToast("MobilePay-nummer gemt", "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[1.375rem] border border-line bg-surface p-4">
      <p className="text-sm text-ink/60">Spillerne kopierer nummeret, når de betaler.</p>
      {editable ? (
        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Fx 1234AB"
            className={cn(inputClass, "flex-1 font-display text-xl font-bold tracking-wider")}
            aria-label="MobilePay-nummer"
          />
          {draft.trim() !== value ? (
            <Button loading={saving} onClick={save}>
              Gem
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="tabular mt-2 font-display text-3xl font-bold tracking-wider text-ink">{value || "Ikke sat"}</p>
      )}
    </div>
  );
}
