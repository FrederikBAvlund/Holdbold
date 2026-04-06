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
      setNotice("Din bruger er oprettet. En administrator skal godkende dig, før du kan logge ind.");
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
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="card relative w-full max-w-md overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-moss/20 blur-3xl" />
        <div className="relative">
          <h1 className="text-3xl font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            Log ind
          </h1>
          <p className="mt-2 text-ink/70">Brug din email.</p>
          {error ? (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
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
            <a href="/signup" className="font-semibold text-ink underline underline-offset-4">
              Opret dig her
            </a>
            .
          </p>
          <p className="mt-2 text-xs text-ink/60">
            Se hvordan vi behandler data i vores{" "}
            <a href="/privatliv" className="underline underline-offset-4">
              privatlivspolitik
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
