export default function PrivatlivPage() {
  return (
    <main className="px-3 pb-10 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-8 sm:py-10">
      <section className="rounded-[1.375rem] border border-line bg-surface shadow-[var(--shadow-sm)] mx-auto max-w-4xl space-y-6 p-5 sm:p-10">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-ink">
            Privatlivspolitik
          </h1>
          <p className="text-sm text-ink/65">Sidst opdateret: 6. april 2026</p>
        </header>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Hvilke data vi gemmer</h2>
          <p>Vi gemmer kun de data, der er nødvendige for at drive Holdbold:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Navn</li>
            <li>Email</li>
            <li>Krypteret adgangskode (password hash)</li>
            <li>Midlertidige engangskoder til login (kun som hash, de udløber efter 10 minutter)</li>
            <li>Holdmedlemskab, roller, tilmeldinger, bøder og notifikationer</li>
          </ul>
        </section>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Formål</h2>
          <p>
            Data bruges til login, administration af hold, kommunikation i appen og historik for aktiviteter i
            systemet.
          </p>
        </section>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Deling af data</h2>
          <p>
            Vi sælger ikke persondata. Data deles kun med de tekniske underdatabehandlere, der driver platformen
            (hosting og database).
          </p>
        </section>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Opbevaring og sikkerhed</h2>
          <p>
            Vi opbevarer data, så længe du har en bruger på et hold. Bliver du fjernet fra dit sidste hold, eller
            beder du om sletning, slettes din bruger og alle data, der hører til den. Adgangskoder opbevares aldrig i
            klartekst.
          </p>
        </section>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Dine rettigheder</h2>
          <p>
            Du kan anmode om indsigt, rettelse eller sletning af dine data. Kontakt din holdadministrator eller os
            direkte. Se{" "}
            <a className="underline underline-offset-4" href="/slet-data">
              instruktioner til sletning af data
            </a>
            .
          </p>
        </section>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Kontakt</h2>
          <p>
            Har du spørgsmål om databehandling, kan du kontakte os på{" "}
            <a className="underline underline-offset-4" href="mailto:kontakt@holdbold.dk">
              kontakt@holdbold.dk
            </a>
            .
          </p>
        </section>
      </section>
    </main>
  );
}
