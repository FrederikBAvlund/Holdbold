import Image from "next/image";

const features = [
  { t: "Samlet kalender", d: "Kampe, træning og møder – med tilmelding med ét tryk." },
  { t: "Bødekasse", d: "Skabeloner, status og betaling, der er nemme at følge." },
  { t: "Notifikationer", d: "Alle ved, hvad der gælder, uden endnu en gruppechat." }
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-5 pb-10 pt-[max(1.5rem,env(safe-area-inset-top,0px))] sm:px-8">
      <header className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2.5">
          <Image src="/brand/holdbold-mark-ball.svg" alt="" width={40} height={40} className="h-9 w-9" priority />
          <span className="font-display text-xl font-bold tracking-tight text-ink">Holdbold</span>
        </span>
        <a href="/login" className="btn-ghost px-5">
          Log ind
        </a>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-7 py-14 sm:py-20">
        <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl">
          Holdlivet samlet i <span className="text-moss">én app</span>.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-ink/70">
          Overblik over kampe, træning og opgaver – med tilmelding, bøder og beskeder samlet, så I kan bruge tiden på
          holdet, ikke på administration.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href="/signup" className="btn-primary px-8">
            Opret bruger
          </a>
          <a href="/login" className="btn-ghost px-8">
            Log ind
          </a>
        </div>
      </section>

      <ul className="grid gap-3 sm:grid-cols-3">
        {features.map((f) => (
          <li key={f.t} className="card-soft">
            <p className="font-display font-semibold text-ink">{f.t}</p>
            <p className="mt-1 text-sm text-ink/65">{f.d}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-center text-sm text-ink/55">
        Ved brug af Holdbold accepterer du vores{" "}
        <a href="/privatliv" className="font-medium text-moss underline decoration-moss/30 underline-offset-4">
          privatlivspolitik
        </a>
        .
      </p>
    </main>
  );
}
