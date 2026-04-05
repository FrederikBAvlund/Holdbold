"use client";

import { useEffect, useState } from "react";

export default function SignupPage() {
  const [slugFromLink, setSlugFromLink] = useState("");
  const slugLocked = slugFromLink.length > 0;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
          phone: phone || undefined,
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
        setMessage(data?.message ?? "Bruger oprettet. Afventer godkendelse fra admin.");
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
    <main className="min-h-screen px-4 py-10 sm:px-6">
      <div className="card mx-auto max-w-xl">
        <h1 className="text-3xl font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
          Opret bruger
        </h1>
        <p className="mt-2 text-ink/70">Udfyld navn, slug, email/telefon og adgangskode.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            <label className="label">Telefon*</label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="input mt-2"
              placeholder="+45..."
              required
            />
            {fieldErrors.phone ? <p className="mt-2 text-sm text-red-600">{fieldErrors.phone}</p> : null}
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
      </div>
    </main>
  );
}
