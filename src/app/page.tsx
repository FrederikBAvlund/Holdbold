import Image from "next/image";

const highlights = ["Kalender & serier", "Bødekasse", "Notifikationer", "Hold på farten"];

export default function Home() {
  return (
    <main className="min-h-screen px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top,0px))] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-10">
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap gap-2">
              {highlights.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-ink/10 bg-white/55 px-3.5 py-1.5 text-xs font-semibold text-ink/75 shadow-sm backdrop-blur-sm"
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="space-y-5">
              <h1 className="font-display text-[2.15rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.25rem]">
                Holdlivet samlet i{" "}
                <span className="bg-gradient-to-r from-moss to-[color:var(--color-button)] bg-clip-text text-transparent">
                  én app
                </span>
                .
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-ink/75 sm:text-xl">
                Overblik over kampe, træning og opgaver — med tilmelding, bøder og beskeder samlet, så I kan bruge
                tiden på holdet, ikke på administration.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a href="/login" className="btn-primary min-h-[3rem] min-w-[9.5rem] px-8 text-center">
                Log ind
              </a>
              <a href="/signup" className="btn-ghost min-h-[3rem] min-w-[9.5rem] px-6 text-center">
                Opret bruger
              </a>
            </div>

            <p className="text-sm text-ink/60">
              Ved brug af Holdbold accepterer du vores{" "}
              <a href="/privatliv" className="font-medium text-moss underline decoration-moss/30 underline-offset-4 hover:decoration-moss">
                privatlivspolitik
              </a>
              .
            </p>
          </div>

          <div className="relative lg:pl-4">
            <div className="pointer-events-none absolute -left-6 top-1/2 hidden h-[85%] w-[110%] -translate-y-1/2 rounded-[2rem] bg-gradient-to-br from-moss/20 via-transparent to-ember/15 blur-3xl lg:block" />
            <div className="card relative overflow-hidden p-7 shadow-[0_28px_60px_-34px_rgba(15,23,42,0.45)] sm:p-10">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-moss/15 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-ember/10 blur-3xl" />

              <div className="relative space-y-8">
                <Image
                  src="/brand/holdbold-logo-ball.svg"
                  alt="Holdbold"
                  width={560}
                  height={150}
                  className="h-auto w-full max-w-[420px]"
                  priority
                />

                <ul className="space-y-4 border-t border-ink/10 pt-8">
                  {[
                    { t: "Samlet kalender", d: "Serier, enkeltkampe og møder ét sted." },
                    { t: "Klar kommunikation", d: "Notifikationer, så alle ved, hvad der gælder." },
                    { t: "Fair bøder", d: "Skabeloner og status, der er nemme at følge." }
                  ].map((row) => (
                    <li key={row.t} className="flex gap-4">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br from-moss to-[color:var(--color-button)] shadow-sm ring-2 ring-white" />
                      <div>
                        <p className="font-semibold text-ink">{row.t}</p>
                        <p className="mt-0.5 text-sm text-ink/65">{row.d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
