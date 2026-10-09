export const metadata = {
  title: "Slet dine data – Holdbold"
};

export default function SletDataPage() {
  return (
    <main className="px-3 pb-10 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:px-8 sm:py-10">
      <section className="rounded-[1.375rem] border border-line bg-surface shadow-[var(--shadow-sm)] mx-auto max-w-4xl space-y-6 p-5 sm:p-10">
        <header className="space-y-2">
          <h1 className="font-display text-3xl font-bold text-ink">Slet dine data</h1>
          <p className="text-sm text-ink/65">Instruktioner til sletning af dine data i Holdbold, også hvis du logger ind med Facebook.</p>
        </header>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Sådan anmoder du om sletning</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Send en mail til{" "}
              <a className="underline underline-offset-4" href="mailto:kontakt@holdbold.dk?subject=Slet%20mine%20data">
                kontakt@holdbold.dk
              </a>{" "}
              fra den e-mailadresse, der er knyttet til din Holdbold-bruger, med emnet &quot;Slet mine data&quot;.
            </li>
            <li>Skriv dit navn og navnet på dit hold, så vi kan finde din bruger.</li>
            <li>Vi bekræfter, at anmodningen kommer fra dig, og sletter derefter din bruger og de data, der hører til den.</li>
          </ol>
          <p>Du kan også bede din holdadministrator om at fjerne dig fra holdet.</p>
        </section>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Hvad bliver slettet</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Din brugerprofil: navn, e-mail og profilbillede</li>
            <li>Den forbindelse til Facebook, der bruges til login (Facebook-id og tilknyttede loginoplysninger)</li>
            <li>Dine medlemskaber, tilmeldinger og notifikationer</li>
          </ul>
          <p>
            Data, som holdet har brug for til sin historik, fx bøder og afholdte begivenheder, kan blive gemt uden
            kobling til dig, hvis det er sagligt nødvendigt.
          </p>
        </section>

        <section className="space-y-2 text-ink/80">
          <h2 className="text-xl font-semibold text-ink">Fjern Holdbold fra din Facebook-konto</h2>
          <p>
            Du kan til enhver tid fjerne Holdbold fra din Facebook-konto under Facebook-indstillinger → Apps og
            websteder. Det stopper login med Facebook, men sletter ikke din bruger i Holdbold. Det kræver en anmodning som
            beskrevet ovenfor.
          </p>
        </section>

        <p className="text-sm text-ink/65">
          Læs mere i vores{" "}
          <a className="underline underline-offset-4" href="/privatliv">
            privatlivspolitik
          </a>
          .
        </p>
      </section>
    </main>
  );
}
