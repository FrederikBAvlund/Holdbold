"use client";

import { signIn } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");

  const errorMessages = useMemo(
    () =>
      ({
        CredentialsSignin: "Forkerte loginoplysninger. Prøv igen.",
        AccessDenied: "Adgang nægtet.",
        OAuthAccountNotLinked: "Denne konto er allerede knyttet til en anden loginmetode."
      }) as Record<string, string>,
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("error");
    const noticeCode = params.get("notice");
    const emailFromQuery = params.get("email");
    if (!code) {
      setError(null);
    } else {
      setError(errorMessages[code] ?? "Login mislykkedes. Prøv igen.");
    }
    if (noticeCode === "pending_approval") {
      setNotice("Din bruger er oprettet. Du kan logge ind, men en administrator skal godkende dig, før du kan bruge appen.");
    } else {
      setNotice(null);
    }
    if (emailFromQuery) {
      setIdentifier(emailFromQuery.toLowerCase());
    }
  }, [errorMessages]);

  function getCallbackUrl() {
    if (typeof window === "undefined") return "/dashboard";
    return new URLSearchParams(window.location.search).get("callbackUrl") || "/dashboard";
  }

  async function handleCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("identifier") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const callbackUrl = getCallbackUrl();
    const result = await signIn("credentials", {
      identifier,
      password,
      callbackUrl,
      redirect: false
    });
    if (result?.error) {
      setError(errorMessages[result.error] ?? "Forkerte loginoplysninger. Prøv igen.");
      setLoading(false);
      return;
    }
    if (result?.url) {
      window.location.href = result.url;
      return;
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 pt-[max(2rem,env(safe-area-inset-top,0px))] sm:px-6">
      <div className="card relative flex w-full max-w-3xl flex-col overflow-hidden p-0 shadow-[0_32px_64px_-36px_rgba(15,23,42,0.45)] sm:min-h-[420px] sm:flex-row">
        <div className="relative flex flex-col justify-between bg-gradient-to-br from-moss via-[color:var(--color-button)] to-moss px-8 py-10 text-fog sm:w-[42%] sm:min-w-[220px] sm:py-12">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
          <div className="relative space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/75">Holdbold</p>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-[2rem]">Log ind</h1>
            <p className="max-w-[14rem] text-sm leading-relaxed text-white/88">
              Samme app på mobil og desktop — kalender, bøder og beskeder samlet.
            </p>
          </div>
          <p className="relative mt-10 hidden text-xs text-white/65 sm:mt-0 sm:block">PWA-klar til hjemmeskærmen.</p>
        </div>

        <div className="relative flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-moss/10 blur-3xl" />
          <div className="relative">
            <p className="text-ink/70 sm:hidden">Brug din email og adgangskode.</p>
            {error ? (
              <p className="mt-4 rounded-control border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 sm:mt-0">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-4 rounded-control border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 sm:mt-0">
                {notice}
              </p>
            ) : null}

            <form onSubmit={handleCredentials} className="mt-6 space-y-4">
              <input
                name="identifier"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Email"
                className="input"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value.toLowerCase())}
                required
              />
              <input name="password" type="password" placeholder="Adgangskode" className="input" required />
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Logger ind..." : "Log ind"}
              </button>
            </form>

            {process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET ? (
              <>
                <div className="my-6 border-t border-ink/10" />
                <button
                  className="btn-ghost w-full"
                  onClick={() => signIn("facebook", { callbackUrl: getCallbackUrl() })}
                >
                  Fortsæt med Facebook
                </button>
              </>
            ) : null}

            <p className="mt-6 text-sm text-ink/70">
              Ingen konto?{" "}
              <a href="/signup" className="font-semibold text-moss underline decoration-moss/30 underline-offset-4 hover:decoration-moss">
                Opret dig her
              </a>
              .
            </p>
            <p className="mt-2 text-xs text-ink/55">
              Se hvordan vi behandler data i vores{" "}
              <a href="/privatliv" className="underline underline-offset-4">
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
