"use client";

import AuthShell from "@/components/AuthShell";
import Button from "@/components/ui/Button";
import { inputClass } from "@/components/ui/primitives";
import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
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
  const [facebookEnabled, setFacebookEnabled] = useState(false);

  useEffect(() => {
    getProviders()
      .then((providers) => setFacebookEnabled(Boolean(providers?.facebook)))
      .catch(() => setFacebookEnabled(false));
  }, []);

  function handleFacebook() {
    const slug = teamSlug.trim().toLowerCase();
    if (!slug) {
      setFieldErrors({ teamSlug: "Hold slug er paakraevet" });
      setMessage("Udfyld holdslug, før du fortsætter med Facebook.");
      return;
    }
    signIn("facebook", { callbackUrl: `/join?slug=${encodeURIComponent(slug)}` });
  }

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
    <AuthShell title="Opret bruger" subtitle="Navn, email, adgangskode og hold – så er du klar.">
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink/80">Navn*</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
          required
        />
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
        <label className="mb-1.5 block text-sm font-semibold text-ink/80">Adgangskode*</label>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          className={inputClass}
          required
        />
        {fieldErrors.password ? <p className="mt-2 text-sm text-danger">{fieldErrors.password}</p> : null}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink/80">Gentag adgangskode*</label>
        <input
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          onBlur={() => validatePassword()}
          type="password"
          className={inputClass}
          required
        />
        {fieldErrors.confirmPassword ? <p className="mt-2 text-sm text-danger">{fieldErrors.confirmPassword}</p> : null}
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-ink/80">Hold slug*</label>
        <input
          value={teamSlug}
          onChange={(event) => setTeamSlug(event.target.value)}
          className={inputClass}
          placeholder="bk_skjold"
          readOnly={slugLocked}
          required
        />
        {slugLocked ? (
          <p className="mt-2 text-xs text-ink/60">Holdslug er udfyldt fra invitationslink og kan ikke ændres.</p>
        ) : null}
        {fieldErrors.teamSlug ? <p className="mt-2 text-sm text-danger">{fieldErrors.teamSlug}</p> : null}
      </div>
      <Button type="submit" size="lg" block loading={loading}>
        Opret bruger
      </Button>
    </form>

      {facebookEnabled ? (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-ink/45">
            <span className="h-px flex-1 bg-line" />
            eller
            <span className="h-px flex-1 bg-line" />
          </div>
          <Button variant="secondary" block onClick={handleFacebook}>
            Opret med Facebook
          </Button>
        </>
      ) : null}

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
