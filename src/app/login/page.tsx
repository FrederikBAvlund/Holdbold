"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("identifier") ?? "");
    const password = String(formData.get("password") ?? "");
    await signIn("credentials", { identifier, password, callbackUrl: "/dashboard" });
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
          <p className="mt-2 text-ink/70">Brug email eller telefon.</p>

          <form onSubmit={handleCredentials} className="mt-6 space-y-4">
            <input name="identifier" placeholder="Email eller telefon" className="input" />
            <input name="password" type="password" placeholder="Adgangskode" className="input" />
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Logger ind..." : "Log ind"}
            </button>
          </form>

          {process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET ? (
            <>
              <div className="my-6 border-t border-ink/10" />
              <button className="btn-ghost w-full" onClick={() => signIn("facebook", { callbackUrl: "/dashboard" })}>
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
        </div>
      </div>
    </main>
  );
}
