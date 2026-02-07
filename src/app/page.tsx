export default function Home() {
  return (
    <main className="px-6 py-12 sm:px-10">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-between gap-12">
        <header className="space-y-6">
          <p className="text-sm uppercase tracking-[0.3em] text-moss">
            Holdbold / MVP
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-ink sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
            Kalender, tilmelding og bødekasse
            <span className="block text-ember">bygget til hold, der møder op.</span>
          </h1>
          <p className="max-w-2xl text-lg text-ink/80">
            Den første version fokuserer på faste træninger, kampkalender, klare deadlines og et bødesystem med godkendelse.
          </p>
        </header>

        <section className="card grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Roller i MVP</h2>
            <ul className="text-ink/80">
              <li>Admin</li>
            <li>Træner</li>
              <li>Spiller</li>
              <li>Bødekasseformand</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Bødeflow</h2>
            <ul className="text-ink/80">
              <li>Automatisk bøde ved overskredet deadline</li>
              <li>Manuelle bøder fra admin/træner</li>
              <li>Foreslåede bøder fra spillere (kræver godkendelse)</li>
            </ul>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/login"
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-fog"
          >
            Log ind
          </a>
          <p className="text-sm text-ink/70">
            Admin importerer DBU-kalender via URL fra admin-området.
          </p>
        </div>
      </div>
    </main>
  );
}
