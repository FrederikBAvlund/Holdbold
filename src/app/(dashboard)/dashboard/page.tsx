export default function DashboardHome() {
  return (
    <section className="space-y-6">
      <header className="card">
        <h2 className="text-2xl font-semibold text-ink">Velkommen tilbage</h2>
        <p className="mt-2 text-ink/70">
          Her får du et hurtigt overblik. Brug menuen til venstre for kalender, bøder og indstillinger.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Næste begivenhed</h3>
          <p className="mt-2 text-sm text-ink/70">Ingen begivenheder endnu.</p>
        </div>
        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Bøder i vente</h3>
          <p className="mt-2 text-sm text-ink/70">Ingen bøder.</p>
        </div>
        <div className="card-soft">
          <h3 className="text-lg font-semibold text-ink">Tilmeldinger</h3>
          <p className="mt-2 text-sm text-ink/70">0 nye tilmeldinger siden sidst.</p>
        </div>
      </div>
    </section>
  );
}
