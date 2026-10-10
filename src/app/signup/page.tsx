"use client";

import AuthShell from "@/components/AuthShell";
import Button from "@/components/ui/Button";
import { inputClass } from "@/components/ui/primitives";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

export default function SignupPage() {
  const [slugFromLink, setSlugFromLink] = useState("");
  const slugLocked = slugFromLink.length > 0;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const slug = new URLSearchParams(window.location.search).get("slug")?.trim() ?? "";
    setSlugFromLink(slug);
    if (slug) {
      setTeamSlug(slug);
    }
  }, []);

  async function handleSendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setMessage(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/otp/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim().toLowerCase(), teamSlug })
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      } | null;

      if (!response.ok) {
        setFieldErrors(data?.fieldErrors ?? {});
        setMessage(data?.error ?? `Kunne ikke sende koden (${response.status})`);
        return;
      }
      setCode("");
      setCodeSent(true);
      setMessage(`Vi har sendt en 6-cifret kode til ${email.trim().toLowerCase()}. Den gælder i 10 minutter.`);
    } catch {
      setMessage("Kunne ikke sende koden. Prøv igen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = await signIn("otp", {
      email: email.trim().toLowerCase(),
      code: code.trim(),
      callbackUrl: "/dashboard",
      redirect: false
    });
    if (result?.error) {
      setMessage("Koden er forkert eller udløbet. Prøv igen, eller bed om en ny kode.");
      setLoading(false);
      return;
    }
    // Ny bruger afventer godkendelse og sendes af middleware videre til indstillinger med besked.
    window.location.href = result?.url ?? "/dashboard";
  }

  return (
    <AuthShell title="Opret bruger" subtitle="Navn, email og hold – bekræft din email med en kode, så er du klar.">
      {!codeSent ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink/80">Navn*</label>
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} autoComplete="name" required />
            {fieldErrors.name ? <p className="mt-2 text-sm text-danger">{fieldErrors.name}</p> : null}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink/80">Email*</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value.toLowerCase())}
              className={inputClass}
              placeholder="navn@klub.dk"
              required
            />
            {fieldErrors.email ? <p className="mt-2 text-sm text-danger">{fieldErrors.email}</p> : null}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink/80">Holdkode*</label>
            <input
              value={teamSlug}
              onChange={(event) => setTeamSlug(event.target.value)}
              className={inputClass}
              placeholder="bk-skjold"
              readOnly={slugLocked}
              required
            />
            {slugLocked ? (
              <p className="mt-2 text-xs text-ink/60">Holdkoden er udfyldt fra invitationslink og kan ikke ændres.</p>
            ) : null}
            {fieldErrors.teamSlug ? <p className="mt-2 text-sm text-danger">{fieldErrors.teamSlug}</p> : null}
          </div>
          <Button type="submit" size="lg" block loading={loading}>
            Send kode
          </Button>
        </form>
      ) : (
        <>
          <form onSubmit={handleVerify} className="space-y-4">
            <input value={email} className={inputClass} readOnly aria-label="Email" />
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="6-cifret kode"
              aria-label="Engangskode"
              className={inputClass}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              required
            />
            <Button type="submit" size="lg" block loading={loading} disabled={code.length !== 6}>
              Opret bruger
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button type="button" className="font-semibold text-moss underline underline-offset-4" onClick={() => handleSendCode()} disabled={loading}>
              Send ny kode
            </button>
            <button
              type="button"
              className="text-ink/70 underline underline-offset-4"
              onClick={() => {
                setCodeSent(false);
                setMessage(null);
              }}
            >
              Ret oplysninger
            </button>
          </div>
        </>
      )}

      {message ? <p className="mt-4 text-sm font-semibold text-ink/80">{message}</p> : null}
      <p className="mt-5 text-center text-sm text-ink/70">
        Har du allerede en konto?{" "}
        <a href="/login" className="font-semibold text-moss underline decoration-moss/30 underline-offset-4">
          Log ind
        </a>
      </p>
      <p className="mt-2 text-center text-xs text-ink/55">
        Ved oprettelse accepterer du vores{" "}
        <a href="/privatliv" className="font-medium underline underline-offset-4">
          privatlivspolitik
        </a>
        .
      </p>
    </AuthShell>
  );
}
