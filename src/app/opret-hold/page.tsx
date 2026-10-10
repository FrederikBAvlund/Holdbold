"use client";

import AuthShell from "@/components/AuthShell";
import Button from "@/components/ui/Button";
import { inputClass } from "@/components/ui/primitives";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

const NEXT_PATH = "/dashboard/opret-hold";

export default function RequestTeamStartPage() {
  const { status } = useSession();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") window.location.replace(NEXT_PATH);
  }, [status]);

  async function handleSendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/auth/otp/team-requester", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim().toLowerCase() })
      });
      const data = (await response.json().catch(() => null)) as { error?: string; fieldErrors?: Record<string, string> } | null;
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
    const result = await signIn("otp", { email: email.trim().toLowerCase(), code: code.trim(), callbackUrl: NEXT_PATH, redirect: false });
    if (result?.error) {
      setMessage("Koden er forkert eller udløbet. Prøv igen, eller bed om en ny kode.");
      setLoading(false);
      return;
    }
    window.location.href = result?.url ?? NEXT_PATH;
  }

  return (
    <AuthShell title="Opret dit hold" subtitle="Opret en bruger, og send en anmodning om dit hold. Når den er godkendt, er du administrator for holdet.">
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
              Fortsæt
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm">
            <button type="button" className="font-semibold text-moss underline underline-offset-4" onClick={() => handleSendCode()} disabled={loading}>
              Send ny kode
            </button>
            <button type="button" className="text-ink/70 underline underline-offset-4" onClick={() => { setCodeSent(false); setMessage(null); }}>
              Ret oplysninger
            </button>
          </div>
        </>
      )}

      {message ? <p className="mt-4 text-sm font-semibold text-ink/80">{message}</p> : null}
      <p className="mt-5 text-center text-sm text-ink/70">
        Har du allerede en bruger?{" "}
        <a href={`/login?callbackUrl=${encodeURIComponent(NEXT_PATH)}`} className="font-semibold text-moss underline decoration-moss/30 underline-offset-4">
          Log ind
        </a>
      </p>
      <p className="mt-2 text-center text-xs text-ink/55">
        Ved oprettelse accepterer du vores{" "}
        <a href="/privatliv" className="font-medium underline underline-offset-4">privatlivspolitik</a>.
      </p>
    </AuthShell>
  );
}
