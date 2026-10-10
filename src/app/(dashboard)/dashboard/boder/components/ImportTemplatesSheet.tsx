"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { formatKr } from "@/lib/format";
import type { ParsedTemplateImport } from "@/lib/fineTemplateImport";
import { IMPORT_PROMPT } from "@/lib/fineTemplateImportPrompt";
import { categoryLabel } from "../boderConstants";

const STEPS = [
  "Kopiér prompten herunder.",
  "Åbn en sprogmodel (fx ChatGPT eller Claude) og indsæt prompten.",
  "Vedhæft dine bøder fra Teambox (skærmbilleder, PDF eller tekst) og send.",
  "Download Excel-filen, den laver, og upload den her."
];

export default function ImportTemplatesSheet({
  open,
  onClose,
  teamId,
  onImported
}: {
  open: boolean;
  onClose: () => void;
  teamId: string;
  onImported: () => Promise<void> | void;
}) {
  const { pushToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [preview, setPreview] = useState<ParsedTemplateImport | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setFileName("");
    setCopied(false);
  }, [open]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      pushToast("Kunne ikke kopiere. Markér teksten og kopiér manuelt.", "error");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setBusy("preview");
    try {
      const formData = new FormData();
      formData.append("teamId", teamId);
      formData.append("file", file);
      const response = await fetch("/api/fine-templates/import", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Kunne ikke læse filen", "error");
        setPreview(null);
        return;
      }
      setPreview(data as ParsedTemplateImport);
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!preview || preview.templates.length === 0) return;
    setBusy("save");
    try {
      const response = await fetch("/api/fine-templates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, templates: preview.templates })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        pushToast(typeof data.error === "string" ? data.error : "Importen fejlede", "error");
        return;
      }
      const skipped = data.skipped ? ` (${data.skipped} fandtes allerede)` : "";
      pushToast(`${data.created} bøder tilføjet til kataloget${skipped}`, "success");
      await onImported();
      onClose();
    } finally {
      setBusy(null);
    }
  }

  const count = preview?.templates.length ?? 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={busy !== "save"}
      title="Importér bøder"
      description="Flyt jeres bødekatalog fra Teambox eller et andet system over med en Excel-fil."
      footer={
        preview ? (
          <Button block size="lg" loading={busy === "save"} disabled={count === 0} onClick={save}>
            {count === 0 ? "Ingen bøder at importere" : `Importér ${count} bøder`}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <ol className="space-y-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm text-ink/80">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-moss">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>

        <div className="space-y-2">
          <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap rounded-2xl bg-ink/[0.05] p-3 text-xs leading-relaxed text-ink/75">
            {IMPORT_PROMPT}
          </pre>
          <Button variant="secondary" icon={copied ? "check" : "copy"} onClick={copyPrompt}>
            {copied ? "Kopieret" : "Kopiér prompt"}
          </Button>
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          <label
            htmlFor="tpl-import-file"
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-ink/20 px-4 text-sm text-ink/60 transition hover:bg-ink/[0.03]"
          >
            <Icon name="share" className="h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">
              {busy === "preview" ? "Læser…" : fileName || "Vælg Excel-fil (.xlsx)"}
            </span>
          </label>
          <input
            id="tpl-import-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        {preview ? (
          <div className="space-y-3">
            {preview.errors.length > 0 ? (
              <div className="rounded-2xl bg-out/10 p-3 text-sm text-ink/80">
                <p className="font-semibold">Disse rækker springes over:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {preview.errors.slice(0, 8).map((error) => (
                    <li key={`${error.row}-${error.message}`}>
                      Række {error.row}: {error.message}
                    </li>
                  ))}
                </ul>
                {preview.errors.length > 8 ? <p className="mt-1">…og {preview.errors.length - 8} flere</p> : null}
              </div>
            ) : null}
            {preview.duplicates > 0 ? (
              <p className="text-sm text-ink/55">{preview.duplicates} dubletter i filen er slået sammen.</p>
            ) : null}
            {count > 0 ? (
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {preview.templates.slice(0, 50).map((template, index) => (
                  <li key={`${template.title}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{template.title}</p>
                      <p className="text-xs uppercase tracking-wide text-ink/40">{categoryLabel[template.category]}</p>
                    </div>
                    <span className="tabular font-semibold text-ink">{formatKr(template.amount)}</span>
                  </li>
                ))}
                {count > 50 ? <li className="px-4 py-2.5 text-sm text-ink/55">…og {count - 50} flere</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
