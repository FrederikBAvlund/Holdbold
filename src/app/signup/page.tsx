"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [slugFromLink, setSlugFromLink] = useState("");
  const slugLocked = slugFromLink.length > 0;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
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
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          password,
          teamSlug
        })
      });

      let data: {
        error?: string;
        message?: string;
        fieldErrors?: Record<string, string>;
      } | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        setFieldErrors(data?.fieldErrors ?? {});
        setMessage(data?.error ?? `Kunne ikke oprette bruger (${response.status})`);
      } else {
        const encodedEmail = encodeURIComponent(email.trim().toLowerCase());
        router.push(`/login?notice=pending_approval&email=${encodedEmail}`);
      }
    } catch {
      setMessage("Kunne ikke oprette bruger");
    } finally {
      setLoading(false);
    }
  }

  function validatePassword() {
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Adgangskoderne matcher ikke" });
    } else {
      setFieldErrors({});
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 pt-[max(2rem,env(safe-area-inset-top,0px))] sm:px-6">
      <div className="card relative flex w-full max-w-3xl flex-col overflow-hidden p-0 shadow-[0_32px_64px_-36px_rgba(15,23,42,0.45)] sm:max-h-[min(92vh,880px)] sm:flex-row sm:overflow-hidden">
        <div className="relative flex shrink-0 flex-col justify-between bg-gradient-to-br from-moss via-[color:var(--color-button)] to-moss px-8 py-10 text-fog sm:w-[38%] sm:min-w-[200px] sm:py-12">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
          <div className="relative space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/75">Holdbold</p>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-[2rem]">Opret bruger</h1>
            <p className="max-w-[14rem] text-sm leading-relaxed text-white/88">
              Navn, email, adgangskode og hold — så er du klar.
            </p>
          </div>
          <p className="relative mt-8 hidden text-xs text-white/65 sm:mt-0 sm:block">Invitationslink udfylder holdslug automatisk.</p>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-moss/10 blur-3xl sm:hidden" />
          <div className="relative">
            <p className="text-ink/70 sm:hidden">Udfyld felterne for at oprette din konto.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 sm:mt-0">
          <div>
            <label className="label">Navn*</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="input mt-2"
              required
            />
            {fieldErrors.name ? <p className="mt-2 text-sm text-red-600">{fieldErrors.name}</p> : null}
          </div>
          <div>
            <label className="label">Email*</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value.toLowerCase())}
              className="input mt-2"
              placeholder="navn@klub.dk"
              required
            />
            {fieldErrors.email ? <p className="mt-2 text-sm text-red-600">{fieldErrors.email}</p> : null}
          </div>
          <div>
            <label className="label">Adgangskode*</label>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="input mt-2"
              required
            />
            {fieldErrors.password ? <p className="mt-2 text-sm text-red-600">{fieldErrors.password}</p> : null}
          </div>
          <div>
            <label className="label">Gentag adgangskode*</label>
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              onBlur={() => validatePassword()}
              type="password"
              className="input mt-2"
              required
            />
            {fieldErrors.confirmPassword ? <p className="mt-2 text-sm text-red-600">{fieldErrors.confirmPassword}</p> : null}
          </div>
          <div>
            <label className="label">Hold slug*</label>
            <input
              value={teamSlug}
              onChange={(event) => setTeamSlug(event.target.value)}
              className="input mt-2"
              placeholder="bk_skjold"
              readOnly={slugLocked}
              required
            />
            {slugLocked ? (
              <p className="mt-2 text-xs text-ink/60">Holdslug er udfyldt fra invitationslink og kan ikke ændres.</p>
            ) : null}
            {fieldErrors.teamSlug ? <p className="mt-2 text-sm text-red-600">{fieldErrors.teamSlug}</p> : null}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Opretter..." : "Opret bruger"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm font-semibold text-ink/80">{message}</p> : null}
        <p className="mt-4 text-xs text-ink/55">
          Ved oprettelse accepterer du vores{" "}
          <a href="/privatliv" className="font-medium text-moss underline decoration-moss/30 underline-offset-4">
            privatlivspolitik
          </a>
          .
        </p>
          </div>
        </div>
      </div>
    </main>
  );
}
