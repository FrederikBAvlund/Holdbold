"use client";

import AuthShell from "@/components/AuthShell";
import Button from "@/components/ui/Button";
import { inputClass } from "@/components/ui/primitives";
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
    <AuthShell title="Log ind" subtitle="Velkommen tilbage – brug din email og adgangskode.">
      {error ? (
        <p className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mb-4 rounded-2xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm font-medium text-success">
          {notice}
        </p>
      ) : null}

      <form onSubmit={handleCredentials} className="space-y-4">
        <input
          name="identifier"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          aria-label="Email"
          className={inputClass}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value.toLowerCase())}
          required
        />
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Adgangskode"
          aria-label="Adgangskode"
          className={inputClass}
          required
        />
        <Button type="submit" size="lg" block loading={loading}>
          Log ind
        </Button>
      </form>

      {process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET ? (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-ink/45">
            <span className="h-px flex-1 bg-line" />
            eller
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" block onClick={() => signIn("facebook", { callbackUrl: getCallbackUrl() })}>
            Fortsæt med Facebook
          </Button>
        </>
      ) : null}

      <p className="mt-6 text-center text-sm text-ink/70">
        Ingen konto?{" "}
        <a href="/signup" className="font-semibold text-moss underline decoration-moss/30 underline-offset-4 hover:decoration-moss">
          Opret dig her
        </a>
      </p>
      <p className="mt-2 text-center text-xs text-ink/55">
        Se vores{" "}
        <a href="/privatliv" className="underline underline-offset-4">
          privatlivspolitik
        </a>
        .
      </p>
    </AuthShell>
  );
}
